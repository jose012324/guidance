from django.contrib import admin

from .models import SchoolSettings


@admin.register(SchoolSettings)
class SchoolSettingsAdmin(admin.ModelAdmin):
    list_display = ('school_name', 'school_year', 'default_theme', 'updated_at', 'updated_by')
    readonly_fields = ('created_at', 'updated_at')
