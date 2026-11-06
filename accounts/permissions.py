"""
Shared permission decorators for role-based access control (Phase 6).

Usage:
    @login_required
    @role_required('Administrator')
    def my_view(request): ...

    @login_required
    @role_required('Administrator', 'Guidance Staff')
    def my_view(request): ...

Also includes a helper to check permissions inside views/templates.
"""
from functools import wraps

from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.shortcuts import render


def role_required(*allowed_roles):
    """
    Restrict a view to users whose Role.name is in `allowed_roles`.
    Must always be wrapped *inside* `@login_required`.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            user = request.user
            if not user.is_authenticated:
                return HttpResponseForbidden('Authentication required.')
            if user.is_superuser:
                return view_func(request, *args, **kwargs)
            if user.role_id is None or user.role.name not in allowed_roles:
                return _render_forbidden(request)
            return view_func(request, *args, **kwargs)
        return _wrapped
    return decorator


def _render_forbidden(request):
    """Render a friendly 403 page consistent with the app design system."""
    return render(request, 'errors/403.html', status=403)


def can(user, permission):
    """
    Programmatic permission check used by views and templates.
    Permissions are derived from role names per the Phase 6 RBAC matrix.
    """
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    role = user.role.name if user.role_id else None

    matrix = {
        # permission_name : roles that have it
        'users.view':         ['Administrator'],
        'users.manage':       ['Administrator'],
        'students.view':      ['Administrator', 'Guidance Staff', 'Counselor'],
        'students.manage':    ['Administrator', 'Guidance Staff'],
        'counseling.view':    ['Administrator', 'Guidance Staff', 'Counselor'],
        'counseling.manage':  ['Administrator', 'Guidance Staff', 'Counselor'],
        'referrals.view':     ['Administrator', 'Guidance Staff', 'Counselor'],
        'referrals.manage':   ['Administrator', 'Guidance Staff', 'Counselor'],
        'inventory.view':     ['Administrator', 'Guidance Staff'],
        'inventory.manage':   ['Administrator', 'Guidance Staff'],
        'borrowing.view':     ['Administrator', 'Guidance Staff'],
        'borrowing.manage':   ['Administrator', 'Guidance Staff'],
        'reports.view':       ['Administrator', 'Guidance Staff'],
        'database.manage':    ['Administrator'],
        'settings.manage':    ['Administrator'],
        'notifications.view': ['Administrator', 'Guidance Staff', 'Counselor'],
    }
    allowed = matrix.get(permission, [])
    return role in allowed
