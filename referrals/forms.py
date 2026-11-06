"""
Referrals app forms (Phase 16-17).
"""
from django import forms

from .models import Referral, ReferralUpdate
from accounts.models import User


class ReferralForm(forms.ModelForm):
    class Meta:
        model = Referral
        fields = ('student', 'referred_by', 'assigned_counselor', 'referral_type',
                  'priority', 'reason', 'description', 'status')
        widgets = {
            'student': forms.HiddenInput(),
            'referred_by': forms.Select(attrs={'class': 'form-select'}),
            'assigned_counselor': forms.Select(attrs={'class': 'form-select'}),
            'referral_type': forms.Select(attrs={'class': 'form-select'}),
            'priority': forms.Select(attrs={'class': 'form-select'}),
            'reason': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 4}),
            'status': forms.Select(attrs={'class': 'form-select'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['assigned_counselor'].queryset = User.objects.filter(role__name='Counselor', is_active=True)
        self.fields['referred_by'].queryset = User.objects.filter(is_active=True)


class ReferralUpdateForm(forms.ModelForm):
    class Meta:
        model = ReferralUpdate
        fields = ('new_status', 'note')
        widgets = {
            'new_status': forms.Select(attrs={'class': 'form-select'}),
            'note': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }


class ReferralFilterForm(forms.Form):
    search = forms.CharField(required=False, widget=forms.TextInput(attrs={
        'class': 'form-control', 'placeholder': 'Search student, reason, or referral type...'
    }))
    status = forms.ChoiceField(required=False, choices=[('', 'All Statuses')] + Referral.STATUS_CHOICES,
                               widget=forms.Select(attrs={'class': 'form-select'}))
    priority = forms.ChoiceField(required=False, choices=[('', 'All Priorities')] + Referral.PRIORITY_CHOICES,
                                 widget=forms.Select(attrs={'class': 'form-select'}))
    referral_type = forms.ChoiceField(required=False, choices=[('', 'All Types')] + Referral.REFERRAL_TYPES,
                                      widget=forms.Select(attrs={'class': 'form-select'}))
