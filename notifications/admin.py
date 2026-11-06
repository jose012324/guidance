from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'category', 'priority', 'is_read', 'created_at')
    list_filter = ('category', 'priority', 'is_read')
    search_fields = ('title', 'message', 'user__username')
