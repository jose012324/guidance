"""
Counseling app — counseling session records.

Models:
    * CounselingSession — individual session record (Phase 14-15)
    * CounselorNote     — free-form notes attached to a session

Statuses follow the plan: Open / Ongoing / Closed.
"""
from django.db import models

from accounts.models import User
from students.models import Student


class CounselingSession(models.Model):
    """A single counseling session between a counselor and a student."""

    STATUS_OPEN = 'open'
    STATUS_ONGOING = 'ongoing'
    STATUS_CLOSED = 'closed'
    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open'),
        (STATUS_ONGOING, 'Ongoing'),
        (STATUS_CLOSED, 'Closed'),
    ]

    CONCERN_TYPES = [
        ('academic', 'Academic Concern'),
        ('behavioral', 'Behavioral Concern'),
        ('personal', 'Personal / Family'),
        ('social', 'Peer / Social'),
        ('career', 'Career Guidance'),
        ('mental_health', 'Mental Health'),
        ('crisis', 'Crisis Intervention'),
        ('follow_up', 'Follow-Up'),
        ('other', 'Other'),
    ]

    # Core fields ---------------------------------------------------------
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='counseling_sessions')
    counselor = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name='counseling_sessions',
        limit_choices_to={'role__name': 'Counselor'},
    )
    session_date = models.DateField()
    concern_type = models.CharField(max_length=30, choices=CONCERN_TYPES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_OPEN)

    # Content -------------------------------------------------------------
    summary = models.TextField(blank=True, help_text='Brief summary of the session')
    notes = models.TextField(blank=True, help_text='Detailed session notes')
    recommendations = models.TextField(blank=True, help_text='Recommendations / next steps')
    follow_up_date = models.DateField(null=True, blank=True)

    # Audit ---------------------------------------------------------------
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='counseling_sessions_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-session_date', '-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['concern_type']),
            models.Index(fields=['counselor', 'session_date']),
            models.Index(fields=['session_date']),
        ]

    def __str__(self):
        return f"{self.student} — {self.get_concern_type_display()} ({self.session_date})"


class CounselorNote(models.Model):
    """Free-form notes attached to a counseling session (progress tracking)."""
    session = models.ForeignKey(CounselingSession, on_delete=models.CASCADE, related_name='counselor_notes')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='counselor_notes')
    note = models.TextField()
    is_private = models.BooleanField(default=False, help_text='Private notes visible only to the author')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Note by {self.author} on {self.session}"
