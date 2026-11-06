"""
Accounts signals — seed default roles on app ready, log user activity.

Hooks:
    * post_migrate  → seed Role rows (Administrator / Guidance Staff / Counselor)
    * user_logged_in / user_logged_out → write LoginLog entries
"""
from django.db.models.signals import post_migrate
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.dispatch import receiver
from django.utils import timezone

from .models import Role, LoginLog, User


# Default role names that must always exist
DEFAULT_ROLES = [
    (Role.ADMINISTRATOR, 'Full system access — manages users, settings, and database.'),
    (Role.GUIDANCE_STAFF, 'Manages students, counseling, referrals, and inventory.'),
    (Role.COUNSELOR, 'Manages student profiles, counseling records, and referrals.'),
]


@receiver(post_migrate)
def seed_default_roles(sender, **kwargs):
    """Create the three default roles after migrations run."""
    if sender.name != 'accounts':
        return
    for name, description in DEFAULT_ROLES:
        Role.objects.get_or_create(name=name, defaults={'description': description})


@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    """Persist a LoginLog entry on every successful login."""
    ip = _get_client_ip(request)
    ua = request.META.get('HTTP_USER_AGENT', '')
    LoginLog.objects.create(
        user=user, username_attempted=user.username, action=LoginLog.ACTION_LOGIN,
        ip_address=ip, user_agent=ua,
    )


@receiver(user_logged_out)
def log_user_logout(sender, request, user, **kwargs):
    if user is None:
        return
    ip = _get_client_ip(request)
    ua = request.META.get('HTTP_USER_AGENT', '')
    LoginLog.objects.create(
        user=user, username_attempted=user.username, action=LoginLog.ACTION_LOGOUT,
        ip_address=ip, user_agent=ua,
    )


def _get_client_ip(request):
    if request is None:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')
