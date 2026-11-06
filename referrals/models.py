"""
Referrals app — referral records and progress tracking.

Models:
    * Referral           — main referral record (Phase 16-17)
    * ReferralUpdate     — timeline / progress tracking entries

Statuses: Pending / Ongoing / Completed (per plan).
"""
from django.db import models

from accounts.models import User
from students.models import Student


class Referral(models.Model):
    """
    A referral is created when a student is referred for counseling, intervention,
    or specialist support. Multiple progress updates (ReferralUpdate) form the timeline.
    """

    STATUS_PENDING = 'pending'
    STATUS_ONGOING = 'ongoing'
    STATUS_COMPLETED = 'completed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ONGOING, 'Ongoing'),
        (STATUS_COMPLETED, 'Completed'),
    ]

    PRIORITY_LOW = 'low'
    PRIORITY_NORMAL = 'normal'
    PRIORITY_HIGH = 'high'
    PRIORITY_URGENT = 'urgent'
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, 'Low'),
        (PRIORITY_NORMAL, 'Normal'),
        (PRIORITY_HIGH, 'High'),
        (PRIORITY_URGENT, 'Urgent'),
    ]

    REFERRAL_TYPES = [
        ('counseling', 'Counseling'),
        ('behavioral', 'Behavioral Intervention'),
        ('academic', 'Academic Intervention'),
        ('psychological', 'Psychological Evaluation'),
        ('medical', 'Medical Referral'),
        ('external', 'External Agency'),
        ('other', 'Other'),
        ('academic_adviser_faculty', 'Academic Adviser / Faculty'),
        ('department_chair_dean', 'Department Chair / Dean'),
        ('student_affairs', 'Student Affairs'),
        ('discipline_office', 'Discipline Office'),
        ('school_clinic_physician', 'School Clinic / Physician'),
        ('licensed_psychologist', 'Licensed Psychologist'),
        ('psychiatrist', 'Psychiatrist'),
        ('social_worker', 'Social Worker'),
        ('scholarship_financial_aid', 'Scholarship/Financial Assistance'),
        ('external_mental_health', 'External Mental Health Provider'),
        ('hospital_emergency_service', 'Hospital / Emergency Service'),
        ('government_social_welfare', 'Government/Social Welfare Agency'),
        ('parent_guardian', 'Parent/Guardian'),
    ]

    # Student / counselor
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='referrals')
    referred_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name='referrals_made',
        help_text='Staff member who created the referral'
    )
    assigned_counselor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_referrals',
        limit_choices_to={'role__name': 'Counselor'},
    )

    # Content
    referral_type = models.CharField(max_length=30, choices=REFERRAL_TYPES)
    priority = models.CharField(max_length=15, choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL)
    reason = models.TextField(help_text='Why is the student being referred?')
    description = models.TextField(blank=True, help_text='Detailed description / context')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_PENDING)

    # Dates
    referred_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-referred_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['referral_type']),
            models.Index(fields=['assigned_counselor']),
        ]

    def __str__(self):
        return f"Referral #{self.id} — {self.student} ({self.get_status_display()})"


class ReferralUpdate(models.Model):
    """
    Progress tracking entries attached to a referral — forms the referral timeline.
    Each update captures a status change, a note, and the user who made it.
    """
    referral = models.ForeignKey(Referral, on_delete=models.CASCADE, related_name='updates')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='referral_updates')
    previous_status = models.CharField(max_length=15, blank=True)
    new_status = models.CharField(max_length=15, choices=Referral.STATUS_CHOICES)
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.referral} — {self.new_status} @ {self.created_at:%Y-%m-%d %H:%M}"
