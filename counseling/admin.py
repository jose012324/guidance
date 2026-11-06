from django.contrib import admin

from .models import CounselingSession, CounselorNote


@admin.register(CounselingSession)
class CounselingSessionAdmin(admin.ModelAdmin):
    list_display = ('student', 'counselor', 'session_date', 'concern_type', 'status')
    list_filter = ('status', 'concern_type', 'session_date')
    search_fields = ('student__last_name', 'student__first_name', 'counselor__username')
    readonly_fields = ('created_at', 'updated_at', 'closed_at')


@admin.register(CounselorNote)
class CounselorNoteAdmin(admin.ModelAdmin):
    list_display = ('session', 'author', 'created_at', 'is_private')
    list_filter = ('is_private',)
