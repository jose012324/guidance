"""
Django settings for guidance_system project.

This module is intentionally minimal — only the configuration required for the
Guidance Office Records Inventory Management System to run is declared here.
Per project guidelines, focus is restricted to:
    * INSTALLED_APPS (declare the apps we built)
    * MIDDLEWARE (per project instructions)
    * TEMPLATES (per project instructions)
    * STATIC_URL / STATICFILES_DIRS (per project instructions)

Everything else uses Django's sensible defaults.
"""
import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------
# PRODUCTION TODO: replace with a strong random key before deploying
# (python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
SECRET_KEY = os.environ.get('SECRET_KEY')
# PRODUCTION TODO: your deployed origin(s), scheme included, e.g.
#   ['https://guidance.example.com', 'https://www.guidance.example.com']
# Safety net for CSRF validation when POSTs arrive with an Origin header that
# isn't an exact host match (www vs non-www, desktop app requests).
# Harmless in local dev — same-origin requests never consult this list.
CSRF_TRUSTED_ORIGINS = []

# PRODUCTION TODO: set False before deploying
DEBUG = False

# PRODUCTION TODO: restrict to your domain before deploying, e.g. ['guidance.example.com']
ALLOWED_HOSTS = []

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Local apps — modular domain-driven design
    'accounts',
    'students',
    'counseling',
    'referrals',
    'inventory',
    'dashboard',
    'reports',
    'notifications',
    'configurations',
]

# ---------------------------------------------------------------------------
# Middleware (per project instructions: update middleware here)
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # WhiteNoise serves static files efficiently in production (right after
    # SecurityMiddleware, before everything else).
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'api_middleware.CORSMiddleware',  # CORS support for Electron desktop app
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # API rate limiting (must come after AuthenticationMiddleware so it can
    # key counters per logged-in user). /api/ only — web pages unaffected.
    'api_middleware.ApiRateLimitMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # Custom audit-trail middleware (login / navigation activity logging)
    'accounts.middleware.AuditTrailMiddleware',
    'accounts.middleware.LoginAttemptMiddleware',
]

ROOT_URLCONF = 'guidance_system.urls'

# ---------------------------------------------------------------------------
# Templates (per project instructions: update templates here)
# ---------------------------------------------------------------------------
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'templates',
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                # Custom context processors
                'accounts.context_processors.school_info',
                'accounts.context_processors.sidebar_notifications',
                'accounts.context_processors.user_role_perms',
            ],
        },
    },
]

WSGI_APPLICATION = 'guidance_system.wsgi.application'
ASGI_APPLICATION = 'guidance_system.asgi.application'

# ---------------------------------------------------------------------------
# Database (SQLite — per plan)
# ---------------------------------------------------------------------------
# DATABASE_PATH override: point this at a persistent disk on Render
# (e.g. /var/data/db.sqlite3) so data survives redeploys.
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.sqlite3',
#         'NAME': os.environ.get('DATABASE_PATH', BASE_DIR / 'db.sqlite3'),
#     }
# }

# Add these at the top of your settings.py
# import os
# from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qsl

# load_dotenv()

# Replace the DATABASES section of your settings.py with this
tmpPostgres = urlparse(os.environ.get('DATABASE_URL'))

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': tmpPostgres.path.replace('/', ''),
        'USER': tmpPostgres.username,
        'PASSWORD': tmpPostgres.password,
        'HOST': tmpPostgres.hostname,
        'PORT': 5432,
        'OPTIONS': dict(parse_qsl(tmpPostgres.query)),
    }
}
# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = '/dashboard/'
LOGOUT_REDIRECT_URL = '/'

# Account lockout settings (custom LoginAttemptMiddleware)
ACCOUNT_LOCKOUT_MAX_FAILURES = 5
ACCOUNT_LOCKOUT_DURATION_MINUTES = 15

# API rate limiting (api_middleware.ApiRateLimitMiddleware): max requests per
# user per 60-second window on /api/ endpoints. Anonymous callers (login,
# register) are tracked per IP instead.
API_RATE_LIMIT_PER_MINUTE = 500

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Manila'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & Media (per project instructions: update static_url here)
# ---------------------------------------------------------------------------
STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

# WhiteNoise: compressed + cached static files in production.
# `collectstatic` must be run at deploy time (python manage.py collectstatic).
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

# ---------------------------------------------------------------------------
# Cloudinary media storage (production uploads)
# ---------------------------------------------------------------------------
# Render's filesystem is ephemeral — files saved to MEDIA_ROOT are wiped on
# every redeploy. Set CLOUDINARY_URL (Render dashboard -> Environment, or
# paste the value between the quotes below) and ALL uploads (avatars, school
# logo, student documents) go to Cloudinary; .url then returns the full CDN
# URL, fetched directly by both the website and the desktop app with no other
# code changes. Unset = local MEDIA_ROOT storage (development).
CLOUDINARY_URL = os.environ.get('CLOUDINARY_URL')
if CLOUDINARY_URL:
    # django-cloudinary-storage reads credentials from the ENVIRONMENT
    # (cloudinary_storage/app_settings.py), NOT from Django settings —
    # without this line every upload/.url call 500s with ImproperlyConfigured.
    os.environ.setdefault('CLOUDINARY_URL', CLOUDINARY_URL)
    import cloudinary
    cloudinary.config(cloudinary_url=CLOUDINARY_URL)
    STORAGES['default'] = {'BACKEND': 'cloud_storage.AutoMediaCloudinaryStorage'}

# Leading slash matters: FileSystemStorage builds <file>.url from MEDIA_URL,
# and api.py returns those .url values to the desktop app — a missing slash
# produced broken joins like "...onrender.commedia/school/logo.jpeg".
MEDIA_URL = '/media/'
MEDIA_ROOT = Path(os.environ.get('MEDIA_ROOT', BASE_DIR / 'media'))
# When Cloudinary is active, .url returns full https://res.cloudinary.com/...
# URLs and Django never serves /media/ itself — see urls.py, which only
# registers the /media/ route when Cloudinary is not configured.
# NOTE: WhiteNoise does NOT serve media/ uploads (avatars, documents, logos).

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# Session configuration (Remember-Me support)
# ---------------------------------------------------------------------------
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7  # 7 days when "remember me" is checked
SESSION_EXPIRE_AT_BROWSER_CLOSE = True  # default — overridden per login

# Cookie settings for Electron desktop app compatibility
# SameSite=None is used for maximum compatibility with Electron's file:// protocol
SESSION_COOKIE_HTTPONLY = True  # session cookie never exposed to JS (desktop app authenticates via /api/ + credentials:'include', no JS cookie read needed)
SESSION_COOKIE_SECURE = True  # Required for SameSite=None — HTTPS mandatory in production
SESSION_COOKIE_SAMESITE = 'None'  # Allow cross-origin requests from file:// protocol
CSRF_COOKIE_HTTPONLY = False  # CSRF cookie must stay readable (Django's standard pattern — the token is not a secret)
CSRF_COOKIE_SECURE = True  # Required for SameSite=None
CSRF_COOKIE_SAMESITE = 'None'  # Allow cross-origin requests
