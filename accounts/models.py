"""
Accounts app — User authentication, roles, profiles, login audit.

This module defines:
    * User (custom user model — supports email/username login)
    * Role (RBAC roles: Administrator, Guidance Staff, Counselor)
    * Profile (extended user attributes — employee id, avatar)
    * LoginAttempt (failed login tracking → account lockout protection)
    * LoginLog (login/logout audit trail)
    * SystemLog (universal audit trail — CRUD operations across modules)

Design goals:
    * Single source of truth for authentication across the entire system.
    * Role-based access control driven by the `Role` model.
    * Audit trail persisted in `SystemLog` so every CRUD operation can be traced.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


# ---------------------------------------------------------------------------
# Roles — defined as a model to allow runtime management (future-proofing)
# ---------------------------------------------------------------------------
class Role(models.Model):
    """
    Represents an RBAC role. Seeded with three core roles at migration time:
        * Administrator — full system access
        * Guidance Staff — students / counseling / referrals / inventory
        * Counselor    — student profiles / counseling / referrals
    """
    ADMINISTRATOR = 'Administrator'
    GUIDANCE_STAFF = 'Guidance Staff'
    COUNSELOR = 'Counselor'

    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class User(AbstractUser):
    """
    Custom user model — supports both username and email login.
    Adds role, status, and approval workflow fields.
    """
    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'
    STATUS_PENDING = 'pending'
    STATUS_LOCKED = 'locked'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_INACTIVE, 'Inactive'),
        (STATUS_PENDING, 'Pending Approval'),
        (STATUS_LOCKED, 'Locked'),
    ]

    # Auth fields
    email = models.EmailField(unique=True)
    # Role
    role = models.ForeignKey(
        Role, on_delete=models.PROTECT, related_name='users', null=True, blank=True
    )
    # Profile
    middle_name = models.CharField(max_length=80, blank=True)
    employee_id = models.CharField(max_length=30, unique=True, null=True, blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    # Status / approval workflow
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_PENDING)
    approved_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_users'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Convenience flags ------------------------------------------------------
    @property
    def full_name(self):
        parts = [self.first_name, self.middle_name, self.last_name]
        return ' '.join(p for p in parts if p).strip() or self.username

    @property
    def is_administrator(self):
        return self.role_id is not None and self.role.name == Role.ADMINISTRATOR

    @property
    def is_guidance_staff(self):
        return self.role_id is not None and self.role.name == Role.GUIDANCE_STAFF

    @property
    def is_counselor(self):
        return self.role_id is not None and self.role.name == Role.COUNSELOR

    @property
    def is_active_staff(self):
        """User is considered 'active' for system access checks."""
        return self.status == self.STATUS_ACTIVE and self.is_active

    def __str__(self):
        return f"{self.full_name} ({self.username})"


# ---------------------------------------------------------------------------
# Login attempts — failed login tracking → lockout protection
# ---------------------------------------------------------------------------
class LoginAttempt(models.Model):
    """Tracks failed login attempts per username + IP for lockout protection."""
    username = models.CharField(max_length=150, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    success = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['username', 'success', 'timestamp']),
        ]

    @classmethod
    def count_recent_failures(cls, username, minutes=15):
        """Return number of failed attempts for username in last `minutes`."""
        threshold = timezone.now() - timezone.timedelta(minutes=minutes)
        return cls.objects.filter(
            username=username, success=False, timestamp__gte=threshold
        ).count()


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------
class LoginLog(models.Model):
    """Persistent login/logout audit trail."""
    ACTION_LOGIN = 'login'
    ACTION_LOGOUT = 'logout'
    ACTION_FAILED = 'failed'
    ACTION_CHOICES = [
        (ACTION_LOGIN, 'Login'),
        (ACTION_LOGOUT, 'Logout'),
        (ACTION_FAILED, 'Failed Login'),
    ]
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='login_logs'
    )
    username_attempted = models.CharField(max_length=150)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.get_action_display()} — {self.username_attempted} @ {self.timestamp:%Y-%m-%d %H:%M}"


class SystemLog(models.Model):
    """
    Universal audit trail — every CRUD action across the entire system is
    recorded here for the Database Management module (Phase 23).
    """
    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'
    ACTION_DELETE = 'delete'
    ACTION_LOGIN = 'login'
    ACTION_LOGOUT = 'logout'
    ACTION_EXPORT = 'export'
    ACTION_BACKUP = 'backup'
    ACTION_RESTORE = 'restore'
    ACTION_CHOICES = [
        (ACTION_CREATE, 'Create'),
        (ACTION_UPDATE, 'Update'),
        (ACTION_DELETE, 'Delete'),
        (ACTION_LOGIN, 'Login'),
        (ACTION_LOGOUT, 'Logout'),
        (ACTION_EXPORT, 'Export'),
        (ACTION_BACKUP, 'Backup'),
        (ACTION_RESTORE, 'Restore'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='system_logs'
    )
    action = models.CharField(max_length=15, choices=ACTION_CHOICES)
    entity = models.CharField(max_length=80)         # e.g. "Student", "InventoryItem"
    entity_id = models.CharField(max_length=40, blank=True)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['entity', 'action']),
            models.Index(fields=['user', 'timestamp']),
        ]

    def __str__(self):
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.user} — {self.action} {self.entity}"

    @classmethod
    def log(cls, *, user=None, action=None, entity='', entity_id='', description='', request=None):
        """Helper for unified audit logging across all apps."""
        ip = None
        if request is not None:
            xff = request.META.get('HTTP_X_FORWARDED_FOR')
            if xff:
                ip = xff.split(',')[0].strip()
            else:
                ip = request.META.get('REMOTE_ADDR')
        return cls.objects.create(
            user=user, action=action, entity=entity, entity_id=str(entity_id),
            description=description, ip_address=ip,
        )
