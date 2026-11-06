from django.contrib import admin

from .models import Referral, ReferralUpdate


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'referred_by', 'referral_type', 'priority', 'status', 'referred_at')
    list_filter = ('status', 'priority', 'referral_type')
    search_fields = ('student__last_name', 'student__first_name', 'reason')


@admin.register(ReferralUpdate)
class ReferralUpdateAdmin(admin.ModelAdmin):
    list_display = ('referral', 'author', 'new_status', 'created_at')
    list_filter = ('new_status',)
