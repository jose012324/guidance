"""WSGI config for guidance_system project."""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'guidance_system.settings')
application = get_wsgi_application()
