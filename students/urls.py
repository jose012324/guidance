"""Students app URL configuration."""
from django.urls import path

from . import views

app_name = 'students'

urlpatterns = [
    path('', views.student_list, name='list'),
    path('record-inventory/', views.record_inventory, name='record_inventory'),
    path('create/', views.student_create, name='create'),
    path('<int:pk>/', views.student_detail, name='detail'),
    path('<int:pk>/edit/', views.student_edit, name='edit'),
    path('<int:pk>/delete/', views.student_delete, name='delete'),
    path('<int:pk>/guardians/add/', views.add_guardian, name='add_guardian'),
    path('<int:pk>/documents/add/', views.add_document, name='add_document'),
]
