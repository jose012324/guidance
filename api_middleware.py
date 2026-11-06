"""
CORS Middleware for Electron Desktop App.

This middleware adds CORS headers to all API responses to allow
the Electron app (file:// protocol) to communicate with Django.

IMPORTANT: When Access-Control-Allow-Credentials is true,
Access-Control-Allow-Origin CANNOT be '*'. It must be the actual
origin from the request. This is required for cookies (sessionid +
csrftoken) to work in Electron.
"""
import logging
import time
from threading import Lock

from django.http import JsonResponse

logger = logging.getLogger('django.request')


class CORSMiddleware:
    """Add CORS headers to all API responses."""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def _get_origin(self, request):
        """Return the origin to use in Access-Control-Allow-Origin."""
        origin = request.META.get('HTTP_ORIGIN', '')
        if origin:
            return origin
        # Electron may not send Origin header — fall back to Referer or *
        referer = request.META.get('HTTP_REFERER', '')
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            return f'{parsed.scheme}://{parsed.netloc}'
        return '*'
    
    def _cors_headers(self, response, request):
        origin = self._get_origin(request)
        response['Access-Control-Allow-Origin'] = origin
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRFToken, Authorization'
        response['Access-Control-Allow-Credentials'] = 'true'
        return response

    def process_exception(self, request, exception):
        """Return JSON for unhandled API errors instead of Django's HTML page.

        Without this, an uncaught server error returns an HTML error page and
        the desktop client fails with "Unexpected token '<' ... is not valid
        JSON". The traceback is still logged so problems remain visible.
        """
        if not request.path.startswith('/api/'):
            return None
        logger.exception('Unhandled API error on %s', request.path, exc_info=exception)
        response = JsonResponse(
            {'success': False, 'error': 'Internal server error. Please try again.'},
            status=500,
        )
        return self._cors_headers(response, request)
    
    def __call__(self, request):
        # Handle OPTIONS preflight requests
        if request.method == 'OPTIONS' and request.path.startswith('/api/'):
            response = JsonResponse({})
            return self._cors_headers(response, request)
        
        response = self.get_response(request)
        
        # Add CORS headers to all API responses
        if request.path.startswith('/api/'):
            response = self._cors_headers(response, request)
        
        return response


class ApiRateLimitMiddleware:
    """
    Rate limiting for the /api/ endpoints consumed by the desktop app.

    Allows API_RATE_LIMIT_PER_MINUTE requests (default 500) per caller per
    60-second window. Authenticated users are tracked by user id; anonymous
    callers (e.g. the login endpoint) are tracked by client IP. Exceeding the
    cap returns a JSON 429 with a Retry-After header.

    Counters are kept in memory, so each worker process tracks its own.
    That is fine for this single-server SQLite deployment; use a shared
    cache (e.g. Redis) if you ever scale to multiple app servers.

    NOTE: must be listed AFTER AuthenticationMiddleware in settings.MIDDLEWARE
    so request.user is available for per-user keying.
    """

    WINDOW_SECONDS = 60
    _buckets = {}   # key -> (window_start, request_count)
    _lock = Lock()

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            from django.conf import settings
            limit = getattr(settings, 'API_RATE_LIMIT_PER_MINUTE', 500)
            allowed, retry_after = self._consume(self._key(request), limit)
            if not allowed:
                response = JsonResponse(
                    {
                        'success': False,
                        'error': 'Rate limit exceeded. Please slow down and try again.',
                    },
                    status=429,
                )
                response['Retry-After'] = str(retry_after)
                return response
        return self.get_response(request)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _key(self, request):
        """Per-user key when authenticated, per-IP otherwise."""
        user = getattr(request, 'user', None)
        if user is not None and user.is_authenticated:
            return f'user:{user.pk}'
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR')
        return f'ip:{ip}'

    def _consume(self, key, limit):
        """Fixed-window counter. Returns (allowed, retry_after_seconds)."""
        now = int(time.time())
        window = now - (now % self.WINDOW_SECONDS)
        with ApiRateLimitMiddleware._lock:
            buckets = ApiRateLimitMiddleware._buckets
            entry = buckets.get(key)
            if entry is None or entry[0] != window:
                buckets[key] = (window, 1)
                # Opportunistic cleanup so stale windows don't accumulate
                if len(buckets) > 10000:
                    for stale_key in [k for k, v in buckets.items() if v[0] != window]:
                        buckets.pop(stale_key, None)
                return True, 0
            count = entry[1] + 1
            buckets[key] = (window, count)
            if count > limit:
                return False, window + self.WINDOW_SECONDS - now
        return True, 0
