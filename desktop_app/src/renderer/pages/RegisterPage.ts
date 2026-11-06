/**
 * Register page — desktop variant.
 * Matches Django public/register.html with dynamic school name.
 */
import { div, span, h1, h2, p, button, icon, el } from '../lib/dom';
import { navigate } from '../lib/router';
import { authApi, settingsApi, resolveMediaUrl } from '../lib/api';
import { toastError, toastSuccess } from '../lib/toast';
import { loadingEl } from '../components/PageWrapper';

export async function RegisterPage(): Promise<HTMLElement> {
  // Fetch public settings for dynamic school name and logo
  let schoolName = 'Guidance Office';
  let schoolYear = '';
  let schoolLogo: string | null = null;
  try {
    const res = await settingsApi.public();
    if (res.success && res.data) {
      schoolName = res.data.settings.school_name || schoolName;
      schoolYear = res.data.settings.school_year || schoolYear;
      schoolLogo = resolveMediaUrl(res.data.settings.school_logo);
    }
  } catch {}

  const form = el('form', 'auth-form') as HTMLFormElement;

  // Section 01 — Personal Information
  const personalSection = div('auth-section', [
    div('auth-section-label', ['01 — Personal Information']),
    div('row g-3', [
      div('col-md-4', [el('label', 'form-label', ['First Name *']), el('input', 'form-control', [], { type: 'text', name: 'first_name', required: 'true' })]),
      div('col-md-4', [el('label', 'form-label', ['Middle Name']), el('input', 'form-control', [], { type: 'text', name: 'middle_name' })]),
      div('col-md-4', [el('label', 'form-label', ['Last Name *']), el('input', 'form-control', [], { type: 'text', name: 'last_name', required: 'true' })]),
    ]),
  ]);
  form.appendChild(personalSection);

  // Section 02 — Account Information
  const accountSection = div('auth-section', [
    div('auth-section-label', ['02 — Account Information']),
    div('row g-3', [
      div('col-md-6', [el('label', 'form-label', ['Username *']), el('input', 'form-control', [], { type: 'text', name: 'username', required: 'true' })]),
      div('col-md-6', [el('label', 'form-label', ['Email *']), el('input', 'form-control', [], { type: 'email', name: 'email', required: 'true' })]),
    ]),
    div('row g-3 mt-1', [
      div('col-md-6', [
        el('label', 'form-label', ['Password']),
        div('auth-input-wrap', [icon('lock'), el('input', 'form-control', [], { type: 'password', name: 'password1', id: 'password1', required: 'true' })]),
        div('auth-strength', [
          div('auth-strength-bar', [div('auth-strength-fill', [], { id: 'strengthBar' })]),
          el('small', 'text-muted-soft', ['At least 8 characters with a mix of letters and numbers.']),
        ]),
      ]),
      div('col-md-6', [
        el('label', 'form-label', ['Confirm Password']),
        div('auth-input-wrap', [icon('lock-fill'), el('input', 'form-control', [], { type: 'password', name: 'password2', required: 'true' })]),
      ]),
    ]),
  ]);
  form.appendChild(accountSection);

  // Section 03 — Role Selection
  const roleSelect = el('select', 'form-select', [], { name: 'role', required: 'true' }) as HTMLSelectElement;
  roleSelect.appendChild(new Option('— Select Role —', ''));
  const roleSection = div('auth-section', [
    div('auth-section-label', ['03 — Role Selection']),
    el('label', 'form-label', ['Role *']),
    roleSelect,
    div('auth-role-hints', [
      div('auth-role-hint', [icon('shield-fill'), div('', [el('strong', '', ['Administrator']), span('', ['Full system access'])])]),
      div('auth-role-hint', [icon('people-fill'), div('', [el('strong', '', ['Guidance Staff']), span('', ['Students, counseling, referrals, inventory'])])]),
      div('auth-role-hint', [icon('chat-heart-fill'), div('', [el('strong', '', ['Counselor']), span('', ['Student profiles, counseling, referrals'])])]),
    ]),
  ]);
  form.appendChild(roleSection);

  // Load roles
  authApi.roles().then(res => {
    if (res.success && res.data) {
      for (const r of res.data) {
        roleSelect.appendChild(new Option(r.name, String(r.id)));
      }
    }
  }).catch(() => {});

  const submitBtn = button('btn btn-primary btn-lg w-100 auth-submit', [
    icon('person-plus'), span('', ['Create Account']),
  ]);
  submitBtn.type = 'submit';
  form.appendChild(submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw1 = form.querySelector('[name="password1"]') as HTMLInputElement;
    const pw2 = form.querySelector('[name="password2"]') as HTMLInputElement;
    if (pw1.value !== pw2.value) {
      toastError('Passwords do not match');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Creating…</span>';
    try {
      const formData = new FormData(form);
      const data: any = {};
      formData.forEach((value, key) => { data[key] = value; });
      data.role = Number(data.role);
      const res = await authApi.register(data);
      if (res.success) {
        toastSuccess('Account created — pending admin approval');
        navigate('/login');
      }
    } catch (err: any) {
      toastError(err.message || 'Registration failed');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(icon('person-plus'));
      submitBtn.appendChild(span('', ['Create Account']));
    }
  });

  // Password strength indicator
  setTimeout(() => {
    const pwInput = document.getElementById('password1');
    const strengthBar = document.getElementById('strengthBar');
    if (pwInput && strengthBar) {
      pwInput.addEventListener('input', function () {
        const v = (this as HTMLInputElement).value;
        let score = 0;
        if (v.length >= 8) score++;
        if (/[A-Z]/.test(v)) score++;
        if (/[a-z]/.test(v)) score++;
        if (/[0-9]/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        const widths = ['0%', '20%', '40%', '60%', '80%', '100%'];
        const colors = ['#e9ecef', '#b91c1c', '#b91c1c', '#b8730a', '#2c7da0', '#1c7c54'];
        strengthBar.style.width = widths[score];
        strengthBar.style.background = colors[score] || '#b91c1c';
      });
    }
  }, 100);

  const backLink = el('a', 'auth-back-link') as HTMLAnchorElement;
  backLink.href = '#';
  backLink.innerHTML = '<i class="bi bi-arrow-left"></i> Back to sign in';
  backLink.addEventListener('click', (e) => { e.preventDefault(); navigate('/login'); });

  const shell = div('auth-shell', [
    // LEFT — Visual panel
    div('auth-visual', [
      backLink,
      div('auth-visual-content', [
        div('auth-visual-eyebrow', [`Get Started · ${schoolYear || 'Welcome'}`]),
        h1('auth-visual-title', ['Join the', document.createElement('br'), el('em', '', [schoolName]), document.createElement('br'), 'system.']),
        p('auth-visual-sub', ['Create an account to access student records, counseling workflows, referrals, and inventory. Your account will be reviewed and approved by an administrator before you can sign in.']),
        div('auth-visual-features', [
          div('auth-visual-feature', [icon('people-fill'), span('', ['Three role types: Administrator, Guidance Staff, Counselor'])]),
          div('auth-visual-feature', [icon('shield-lock-fill'), span('', ['Secure password hashing and account lockout protection'])]),
          div('auth-visual-feature', [icon('clipboard-check-fill'), span('', ['Full audit trail of every action across the system'])]),
        ]),
        div('auth-visual-meta', [
          span('', [icon('shield-check'), span('', ['Secure'])]),
          span('', ['·']),
          span('', [icon('people'), span('', ['3 Roles'])]),
          span('', ['·']),
          span('', [icon('phone'), span('', ['Mobile-First'])]),
        ]),
      ]),
      div('auth-visual-deco auth-deco-1', []),
      div('auth-visual-deco auth-deco-2', []),
      div('auth-visual-deco auth-deco-3', []),
    ]),
    // RIGHT — Form panel
    div('auth-form-panel', [
      div('auth-form-wrap', [
        // Brand with dynamic school name
        div('auth-brand', [
          div('auth-brand-mark', [
            schoolLogo
              ? (() => { const img = document.createElement('img'); img.src = schoolLogo; img.alt = 'logo'; img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:var(--radius-sm);'; return img; })()
              : icon('mortarboard-fill')
          ]),
          div('', [div('auth-brand-name', [schoolName]), div('auth-brand-sub', ['Records & Inventory'])]),
        ]),
        // Form header
        div('auth-form-header', [
          div('auth-form-eyebrow', [span('auth-eyebrow-line'), span('', ['Create account'])]),
          h2('auth-form-title', ['Request access', document.createElement('br'), 'to the platform.']),
          p('auth-form-sub', ['Fill out the form below — your administrator will review and approve.']),
        ]),
        form,
        div('auth-form-footnote', [
          span('', ['Already have an account?']),
          (() => {
            const link = el('a', '') as HTMLAnchorElement;
            link.href = '#/login';
            link.style.color = 'var(--accent)';
            link.style.fontWeight = '600';
            link.style.marginLeft = '.35rem';
            link.textContent = 'Sign in';
            link.innerHTML = 'Sign in <i class="bi bi-arrow-right ms-1"></i>';
            link.addEventListener('click', (e) => { e.preventDefault(); navigate('/login'); });
            return link;
          })(),
        ]),
      ]),
    ]),
  ]);

  return shell;
}
