from django.contrib import admin

from .models import SavedReport


@admin.register(SavedReport)
class SavedReportAdmin(admin.ModelAdmin):
    list_display = ('name', 'report_type', 'generated_by', 'generated_at')
    list_filter = ('report_type',)
    search_fields = ('name', 'notes')
