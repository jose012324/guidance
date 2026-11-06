"""
Accounts views — public authentication, account settings, global search,
logout, and audit log helpers.

Routes (accounts/urls.py):
    /                       → landing (public)
    /login/                 → login
    /register/              → register
    /logout/                → logout
    /account/               → account settings (profile + password)
    /search/                → global search JSON
"""
from django.conf import settings
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Q
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect, StreamingHttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.utils.http import http_date
from django.views.decorators.http import require_http_methods

from .forms import LoginForm, RegistrationForm, ProfileForm, CustomPasswordChangeForm
from .models import User, LoginAttempt, LoginLog, SystemLog
from .permissions import can


# ===========================================================================
# Landing page (Phase 3)
# ===========================================================================
def landing(request):
    """Public landing page with hero, features, statistics preview, footer."""
    # Quick stats — fail-safe if tables don't exist yet (pre-migration)
    try:
        from students.models import Student
        from counseling.models import CounselingSession
        from referrals.models import Referral
        stats = {
            'students': Student.objects.count(),
            'sessions': CounselingSession.objects.count(),
            'referrals': Referral.objects.count(),
        }
    except Exception:
        stats = {'students': 0, 'sessions': 0, 'referrals': 0}

    return render(request, 'public/landing.html', {'stats': stats})


# ===========================================================================
# Desktop app download
# ===========================================================================
def download_desktop_app(request):
    """Stream the latest Windows installer from the private/ folder.

    The installer is intentionally kept outside static/ and media/ so it can
    only be served through this view (which also records the download).

    Supports HTTP Range requests so interrupted downloads on slow/unstable
    connections RESUME from where they left off instead of restarting the
    whole file. Django's FileResponse ignores the ``Range`` header and always
    replies 200 with the full body, which is why big installers kept
    restarting; here we honour ``Range`` and reply 206 Partial Content.
    """
    private_dir = settings.BASE_DIR / 'private'
    installers = sorted(
        private_dir.glob('*.exe'),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    ) if private_dir.is_dir() else []

    if not installers:
        messages.error(
            request,
            'The desktop installer is not available yet. Please contact the administrator.'
        )
        return redirect('accounts:landing')

    installer = installers[0]
    stat = installer.stat()
    file_size = stat.st_size
    # Stable validator: only changes when the file itself changes.
    etag = f'"{int(stat.st_mtime)}-{file_size}"'

    # Only log the initial request (byte 0 / no Range) so a resumed or
    # multi-connection download doesn't spam the audit trail.
    range_header = request.headers.get('Range', '')
    if not range_header:
        SystemLog.log(
            user=request.user if request.user.is_authenticated else None,
            action=SystemLog.ACTION_EXPORT, entity='DesktopApp',
            entity_id=installer.name,
            description=f'Downloaded desktop installer: {installer.name}',
            request=request,
        )

    start, end = 0, file_size - 1
    status = 200
    # Parse a single-range request of the form "bytes=start-end".
    if range_header.startswith('bytes='):
        try:
            range_spec = range_header.split('=', 1)[1].split(',')[0].strip()
            start_str, _, end_str = range_spec.partition('-')
            if start_str:
                start = int(start_str)
                end = int(end_str) if end_str else file_size - 1
            elif end_str:
                # Suffix range: "bytes=-N" → last N bytes.
                start = max(0, file_size - int(end_str))
                end = file_size - 1
            end = min(end, file_size - 1)
            if start > end or start >= file_size:
                resp = HttpResponse(status=416)  # Range Not Satisfiable
                resp['Content-Range'] = f'bytes */{file_size}'
                return resp
            status = 206
        except (ValueError, IndexError):
            start, end, status = 0, file_size - 1, 200

    length = end - start + 1

    def file_iterator(chunk=8192):
        with installer.open('rb') as fh:
            fh.seek(start)
            remaining = length
            while remaining > 0:
                data = fh.read(min(chunk, remaining))
                if not data:
                    break
                remaining -= len(data)
                yield data

    response = StreamingHttpResponse(
        file_iterator(),
        status=status,
        content_type='application/octet-stream',
    )
    response['Content-Length'] = str(length)
    response['Content-Disposition'] = f'attachment; filename="{installer.name}"'
    response['Accept-Ranges'] = 'bytes'
    response['ETag'] = etag
    response['Last-Modified'] = http_date(stat.st_mtime)
    if status == 206:
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
    return response


# ===========================================================================
# Registration (Phase 4)
# ===========================================================================
def register(request):
    """Self-service account creation — accounts default to PENDING status."""
    if request.user.is_authenticated:
        return redirect('dashboard:home')

    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            SystemLog.log(
                user=user, action=SystemLog.ACTION_CREATE, entity='User',
                entity_id=user.pk, description=f'New account registered: {user.username}',
                request=request,
            )
            messages.success(
                request,
                'Your account has been created and is now pending administrator approval. '
                'You will be able to log in once approved.'
            )
            return redirect('accounts:login')
    else:
        form = RegistrationForm()

    return render(request, 'public/register.html', {'form': form})


# ===========================================================================
# Login (Phase 5)
# ===========================================================================
def login_view(request):
    """Login with username OR email + remember-me + lockout protection."""
    if request.user.is_authenticated:
        return redirect('dashboard:home')

    locked = request.GET.get('locked') == '1'

    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username'].strip()
            password = form.cleaned_data['password']
            remember = form.cleaned_data['remember_me']

            # Allow login by either username or email
            user_obj = None
            if '@' in username:
                try:
                    user_obj = User.objects.get(email__iexact=username)
                except User.DoesNotExist:
                    user_obj = None
                if user_obj:
                    username = user_obj.username

            user = authenticate(request, username=username, password=password)

            ip = _get_client_ip(request)
            ua = request.META.get('HTTP_USER_AGENT', '')

            if user is None:
                # Record failed attempt
                LoginAttempt.objects.create(
                    username=username, ip_address=ip, success=False,
                )
                LoginLog.objects.create(
                    username_attempted=username, action=LoginLog.ACTION_FAILED,
                    ip_address=ip, user_agent=ua,
                )
                messages.error(request, 'Invalid username or password.')
                return render(request, 'public/login.html', {'form': form, 'locked': locked})

            # Check account status before logging in
            if user.status == User.STATUS_PENDING:
                messages.error(request, 'Your account is pending administrator approval.')
                return render(request, 'public/login.html', {'form': form, 'locked': locked})
            if user.status == User.STATUS_LOCKED:
                messages.error(request, 'Your account has been locked. Please contact the administrator.')
                return render(request, 'public/login.html', {'form': form, 'locked': locked})
            if user.status == User.STATUS_INACTIVE:
                messages.error(request, 'Your account has been deactivated. Please contact the administrator.')
                return render(request, 'public/login.html', {'form': form, 'locked': locked})

            auth_login(request, user)
            # Successful attempt log
            LoginAttempt.objects.create(username=username, ip_address=ip, success=True)
            # Session expiry based on remember-me
            if not remember:
                request.session.set_expiry(0)  # expires on browser close
            else:
                request.session.set_expiry(60 * 60 * 24 * 7)  # 7 days
            # Redirect (validated — prevents open-redirect via ?next=https://evil.com)
            from django.utils.http import url_has_allowed_host_and_scheme
            next_url = request.GET.get('next') or request.POST.get('next')
            if not (next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()})):
                next_url = None
            SystemLog.log(
                user=user, action=SystemLog.ACTION_LOGIN, entity='User',
                entity_id=user.pk, description=f'User logged in: {user.username}',
                request=request,
            )
            return redirect(next_url or 'dashboard:home')
    else:
        form = LoginForm()

    return render(request, 'public/login.html', {'form': form, 'locked': locked})


# ===========================================================================
# Logout (Phase 27) — confirmation handled client-side by main.js
# ===========================================================================
def logout_view(request):
    """Destroy session, record logout time, redirect to login."""
    if request.method == 'POST':
        user = request.user
        # Capture identity BEFORE auth_logout — afterwards request.user is anonymous
        was_authenticated = user.is_authenticated
        SystemLog.log(
            user=user if was_authenticated else None,
            action=SystemLog.ACTION_LOGOUT, entity='User',
            entity_id=user.pk if was_authenticated else None,
            description=f'User logged out: {user.username}' if was_authenticated else 'Anonymous logout attempt',
            request=request,
        )
        auth_logout(request)
        messages.success(request, 'You have been successfully logged out.')
        return redirect('accounts:login')
    # GET shows confirmation page (also accessible via SweetAlert in topbar)
    return render(request, 'public/logout.html')


# ===========================================================================
# Account settings (Phase 26)
# ===========================================================================
@login_required
def account_settings(request):
    """User-self profile + password change + avatar upload."""
    user = request.user
    profile_form = ProfileForm(instance=user)
    password_form = CustomPasswordChangeForm(user)

    if request.method == 'POST':
        action = request.POST.get('action', 'profile')
        if action == 'profile':
            profile_form = ProfileForm(request.POST, request.FILES, instance=user)
            if profile_form.is_valid():
                profile_form.save()
                SystemLog.log(
                    user=user, action=SystemLog.ACTION_UPDATE, entity='User',
                    entity_id=user.pk, description='Updated own profile', request=request,
                )
                messages.success(request, 'Your profile has been updated.')
                return redirect('accounts:account_settings')
        elif action == 'password':
            password_form = CustomPasswordChangeForm(user, request.POST)
            if password_form.is_valid():
                password_form.save()
                SystemLog.log(
                    user=user, action=SystemLog.ACTION_UPDATE, entity='User',
                    entity_id=user.pk, description='Changed own password', request=request,
                )
                messages.success(request, 'Your password has been changed.')
                return redirect('accounts:account_settings')

    return render(request, 'users/account_settings.html', {
        'profile_form': profile_form,
        'password_form': password_form,
    })


# ===========================================================================
# Global search (Phase 28) — JSON endpoint consumed by topbar search
# ===========================================================================
@login_required
def global_search(request):
    """Universal search across students, users, items, referrals, counseling."""
    q = request.GET.get('q', '').strip()
    if len(q) < 2:
        return JsonResponse([], safe=False)

    results = []

    # Students
    if can(request.user, 'students.view'):
        from students.models import Student
        for s in Student.objects.filter(
            Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(student_number__icontains=q)
        )[:5]:
            results.append({
                'type': 'student',
                'label': s.full_name,
                'subtitle': f'{s.student_number} • {s.grade_level}',
                'url': f'/students/{s.pk}/',
            })

    # Users (admin only)
    if can(request.user, 'users.view'):
        for u in User.objects.filter(
            Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q)
        )[:5]:
            results.append({
                'type': 'user',
                'label': u.full_name,
                'subtitle': f'{u.username} • {u.role.name if u.role_id else "—"}',
                'url': f'/users/{u.pk}/',
            })

    # Inventory items
    if can(request.user, 'inventory.view'):
        from inventory.models import InventoryItem
        for i in InventoryItem.objects.filter(
            Q(name__icontains=q) | Q(item_code__icontains=q) | Q(description__icontains=q)
        )[:5]:
            results.append({
                'type': 'item',
                'label': i.name,
                'subtitle': f'{i.item_code} • {i.quantity} {i.unit} in stock',
                'url': f'/inventory/{i.pk}/',
            })

    # Referrals
    if can(request.user, 'referrals.view'):
        from referrals.models import Referral
        for r in Referral.objects.filter(
            Q(student__first_name__icontains=q) | Q(student__last_name__icontains=q) | Q(reason__icontains=q)
        )[:5]:
            results.append({
                'type': 'referral',
                'label': f'Referral #{r.pk} — {r.student.full_name}',
                'subtitle': f'{r.get_status_display()} • {r.get_priority_display()} priority',
                'url': f'/referrals/{r.pk}/',
            })

    # Counseling sessions
    if can(request.user, 'counseling.view'):
        from counseling.models import CounselingSession
        for c in CounselingSession.objects.filter(
            Q(student__first_name__icontains=q) | Q(student__last_name__icontains=q) | Q(summary__icontains=q)
        )[:5]:
            results.append({
                'type': 'counseling',
                'label': f'Session — {c.student.full_name}',
                'subtitle': f'{c.get_concern_type_display()} • {c.session_date}',
                'url': f'/counseling/{c.pk}/',
            })

    return JsonResponse(results, safe=False)


# ===========================================================================
# Helpers
# ===========================================================================
def _get_client_ip(request):
    if request is None:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ===========================================================================
# Error handlers (registered in guidance_system/urls.py)
# ===========================================================================
def _handler404(request, exception=None):
    return render(request, 'errors/404.html', status=404)


def _handler403(request, exception=None):
    return render(request, 'errors/403.html', status=403)


def _handler500(request):
    return render(request, 'errors/500.html', status=500)
