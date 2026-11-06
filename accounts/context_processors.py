"""
Custom template context processors — exposed to every template render.

    * school_info          → active SchoolSettings + current year
    * sidebar_notifications → unread notifications for the current user
    * user_role_perms      → RBAC helper booleans (is_administrator, etc.)
"""
from configurations.models import SchoolSettings
from notifications.models import Notification


def school_info(request):
    """Expose the active school settings to every template."""
    try:
        settings = SchoolSettings.get_settings()
    except Exception:
        # Database not ready (during migrations). Fail gracefully.
        settings = None
    return {
        'school_settings': settings,
        'system_title': settings.system_title if settings else 'Guidance Office Records Inventory Management System',
        'school_name': settings.school_name if settings else 'Guidance Office',
        'school_year': settings.school_year if settings else '',
    }


def sidebar_notifications(request):
    """Inject unread notification count + 5 latest for the sidebar bell icon."""
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return {'unread_count': 0, 'recent_notifications': []}
    qs = Notification.objects.filter(user=user, is_read=False)
    return {
        'unread_count': qs.count(),
        'recent_notifications': qs[:5],
    }


def user_role_perms(request):
    """Expose role-based permission booleans for use in templates."""
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return {
            'can_manage_users': False,
            'can_manage_settings': False,
            'can_manage_database': False,
            'can_manage_inventory': False,
            'can_manage_counseling': True,
            'can_manage_referrals': True,
            'can_view_reports': False,
            'is_administrator': False,
            'is_guidance_staff': False,
            'is_counselor': False,
        }
    return {
        'can_manage_users': user.is_administrator,
        'can_manage_settings': user.is_administrator,
        'can_manage_database': user.is_administrator,
        'can_manage_inventory': user.is_administrator or user.is_guidance_staff,
        'can_manage_counseling': True,
        'can_manage_referrals': True,
        'can_view_reports': user.is_administrator or user.is_guidance_staff,
        'is_administrator': user.is_administrator,
        'is_guidance_staff': user.is_guidance_staff,
        'is_counselor': user.is_counselor,
    }
