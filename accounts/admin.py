"""Accounts admin — registers User, Role, LoginLog, SystemLog for Django admin."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, Role, LoginAttempt, LoginLog, SystemLog


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'created_at')
    search_fields = ('name',)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'status', 'is_active', 'employee_id', 'date_joined')
    list_filter = ('role', 'status', 'is_active', 'is_staff')
    search_fields = ('username', 'email', 'first_name', 'last_name', 'employee_id')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Profile', {'fields': ('middle_name', 'role', 'employee_id', 'contact_number', 'avatar', 'status', 'approved_by', 'approved_at')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Profile', {'fields': ('middle_name', 'role', 'employee_id', 'contact_number', 'status')}),
    )


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ('username', 'ip_address', 'success', 'timestamp')
    list_filter = ('success',)
    search_fields = ('username', 'ip_address')


@admin.register(LoginLog)
class LoginLogAdmin(admin.ModelAdmin):
    list_display = ('username_attempted', 'action', 'user', 'ip_address', 'timestamp')
    list_filter = ('action',)
    search_fields = ('username_attempted', 'ip_address')


@admin.register(SystemLog)
class SystemLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user', 'action', 'entity', 'entity_id', 'ip_address')
    list_filter = ('action', 'entity')
    search_fields = ('description', 'entity', 'entity_id')
