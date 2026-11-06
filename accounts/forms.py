"""
Accounts forms — registration, login, user management, account settings.
"""
from django import forms
from django.contrib.auth.forms import UserCreationForm, PasswordChangeForm
from django.core.exceptions import ValidationError

from .models import User, Role


class LoginForm(forms.Form):
    """Login form supports both username and email + remember-me."""
    username = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Username or Email',
            'autocomplete': 'username',
            'autofocus': True,
        })
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Password',
            'autocomplete': 'current-password',
        })
    )
    remember_me = forms.BooleanField(required=False, widget=forms.CheckboxInput(attrs={'class': 'form-check-input'}))


class RegistrationForm(UserCreationForm):
    """Self-service registration (Phase 4) — requires admin approval."""
    email = forms.EmailField(required=True, widget=forms.EmailInput(attrs={'class': 'form-control'}))
    first_name = forms.CharField(max_length=80, widget=forms.TextInput(attrs={'class': 'form-control'}))
    middle_name = forms.CharField(max_length=80, required=False, widget=forms.TextInput(attrs={'class': 'form-control'}))
    last_name = forms.CharField(max_length=80, widget=forms.TextInput(attrs={'class': 'form-control'}))
    role = forms.ModelChoiceField(
        queryset=Role.objects.all(),
        empty_label='— Select Role —',
        widget=forms.Select(attrs={'class': 'form-select'}),
        help_text='Administrator accounts require approval from an existing administrator.'
    )

    class Meta:
        model = User
        fields = ('first_name', 'middle_name', 'last_name', 'username', 'email', 'password1', 'password2', 'role')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Apply consistent styling
        for field_name in self.fields:
            if field_name not in ('role',):
                widget = self.fields[field_name].widget
                if not widget.attrs.get('class'):
                    widget.attrs['class'] = 'form-control'
        # Password strength hints
        self.fields['password1'].help_text = 'At least 8 characters with a mix of letters and numbers.'

    def clean_email(self):
        email = self.cleaned_data.get('email', '').lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError('An account with this email already exists.')
        return email

    def clean_username(self):
        username = self.cleaned_data.get('username', '').strip()
        if User.objects.filter(username__iexact=username).exists():
            raise ValidationError('This username is already taken.')
        return username

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        user.first_name = self.cleaned_data['first_name']
        user.middle_name = self.cleaned_data.get('middle_name', '')
        user.last_name = self.cleaned_data['last_name']
        user.role = self.cleaned_data['role']
        user.status = User.STATUS_PENDING
        user.is_active = True  # active=True allows login; status=PENDING gates the dashboard
        if commit:
            user.save()
        return user


# ---------------------------------------------------------------------------
# User Management (Phase 9-10) — admin-side forms
# ---------------------------------------------------------------------------
class UserForm(forms.ModelForm):
    """Form for creating/updating users from the admin panel."""
    password = forms.CharField(
        required=False,
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Leave blank to keep current password'}),
        help_text='Leave blank to keep the current password when editing.'
    )

    class Meta:
        model = User
        fields = ('first_name', 'middle_name', 'last_name', 'username', 'email', 'role',
                  'employee_id', 'contact_number', 'status')
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'middle_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'employee_id': forms.TextInput(attrs={'class': 'form-control'}),
            'contact_number': forms.TextInput(attrs={'class': 'form-control'}),
            'role': forms.Select(attrs={'class': 'form-select'}),
            'status': forms.Select(attrs={'class': 'form-select'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.instance or not self.instance.pk:
            self.fields['password'].required = True
            self.fields['password'].label = 'Initial Password'
        # Auto-generate employee ID hint
        if not self.initial.get('employee_id') and not self.instance.pk:
            self.fields['employee_id'].widget.attrs['placeholder'] = 'Auto-generated if blank'

    def clean_email(self):
        email = self.cleaned_data.get('email', '').lower().strip()
        qs = User.objects.filter(email__iexact=email)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise ValidationError('This email is already in use.')
        return email

    def save(self, commit=True):
        user = super().save(commit=False)
        password = self.cleaned_data.get('password')
        if password:
            user.set_password(password)
        if not user.employee_id:
            # Auto-generate employee ID
            prefix = 'EMP'
            last = User.objects.order_by('-id').first()
            next_num = (last.id + 1) if last else 1
            user.employee_id = f"{prefix}-{next_num:05d}"
        if commit:
            user.save()
        return user


class UserFilterForm(forms.Form):
    """Filter form for the user listing page."""
    search = forms.CharField(required=False, widget=forms.TextInput(attrs={
        'class': 'form-control', 'placeholder': 'Search name, username, email, employee id...'
    }))
    role = forms.ModelChoiceField(queryset=Role.objects.all(), required=False, empty_label='All Roles',
                                  widget=forms.Select(attrs={'class': 'form-select'}))
    status = forms.ChoiceField(choices=[('', 'All Statuses')] + User.STATUS_CHOICES, required=False,
                               widget=forms.Select(attrs={'class': 'form-select'}))


# ---------------------------------------------------------------------------
# Account settings (Phase 26)
# ---------------------------------------------------------------------------
class ProfileForm(forms.ModelForm):
    """User-self profile editing (Phase 26)."""
    class Meta:
        model = User
        fields = ('first_name', 'middle_name', 'last_name', 'email', 'contact_number', 'avatar')
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'middle_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'contact_number': forms.TextInput(attrs={'class': 'form-control'}),
            'avatar': forms.FileInput(attrs={'class': 'form-control'}),
        }


class CustomPasswordChangeForm(PasswordChangeForm):
    """Styling-only subclass of Django's PasswordChangeForm."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field_name in self.fields:
            self.fields[field_name].widget.attrs.update({'class': 'form-control'})
