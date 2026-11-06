"""
Guidance Office Records Inventory Management System
Root URL configuration.

Routes:
  /                    -> accounts app (landing, auth, account settings)
  /admin/              -> Django built-in admin
  /dashboard/          -> dashboard app (admin overview)
  /users/              -> accounts app (user management routes)
  /students/           -> students app
  /counseling/         -> counseling app
  /referrals/          -> referrals app
  /inventory/          -> inventory app
  /reports/            -> reports app
  /notifications/      -> notifications app
  /settings/           -> configurations app (school settings)
  /api/                -> REST API layer (api.py) consumed by Electron desktop app
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve

import api as api_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('accounts.urls')),
    path('dashboard/', include('dashboard.urls')),
    path('students/', include('students.urls')),
    path('counseling/', include('counseling.urls')),
    path('referrals/', include('referrals.urls')),
    path('inventory/', include('inventory.urls')),
    path('reports/', include('reports.urls')),
    path('notifications/', include('notifications.urls')),
    path('settings/', include('configurations.urls')),

    # ============ REST API (consumed by Electron desktop app) ============
    path('api/auth/login/', api_views.auth_login, name='api_auth_login'),
    path('api/auth/logout/', api_views.auth_logout, name='api_auth_logout'),
    path('api/auth/me/', api_views.auth_me, name='api_auth_me'),
    path('api/auth/register/', api_views.auth_register, name='api_auth_register'),
    path('api/csrf-token/', api_views.csrf_token, name='api_csrf_token'),
    path('api/roles/', api_views.roles_list, name='api_roles_list'),

    # Dashboard
    path('api/dashboard/stats/', api_views.dashboard_stats, name='api_dashboard_stats'),

    # Users
    path('api/users/', api_views.users_list, name='api_users_list'),
    path('api/users/create/', api_views.user_create, name='api_user_create'),
    path('api/users/<int:pk>/', api_views.user_detail, name='api_user_detail'),
    path('api/users/<int:pk>/update/', api_views.user_update, name='api_user_update'),
    path('api/users/<int:pk>/activate/', api_views.user_activate, name='api_user_activate'),
    path('api/users/<int:pk>/deactivate/', api_views.user_deactivate, name='api_user_deactivate'),
    path('api/users/<int:pk>/approve/', api_views.user_approve, name='api_user_approve'),
    path('api/users/<int:pk>/delete/', api_views.user_delete, name='api_user_delete'),

    # Students
    path('api/students/record-inventory/', api_views.student_record_inventory, name='api_student_record_inventory'),
    path('api/students/lookup/', api_views.student_lookup, name='api_student_lookup'),
    path('api/students/', api_views.students_list, name='api_students_list'),
    path('api/students/create/', api_views.student_create, name='api_student_create'),
    path('api/students/<int:pk>/', api_views.student_detail, name='api_student_detail'),
    path('api/students/<int:pk>/update/', api_views.student_update, name='api_student_update'),
    path('api/students/<int:pk>/delete/', api_views.student_delete, name='api_student_delete'),
    # Student sub-resources — guardians + documents
    path('api/students/<int:pk>/guardians/add/', api_views.guardian_add, name='api_guardian_add'),
    path('api/students/<int:pk>/guardians/<int:guardian_pk>/delete/', api_views.guardian_delete, name='api_guardian_delete'),
    path('api/students/<int:pk>/documents/add/', api_views.document_add, name='api_document_add'),
    path('api/students/<int:pk>/documents/<int:document_pk>/delete/', api_views.document_delete, name='api_document_delete'),

    # Counseling
    path('api/counseling/', api_views.counseling_list, name='api_counseling_list'),
    path('api/counseling/create/', api_views.counseling_create, name='api_counseling_create'),
    path('api/counseling/<int:pk>/', api_views.counseling_detail, name='api_counseling_detail'),
    path('api/counseling/<int:pk>/update/', api_views.counseling_update, name='api_counseling_update'),
    path('api/counseling/<int:pk>/close/', api_views.counseling_close, name='api_counseling_close'),
    path('api/counseling/<int:pk>/notes/add/', api_views.counseling_add_note, name='api_counseling_add_note'),
    path('api/counseling/<int:pk>/delete/', api_views.counseling_delete, name='api_counseling_delete'),

    # Referrals
    path('api/referrals/', api_views.referrals_list, name='api_referrals_list'),
    path('api/referrals/create/', api_views.referral_create, name='api_referral_create'),
    path('api/referrals/<int:pk>/', api_views.referral_detail, name='api_referral_detail'),
    path('api/referrals/<int:pk>/update/', api_views.referral_update, name='api_referral_update'),
    path('api/referrals/<int:pk>/updates/add/', api_views.referral_add_update, name='api_referral_add_update'),
    path('api/referrals/<int:pk>/close/', api_views.referral_close, name='api_referral_close'),
    path('api/referrals/<int:pk>/delete/', api_views.referral_delete, name='api_referral_delete'),

    # Inventory
    path('api/inventory/', api_views.inventory_list, name='api_inventory_list'),
    path('api/inventory/create/', api_views.inventory_create, name='api_inventory_create'),
    path('api/inventory/stock-monitoring/', api_views.stock_monitoring, name='api_stock_monitoring'),
    path('api/inventory/<int:pk>/', api_views.inventory_detail, name='api_inventory_detail'),
    path('api/inventory/<int:pk>/update/', api_views.inventory_update, name='api_inventory_update'),
    path('api/inventory/<int:pk>/adjust/', api_views.inventory_adjust, name='api_inventory_adjust'),
    path('api/inventory/<int:pk>/delete/', api_views.inventory_delete, name='api_inventory_delete'),

    # Borrowed items
    path('api/borrowed/', api_views.borrowed_list, name='api_borrowed_list'),
    path('api/borrowed/create/', api_views.borrowed_create, name='api_borrowed_create'),
    path('api/borrowed/<int:pk>/return/', api_views.borrowed_return, name='api_borrowed_return'),

    # Notifications
    path('api/notifications/', api_views.notifications_list, name='api_notifications_list'),
    path('api/notifications/unread-count/', api_views.notifications_unread_count, name='api_notifications_unread_count'),
    path('api/notifications/<int:pk>/read/', api_views.notification_mark_read, name='api_notification_mark_read'),
    path('api/notifications/mark-all-read/', api_views.notification_mark_all_read, name='api_notifications_mark_all_read'),

    # Reports
    path('api/reports/', api_views.reports_home, name='api_reports_home'),
    path('api/reports/students/', api_views.report_students, name='api_report_students'),
    path('api/reports/counseling/', api_views.report_counseling, name='api_report_counseling'),
    path('api/reports/referrals/', api_views.report_referrals, name='api_report_referrals'),
    path('api/reports/inventory/', api_views.report_inventory, name='api_report_inventory'),
    path('api/reports/borrowing/', api_views.report_borrowing, name='api_report_borrowing'),
    path('api/reports/user-activity/', api_views.report_user_activity, name='api_report_user_activity'),

    # Settings
    path('api/school/public/', api_views.school_public, name='api_school_public'),
    path('api/school/settings/', api_views.school_settings, name='api_school_settings'),
    path('api/school/settings/update/', api_views.school_settings_update, name='api_school_settings_update'),
    path('api/school/logo/', api_views.school_logo_upload, name='api_school_logo_upload'),

    # Account (self-service)
    path('api/account/profile/', api_views.account_profile_update, name='api_account_profile_update'),
    path('api/account/avatar/', api_views.account_avatar_upload, name='api_account_avatar_upload'),
    path('api/account/password/', api_views.account_password_change, name='api_account_password_change'),

    # Database / audit logs
    path('api/audit/logs/', api_views.audit_logs, name='api_audit_logs'),
    path('api/audit/login-logs/', api_views.audit_login_logs, name='api_audit_login_logs'),
    path('api/database/backup/', api_views.database_backup, name='api_database_backup'),
    path('api/database/restore/', api_views.database_restore, name='api_database_restore'),
    path('api/database/backups/', api_views.backups_list, name='api_database_backups_list'),
    path('api/database/backups/<str:filename>/delete/', api_views.backup_delete, name='api_database_backup_delete'),
]

# Custom error handlers
handler404 = 'accounts.views._handler404'
handler403 = 'accounts.views._handler403'
handler500 = 'accounts.views._handler500'

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Media uploads (avatars, student documents, school logo).
# - Local storage (no CLOUDINARY_URL): Django serves MEDIA_ROOT. Note that
#   django.conf.urls.static.static() registers nothing unless DEBUG=True, so
#   the route is declared explicitly to keep serving in production.
# - Cloudinary active: every file .url is an absolute res.cloudinary.com URL,
#   so the /media/ route is skipped — it would only 404 against Render's
#   ephemeral disk.
if not getattr(settings, 'CLOUDINARY_URL', ''):
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
