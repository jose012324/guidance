"""
Configurations app — system / school settings (Phase 25).

A single-row table holds all school branding & configuration. The first row is
always the active configuration (the rest are historical snapshots — future-proof).
"""
from django.db import models


class SchoolSettings(models.Model):
    """Single-row school configuration. Use `SchoolSettings.get_settings()` for access."""

    THEME_LIGHT = 'light'
    THEME_DARK = 'dark'
    THEME_CHOICES = [
        (THEME_LIGHT, 'Light Mode'),
        (THEME_DARK, 'Dark Mode'),
    ]

    # Identity
    school_name = models.CharField(max_length=200, default='Guidance Office')
    school_logo = models.ImageField(upload_to='school/', blank=True, null=True)
    school_address = models.TextField(blank=True)
    school_year = models.CharField(max_length=20, default='2025-2026')

    # Contact
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)

    # Branding
    system_title = models.CharField(max_length=200, default='Guidance Office Records Inventory Management System')
    footer_text = models.CharField(max_length=255, blank=True)
    default_theme = models.CharField(max_length=10, choices=THEME_CHOICES, default=THEME_LIGHT)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_updated'
    )

    class Meta:
        verbose_name_plural = 'School settings'

    def __str__(self):
        return self.school_name

    @classmethod
    def get_settings(cls):
        """Always return the most recent settings row, creating one if necessary."""
        obj, _ = cls.objects.get_or_create(pk=1, defaults={})
        return obj
