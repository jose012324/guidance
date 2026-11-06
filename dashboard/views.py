"""
Dashboard views (Phase 8) — admin overview analytics, charts, activity feed.
"""
from collections import OrderedDict
from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q
from django.shortcuts import render
from django.utils import timezone

from accounts.models import User, SystemLog
from accounts.permissions import can
from students.models import Student
from counseling.models import CounselingSession
from referrals.models import Referral
from inventory.models import InventoryItem, BorrowedItem
from notifications.models import Notification


@login_required
def home(request):
    """Admin / staff dashboard with KPI cards, trend charts, and activity feed."""
    user = request.user

    # ----- KPI counts -----
    total_students = Student.objects.count()
    active_students = Student.objects.filter(status=Student.STATUS_ACTIVE).count()
    sessions_total = CounselingSession.objects.count()
    sessions_open = CounselingSession.objects.exclude(status=CounselingSession.STATUS_CLOSED).count()
    referrals_total = Referral.objects.count()
    referrals_pending = Referral.objects.filter(status=Referral.STATUS_PENDING).count()
    inventory_total = InventoryItem.objects.count()
    borrowed_active = BorrowedItem.objects.exclude(status=BorrowedItem.STATUS_RETURNED).count()

    # Low stock + out of stock
    low_stock_items = [i for i in InventoryItem.objects.all() if i.stock_status in ('low_stock', 'out_of_stock')]

    # ----- Charts: last 6 months trend -----
    today = timezone.now().date()
    months = []
    for i in range(5, -1, -1):
        first = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        last = (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        months.append((first, last, first.strftime('%b')))

    counseling_trend = []
    referral_trend = []
    for first, last, label in months:
        counseling_trend.append({
            'label': label,
            'value': CounselingSession.objects.filter(session_date__range=(first, last)).count(),
        })
        referral_trend.append({
            'label': label,
            'value': Referral.objects.filter(referred_at__date__range=(first, last)).count(),
        })

    # ----- Charts: counseling by concern type -----
    concern_counts = (
        CounselingSession.objects
        .values('concern_type')
        .annotate(count=Count('id'))
        .order_by('concern_type')
    )
    concern_map = {row['concern_type']: row['count'] for row in concern_counts}
    concern_chart = []
    concern_labels = []
    concern_values = []
    concern_colors = ['#1a3a6b', '#b8730a', '#1c7c54', '#2c7da0', '#b91c1c', '#6f42c1', '#9aa0a6']
    concern_type_choices = [
        ('academic', 'Academic'),
        ('behavioral', 'Behavioral'),
        ('personal', 'Personal'),
        ('social', 'Social'),
        ('career', 'Career'),
        ('mental_health', 'Mental Health'),
        ('other', 'Other'),
    ]
    for code, label in concern_type_choices:
        concern_chart.append({'label': label, 'value': concern_map.get(code, 0)})
        concern_labels.append(label)
        concern_values.append(concern_map.get(code, 0))

    # ----- Activity feed (last 12 entries) -----
    activity_logs = SystemLog.objects.select_related('user').order_by('-timestamp')[:12]

    # ----- Notifications for current user -----
    user_notifications = Notification.objects.filter(user=user).order_by('-created_at')[:5]

    context = {
        'section': 'dashboard',
        'kpis': {
            'total_students': total_students,
            'active_students': active_students,
            'sessions_total': sessions_total,
            'sessions_open': sessions_open,
            'referrals_total': referrals_total,
            'referrals_pending': referrals_pending,
            'inventory_total': inventory_total,
            'borrowed_active': borrowed_active,
            'low_stock_count': len(low_stock_items),
        },
        'counseling_trend': counseling_trend,
        'referral_trend': referral_trend,
        'concern_chart': concern_chart,
        'concern_labels': concern_labels,
        'concern_values': concern_values,
        'concern_colors': concern_colors,
        'activity_logs': activity_logs,
        'user_notifications': user_notifications,
        'low_stock_items': low_stock_items[:5],
    }
    return render(request, 'admin/dashboard.html', context)
