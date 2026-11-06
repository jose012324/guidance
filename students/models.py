"""
Students app — student records and personal/academic information.

Models:
    * Student — demographic + contact + academic information
    * Guardian — parent/guardian contact (1-to-many with Student)
    * StudentDocument — uploaded documents (forms, certificates, etc.)
    * ActivityTimeline — activity events tied to a student (CRUD by other modules)

The `Student` model intentionally captures only what the Guidance Office
needs. Other modules (counseling, referrals) reference Student via FK.
"""
from django.db import models
from django.utils import timezone

from accounts.models import User


class Student(models.Model):
    """Core student record. Designed for search/filter by grade/section/gender/year."""

    GENDER_MALE = 'male'
    GENDER_FEMALE = 'female'
    GENDER_OTHER = 'other'
    GENDER_CHOICES = [
        (GENDER_MALE, 'Male'),
        (GENDER_FEMALE, 'Female'),
        (GENDER_OTHER, 'Other'),
    ]

    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'
    STATUS_GRADUATED = 'graduated'
    STATUS_TRANSFERRED = 'transferred'
    STATUS_INC = 'inc'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_INACTIVE, 'Inactive'),
        (STATUS_GRADUATED, 'Graduated'),
        (STATUS_TRANSFERRED, 'Transferred'),
        (STATUS_INC, 'INC'),
    ]

    # Personal information
    student_number = models.CharField(max_length=30, unique=True)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    birthdate = models.DateField(null=True, blank=True)

    # Contact information
    address = models.TextField(blank=True)
    contact_number = models.CharField(max_length=20, blank=True)

    # Academic information
    GRADE_LEVELS = [
        ('1st Year', '1st Year'),
        ('2nd Year', '2nd Year'),
        ('3rd Year', '3rd Year'),
        ('4th Year', '4th Year'),
    ]
    grade_level = models.CharField(max_length=20, choices=GRADE_LEVELS, blank=True)
    section = models.CharField('Course & Section', max_length=100, blank=True)
    school_year = models.CharField(max_length=20, blank=True, help_text='e.g. 2025-2026')

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_ACTIVE)

    # Audit
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='students_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['last_name', 'first_name']
        indexes = [
            models.Index(fields=['grade_level', 'section']),
            models.Index(fields=['school_year']),
            models.Index(fields=['status']),
            models.Index(fields=['gender']),
        ]

    def __str__(self):
        return f"{self.last_name}, {self.first_name} ({self.student_number})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.middle_name} {self.last_name}".strip()

    @property
    def age(self):
        if not self.birthdate:
            return None
        today = timezone.now().date()
        return today.year - self.birthdate.year - (
            (today.month, today.day) < (self.birthdate.month, self.birthdate.day)
        )


class Guardian(models.Model):
    """Parent/guardian contact for a student (1-to-many)."""
    RELATIONSHIP_CHOICES = [
        ('mother', 'Mother'), ('father', 'Father'),
        ('guardian', 'Guardian'), ('sibling', 'Sibling'),
        ('relative', 'Relative'), ('other', 'Other'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='guardians')
    full_name = models.CharField(max_length=150)
    relationship = models.CharField(max_length=20, choices=RELATIONSHIP_CHOICES, default='guardian')
    contact_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_primary', 'full_name']

    def __str__(self):
        return f"{self.full_name} ({self.get_relationship_display()})"


class StudentDocument(models.Model):
    """Documents uploaded to a student's profile (Phase 13)."""
    DOCUMENT_TYPES = [
        ('form', 'Enrollment Form'),
        ('report', 'Report Card'),
        ('certificate', 'Certificate'),
        ('referral', 'Referral Letter'),
        ('medical', 'Medical Record'),
        ('other', 'Other'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=200)
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES, default='other')
    file = models.FileField(upload_to='student_documents/')
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_student_documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.title} — {self.student}"


class ActivityTimeline(models.Model):
    """
    Activity events linked to a student (Phase 13 — activity timeline tab).
    Other modules write to this table when they create/update records for a student.
    """
    ACTIVITY_TYPES = [
        ('counseling', 'Counseling Session'),
        ('referral', 'Referral'),
        ('document', 'Document Uploaded'),
        ('profile', 'Profile Update'),
        ('note', 'Counselor Note'),
        ('other', 'Other'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='student_activities'
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    related_object_id = models.CharField(max_length=40, blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.student} — {self.title} ({self.timestamp:%Y-%m-%d %H:%M})"
