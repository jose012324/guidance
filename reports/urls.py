"""Reports app URL configuration."""
from django.urls import path

from . import views

app_name = 'reports'

urlpatterns = [
    path('', views.home, name='home'),
    path('students/', views.student_report, name='student_report'),
    path('counseling/', views.counseling_report, name='counseling_report'),
    path('referrals/', views.referral_report, name='referral_report'),
    path('inventory/', views.inventory_report, name='inventory_report'),
    path('borrowing/', views.borrowing_report, name='borrowing_report'),
    path('user-activity/', views.user_activity_report, name='user_activity_report'),
]
