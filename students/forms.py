"""
Students app forms.
"""
from django import forms

from .models import Student, Guardian, StudentDocument


class StudentForm(forms.ModelForm):
    """Student registration / edit form (Phase 12)."""
    class Meta:
        model = Student
        fields = ('student_number', 'first_name', 'middle_name', 'last_name',
                  'gender', 'birthdate', 'address', 'contact_number',
                  'grade_level', 'section', 'school_year', 'status')
        widgets = {
            'student_number': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. 2025-0001'}),
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'middle_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'gender': forms.Select(attrs={'class': 'form-select'}),
            'birthdate': forms.DateInput(attrs={'class': 'form-control datepicker', 'placeholder': 'YYYY-MM-DD'}),
            'address': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            'contact_number': forms.TextInput(attrs={'class': 'form-control'}),
            'grade_level': forms.Select(attrs={'class': 'form-select'}),
            'section': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. BSIT-1A'}),
            'school_year': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. 2025-2026'}),
            'status': forms.Select(attrs={'class': 'form-select'}),
        }

    def clean_student_number(self):
        sn = self.cleaned_data.get('student_number', '').strip()
        qs = Student.objects.filter(student_number__iexact=sn)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError('This student number is already in use.')
        return sn


class GuardianForm(forms.ModelForm):
    class Meta:
        model = Guardian
        fields = ('full_name', 'relationship', 'contact_number', 'email', 'address', 'is_primary')
        widgets = {
            'full_name': forms.TextInput(attrs={'class': 'form-control'}),
            'relationship': forms.Select(attrs={'class': 'form-select'}),
            'contact_number': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'address': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            'is_primary': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }


class StudentDocumentForm(forms.ModelForm):
    class Meta:
        model = StudentDocument
        fields = ('title', 'document_type', 'file', 'description')
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control'}),
            'document_type': forms.Select(attrs={'class': 'form-select'}),
            'file': forms.FileInput(attrs={'class': 'form-control'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
        }


class StudentFilterForm(forms.Form):
    search = forms.CharField(required=False, widget=forms.TextInput(attrs={
        'class': 'form-control', 'placeholder': 'Search name, student number...'
    }))
    grade_level = forms.ChoiceField(required=False, choices=[('', 'All Year Levels')] + Student.GRADE_LEVELS,
                                    widget=forms.Select(attrs={'class': 'form-select'}))
    gender = forms.ChoiceField(required=False, choices=[('', 'All Genders')] + Student.GENDER_CHOICES,
                               widget=forms.Select(attrs={'class': 'form-select'}))
    status = forms.ChoiceField(required=False, choices=[('', 'All Statuses')] + Student.STATUS_CHOICES,
                               widget=forms.Select(attrs={'class': 'form-select'}))
    school_year = forms.CharField(required=False, widget=forms.TextInput(attrs={
        'class': 'form-control', 'placeholder': 'e.g. 2025-2026'
    }))
