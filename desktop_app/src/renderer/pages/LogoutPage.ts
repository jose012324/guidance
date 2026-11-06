/**
 * Logout page — premium editorial design.
 * Shows a "signing out" animation, calls the logout API, then redirects to login.
 */
import { div, span, icon, p, h1 } from '../lib/dom';
import { authApi, settingsApi, resolveMediaUrl } from '../lib/api';
import { setUser } from '../lib/auth';
import { navigate } from '../lib/router';

export async function LogoutPage(): Promise<HTMLElement> {
  // Fetch public settings for dynamic school name and logo
  let schoolName = 'Guidance Office';
  let schoolLogo: string | null = null;
  try {
    const res = await settingsApi.public();
    if (res.success && res.data) {
      schoolName = res.data.settings.school_name || schoolName;
      schoolLogo = resolveMediaUrl(res.data.settings.school_logo);
    }
  } catch {}

  const shell = div('logout-shell', []);

  const card = div('logout-card', [], { 'data-aos': 'zoom-in' });

  // Spinner
  const spinner = div('logout-spinner', [
    div('logout-ring'),
    div('logout-icon', [icon('box-arrow-right')]),
  ]);

  // Brand
  const brandMark = schoolLogo
    ? (() => { const img = document.createElement('img'); img.src = schoolLogo; img.alt = 'logo'; img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:var(--radius-sm);'; return img; })()
    : icon('mortarboard-fill');
  const brand = div('logout-brand', [
    div('logout-brand-mark', [brandMark]),
    div('logout-brand-text', [
      div('logout-brand-name', [schoolName]),
      div('logout-brand-sub', ['Records & Inventory']),
    ]),
  ]);

  // Eyebrow
  const eyebrow = div('logout-eyebrow', [
    span('logout-eyebrow-line'),
    span('', ['Signing out']),
  ]);

  const title = h1('logout-title', ['See you soon.']);
  const sub = p('logout-sub', [
    `Securely closing your session. Thank you for using the ${schoolName} system.`,
  ]);

  // Progress bar
  const progress = div('logout-progress', [div('logout-progress-fill')]);
  const progressLabel = p('logout-progress-label', [
    'Destroying session · Recording logout · Redirecting…',
  ]);

  card.appendChild(spinner);
  card.appendChild(brand);
  card.appendChild(eyebrow);
  card.appendChild(title);
  card.appendChild(sub);
  card.appendChild(progress);
  card.appendChild(progressLabel);

  // Decorative circles
  shell.appendChild(card);
  shell.appendChild(div('logout-deco logout-deco-1'));
  shell.appendChild(div('logout-deco logout-deco-2'));
  shell.appendChild(div('logout-deco logout-deco-3'));

  // Inject styles (scoped to this page only)
  injectLogoutStyles();

  // Auto-perform logout after 1.5s (matches progress bar animation)
  setTimeout(async () => {
    try {
      await authApi.logout();
    } catch { /* ignore network errors */ }
    setUser(null);
    navigate('/login');
  }, 1500);

  return shell;
}

function injectLogoutStyles(): void {
  if (document.getElementById('logout-styles')) return;
  const style = document.createElement('style');
  style.id = 'logout-styles';
  style.textContent = `
    .logout-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background:
        radial-gradient(circle at 20% 30%, var(--accent-soft) 0%, transparent 50%),
        linear-gradient(135deg, var(--bg) 0%, var(--surface) 100%);
      position: relative;
      overflow: hidden;
    }
    .logout-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      padding: 3.5rem 3rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: var(--shadow-xl);
      position: relative;
      z-index: 2;
    }
    .logout-spinner {
      position: relative;
      width: 80px;
      height: 80px;
      margin: 0 auto 1.75rem;
    }
    .logout-ring {
      position: absolute;
      inset: 0;
      border: 3px solid var(--accent-soft);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: l-spin 1s linear infinite;
    }
    .logout-icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      color: var(--accent);
      animation: l-pulse 1.5s ease-in-out infinite;
    }
    @keyframes l-spin { to { transform: rotate(360deg); } }
    @keyframes l-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: .7; }
    }
    .logout-brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .75rem;
      margin-bottom: 2rem;
    }
    .logout-brand-mark {
      width: 36px; height: 36px;
      border-radius: var(--radius-sm);
      background: linear-gradient(135deg, var(--accent), var(--accent-darker));
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem;
      box-shadow: var(--shadow-accent);
    }
    .logout-brand-text { text-align: left; }
    .logout-brand-name {
      font-family: var(--font-serif);
      font-weight: 700;
      font-size: .95rem;
      line-height: 1.2;
      color: var(--text);
    }
    .logout-brand-sub {
      font-size: .65rem;
      color: var(--text-muted);
      letter-spacing: .15em;
      text-transform: uppercase;
    }
    .logout-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: .65rem;
      margin-bottom: 1rem;
    }
    .logout-eyebrow-line {
      width: 28px; height: 1px;
      background: var(--accent);
    }
    .logout-eyebrow span:last-child {
      font-size: .72rem;
      text-transform: uppercase;
      letter-spacing: .25em;
      color: var(--accent);
      font-weight: 600;
    }
    .logout-title {
      font-family: var(--font-serif);
      font-size: 2.2rem;
      font-weight: 700;
      letter-spacing: -.025em;
      margin-bottom: .85rem;
    }
    .logout-sub {
      color: var(--text-muted);
      font-size: .92rem;
      line-height: 1.65;
      margin-bottom: 1.75rem;
      max-width: 380px;
      margin-left: auto;
      margin-right: auto;
    }
    .logout-progress {
      height: 4px;
      background: var(--surface-2);
      border-radius: var(--radius-pill);
      overflow: hidden;
      margin-bottom: .85rem;
    }
    .logout-progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--accent) 0%, var(--accent-bright) 100%);
      border-radius: var(--radius-pill);
      animation: l-progress 1.5s ease-out forwards;
    }
    @keyframes l-progress { from { width: 0%; } to { width: 100%; } }
    .logout-progress-label {
      font-size: .72rem;
      color: var(--text-soft);
      margin: 0;
      font-family: var(--font-mono);
      letter-spacing: .02em;
    }
    .logout-deco {
      position: absolute;
      border: 1px solid var(--border);
      border-radius: 50%;
      pointer-events: none;
      z-index: 1;
    }
    .logout-deco-1 { width: 400px; height: 400px; top: -150px; right: -100px; opacity: .5; }
    .logout-deco-2 { width: 250px; height: 250px; bottom: -100px; left: -80px; opacity: .4; }
    .logout-deco-3 { width: 120px; height: 120px; top: 30%; left: 10%; opacity: .3; }
    @media (max-width: 575.98px) {
      .logout-card { padding: 2.5rem 1.75rem; }
      .logout-title { font-size: 1.75rem; }
    }
  `;
  document.head.appendChild(style);
}
