from django.contrib import admin

from .models import Student, Guardian, StudentDocument, ActivityTimeline


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('student_number', 'full_name', 'grade_level', 'section', 'gender', 'status', 'school_year')
    list_filter = ('grade_level', 'gender', 'status', 'school_year')
    search_fields = ('student_number', 'first_name', 'last_name', 'middle_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Guardian)
class GuardianAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'student', 'relationship', 'is_primary', 'contact_number')
    list_filter = ('relationship', 'is_primary')
    search_fields = ('full_name', 'student__last_name', 'student__first_name')


@admin.register(StudentDocument)
class StudentDocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'student', 'document_type', 'uploaded_by', 'uploaded_at')
    list_filter = ('document_type',)
    search_fields = ('title', 'student__last_name')


@admin.register(ActivityTimeline)
class ActivityTimelineAdmin(admin.ModelAdmin):
    list_display = ('student', 'activity_type', 'title', 'performed_by', 'timestamp')
    list_filter = ('activity_type',)
    search_fields = ('title', 'student__last_name')
