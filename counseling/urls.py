"""Counseling app URL configuration."""
from django.urls import path

from . import views

app_name = 'counseling'

urlpatterns = [
    path('', views.counseling_list, name='list'),
    path('create/', views.counseling_create, name='create'),
    path('<int:pk>/', views.counseling_detail, name='detail'),
    path('<int:pk>/edit/', views.counseling_edit, name='edit'),
    path('<int:pk>/close/', views.close, name='close'),
    path('<int:pk>/delete/', views.counseling_delete, name='delete'),
]
