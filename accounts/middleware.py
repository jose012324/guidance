"""
Accounts middleware.

    * AuditTrailMiddleware      — records navigation activity on protected pages
    * LoginAttemptMiddleware    — restricts login attempts from locked accounts

Both middlewares are intentionally lightweight to keep request latency low.
"""
from django.utils import timezone

from .models import LoginAttempt, SystemLog


class AuditTrailMiddleware:
    """
    Records high-level navigation actions into SystemLog. Heavy CRUD logging is
    performed explicitly inside each view via SystemLog.log(...); this middleware
    only captures the user's presence on protected pages for session analytics.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        # Only log authenticated HTML navigation (skip API/static/ajax)
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and 'text/html' in response.get('Content-Type', ''):
            # Avoid noise — only log every 5 minutes per user per path
            last = SystemLog.objects.filter(
                user=user, entity='Navigation', entity_id=request.path
            ).order_by('-timestamp').first()
            if not last or (timezone.now() - last.timestamp).total_seconds() > 300:
                SystemLog.objects.create(
                    user=user, action=SystemLog.ACTION_UPDATE,
                    entity='Navigation', entity_id=request.path,
                    description=f"Visited {request.path}",
                )
        return response


class LoginAttemptMiddleware:
    """
    Prevents login brute-force by checking failed attempts before the auth backend
    runs. The actual attempt recording happens in the login view; this middleware
    is a safety net to short-circuit the request when the username is locked.
    """
    LOCKED_MSG = (
        "Too many failed login attempts. "
        "Please try again in a few minutes or contact the administrator."
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        # Only intercept the login POST endpoint
        if request.method != 'POST' or request.path.rstrip('/') != '/login':
            return None
        from django.conf import settings
        from django.contrib import messages

        username = (request.POST.get('username') or '').strip()
        if not username:
            return None
        max_failures = getattr(settings, 'ACCOUNT_LOCKOUT_MAX_FAILURES', 5)
        window_min = getattr(settings, 'ACCOUNT_LOCKOUT_DURATION_MINUTES', 15)
        if LoginAttempt.count_recent_failures(username, minutes=window_min) >= max_failures:
            messages.error(request, self.LOCKED_MSG)
            # Re-render login page by calling the view with a GET-like response
            from django.shortcuts import redirect
            return redirect('/login/?locked=1')
        return None
