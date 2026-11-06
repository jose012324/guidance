"""
Guidance Office Records Inventory Management System
REST API Layer (api.py)

This module exposes a JSON REST API that the Electron desktop app consumes.
It communicates with the existing Django views/models (the "backend logic")
and returns JSON responses — no HTML rendering happens here.

Authentication:
    * Session-based (cookie). The desktop app calls /api/auth/login/ first,
      then includes the session cookie in subsequent requests.
    * Token-style endpoints (/api/auth/me/) return the current user.

Conventions:
    * All endpoints prefixed with /api/
    * All responses use { success: bool, data?: any, error?: str, message?: str }
    * List endpoints accept ?search=&page=&per_page= for pagination
    * All POST/PUT/DELETE endpoints require CSRF token in header (X-CSRFToken)
"""
import json
from datetime import timedelta

from django.contrib.auth import authenticate, login as django_login, logout as django_logout
# from django.contrib.auth.decorators import login_required  # Replaced with api_login_required
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.http import JsonResponse, HttpResponseNotAllowed, HttpResponseBadRequest
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from accounts.models import User, Role, LoginAttempt, LoginLog, SystemLog
from accounts.permissions import can, role_required
from counseling.models import CounselingSession, CounselorNote
from configurations.models import SchoolSettings
from inventory.models import InventoryItem, StockMovement, BorrowedItem
from notifications.models import Notification
from referrals.models import Referral, ReferralUpdate
from reports.models import SavedReport
from students.models import Student, Guardian, StudentDocument, ActivityTimeline
from students.inventory_stats import get_student_inventory_data


# ===========================================================================
# Helpers
# ===========================================================================
def api_login_required(view_func):
    """Custom login_required that returns JSON 401 instead of redirect."""
    from functools import wraps
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return _err('Authentication required', status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


def _ok(data=None, message=None, **extra):
    """Standard success response."""
    payload = {'success': True}
    if data is not None:
        payload['data'] = data
    if message:
        payload['message'] = message
    payload.update(extra)
    return JsonResponse(payload, safe=False)


def _err(error, status=400, **extra):
    """Standard error response."""
    payload = {'success': False, 'error': error}
    payload.update(extra)
    return JsonResponse(payload, status=status, safe=False)


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _parse_json_body(request):
    """Parse a JSON request body, returning {} on empty/invalid."""
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None  # caller checks for None to detect bad JSON


def _user_dict(user, include_role=True):
    """Serialize a User to a JSON-safe dict."""
    if user is None or not user.is_authenticated:
        return None
    data = {
        'id': user.pk,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'middle_name': user.middle_name,
        'last_name': user.last_name,
        'full_name': user.full_name,
        'employee_id': user.employee_id,
        'contact_number': user.contact_number,
        'avatar': user.avatar.url if user.avatar else None,
        'status': user.status,
        'status_display': user.get_status_display(),
        'date_joined': user.date_joined.isoformat() if user.date_joined else None,
        'last_login': user.last_login.isoformat() if user.last_login else None,
        'is_superuser': user.is_superuser,
    }
    if include_role and user.role_id:
        data['role'] = {
            'id': user.role.pk,
            'name': user.role.name,
        }
    else:
        data['role'] = None
    return data


def _student_dict(s, include_relations=False):
    d = {
        'id': s.pk,
        'student_number': s.student_number,
        'first_name': s.first_name,
        'middle_name': s.middle_name,
        'last_name': s.last_name,
        'full_name': s.full_name,
        'gender': s.gender,
        'gender_display': s.get_gender_display(),
        'birthdate': s.birthdate.isoformat() if s.birthdate else None,
        'age': s.age,
        'address': s.address,
        'contact_number': s.contact_number,
        'grade_level': s.grade_level,
        'section': s.section,
        'school_year': s.school_year,
        'status': s.status,
        'status_display': s.get_status_display(),
        'created_at': s.created_at.isoformat() if s.created_at else None,
        'updated_at': s.updated_at.isoformat() if s.updated_at else None,
    }
    if include_relations:
        d['guardians'] = [{
            'id': g.pk, 'full_name': g.full_name,
            'relationship': g.relationship, 'relationship_display': g.get_relationship_display(),
            'contact_number': g.contact_number, 'email': g.email,
            'is_primary': g.is_primary,
        } for g in s.guardians.all()]
        d['counseling_count'] = s.counseling_sessions.count()
        d['referral_count'] = s.referrals.count()
    return d


def _session_dict(c):
    return {
        'id': c.pk,
        'student': _student_dict(c.student),
        'counselor': _user_dict(c.counselor),
        'session_date': c.session_date.isoformat(),
        'concern_type': c.concern_type,
        'concern_type_display': c.get_concern_type_display(),
        'status': c.status,
        'status_display': c.get_status_display(),
        'summary': c.summary,
        'notes': c.notes,
        'recommendations': c.recommendations,
        'follow_up_date': c.follow_up_date.isoformat() if c.follow_up_date else None,
        'created_at': c.created_at.isoformat() if c.created_at else None,
        'closed_at': c.closed_at.isoformat() if c.closed_at else None,
    }


def _referral_dict(r, include_updates=False):
    d = {
        'id': r.pk,
        'student': _student_dict(r.student),
        'referred_by': _user_dict(r.referred_by),
        'assigned_counselor': _user_dict(r.assigned_counselor) if r.assigned_counselor_id else None,
        'referral_type': r.referral_type,
        'referral_type_display': r.get_referral_type_display(),
        'priority': r.priority,
        'priority_display': r.get_priority_display(),
        'reason': r.reason,
        'description': r.description,
        'status': r.status,
        'status_display': r.get_status_display(),
        'referred_at': r.referred_at.isoformat(),
        'completed_at': r.completed_at.isoformat() if r.completed_at else None,
    }
    if include_updates:
        d['updates'] = [{
            'id': u.pk, 'author': _user_dict(u.author),
            'previous_status': u.previous_status, 'new_status': u.new_status,
            'note': u.note, 'created_at': u.created_at.isoformat(),
        } for u in r.updates.select_related('author').all()]
    return d


def _item_dict(i, include_relations=False):
    d = {
        'id': i.pk,
        'item_code': i.item_code,
        'name': i.name,
        'description': i.description,
        'category': i.category,
        'category_display': i.get_category_display(),
        'quantity': i.quantity,
        'unit': i.unit,
        'unit_display': i.get_unit_display(),
        'reorder_level': i.reorder_level,
        'stock_status': i.stock_status,
        'stock_status_display': i.stock_status_display,
        'created_at': i.created_at.isoformat() if i.created_at else None,
    }
    if include_relations:
        d['movements'] = [{
            'id': m.pk, 'movement_type': m.movement_type,
            'movement_type_display': m.get_movement_type_display(),
            'quantity': m.quantity, 'balance_after': m.balance_after,
            'note': m.note,
            'performed_by': _user_dict(m.performed_by) if m.performed_by_id else None,
            'timestamp': m.timestamp.isoformat(),
        } for m in i.movements.select_related('performed_by')[:20]]
        d['borrowed_records'] = [{
            'id': b.pk, 'borrower_name': b.borrower_name,
            'department': b.department, 'quantity': b.quantity,
            'borrow_date': b.borrow_date.isoformat(),
            'expected_return_date': b.expected_return_date.isoformat() if b.expected_return_date else None,
            'actual_return_date': b.actual_return_date.isoformat() if b.actual_return_date else None,
            'status': b.status, 'status_display': b.get_status_display(),
        } for b in i.borrowed_records.select_related('borrower_user')[:20]]
    return d


def _borrowed_dict(b):
    return {
        'id': b.pk,
        'borrower_name': b.borrower_name,
        'department': b.department,
        'borrower_user': _user_dict(b.borrower_user) if b.borrower_user_id else None,
        'item': _item_dict(b.item),
        'quantity': b.quantity,
        'borrow_date': b.borrow_date.isoformat(),
        'expected_return_date': b.expected_return_date.isoformat() if b.expected_return_date else None,
        'actual_return_date': b.actual_return_date.isoformat() if b.actual_return_date else None,
        'status': b.status,
        'status_display': b.get_status_display(),
        'notes': b.notes,
    }


def _notification_dict(n):
    return {
        'id': n.pk,
        'category': n.category,
        'category_display': n.get_category_display(),
        'priority': n.priority,
        'priority_display': n.get_priority_display(),
        'title': n.title,
        'message': n.message,
        'link': n.link,
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat(),
    }


def _paginate(qs, request, per_page=20):
    """Apply pagination to a queryset based on ?page=&per_page=."""
    try:
        page_num = int(request.GET.get('page', 1))
    except (TypeError, ValueError):
        page_num = 1
    try:
        per = int(request.GET.get('per_page', per_page))
    except (TypeError, ValueError):
        per = per_page
    per = max(1, min(per, 100))
    paginator = Paginator(qs, per)
    page = paginator.get_page(page_num)
    return {
        'items': list(page),
        'page': page.number,
        'per_page': per,
        'total_pages': paginator.num_pages,
        'total_count': paginator.count,
        'has_next': page.has_next(),
        'has_previous': page.has_previous(),
    }


# ===========================================================================
# AUTH ENDPOINTS
# ===========================================================================
@csrf_exempt
@require_http_methods(['POST'])
def auth_login(request):
    """POST /api/auth/login/ — authenticate user, start session."""
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    username = (data.get('username') or '').strip()
    password = data.get('password', '')
    remember = data.get('remember_me', False)
    if not username or not password:
        return _err('Username and password are required')

    # Allow login by either username or email
    if '@' in username:
        try:
            user_obj = User.objects.get(email__iexact=username)
            username = user_obj.username
        except User.DoesNotExist:
            return _err('Invalid credentials', status=401)

    # Brute-force lockout — same policy as the web login (LoginAttemptMiddleware)
    from django.conf import settings
    max_failures = getattr(settings, 'ACCOUNT_LOCKOUT_MAX_FAILURES', 5)
    window_min = getattr(settings, 'ACCOUNT_LOCKOUT_DURATION_MINUTES', 15)
    if LoginAttempt.count_recent_failures(username, minutes=window_min) >= max_failures:
        return _err('Too many failed login attempts. Please try again in a few minutes or contact the administrator.', status=423)

    user = authenticate(request, username=username, password=password)
    if user is None:
        LoginAttempt.objects.create(
            username=username, ip_address=_get_client_ip(request), success=False,
        )
        LoginLog.objects.create(
            username_attempted=username, action=LoginLog.ACTION_FAILED,
            ip_address=_get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )
        return _err('Invalid username or password', status=401)

    if user.status == User.STATUS_PENDING:
        return _err('Your account is pending administrator approval.', status=403)
    if user.status == User.STATUS_LOCKED:
        return _err('Your account has been locked. Contact the administrator.', status=403)
    if user.status == User.STATUS_INACTIVE:
        return _err('Your account has been deactivated.', status=403)

    django_login(request, user)
    LoginAttempt.objects.create(username=username, ip_address=_get_client_ip(request), success=True)
    if not remember:
        request.session.set_expiry(0)
    else:
        request.session.set_expiry(60 * 60 * 24 * 7)
    SystemLog.log(user=user, action=SystemLog.ACTION_LOGIN, entity='User',
                  entity_id=user.pk, description=f'API login: {user.username}', request=request)
    
    # Get CSRF token from cookie to return in response
    from django.middleware.csrf import get_token
    csrf_token = get_token(request)
    
    response = _ok({'user': _user_dict(user), 'csrf_token': csrf_token}, 'Login successful')
    return response


@csrf_exempt
@require_http_methods(['POST'])
def auth_logout(request):
    """POST /api/auth/logout/ — destroy session."""
    user = request.user if request.user.is_authenticated else None
    django_logout(request)
    if user:
        SystemLog.log(user=user, action=SystemLog.ACTION_LOGOUT, entity='User',
                      entity_id=user.pk, description=f'API logout: {user.username}', request=request)
    return _ok(message='Logged out successfully')


@require_http_methods(['GET'])
def auth_me(request):
    """GET /api/auth/me/ — current authenticated user."""
    if not request.user.is_authenticated:
        return _err('Not authenticated', status=401)
    return _ok({'user': _user_dict(request.user)})


@csrf_exempt
@require_http_methods(['POST'])
def auth_register(request):
    """POST /api/auth/register/ — self-service registration."""
    from accounts.forms import RegistrationForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = RegistrationForm(data)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    user = form.save()
    SystemLog.log(user=user, action=SystemLog.ACTION_CREATE, entity='User',
                  entity_id=user.pk, description=f'API registration: {user.username}', request=request)
    return _ok({'user': _user_dict(user)}, 'Account created — pending approval', status=201)


@require_http_methods(['GET'])
def csrf_token(request):
    """GET /api/csrf-token/ — return a fresh CSRF token.
    
    This endpoint is exempt from CSRF checks (it's a GET) and returns
    a token that the client can use in X-CSRFToken header for POST requests.
    It also sets the csrftoken cookie.
    """
    from django.middleware.csrf import get_token
    token = get_token(request)
    response = _ok({'csrf_token': token})
    response.set_cookie(
        'csrftoken', token,
        max_age=60 * 60 * 24 * 7,
        httponly=False,
        samesite='Lax',
    )
    return response


@require_http_methods(['GET'])
def roles_list(request):
    """GET /api/roles/ — list all available roles."""
    return _ok([{'id': r.pk, 'name': r.name, 'description': r.description} for r in Role.objects.all()])


# ===========================================================================
# DASHBOARD
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def dashboard_stats(request):
    """GET /api/dashboard/stats/ — KPI counts for the dashboard."""
    user = request.user
    total_students = Student.objects.count()
    active_students = Student.objects.filter(status=Student.STATUS_ACTIVE).count()
    sessions_total = CounselingSession.objects.count()
    sessions_open = CounselingSession.objects.exclude(status=CounselingSession.STATUS_CLOSED).count()
    referrals_total = Referral.objects.count()
    referrals_pending = Referral.objects.filter(status=Referral.STATUS_PENDING).count()
    inventory_total = InventoryItem.objects.count()
    borrowed_active = BorrowedItem.objects.exclude(status=BorrowedItem.STATUS_RETURNED).count()

    all_items = list(InventoryItem.objects.all())
    low_stock_items = [i for i in all_items if i.stock_status == 'low_stock']
    out_of_stock_items = [i for i in all_items if i.stock_status == 'out_of_stock']

    # Trend — last 6 months
    today = timezone.now().date()
    months = []
    for i in range(5, -1, -1):
        first = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        last = (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        months.append((first, last, first.strftime('%b')))
    counseling_trend = [{'label': label, 'value': CounselingSession.objects.filter(session_date__range=(f, l)).count()}
                        for f, l, label in months]
    referral_trend = [{'label': label, 'value': Referral.objects.filter(referred_at__date__range=(f, l)).count()}
                      for f, l, label in months]

    # Concern type distribution
    concern_counts = (CounselingSession.objects
                      .values('concern_type').annotate(count=Count('id')).order_by('concern_type'))
    concern_map = {row['concern_type']: row['count'] for row in concern_counts}
    concern_chart = []
    for code, label in CounselingSession.CONCERN_TYPES:
        concern_chart.append({'label': label, 'value': concern_map.get(code, 0)})

    activity_logs = [{
        'id': l.pk, 'action': l.action, 'action_display': l.get_action_display(),
        'entity': l.entity, 'entity_id': l.entity_id, 'description': l.description,
        'user': _user_dict(l.user) if l.user_id else None,
        'timestamp': l.timestamp.isoformat(),
    } for l in SystemLog.objects.select_related('user', 'user__role').order_by('-timestamp')[:12]]

    return _ok({
        'kpis': {
            'total_students': total_students,
            'active_students': active_students,
            'sessions_total': sessions_total,
            'sessions_open': sessions_open,
            'referrals_total': referrals_total,
            'referrals_pending': referrals_pending,
            'inventory_total': inventory_total,
            'borrowed_active': borrowed_active,
            'low_stock_count': len(low_stock_items),
            'out_of_stock_count': len(out_of_stock_items),
        },
        'counseling_trend': counseling_trend,
        'referral_trend': referral_trend,
        'concern_chart': concern_chart,
        'activity_logs': activity_logs,
        'low_stock_items': [_item_dict(i) for i in low_stock_items[:5]],
    })


# ===========================================================================
# USERS
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def users_list(request):
    """GET /api/users/ — paginated user list with filters."""
    if not can(request.user, 'users.view'):
        return _err('Permission denied', status=403)
    qs = User.objects.select_related('role').all()
    search = request.GET.get('search', '').strip()
    role_id = request.GET.get('role')
    status = request.GET.get('status')
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search) |
            Q(username__icontains=search) | Q(email__icontains=search) |
            Q(employee_id__icontains=search)
        )
    if role_id:
        qs = qs.filter(role_id=role_id)
    if status:
        qs = qs.filter(status=status)
    qs = qs.order_by('-date_joined')
    page = _paginate(qs, request)
    return _ok({
        'items': [_user_dict(u) for u in page['items']],
        'pagination': {k: page[k] for k in ('page', 'per_page', 'total_pages', 'total_count', 'has_next', 'has_previous')},
    })


@api_login_required
@require_http_methods(['GET'])
def user_detail(request, pk):
    if not can(request.user, 'users.view'):
        return _err('Permission denied', status=403)
    user = User.objects.filter(pk=pk).select_related('role').first()
    if not user:
        return _err('User not found', status=404)
    return _ok({'user': _user_dict(user), 'recent_logs': [
        {'id': l.pk, 'action': l.action, 'action_display': l.get_action_display(),
         'entity': l.entity, 'description': l.description, 'timestamp': l.timestamp.isoformat()}
        for l in user.system_logs.order_by('-timestamp')[:10]
    ]})


@api_login_required
@require_http_methods(['POST'])
def user_create(request):
    if not can(request.user, 'users.manage'):
        return _err('Permission denied', status=403)
    from accounts.forms import UserForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = UserForm(data)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    user = form.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_CREATE, entity='User',
                  entity_id=user.pk, description=f'API created user {user.username}', request=request)
    return _ok({'user': _user_dict(user)}, 'User created', status=201)


@api_login_required
@require_http_methods(['PUT', 'POST'])
def user_update(request, pk):
    if not can(request.user, 'users.manage'):
        return _err('Permission denied', status=403)
    user = User.objects.filter(pk=pk).first()
    if not user:
        return _err('User not found', status=404)
    from accounts.forms import UserForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = UserForm(data, instance=user)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    user = form.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='User',
                  entity_id=user.pk, description=f'API updated user {user.username}', request=request)
    return _ok({'user': _user_dict(user)}, 'User updated')


@api_login_required
@require_http_methods(['POST'])
def user_activate(request, pk):
    if not can(request.user, 'users.manage'):
        return _err('Permission denied', status=403)
    user = User.objects.filter(pk=pk).first()
    if not user:
        return _err('User not found', status=404)
    user.status = User.STATUS_ACTIVE
    user.is_active = True
    user.approved_by = request.user
    user.approved_at = timezone.now()
    user.save()
    return _ok({'user': _user_dict(user)}, 'User activated')


@api_login_required
@require_http_methods(['POST'])
def user_deactivate(request, pk):
    if not can(request.user, 'users.manage'):
        return _err('Permission denied', status=403)
    user = User.objects.filter(pk=pk).first()
    if not user:
        return _err('User not found', status=404)
    if user.pk == request.user.pk:
        return _err('You cannot deactivate your own account')
    user.status = User.STATUS_INACTIVE
    user.is_active = False
    user.save()
    return _ok({'user': _user_dict(user)}, 'User deactivated')


@api_login_required
@require_http_methods(['POST'])
def user_approve(request, pk):
    if not can(request.user, 'users.manage'):
        return _err('Permission denied', status=403)
    user = User.objects.filter(pk=pk).first()
    if not user:
        return _err('User not found', status=404)
    user.status = User.STATUS_ACTIVE
    user.is_active = True
    user.approved_by = request.user
    user.approved_at = timezone.now()
    user.save()
    return _ok({'user': _user_dict(user)}, 'User approved')


@api_login_required
@require_http_methods(['DELETE', 'POST'])
def user_delete(request, pk):
    if not can(request.user, 'users.manage'):
        return _err('Permission denied', status=403)
    user = User.objects.filter(pk=pk).first()
    if not user:
        return _err('User not found', status=404)
    if user.pk == request.user.pk:
        return _err('You cannot delete your own account')
    if user.is_superuser:
        return _err('You cannot delete a superuser')
    SystemLog.log(user=request.user, action=SystemLog.ACTION_DELETE, entity='User',
                  entity_id=user.pk, description=f'API deleted user {user.username}', request=request)
    user.delete()
    return _ok(message='User deleted')


# ===========================================================================
# STUDENTS
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def student_record_inventory(request):
    """GET /api/students/record-inventory/ — shared student overview."""
    if not can(request.user, 'students.view'):
        return _err('Permission denied', status=403)
    return _ok(get_student_inventory_data())


@api_login_required
@require_http_methods(['GET'])
def students_list(request):
    qs = Student.objects.all()
    search = request.GET.get('search', '').strip()
    grade = request.GET.get('grade_level')
    gender = request.GET.get('gender')
    status = request.GET.get('status')
    sy = request.GET.get('school_year')
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search) |
            Q(middle_name__icontains=search) | Q(student_number__icontains=search)
        )
    if grade:
        qs = qs.filter(grade_level=grade)
    if gender:
        qs = qs.filter(gender=gender)
    if status:
        qs = qs.filter(status=status)
    if sy:
        qs = qs.filter(school_year__icontains=sy)
    qs = qs.order_by('last_name', 'first_name')
    page = _paginate(qs, request)
    return _ok({
        'items': [_student_dict(s) for s in page['items']],
        'pagination': {k: page[k] for k in ('page', 'per_page', 'total_pages', 'total_count', 'has_next', 'has_previous')},
    })


@api_login_required
@require_http_methods(['GET'])
def student_lookup(request):
    """GET /api/students/lookup/?q=... — lightweight autocomplete for student
    pickers (counseling/referral forms). Returns up to 10 matches across
    first/middle/last name and student number, with a tiny payload — these
    results are streamed in via a debounced search box, not rendered into
    a full <select>, so the response stays small even with 1k+ students.
    """
    q = request.GET.get('q', '').strip()
    qs = Student.objects.all()
    if q:
        qs = qs.filter(
            Q(first_name__icontains=q) | Q(last_name__icontains=q) |
            Q(middle_name__icontains=q) | Q(student_number__icontains=q)
        )
    qs = qs.order_by('last_name', 'first_name')[:10]
    return _ok({
        'items': [{
            'id': s.pk,
            'student_number': s.student_number,
            'first_name': s.first_name,
            'middle_name': s.middle_name,
            'last_name': s.last_name,
            'full_name': s.full_name,
            'grade_level': s.grade_level,
            'section': s.section,
            'status': s.status,
        } for s in qs],
    })


@api_login_required
@require_http_methods(['GET'])
def student_detail(request, pk):
    s = Student.objects.filter(pk=pk).first()
    if not s:
        return _err('Student not found', status=404)
    data = _student_dict(s, include_relations=True)
    data['counseling_sessions'] = [_session_dict(c) for c in s.counseling_sessions.all()[:20]]
    data['referrals'] = [_referral_dict(r) for r in s.referrals.all()[:20]]
    data['activities'] = [{
        'id': a.pk, 'activity_type': a.activity_type,
        'activity_type_display': a.get_activity_type_display(),
        'title': a.title, 'description': a.description,
        'performed_by': _user_dict(a.performed_by) if a.performed_by_id else None,
        'timestamp': a.timestamp.isoformat(),
    } for a in s.activities.all()[:20]]
    data['documents'] = [{
        'id': d.pk, 'title': d.title, 'document_type': d.document_type,
        'document_type_display': d.get_document_type_display(),
        'file': d.file.url if d.file else None,
        'description': d.description,
        'uploaded_at': d.uploaded_at.isoformat(),
    } for d in s.documents.all()]
    return _ok({'student': data})


@api_login_required
@require_http_methods(['POST', 'PUT'])
def student_create(request):
    from students.forms import StudentForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = StudentForm(data)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    student = form.save(commit=False)
    student.created_by = request.user
    student.save()
    ActivityTimeline.objects.create(
        student=student, activity_type='profile', title='Student record created',
        description=f'Created by {request.user.full_name}', performed_by=request.user,
    )
    SystemLog.log(user=request.user, action=SystemLog.ACTION_CREATE, entity='Student',
                  entity_id=student.pk, description=f'API created student {student}', request=request)
    return _ok({'student': _student_dict(student)}, 'Student created', status=201)


@api_login_required
@require_http_methods(['PUT', 'POST'])
def student_update(request, pk):
    student = Student.objects.filter(pk=pk).first()
    if not student:
        return _err('Student not found', status=404)
    from students.forms import StudentForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = StudentForm(data, instance=student)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    student = form.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='Student',
                  entity_id=student.pk, description=f'API updated student {student}', request=request)
    return _ok({'student': _student_dict(student)}, 'Student updated')


@api_login_required
@require_http_methods(['DELETE', 'POST'])
def student_delete(request, pk):
    student = Student.objects.filter(pk=pk).first()
    if not student:
        return _err('Student not found', status=404)
    label = str(student)
    SystemLog.log(user=request.user, action=SystemLog.ACTION_DELETE, entity='Student',
                  entity_id=student.pk, description=f'API deleted student {label}', request=request)
    student.delete()
    return _ok(message='Student deleted')


# ---------------------------------------------------------------------------
# Guardians (sub-resource of Student)
# ---------------------------------------------------------------------------
@api_login_required
@require_http_methods(['POST'])
def guardian_add(request, pk):
    """POST /api/students/<pk>/guardians/add/ — add a guardian to a student."""
    student = Student.objects.filter(pk=pk).first()
    if not student:
        return _err('Student not found', status=404)
    from students.forms import GuardianForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = GuardianForm(data)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    guardian = form.save(commit=False)
    guardian.student = student
    guardian.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_CREATE, entity='Guardian',
                  entity_id=guardian.pk, description=f'API added guardian {guardian.full_name} to {student}', request=request)
    return _ok({'guardian': {
        'id': guardian.pk, 'full_name': guardian.full_name,
        'relationship': guardian.relationship, 'relationship_display': guardian.get_relationship_display(),
        'contact_number': guardian.contact_number, 'email': guardian.email,
        'address': guardian.address, 'is_primary': guardian.is_primary,
    }}, 'Guardian added', status=201)


@api_login_required
@require_http_methods(['DELETE', 'POST'])
def guardian_delete(request, pk, guardian_pk):
    """POST /api/students/<pk>/guardians/<guardian_pk>/delete/ — remove a guardian."""
    guardian = Guardian.objects.filter(pk=guardian_pk, student_id=pk).first()
    if not guardian:
        return _err('Guardian not found', status=404)
    SystemLog.log(user=request.user, action=SystemLog.ACTION_DELETE, entity='Guardian',
                  entity_id=guardian.pk, description=f'API deleted guardian {guardian.full_name}', request=request)
    guardian.delete()
    return _ok(message='Guardian deleted')


# ---------------------------------------------------------------------------
# Student Documents (sub-resource of Student)
# ---------------------------------------------------------------------------
@api_login_required
@require_http_methods(['POST'])
def document_add(request, pk):
    """POST /api/students/<pk>/documents/add/ — upload a document to a student.
    Accepts multipart/form-data (file upload) OR JSON (link-only).
    """
    student = Student.objects.filter(pk=pk).first()
    if not student:
        return _err('Student not found', status=404)
    title = request.POST.get('title', '').strip()
    document_type = request.POST.get('document_type', 'other')
    description = request.POST.get('description', '').strip()
    file = request.FILES.get('file')
    if not title or not file:
        return _err('title and file are required')
    doc = StudentDocument.objects.create(
        student=student, title=title, document_type=document_type,
        description=description, file=file, uploaded_by=request.user,
    )
    ActivityTimeline.objects.create(
        student=student, activity_type='document',
        title=f'Document uploaded: {doc.title}',
        performed_by=request.user,
    )
    SystemLog.log(user=request.user, action=SystemLog.ACTION_CREATE, entity='StudentDocument',
                  entity_id=doc.pk, description=f'API uploaded document {doc.title} for {student}', request=request)
    return _ok({'document': {
        'id': doc.pk, 'title': doc.title, 'document_type': doc.document_type,
        'document_type_display': doc.get_document_type_display(),
        'file': doc.file.url if doc.file else None,
        'description': doc.description,
        'uploaded_at': doc.uploaded_at.isoformat(),
    }}, 'Document uploaded', status=201)


@api_login_required
@require_http_methods(['DELETE', 'POST'])
def document_delete(request, pk, document_pk):
    """POST /api/students/<pk>/documents/<document_pk>/delete/ — remove a document."""
    doc = StudentDocument.objects.filter(pk=document_pk, student_id=pk).first()
    if not doc:
        return _err('Document not found', status=404)
    SystemLog.log(user=request.user, action=SystemLog.ACTION_DELETE, entity='StudentDocument',
                  entity_id=doc.pk, description=f'API deleted document {doc.title}', request=request)
    doc.delete()
    return _ok(message='Document deleted')


# ===========================================================================
# COUNSELING SESSIONS
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def counseling_list(request):
    qs = CounselingSession.objects.select_related('student', 'counselor')
    search = request.GET.get('search', '').strip()
    counselor_id = request.GET.get('counselor')
    concern = request.GET.get('concern_type')
    status = request.GET.get('status')
    if search:
        qs = qs.filter(
            Q(student__first_name__icontains=search) | Q(student__last_name__icontains=search) |
            Q(summary__icontains=search) | Q(notes__icontains=search)
        )
    if counselor_id:
        qs = qs.filter(counselor_id=counselor_id)
    if concern:
        qs = qs.filter(concern_type=concern)
    if status:
        qs = qs.filter(status=status)
    user = request.user
    if user.is_counselor and not user.is_administrator and not user.is_guidance_staff:
        qs = qs.filter(counselor=user)
    qs = qs.order_by('-session_date', '-created_at')
    page = _paginate(qs, request)
    return _ok({
        'items': [_session_dict(c) for c in page['items']],
        'pagination': {k: page[k] for k in ('page', 'per_page', 'total_pages', 'total_count', 'has_next', 'has_previous')},
    })


@api_login_required
@require_http_methods(['GET'])
def counseling_detail(request, pk):
    c = CounselingSession.objects.filter(pk=pk).select_related('student', 'counselor').first()
    if not c:
        return _err('Session not found', status=404)
    data = _session_dict(c)
    data['notes_list'] = [{
        'id': n.pk, 'author': _user_dict(n.author),
        'note': n.note, 'is_private': n.is_private,
        'created_at': n.created_at.isoformat(),
    } for n in c.counselor_notes.select_related('author').all()]
    return _ok({'session': data})


@api_login_required
@require_http_methods(['POST'])
def counseling_create(request):
    from counseling.forms import CounselingSessionForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = CounselingSessionForm(data)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    session = form.save(commit=False)
    session.created_by = request.user
    if not session.counselor_id:
        session.counselor = request.user
    session.save()
    ActivityTimeline.objects.create(
        student=session.student, activity_type='counseling',
        title=f'Counseling session: {session.get_concern_type_display()}',
        description=f'Session on {session.session_date} with {session.counselor.full_name}',
        performed_by=request.user, related_object_id=str(session.pk),
    )
    SystemLog.log(user=request.user, action=SystemLog.ACTION_CREATE, entity='CounselingSession',
                  entity_id=session.pk, description=f'API created counseling session for {session.student}', request=request)
    return _ok({'session': _session_dict(session)}, 'Session created', status=201)


@api_login_required
@require_http_methods(['PUT', 'POST'])
def counseling_update(request, pk):
    session = CounselingSession.objects.filter(pk=pk).first()
    if not session:
        return _err('Session not found', status=404)
    from counseling.forms import CounselingSessionForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = CounselingSessionForm(data, instance=session)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    session = form.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='CounselingSession',
                  entity_id=session.pk, description=f'API updated counseling session {session.pk}', request=request)
    return _ok({'session': _session_dict(session)}, 'Session updated')


@api_login_required
@require_http_methods(['POST'])
def counseling_close(request, pk):
    session = CounselingSession.objects.filter(pk=pk).first()
    if not session:
        return _err('Session not found', status=404)
    session.status = CounselingSession.STATUS_CLOSED
    session.closed_at = timezone.now()
    session.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='CounselingSession',
                  entity_id=session.pk, description=f'API closed session {session.pk}', request=request)
    return _ok({'session': _session_dict(session)}, 'Session closed')


@api_login_required
@require_http_methods(['POST'])
def counseling_add_note(request, pk):
    session = CounselingSession.objects.filter(pk=pk).first()
    if not session:
        return _err('Session not found', status=404)
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    note_text = (data.get('note') or '').strip()
    if not note_text:
        return _err('Note text is required')
    note = CounselorNote.objects.create(
        session=session, author=request.user, note=note_text,
        is_private=bool(data.get('is_private', False)),
    )
    return _ok({'note': {
        'id': note.pk, 'author': _user_dict(note.author),
        'note': note.note, 'is_private': note.is_private,
        'created_at': note.created_at.isoformat(),
    }}, 'Note added', status=201)


@api_login_required
@require_http_methods(['DELETE', 'POST'])
def counseling_delete(request, pk):
    session = CounselingSession.objects.filter(pk=pk).first()
    if not session:
        return _err('Session not found', status=404)
    SystemLog.log(user=request.user, action=SystemLog.ACTION_DELETE, entity='CounselingSession',
                  entity_id=session.pk, description=f'API deleted session {session.pk}', request=request)
    session.delete()
    return _ok(message='Session deleted')


# ===========================================================================
# REFERRALS
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def referrals_list(request):
    qs = Referral.objects.select_related('student', 'referred_by', 'assigned_counselor')
    search = request.GET.get('search', '').strip()
    status = request.GET.get('status')
    priority = request.GET.get('priority')
    rtype = request.GET.get('referral_type')
    if search:
        matching_types = [value for value, label in Referral.REFERRAL_TYPES if search.lower() in label.lower()]
        qs = qs.filter(
            Q(student__first_name__icontains=search) | Q(student__last_name__icontains=search) |
            Q(reason__icontains=search) | Q(description__icontains=search) |
            Q(referral_type__icontains=search) | Q(referral_type__in=matching_types)
        )
    if status:
        qs = qs.filter(status=status)
    if priority:
        qs = qs.filter(priority=priority)
    if rtype:
        qs = qs.filter(referral_type=rtype)
    user = request.user
    if user.is_counselor and not user.is_administrator and not user.is_guidance_staff:
        qs = qs.filter(assigned_counselor=user)
    qs = qs.order_by('-referred_at')
    page = _paginate(qs, request)
    return _ok({
        'items': [_referral_dict(r) for r in page['items']],
        'pagination': {k: page[k] for k in ('page', 'per_page', 'total_pages', 'total_count', 'has_next', 'has_previous')},
    })


@api_login_required
@require_http_methods(['GET'])
def referral_detail(request, pk):
    r = Referral.objects.filter(pk=pk).select_related('student', 'referred_by', 'assigned_counselor').first()
    if not r:
        return _err('Referral not found', status=404)
    return _ok({'referral': _referral_dict(r, include_updates=True)})


@api_login_required
@require_http_methods(['POST'])
def referral_create(request):
    from referrals.forms import ReferralForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = ReferralForm(data)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    referral = form.save(commit=False)
    if not referral.referred_by_id:
        referral.referred_by = request.user
    referral.save()
    ActivityTimeline.objects.create(
        student=referral.student, activity_type='referral',
        title=f'New referral: {referral.get_referral_type_display()}',
        description=f'Priority: {referral.get_priority_display()}. Reason: {referral.reason[:120]}',
        performed_by=request.user, related_object_id=str(referral.pk),
    )
    if referral.assigned_counselor_id:
        Notification.objects.create(
            user=referral.assigned_counselor,
            category=Notification.CATEGORY_NEW_REFERRAL,
            priority=Notification.PRIORITY_HIGH if referral.priority in ('high', 'urgent') else Notification.PRIORITY_NORMAL,
            title=f'New referral assigned: {referral.student.full_name}',
            message=f'You have been assigned a new {referral.get_referral_type_display()} referral.',
            link=f'/referrals/{referral.pk}/',
        )
    SystemLog.log(user=request.user, action=SystemLog.ACTION_CREATE, entity='Referral',
                  entity_id=referral.pk, description=f'API created referral #{referral.pk}', request=request)
    return _ok({'referral': _referral_dict(referral)}, 'Referral created', status=201)


@api_login_required
@require_http_methods(['PUT', 'POST'])
def referral_update(request, pk):
    referral = Referral.objects.filter(pk=pk).first()
    if not referral:
        return _err('Referral not found', status=404)
    from referrals.forms import ReferralForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = ReferralForm(data, instance=referral)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    referral = form.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='Referral',
                  entity_id=referral.pk, description=f'API updated referral #{referral.pk}', request=request)
    return _ok({'referral': _referral_dict(referral)}, 'Referral updated')


@api_login_required
@require_http_methods(['POST'])
def referral_add_update(request, pk):
    referral = Referral.objects.filter(pk=pk).first()
    if not referral:
        return _err('Referral not found', status=404)
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    new_status = data.get('new_status')
    note_text = (data.get('note') or '').strip()
    if not new_status:
        return _err('new_status is required')
    if not note_text:
        return _err('note is required')
    update = ReferralUpdate.objects.create(
        referral=referral, author=request.user,
        previous_status=referral.status, new_status=new_status, note=note_text,
    )
    referral.status = new_status
    if new_status == Referral.STATUS_COMPLETED:
        referral.completed_at = timezone.now()
    referral.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='Referral',
                  entity_id=referral.pk, description=f'API referral #{referral.pk} → {new_status}', request=request)
    return _ok({'update': {
        'id': update.pk, 'author': _user_dict(update.author),
        'previous_status': update.previous_status, 'new_status': update.new_status,
        'note': update.note, 'created_at': update.created_at.isoformat(),
    }}, 'Update added', status=201)


@api_login_required
@require_http_methods(['POST'])
def referral_close(request, pk):
    referral = Referral.objects.filter(pk=pk).first()
    if not referral:
        return _err('Referral not found', status=404)
    prev = referral.status
    referral.status = Referral.STATUS_COMPLETED
    referral.completed_at = timezone.now()
    referral.save()
    ReferralUpdate.objects.create(
        referral=referral, author=request.user, previous_status=prev,
        new_status=Referral.STATUS_COMPLETED, note='Referral closed.',
    )
    return _ok({'referral': _referral_dict(referral)}, 'Referral closed')


@api_login_required
@require_http_methods(['DELETE', 'POST'])
def referral_delete(request, pk):
    referral = Referral.objects.filter(pk=pk).first()
    if not referral:
        return _err('Referral not found', status=404)
    SystemLog.log(user=request.user, action=SystemLog.ACTION_DELETE, entity='Referral',
                  entity_id=referral.pk, description=f'API deleted referral #{referral.pk}', request=request)
    referral.delete()
    return _ok(message='Referral deleted')


# ===========================================================================
# INVENTORY
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def inventory_list(request):
    qs = InventoryItem.objects.all()
    search = request.GET.get('search', '').strip()
    category = request.GET.get('category')
    stock_status = request.GET.get('stock_status')
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(item_code__icontains=search) | Q(description__icontains=search))
    if category:
        qs = qs.filter(category=category)
    items = list(qs.order_by('name'))
    if stock_status:
        items = [i for i in items if i.stock_status == stock_status]
    page = _paginate(items, request)
    return _ok({
        'items': [_item_dict(i) for i in page['items']],
        'pagination': {k: page[k] for k in ('page', 'per_page', 'total_pages', 'total_count', 'has_next', 'has_previous')},
    })


@api_login_required
@require_http_methods(['GET'])
def inventory_detail(request, pk):
    item = InventoryItem.objects.filter(pk=pk).first()
    if not item:
        return _err('Item not found', status=404)
    return _ok({'item': _item_dict(item, include_relations=True)})


@api_login_required
@require_http_methods(['POST'])
def inventory_create(request):
    if not can(request.user, 'inventory.manage'):
        return _err('Permission denied', status=403)
    from inventory.forms import InventoryItemForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = InventoryItemForm(data)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    item = form.save(commit=False)
    item.created_by = request.user
    item.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_CREATE, entity='InventoryItem',
                  entity_id=item.pk, description=f'API created item {item}', request=request)
    return _ok({'item': _item_dict(item)}, 'Item created', status=201)


@api_login_required
@require_http_methods(['PUT', 'POST'])
def inventory_update(request, pk):
    if not can(request.user, 'inventory.manage'):
        return _err('Permission denied', status=403)
    item = InventoryItem.objects.filter(pk=pk).first()
    if not item:
        return _err('Item not found', status=404)
    from inventory.forms import InventoryItemForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = InventoryItemForm(data, instance=item)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    item = form.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='InventoryItem',
                  entity_id=item.pk, description=f'API updated item {item}', request=request)
    return _ok({'item': _item_dict(item)}, 'Item updated')


@api_login_required
@require_http_methods(['POST'])
def inventory_adjust(request, pk):
    """POST /api/inventory/<pk>/adjust/ — stock movement."""
    item = InventoryItem.objects.filter(pk=pk).first()
    if not item:
        return _err('Item not found', status=404)
    if not can(request.user, 'inventory.manage'):
        return _err('Permission denied', status=403)
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    movement_type = data.get('movement_type')
    quantity = data.get('quantity')
    note = data.get('note', '')
    if movement_type not in dict(StockMovement.MOVEMENT_CHOICES):
        return _err('Invalid movement_type')
    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        return _err('quantity must be an integer')
    if quantity <= 0:
        return _err('quantity must be positive')
    delta = -abs(quantity) if movement_type == StockMovement.MOVEMENT_OUT else abs(quantity)
    item.quantity = max(0, item.quantity + delta)
    item.save()
    movement = StockMovement.objects.create(
        item=item, movement_type=movement_type, quantity=abs(quantity),
        balance_after=item.quantity, note=note, performed_by=request.user,
    )
    # Low-stock notification
    if item.stock_status == 'low_stock':
        Notification.create_for_role(
            role_name='Administrator', category=Notification.CATEGORY_LOW_STOCK,
            priority=Notification.PRIORITY_NORMAL,
            title=f'Low stock alert: {item.name}',
            message=f'"{item.name}" is below reorder level ({item.quantity} {item.unit} left).',
            link=f'/inventory/{item.pk}/',
        )
    elif item.stock_status == 'out_of_stock':
        Notification.create_for_role(
            role_name='Administrator', category=Notification.CATEGORY_LOW_STOCK,
            priority=Notification.PRIORITY_HIGH,
            title=f'Out of stock: {item.name}',
            message=f'"{item.name}" is now OUT OF STOCK.',
            link=f'/inventory/{item.pk}/',
        )
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='InventoryItem',
                  entity_id=item.pk, description=f'API stock {movement_type}: {quantity} {item.unit}', request=request)
    return _ok({'item': _item_dict(item), 'movement': {
        'id': movement.pk, 'movement_type': movement.movement_type,
        'movement_type_display': movement.get_movement_type_display(),
        'quantity': movement.quantity, 'balance_after': movement.balance_after,
        'note': movement.note, 'timestamp': movement.timestamp.isoformat(),
    }}, 'Stock adjusted')


@api_login_required
@require_http_methods(['DELETE', 'POST'])
def inventory_delete(request, pk):
    if not can(request.user, 'inventory.manage'):
        return _err('Permission denied', status=403)
    item = InventoryItem.objects.filter(pk=pk).first()
    if not item:
        return _err('Item not found', status=404)
    SystemLog.log(user=request.user, action=SystemLog.ACTION_DELETE, entity='InventoryItem',
                  entity_id=item.pk, description=f'API deleted item {item}', request=request)
    item.delete()
    return _ok(message='Item deleted')


@api_login_required
@require_http_methods(['GET'])
def stock_monitoring(request):
    """GET /api/inventory/stock-monitoring/ — stock monitoring KPIs."""
    all_items = list(InventoryItem.objects.all())
    return _ok({
        'kpis': {
            'total': len(all_items),
            'available': sum(1 for i in all_items if i.stock_status == 'available'),
            'low_stock': sum(1 for i in all_items if i.stock_status == 'low_stock'),
            'out_of_stock': sum(1 for i in all_items if i.stock_status == 'out_of_stock'),
        },
        'low_stock': [_item_dict(i) for i in all_items if i.stock_status == 'low_stock'],
        'out_of_stock': [_item_dict(i) for i in all_items if i.stock_status == 'out_of_stock'],
    })


# ===========================================================================
# BORROWED ITEMS
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def borrowed_list(request):
    BorrowedItem.mark_overdue()
    qs = BorrowedItem.objects.select_related('item', 'borrower_user')
    search = request.GET.get('search', '').strip()
    status = request.GET.get('status')
    if search:
        qs = qs.filter(Q(borrower_name__icontains=search) | Q(item__name__icontains=search) | Q(item__item_code__icontains=search))
    if status:
        qs = qs.filter(status=status)
    qs = qs.order_by('-borrow_date')
    page = _paginate(qs, request)
    return _ok({
        'items': [_borrowed_dict(b) for b in page['items']],
        'pagination': {k: page[k] for k in ('page', 'per_page', 'total_pages', 'total_count', 'has_next', 'has_previous')},
    })


@api_login_required
@require_http_methods(['POST'])
def borrowed_create(request):
    if not can(request.user, 'inventory.manage'):
        return _err('Permission denied', status=403)
    from inventory.forms import BorrowedItemForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = BorrowedItemForm(data)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    record = form.save(commit=False)
    record.recorded_by = request.user
    record.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_CREATE, entity='BorrowedItem',
                  entity_id=record.pk, description=f'API borrowed {record.quantity} × {record.item}', request=request)
    return _ok({'item': _borrowed_dict(record)}, 'Borrowing recorded', status=201)


@api_login_required
@require_http_methods(['POST'])
def borrowed_return(request, pk):
    if not can(request.user, 'inventory.manage'):
        return _err('Permission denied', status=403)
    record = BorrowedItem.objects.filter(pk=pk).first()
    if not record:
        return _err('Borrowed record not found', status=404)
    data = _parse_json_body(request) or {}
    record.status = BorrowedItem.STATUS_RETURNED
    if data.get('actual_return_date'):
        try:
            record.actual_return_date = data['actual_return_date']
        except (ValueError, TypeError):
            pass
    if not record.actual_return_date:
        record.actual_return_date = timezone.now().date()
    if data.get('notes'):
        record.notes = data['notes']
    record.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='BorrowedItem',
                  entity_id=record.pk, description=f'API returned {record.item}', request=request)
    return _ok({'item': _borrowed_dict(record)}, 'Item returned')


# ===========================================================================
# NOTIFICATIONS
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def notifications_list(request):
    qs = Notification.objects.filter(user=request.user)
    filter_val = request.GET.get('filter', 'all')
    if filter_val == 'unread':
        qs = qs.filter(is_read=False)
    qs = qs.order_by('-created_at')
    page = _paginate(qs, request, per_page=20)
    return _ok({
        'items': [_notification_dict(n) for n in page['items']],
        'pagination': {k: page[k] for k in ('page', 'per_page', 'total_pages', 'total_count', 'has_next', 'has_previous')},
        'unread_count': Notification.objects.filter(user=request.user, is_read=False).count(),
    })


@api_login_required
@require_http_methods(['POST'])
def notification_mark_read(request, pk):
    n = Notification.objects.filter(pk=pk, user=request.user).first()
    if not n:
        return _err('Notification not found', status=404)
    n.is_read = True
    n.read_at = timezone.now()
    n.save()
    return _ok({'notification': _notification_dict(n)}, 'Marked as read')


@api_login_required
@require_http_methods(['POST'])
def notification_mark_all_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(
        is_read=True, read_at=timezone.now()
    )
    return _ok(message='All notifications marked as read')


@api_login_required
@require_http_methods(['GET'])
def notifications_unread_count(request):
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return _ok({'count': count})


# ===========================================================================
# REPORTS
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def reports_home(request):
    if not can(request.user, 'reports.view'):
        return _err('Permission denied', status=403)
    return _ok({'reports': [
        {'key': 'students', 'name': 'Student Record Report', 'icon': 'mortarboard', 'description': 'Record inventory summary of student records.'},
        {'key': 'counseling', 'name': 'Counseling Report', 'icon': 'chat-heart', 'description': 'All counseling sessions.'},
        {'key': 'referrals', 'name': 'Referral Report', 'icon': 'send-exclamation', 'description': 'All referrals.'},
        {'key': 'inventory', 'name': 'Inventory Report', 'icon': 'box-seam', 'description': 'Stock levels.'},
        {'key': 'borrowing', 'name': 'Borrowing Report', 'icon': 'arrow-left-right', 'description': 'Borrowing records.'},
        {'key': 'user_activity', 'name': 'User Activity Logs', 'icon': 'activity', 'description': 'Audit log.'},
    ]})


@api_login_required
@require_http_methods(['GET'])
def report_students(request):
    """Student Record Report — the same record-inventory summary the web
    report renders (KPI counts plus breakdowns), not a student listing."""
    if not can(request.user, 'reports.view'):
        return _err('Permission denied', status=403)
    return _ok(get_student_inventory_data())


@api_login_required
@require_http_methods(['GET'])
def report_counseling(request):
    if not can(request.user, 'reports.view'):
        return _err('Permission denied', status=403)
    qs = CounselingSession.objects.select_related('student', 'counselor', 'counselor__role').order_by('-session_date')
    return _ok({'items': [_session_dict(c) for c in qs], 'count': qs.count()})


@api_login_required
@require_http_methods(['GET'])
def report_referrals(request):
    if not can(request.user, 'reports.view'):
        return _err('Permission denied', status=403)
    qs = Referral.objects.select_related('student', 'referred_by', 'assigned_counselor', 'referred_by__role', 'assigned_counselor__role').order_by('-referred_at')
    return _ok({'items': [_referral_dict(r) for r in qs], 'count': qs.count()})


@api_login_required
@require_http_methods(['GET'])
def report_inventory(request):
    if not can(request.user, 'reports.view'):
        return _err('Permission denied', status=403)
    items = list(InventoryItem.objects.all().order_by('name'))
    return _ok({'items': [_item_dict(i) for i in items], 'count': len(items)})


@api_login_required
@require_http_methods(['GET'])
def report_borrowing(request):
    if not can(request.user, 'reports.view'):
        return _err('Permission denied', status=403)
    qs = BorrowedItem.objects.select_related('item').order_by('-borrow_date')
    return _ok({'items': [_borrowed_dict(b) for b in qs], 'count': qs.count()})


@api_login_required
@require_http_methods(['GET'])
def report_user_activity(request):
    if not request.user.is_administrator and not request.user.is_superuser:
        return _err('Permission denied', status=403)
    # select_related pulls in the role too — otherwise _user_dict fires one
    # extra query per log row (up to 500), which is enough to exhaust a small
    # production worker and get it OOM-killed.
    qs = SystemLog.objects.select_related('user', 'user__role').order_by('-timestamp')[:500]
    return _ok({'items': [{
        'id': l.pk, 'timestamp': l.timestamp.isoformat(),
        'user': _user_dict(l.user) if l.user_id else None,
        'action': l.action, 'action_display': l.get_action_display(),
        'entity': l.entity, 'entity_id': l.entity_id,
        'description': l.description, 'ip_address': l.ip_address,
    } for l in qs], 'count': qs.count()})


# ===========================================================================
# SETTINGS / SCHOOL INFO
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def school_settings(request):
    s = SchoolSettings.get_settings()
    return _ok({'settings': {
        'id': s.pk,
        'school_name': s.school_name,
        'school_logo': s.school_logo.url if s.school_logo else None,
        'school_address': s.school_address,
        'school_year': s.school_year,
        'contact_email': s.contact_email,
        'contact_phone': s.contact_phone,
        'system_title': s.system_title,
        'footer_text': s.footer_text,
        'default_theme': s.default_theme,
    }})


@require_http_methods(['GET'])
def school_public(request):
    """Public endpoint — no auth required (for login screen branding)."""
    s = SchoolSettings.get_settings()
    return _ok({'settings': {
        'school_name': s.school_name,
        'school_logo': s.school_logo.url if s.school_logo else None,
        'school_year': s.school_year,
        'system_title': s.system_title,
        'footer_text': s.footer_text,
        'default_theme': s.default_theme,
        'school_address': s.school_address,
        'contact_email': s.contact_email,
        'contact_phone': s.contact_phone,
    }})


@api_login_required
@require_http_methods(['PUT', 'POST'])
def school_settings_update(request):
    if not can(request.user, 'settings.manage'):
        return _err('Permission denied', status=403)
    from configurations.forms import SchoolSettingsForm
    s = SchoolSettings.get_settings()
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = SchoolSettingsForm(data, request.FILES, instance=s)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    s = form.save(commit=False)
    s.updated_by = request.user
    s.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='SchoolSettings',
                  entity_id=s.pk, description='API updated school settings', request=request)
    return _ok({'settings': {
        'id': s.pk, 'school_name': s.school_name,
        'school_logo': s.school_logo.url if s.school_logo else None,
        'school_address': s.school_address,
        'school_year': s.school_year,
        'contact_email': s.contact_email,
        'contact_phone': s.contact_phone,
        'system_title': s.system_title,
        'footer_text': s.footer_text,
        'default_theme': s.default_theme,
    }}, 'Settings updated')


@api_login_required
@require_http_methods(['POST'])
def school_logo_upload(request):
    """Handle logo upload separately (multipart/form-data)."""
    if not can(request.user, 'settings.manage'):
        return _err('Permission denied', status=403)
    s = SchoolSettings.get_settings()
    logo = request.FILES.get('school_logo')
    if not logo:
        return _err('No file uploaded')
    s.school_logo = logo
    s.updated_by = request.user
    s.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='SchoolSettings',
                  entity_id=s.pk, description='Updated school logo', request=request)
    return _ok({'school_logo': s.school_logo.url if s.school_logo else None}, 'Logo updated')


# ===========================================================================
# ACCOUNT (self-service)
# ===========================================================================
@api_login_required
@require_http_methods(['PUT', 'POST'])
def account_profile_update(request):
    from accounts.forms import ProfileForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = ProfileForm(data, request.FILES, instance=request.user)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    form.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='User',
                  entity_id=request.user.pk, description='API updated own profile', request=request)
    return _ok({'user': _user_dict(request.user)}, 'Profile updated')


@api_login_required
@require_http_methods(['POST'])
def account_avatar_upload(request):
    """Handle avatar upload separately (multipart/form-data)."""
    user = request.user
    avatar = request.FILES.get('avatar')
    if not avatar:
        return _err('No file uploaded')
    user.avatar = avatar
    user.save()
    SystemLog.log(user=user, action=SystemLog.ACTION_UPDATE, entity='User',
                  entity_id=user.pk, description='Updated own avatar', request=request)
    return _ok({'user': _user_dict(user)}, 'Avatar updated')


@api_login_required
@require_http_methods(['POST'])
def account_password_change(request):
    from accounts.forms import CustomPasswordChangeForm
    data = _parse_json_body(request)
    if data is None:
        return _err('Invalid JSON body')
    form = CustomPasswordChangeForm(request.user, data)
    if not form.is_valid():
        return _err('Validation failed', errors=form.errors)
    form.save()
    SystemLog.log(user=request.user, action=SystemLog.ACTION_UPDATE, entity='User',
                  entity_id=request.user.pk, description='API changed own password', request=request)
    return _ok(message='Password changed')


# ===========================================================================
# DATABASE (audit logs)
# ===========================================================================
@api_login_required
@require_http_methods(['GET'])
def audit_logs(request):
    if not can(request.user, 'database.manage'):
        return _err('Permission denied', status=403)
    qs = SystemLog.objects.select_related('user', 'user__role').all().order_by('-timestamp')
    entity = request.GET.get('entity')
    action = request.GET.get('action')
    if entity:
        qs = qs.filter(entity__icontains=entity)
    if action:
        qs = qs.filter(action=action)
    page = _paginate(qs, request, per_page=25)
    return _ok({
        'items': [{
            'id': l.pk, 'timestamp': l.timestamp.isoformat(),
            'user': _user_dict(l.user) if l.user_id else None,
            'action': l.action, 'action_display': l.get_action_display(),
            'entity': l.entity, 'entity_id': l.entity_id,
            'description': l.description, 'ip_address': l.ip_address,
        } for l in page['items']],
        'pagination': {k: page[k] for k in ('page', 'per_page', 'total_pages', 'total_count', 'has_next', 'has_previous')},
        'entities': list(SystemLog.objects.values_list('entity', flat=True).distinct()),
        'actions': [{'value': v, 'label': l} for v, l in SystemLog.ACTION_CHOICES],
        'summary': {
            'total_logs': SystemLog.objects.count(),
            'total_logins': LoginLog.objects.count(),
            'logins_today': LoginLog.objects.filter(action='login', timestamp__date=timezone.now().date()).count(),
            'failed_logins': LoginLog.objects.filter(action='failed').count(),
        },
    })


@api_login_required
@require_http_methods(['GET'])
def audit_login_logs(request):
    if not can(request.user, 'database.manage'):
        return _err('Permission denied', status=403)
    qs = LoginLog.objects.select_related('user', 'user__role').all().order_by('-timestamp')
    page = _paginate(qs, request, per_page=25)
    return _ok({
        'items': [{
            'id': l.pk, 'username_attempted': l.username_attempted,
            'action': l.action, 'action_display': l.get_action_display(),
            'user': _user_dict(l.user) if l.user_id else None,
            'ip_address': l.ip_address, 'user_agent': l.user_agent,
            'timestamp': l.timestamp.isoformat(),
        } for l in page['items']],
        'pagination': {k: page[k] for k in ('page', 'per_page', 'total_pages', 'total_count', 'has_next', 'has_previous')},
    })


# ---------------------------------------------------------------------------
# Database backup
# ---------------------------------------------------------------------------
@api_login_required
@require_http_methods(['POST'])
def database_backup(request):
    """POST /api/database/backup/ — create a SQLite backup file and return it for download."""
    import os, shutil
    from datetime import datetime
    from django.conf import settings
    from django.http import HttpResponse

    if not can(request.user, 'database.manage'):
        return _err('Permission denied', status=403)

    db_path = settings.DATABASES['default']['NAME']
    backup_dir = os.path.join(settings.BASE_DIR, 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_filename = f'db_backup_{timestamp}.sqlite3'
    backup_path = os.path.join(backup_dir, backup_filename)
    try:
        shutil.copy2(db_path, backup_path)
        SystemLog.log(
            user=request.user, action=SystemLog.ACTION_BACKUP, entity='Database',
            entity_id=0, description=f'API manual backup: {backup_filename}',
            request=request,
        )
        # Return the file as a downloadable attachment
        with open(backup_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/x-sqlite3')
            response['Content-Disposition'] = f'attachment; filename="{backup_filename}"'
            return response
    except Exception as e:
        return _err(f'Backup failed: {e}', status=500)


@api_login_required
@require_http_methods(['GET'])
def backups_list(request):
    """GET /api/database/backups/ — list existing backup files."""
    import os
    from datetime import datetime
    from django.conf import settings

    if not can(request.user, 'database.manage'):
        return _err('Permission denied', status=403)

    backup_dir = os.path.join(settings.BASE_DIR, 'backups')
    backups = []
    if os.path.isdir(backup_dir):
        for filename in sorted(os.listdir(backup_dir), reverse=True):
            if filename.endswith('.sqlite3'):
                filepath = os.path.join(backup_dir, filename)
                stat = os.stat(filepath)
                backups.append({
                    'filename': filename,
                    'size_bytes': stat.st_size,
                    'size_mb': round(stat.st_size / (1024 * 1024), 2),
                    'created_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
    return _ok({'backups': backups, 'count': len(backups)})


@api_login_required
@require_http_methods(['POST'])
def database_restore(request):
    """POST /api/database/restore/ — restore the database from an uploaded .sqlite3 file.

    Accepts multipart/form-data with:
        file: the .sqlite3 backup file to restore from
        confirm: must be 'true' (safety check)

    Safety flow:
        1. Saves the uploaded file to /tmp/
        2. Creates a safety backup of the current db (pre_restore_<timestamp>.sqlite3)
        3. Replaces the active db.sqlite3 with the uploaded file
        4. Logs the restore action
        5. Returns instructions to restart the server

    NOTE: After restore, the Django process should be restarted to release the
    old SQLite file handles and re-open the new database.
    """
    import os
    import shutil
    from datetime import datetime
    from django.conf import settings

    if not can(request.user, 'database.manage'):
        return _err('Permission denied', status=403)

    confirm = request.POST.get('confirm', '').lower()
    if confirm != 'true':
        return _err('Confirmation required — please acknowledge the restore action')

    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return _err('No file uploaded. Please select a .sqlite3 backup file.')

    # Validate the file extension
    if not (uploaded_file.name.endswith('.sqlite3') or uploaded_file.name.endswith('.sqlite') or uploaded_file.name.endswith('.db')):
        return _err('Invalid file type. Please upload a .sqlite3 backup file.')

    # Validate file size (limit to 100 MB)
    if uploaded_file.size > 100 * 1024 * 1024:
        return _err('File too large. Maximum allowed size is 100 MB.')

    try:
        db_path = settings.DATABASES['default']['NAME']
        backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        os.makedirs(backup_dir, exist_ok=True)

        # 1. Create a safety backup of the current database (in case restore fails)
        safety_filename = f'pre_restore_{datetime.now().strftime("%Y%m%d_%H%M%S")}.sqlite3'
        safety_path = os.path.join(backup_dir, safety_filename)
        shutil.copy2(db_path, safety_path)

        # 2. Save the uploaded file to a temporary location
        temp_path = os.path.join(backup_dir, f'restore_temp_{datetime.now().strftime("%Y%m%d_%H%M%S")}.sqlite3')
        with open(temp_path, 'wb') as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)

        # 3. Replace the active database file
        # Note: SQLite file handles in the current process will continue pointing
        # to the old inode. A server restart is recommended after restore.
        shutil.move(temp_path, db_path)

        SystemLog.log(
            user=request.user, action=SystemLog.ACTION_RESTORE, entity='Database',
            entity_id=0,
            description=f'API database restored from {uploaded_file.name} (safety backup: {safety_filename})',
            request=request,
        )

        return _ok({
            'restored_from': uploaded_file.name,
            'safety_backup': safety_filename,
            'message': 'Database restored successfully. Please restart the Django server for the changes to take full effect.',
            'requires_restart': True,
        }, 'Database restored successfully')

    except Exception as e:
        return _err(f'Restore failed: {e}', status=500)


@api_login_required
@require_http_methods(['DELETE', 'POST'])
def backup_delete(request, filename):
    """POST /api/database/backups/<filename>/delete/ — delete a backup file.

    NOTE: filename is validated to prevent path traversal — only the basename
    is used and the file must live inside the backups directory.
    """
    import os
    from django.conf import settings

    if not can(request.user, 'database.manage'):
        return _err('Permission denied', status=403)

    # Sanitize filename — strip path components
    safe_filename = os.path.basename(filename)
    if not safe_filename or safe_filename != filename:
        return _err('Invalid filename')

    if not safe_filename.endswith('.sqlite3'):
        return _err('Only .sqlite3 backup files can be deleted')

    backup_dir = os.path.join(settings.BASE_DIR, 'backups')
    filepath = os.path.join(backup_dir, safe_filename)

    if not os.path.isfile(filepath):
        return _err('Backup file not found', status=404)

    try:
        os.remove(filepath)
        SystemLog.log(
            user=request.user, action=SystemLog.ACTION_DELETE, entity='Database',
            entity_id=0, description=f'API deleted backup file {safe_filename}',
            request=request,
        )
        return _ok(message=f'Backup file "{safe_filename}" deleted')
    except Exception as e:
        return _err(f'Delete failed: {e}', status=500)
