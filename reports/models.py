"""
Reports app — saved / scheduled reports (Phase 22).

The actual reports are computed on-the-fly in views.py from real DB data.
This model captures report metadata for saved/scheduled reports only.
"""
from django.db import models

from accounts.models import User


class SavedReport(models.Model):
    """A saved report snapshot (manual or scheduled)."""

    REPORT_TYPES = [
        ('students', 'Student Report'),
        ('counseling', 'Counseling Report'),
        ('referrals', 'Referral Report'),
        ('inventory', 'Inventory Report'),
        ('borrowing', 'Borrowing Report'),
        ('user_activity', 'User Activity Report'),
    ]

    name = models.CharField(max_length=200)
    report_type = models.CharField(max_length=30, choices=REPORT_TYPES)
    parameters = models.JSONField(default=dict, blank=True, help_text='Filters used to generate this report')
    generated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='saved_reports'
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.name} ({self.get_report_type_display()})"
