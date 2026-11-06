"""
Notifications app — system-wide notification center (Phase 24).

Each Notification is targeted at a single user (inbox-style), or broadcast to
all users when `user` is NULL (system-wide alert). `NotificationType` defines
the categories that trigger notifications (low stock, new referral, follow-up, etc).
"""
from django.db import models

from accounts.models import User


class Notification(models.Model):
    """A single notification message targeted at a user (or system-wide if user is NULL)."""

    CATEGORY_LOW_STOCK = 'low_stock'
    CATEGORY_NEW_REFERRAL = 'new_referral'
    CATEGORY_FOLLOW_UP = 'counseling_follow_up'
    CATEGORY_OVERDUE = 'overdue_borrowed'
    CATEGORY_SYSTEM = 'system'
    CATEGORY_USER = 'user'
    CATEGORY_CHOICES = [
        (CATEGORY_LOW_STOCK, 'Low Inventory'),
        (CATEGORY_NEW_REFERRAL, 'New Referral'),
        (CATEGORY_FOLLOW_UP, 'Counseling Follow-up'),
        (CATEGORY_OVERDUE, 'Overdue Borrowed Items'),
        (CATEGORY_SYSTEM, 'System'),
        (CATEGORY_USER, 'User'),
    ]

    PRIORITY_LOW = 'low'
    PRIORITY_NORMAL = 'normal'
    PRIORITY_HIGH = 'high'
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, 'Low'),
        (PRIORITY_NORMAL, 'Normal'),
        (PRIORITY_HIGH, 'High'),
    ]

    # Target — NULL means system-wide broadcast
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True
    )
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default=CATEGORY_SYSTEM)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL)
    title = models.CharField(max_length=200)
    message = models.TextField()
    link = models.CharField(max_length=255, blank=True, help_text='Optional URL for the notification')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        target = self.user.username if self.user else 'broadcast'
        return f"[{self.priority}] {self.title} → {target}"

    @classmethod
    def create_for_role(cls, *, role_name, **kwargs):
        """Broadcast a notification to every user with the given role."""
        notifications = []
        for user in User.objects.filter(role__name=role_name, is_active=True):
            notifications.append(cls(user=user, **kwargs))
        return cls.objects.bulk_create(notifications)

    @classmethod
    def broadcast(cls, **kwargs):
        """Broadcast a notification to every active user."""
        notifications = []
        for user in User.objects.filter(is_active=True):
            notifications.append(cls(user=user, **kwargs))
        return cls.objects.bulk_create(notifications)
