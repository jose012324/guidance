"""
Counseling app forms (Phase 14-15).
"""
from django import forms

from .models import CounselingSession, CounselorNote
from accounts.models import User


class CounselingSessionForm(forms.ModelForm):
    """Form for creating / editing a counseling session."""
    class Meta:
        model = CounselingSession
        fields = ('student', 'counselor', 'session_date', 'concern_type', 'status',
                  'summary', 'notes', 'recommendations', 'follow_up_date')
        widgets = {
            'student': forms.HiddenInput(),
            'counselor': forms.Select(attrs={'class': 'form-select'}),
            'session_date': forms.DateInput(attrs={'class': 'form-control datepicker'}),
            'concern_type': forms.Select(attrs={'class': 'form-select'}),
            'status': forms.Select(attrs={'class': 'form-select'}),
            'summary': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            'notes': forms.Textarea(attrs={'class': 'form-control', 'rows': 4}),
            'recommendations': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'follow_up_date': forms.DateInput(attrs={'class': 'form-control datepicker'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Counselor choices — only Counselor role users
        self.fields['counselor'].queryset = User.objects.filter(role__name='Counselor', is_active=True)
        # Pre-select student from query param when creating
        if not self.instance.pk and self.initial.get('student'):
            self.fields['student'].initial = self.initial['student']


class CounselorNoteForm(forms.ModelForm):
    class Meta:
        model = CounselorNote
        fields = ('note', 'is_private')
        widgets = {
            'note': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'is_private': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }


class CounselingFilterForm(forms.Form):
    search = forms.CharField(required=False, widget=forms.TextInput(attrs={
        'class': 'form-control', 'placeholder': 'Search student name or summary...'
    }))
    counselor = forms.ModelChoiceField(queryset=None, required=False, empty_label='All Counselors',
                                       widget=forms.Select(attrs={'class': 'form-select'}))
    concern_type = forms.ChoiceField(required=False, choices=[('', 'All Concern Types')] + CounselingSession.CONCERN_TYPES,
                                     widget=forms.Select(attrs={'class': 'form-select'}))
    status = forms.ChoiceField(required=False, choices=[('', 'All Statuses')] + CounselingSession.STATUS_CHOICES,
                               widget=forms.Select(attrs={'class': 'form-select'}))
    date_from = forms.DateField(required=False, widget=forms.DateInput(attrs={'class': 'form-control datepicker', 'placeholder': 'From'}))
    date_to = forms.DateField(required=False, widget=forms.DateInput(attrs={'class': 'form-control datepicker', 'placeholder': 'To'}))

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['counselor'].queryset = User.objects.filter(role__name='Counselor', is_active=True)
