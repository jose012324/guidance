"""Configurations app URL configuration."""
from django.urls import path

from . import views

app_name = 'configurations'

urlpatterns = [
    path('', views.school_settings, name='school_settings'),
    path('database/', views.database, name='database'),
    path('database/backup/', views.database_backup, name='database_backup'),
    path('database/restore/', views.database_restore, name='database_restore'),
]
