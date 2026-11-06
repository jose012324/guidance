"""
User management views (Phase 9-10) — admin-side CRUD for users + approval workflow.
Routed under /users/ via urls_users.py.
"""
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone

from accounts.models import User, SystemLog, Role
from accounts.forms import UserForm, UserFilterForm
from accounts.permissions import role_required, can


@login_required
@role_required('Administrator')
def user_list(request):
    """User directory with search, role/status filters, and pagination."""
    qs = User.objects.select_related('role').all()

    form = UserFilterForm(request.GET or None)
    if form.is_valid():
        search = form.cleaned_data.get('search')
        role = form.cleaned_data.get('role')
        status = form.cleaned_data.get('status')
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(employee_id__icontains=search)
            )
        if role:
            qs = qs.filter(role=role)
        if status:
            qs = qs.filter(status=status)

    qs = qs.order_by('-date_joined')
    paginator = Paginator(qs, 15)
    page = request.GET.get('page')
    users = paginator.get_page(page)

    return render(request, 'users/user_list.html', {
        'users': users, 'filter_form': form, 'section': 'users',
    })


@login_required
@role_required('Administrator')
def user_create(request):
    """Add-user workflow (Phase 10) — admin creates a user with a chosen role."""
    if request.method == 'POST':
        form = UserForm(request.POST)
        if form.is_valid():
            user = form.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_CREATE, entity='User',
                entity_id=user.pk, description=f'Created user {user.username} ({user.role})',
                request=request,
            )
            messages.success(request, f'User "{user.username}" has been created successfully.')
            return redirect('accounts:user_list')
    else:
        form = UserForm()
    return render(request, 'users/user_form.html', {'form': form, 'is_create': True, 'section': 'users'})


@login_required
@role_required('Administrator')
def user_edit(request, pk):
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        form = UserForm(request.POST, instance=user)
        if form.is_valid():
            updated = form.save()
            SystemLog.log(
                user=request.user, action=SystemLog.ACTION_UPDATE, entity='User',
                entity_id=updated.pk, description=f'Updated user {updated.username}',
                request=request,
            )
            messages.success(request, f'User "{updated.username}" has been updated.')
            return redirect('accounts:user_list')
    else:
        form = UserForm(instance=user)
    return render(request, 'users/user_form.html', {
        'form': form, 'is_create': False, 'target_user': user, 'section': 'users',
    })


@login_required
@role_required('Administrator')
def user_detail(request, pk):
    user = get_object_or_404(User, pk=pk)
    return render(request, 'users/user_detail.html', {'target_user': user, 'section': 'users'})


@login_required
@role_required('Administrator')
def user_activate(request, pk):
    user = get_object_or_404(User, pk=pk)
    user.status = User.STATUS_ACTIVE
    user.is_active = True
    user.approved_by = request.user
    user.approved_at = timezone.now()
    user.save()
    SystemLog.log(
        user=request.user, action=SystemLog.ACTION_UPDATE, entity='User',
        entity_id=user.pk, description=f'Activated user {user.username}',
        request=request,
    )
    messages.success(request, f'User "{user.username}" has been activated.')
    return redirect('accounts:user_list')


@login_required
@role_required('Administrator')
def user_deactivate(request, pk):
    user = get_object_or_404(User, pk=pk)
    if user.pk == request.user.pk:
        messages.error(request, 'You cannot deactivate your own account.')
        return redirect('accounts:user_list')
    user.status = User.STATUS_INACTIVE
    user.is_active = False
    user.save()
    SystemLog.log(
        user=request.user, action=SystemLog.ACTION_UPDATE, entity='User',
        entity_id=user.pk, description=f'Deactivated user {user.username}',
        request=request,
    )
    messages.success(request, f'User "{user.username}" has been deactivated.')
    return redirect('accounts:user_list')


@login_required
@role_required('Administrator')
def user_approve(request, pk):
    """Approve a pending registration (Phase 4 — account approval workflow)."""
    user = get_object_or_404(User, pk=pk)
    user.status = User.STATUS_ACTIVE
    user.is_active = True
    user.approved_by = request.user
    user.approved_at = timezone.now()
    user.save()
    SystemLog.log(
        user=request.user, action=SystemLog.ACTION_UPDATE, entity='User',
        entity_id=user.pk, description=f'Approved pending user {user.username}',
        request=request,
    )
    messages.success(request, f'Account "{user.username}" has been approved and can now log in.')
    return redirect('accounts:user_list')


@login_required
@role_required('Administrator')
def user_delete(request, pk):
    user = get_object_or_404(User, pk=pk)
    if user.pk == request.user.pk:
        messages.error(request, 'You cannot delete your own account.')
        return redirect('accounts:user_list')
    if user.is_superuser:
        messages.error(request, 'You cannot delete a superuser.')
        return redirect('accounts:user_list')
    if request.method == 'POST':
        SystemLog.log(
            user=request.user, action=SystemLog.ACTION_DELETE, entity='User',
            entity_id=user.pk, description=f'Deleted user {user.username}',
            request=request,
        )
        user.delete()
        messages.success(request, f'User "{user.username}" has been deleted.')
        return redirect('accounts:user_list')
    return render(request, 'users/user_delete.html', {'target_user': user, 'section': 'users'})
