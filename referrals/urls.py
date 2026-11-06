"""Referrals app URL configuration."""
from django.urls import path

from . import views

app_name = 'referrals'

urlpatterns = [
    path('', views.referral_list, name='list'),
    path('create/', views.referral_create, name='create'),
    path('<int:pk>/', views.referral_detail, name='detail'),
    path('<int:pk>/edit/', views.referral_edit, name='edit'),
    path('<int:pk>/close/', views.close, name='close'),
    path('<int:pk>/delete/', views.referral_delete, name='delete'),
]
