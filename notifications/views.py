"""
Notifications app views (Phase 24).
"""
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone

from accounts.permissions import can
from .models import Notification


@login_required
def notification_list(request):
    """User's notification inbox."""
    qs = Notification.objects.filter(user=request.user)
    filter_val = request.GET.get('filter', 'all')
    if filter_val == 'unread':
        qs = qs.filter(is_read=False)
    qs = qs.order_by('-created_at')

    paginator = Paginator(qs, 20)
    notifications = paginator.get_page(request.GET.get('page'))

    return render(request, 'notifications/list.html', {
        'notifications': notifications, 'filter': filter_val, 'section': 'notifications',
        'unread_count': Notification.objects.filter(user=request.user, is_read=False).count(),
    })


@login_required
def mark_read(request, pk):
    n = get_object_or_404(Notification, pk=pk, user=request.user)
    n.is_read = True
    n.read_at = timezone.now()
    n.save()
    if n.link:
        return redirect(n.link)
    return redirect('notifications:list')


@login_required
def mark_all_read(request):
    if request.method == 'POST':
        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        messages.success(request, 'All notifications marked as read.')
    return redirect('notifications:list')


@login_required
def unread_count(request):
    """JSON endpoint for AJAX polling."""
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return JsonResponse({'count': count})
