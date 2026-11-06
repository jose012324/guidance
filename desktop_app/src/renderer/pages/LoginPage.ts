/**
 * Login page — desktop variant.
 * Matches Django public/login.html with dynamic school name.
 */
import { div, span, h1, p, button, icon, el } from '../lib/dom';
import { navigate } from '../lib/router';
import { authApi, setCsrfToken, settingsApi, resolveMediaUrl } from '../lib/api';
import { setUser } from '../lib/auth';
import { toastError, toastSuccess } from '../lib/toast';
import { showModal } from '../components/Modal';

export async function LoginPage(): Promise<HTMLElement> {
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

  const usernameField = div('auth-field', [
    el('label', 'form-label', ['Username or Email']),
    div('auth-input-wrap', [
      icon('person'),
      (() => {
        const input = el('input', 'form-control') as HTMLInputElement;
        input.name = 'username';
        input.placeholder = 'username or email';
        input.required = true;
        input.autofocus = true;
        return input;
      })(),
    ]),
  ]);

  const passwordInput = el('input', 'form-control') as HTMLInputElement;
  passwordInput.type = 'password';
  passwordInput.name = 'password';
  passwordInput.placeholder = '••••••••';
  passwordInput.required = true;

  const toggleBtn = button('auth-toggle-pw', [icon('eye')], () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleBtn.innerHTML = '<i class="bi bi-eye-slash"></i>';
    } else {
      passwordInput.type = 'password';
      toggleBtn.innerHTML = '<i class="bi bi-eye"></i>';
    }
  });
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('aria-label', 'Show or hide password');

  const passwordField = div('auth-field', [
    el('label', 'form-label', ['Password']),
    div('auth-input-wrap', [icon('lock'), passwordInput, toggleBtn]),
  ]);

  const rememberInput = el('input', 'form-check-input') as HTMLInputElement;
  rememberInput.type = 'checkbox';
  rememberInput.id = 'rememberMe';

  const forgotLink = el('a', '') as HTMLAnchorElement;
  forgotLink.href = '#';
  forgotLink.className = 'small';
  forgotLink.style.color = 'var(--accent)';
  forgotLink.style.fontWeight = '500';
  forgotLink.textContent = 'Forgot password?';
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForgotPasswordModal();
  });

  const row = div('d-flex justify-content-between align-items-center', [
    div('form-check', [rememberInput, el('label', 'form-check-label small', ['Remember me'], { for: 'rememberMe' })]),
    forgotLink,
  ]);

  const submitBtn = button('btn btn-primary btn-lg w-100 auth-submit', [
    icon('box-arrow-in-right'), span('', ['Sign In']),
  ]);
  submitBtn.type = 'submit';

  form.appendChild(usernameField);
  form.appendChild(passwordField);
  form.appendChild(row);
  form.appendChild(submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Signing in…</span>';
    try {
      const res = await authApi.login(usernameField.querySelector('input')!.value, passwordInput.value, rememberInput.checked);
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        // Set CSRF token from login response
        if (res.data?.csrf_token) {
          setCsrfToken(res.data.csrf_token);
        }
        toastSuccess('Welcome back!');
        navigate('/dashboard');
      }
    } catch (err: any) {
      toastError(err.message || 'Login failed');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(icon('box-arrow-in-right'));
      submitBtn.appendChild(span('', ['Sign In']));
    }
  });

  const backLink = el('a', 'auth-back-link') as HTMLAnchorElement;
  backLink.href = '#';
  backLink.innerHTML = '<i class="bi bi-arrow-left"></i> Back to home';
  backLink.addEventListener('click', (e) => { e.preventDefault(); navigate('/'); });

  const shell = div('auth-shell', [
    div('auth-visual', [
      backLink,
      div('auth-visual-content', [
        div('auth-visual-eyebrow', [`${schoolName} · ${schoolYear || 'Welcome'}`]),
        h1('auth-visual-title', ['Welcome', document.createElement('br'), el('em', '', ['back.'])]),
        p('auth-visual-sub', ['Sign in to manage student records, counseling sessions, referrals, and office inventory from one secure dashboard.']),
        div('auth-visual-features', [
          div('auth-visual-feature', [icon('shield-lock-fill'), span('', ['Secure login with lockout protection'])]),
          div('auth-visual-feature', [icon('people-fill'), span('', ['Role-based access control'])]),
          div('auth-visual-feature', [icon('clock-history'), span('', ['Full audit trail of every action'])]),
        ]),
        div('auth-visual-meta', [
          span('', [icon('shield-check'), span('', ['Secure'])]),
          span('', ['·']),
          span('', [icon('people'), span('', ['Role-Based'])]),
          span('', ['·']),
          span('', [icon('phone'), span('', ['Mobile-First'])]),
        ]),
      ]),
      div('auth-visual-deco auth-deco-1', []),
      div('auth-visual-deco auth-deco-2', []),
      div('auth-visual-deco auth-deco-3', []),
    ]),
    div('auth-form-panel', [
      div('auth-form-wrap', [
        div('auth-brand', [
          div(schoolLogo ? 'auth-brand-mark' : 'auth-brand-mark', [
            schoolLogo
              ? (() => { const img = document.createElement('img'); img.src = schoolLogo; img.alt = 'logo'; img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:var(--radius-sm);'; return img; })()
              : icon('mortarboard-fill')
          ]),
          div('', [
            div('auth-brand-name', [schoolName]),
            div('auth-brand-sub', ['Records & Inventory']),
          ]),
        ]),
        div('auth-form-eyebrow', [span('auth-eyebrow-line'), span('', ['Sign in'])]),
        h1('auth-form-title', ['Access your', document.createElement('br'), 'dashboard.']),
        p('auth-form-sub', ['Enter your credentials to continue.']),
        form,
        // Register entry point temporarily disabled.
        // div('auth-form-footnote', [
        //   span('', ["Don't have an account?"]),
        //   a('/register', '', ['Create one →']),
        // ]),
      ]),
    ]),
  ]);

  // Register entry point temporarily disabled.
  // const link = shell.querySelector('a[href="#/register"]');
  // if (link) link.addEventListener('click', (e) => { e.preventDefault(); navigate('/register'); });

  return shell;
}

/**
 * Forgot password modal — matches the Django SweetAlert info dialog.
 */
function showForgotPasswordModal(): void {
  const body = div('', [
    div('d-flex gap-3', [
      div('stat-icon bg-info', [icon('info-circle-fill')], { style: 'width: 48px; height: 48px; flex-shrink: 0;' } as any),
      div('', [
        p('mb-2', ['Password resets are managed by the system administrator for security purposes.']),
        p('mb-0 text-muted-soft small', ['Please contact your administrator at the Guidance Office to request a password reset. You will need to provide your username or email.']),
      ]),
    ]),
  ]);
  const footer = div('modal-footer', [
    button('btn btn-primary', [span('', ['Got it'])], () => modal.close()),
  ]);
  const modal = showModal({
    title: 'Forgot Password',
    body,
    footer,
    size: 'sm',
  });
}
