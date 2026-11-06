"""
User-management URL configuration (mounted at /users/).

Separate file keeps accounts/urls.py focused on public auth while letting
the admin-side user management live under a clean URL prefix.
"""
from django.urls import path

from . import views_users



urlpatterns = [
    path('', views_users.user_list, name='user_list'),
    path('create/', views_users.user_create, name='user_create'),
    path('<int:pk>/', views_users.user_detail, name='user_detail'),
    path('<int:pk>/edit/', views_users.user_edit, name='user_edit'),
    path('<int:pk>/activate/', views_users.user_activate, name='user_activate'),
    path('<int:pk>/deactivate/', views_users.user_deactivate, name='user_deactivate'),
    path('<int:pk>/approve/', views_users.user_approve, name='user_approve'),
    path('<int:pk>/delete/', views_users.user_delete, name='user_delete'),
]
