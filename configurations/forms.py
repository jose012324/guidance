"""
Configurations app forms (Phase 25).
"""
from django import forms

from .models import SchoolSettings


class SchoolSettingsForm(forms.ModelForm):
    """School-wide configuration form."""
    class Meta:
        model = SchoolSettings
        fields = ('school_name', 'school_logo', 'school_address', 'school_year',
                  'contact_email', 'contact_phone', 'system_title', 'footer_text',
                  'default_theme')
        widgets = {
            'school_name': forms.TextInput(attrs={'class': 'form-control'}),
            'school_logo': forms.FileInput(attrs={'class': 'form-control'}),
            'school_address': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            'school_year': forms.TextInput(attrs={'class': 'form-control'}),
            'contact_email': forms.EmailInput(attrs={'class': 'form-control'}),
            'contact_phone': forms.TextInput(attrs={'class': 'form-control'}),
            'system_title': forms.TextInput(attrs={'class': 'form-control'}),
            'footer_text': forms.TextInput(attrs={'class': 'form-control'}),
            'default_theme': forms.Select(attrs={'class': 'form-select'}),
        }


class DatabaseBackupForm(forms.Form):
    """Manual backup trigger (Phase 23)."""
    confirm = forms.BooleanField(required=True, label='I understand this will create a backup file.',
                                 widget=forms.CheckboxInput(attrs={'class': 'form-check-input'}))
