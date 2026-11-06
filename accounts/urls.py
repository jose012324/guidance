"""
Accounts app URL configuration — public auth routes.

/user/ management routes are defined in urls_users.py and mounted at /users/.
"""
from django.urls import path, include

from . import views

app_name = 'accounts'

urlpatterns = [
    # Landing
    path('', views.landing, name='landing'),
    # Desktop app installer download
    path('download/desktop-app/', views.download_desktop_app, name='download_desktop_app'),
    # Auth
    path('login/', views.login_view, name='login'),
    path('register/', views.register, name='register'),
    path('logout/', views.logout_view, name='logout'),
    # Account settings
    path('account/', views.account_settings, name='account_settings'),
    # Global search
    path('search/', views.global_search, name='global_search'),
    # User management (mounted at /users/)
    path('users/', include('accounts.urls_users')),
]
