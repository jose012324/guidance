/**
 * Error page — matches Django errors/403.html, 404.html, 500.html.
 * Single parametrized component used for all three error codes.
 */
import { div, span, button, icon, h1, p } from '../lib/dom';
import { navigate } from '../lib/router';
import { getUser } from '../lib/auth';
import { settingsApi } from '../lib/api';

// Cache for school name
let cachedSchoolName = 'Guidance Office';
let schoolNameFetched = false;

async function getSchoolName(): Promise<string> {
  if (schoolNameFetched) return cachedSchoolName;
  try {
    const res = await settingsApi.public();
    if (res.success && res.data) {
      cachedSchoolName = res.data.settings.school_name || cachedSchoolName;
    }
  } catch {}
  schoolNameFetched = true;
  return cachedSchoolName;
}

export interface ErrorPageConfig {
  code: '403' | '404' | '500';
  title: string;
  subtitle: string;
  message: string;
  description: string;
  icon: string;
  /** Optional color theme — 'accent' (default) or 'danger' */
  tone?: 'accent' | 'danger';
  /** Label for the primary action button */
  primaryActionLabel?: string;
  primaryActionIcon?: string;
  primaryActionRoute?: string;
}

export async function ErrorPage(config: ErrorPageConfig): Promise<HTMLElement> {
  const tone = config.tone || 'accent';
  const schoolName = await getSchoolName();
  const primaryLabel = config.primaryActionLabel || 'Back to Dashboard';
  const primaryIcon = config.primaryActionIcon || 'house-fill';
  const primaryRoute = config.primaryActionRoute || (getUser() ? '/dashboard' : '/');

  const shell = div('error-shell', []);
  const grid = div('error-grid', []);

  // LEFT — Big error number
  const visual = div('error-visual', [], { 'data-aos': 'fade-right' });
  visual.appendChild(div('error-eyebrow', [
    span('error-eyebrow-line'),
    span('', [config.subtitle]),
  ]));
  visual.appendChild(div('error-number', [config.code]));
  visual.appendChild(div('error-number-sub', [config.title]));

  // RIGHT — Content
  const content = div('error-content', [], { 'data-aos': 'fade-left' });

  // Brand
  content.appendChild(div('error-brand', [
    div('error-brand-mark', [icon('mortarboard-fill')]),
    div('error-brand-text', [
      div('error-brand-name', [schoolName]),
      div('error-brand-sub', ['Records & Inventory']),
    ]),
  ]));

  // Icon tile
  content.appendChild(div(`error-icon-large ${tone}`, [icon(config.icon)]));

  // Title
  content.appendChild(h1('error-title', [config.message]));

  // Description
  content.appendChild(p('error-sub', [config.description]));

  // Actions
  content.appendChild(div('error-actions', [
    button('btn btn-primary btn-lg', [
      icon(primaryIcon),
      span('', [primaryLabel]),
    ], () => navigate(primaryRoute)),
    button('btn btn-outline-primary btn-lg', [
      span('', ['Go Home']),
    ], () => navigate('/')),
  ]));

  // Meta info
  content.appendChild(div('error-meta', [
    div('error-meta-item', [
      span('error-meta-label', ['Error code']),
      span('error-meta-value', [`${config.code} · ${config.title.replace('— ', '').toUpperCase().replace(/ /g, '_')}`]),
    ]),
    div('error-meta-divider'),
    div('error-meta-item', [
      span('error-meta-label', ['Timestamp']),
      span('error-meta-value', [new Date().toLocaleString()]),
    ]),
  ]));

  grid.appendChild(visual);
  grid.appendChild(content);
  shell.appendChild(grid);

  // Decorative circles
  shell.appendChild(div('error-deco error-deco-1'));
  shell.appendChild(div('error-deco error-deco-2'));

  injectErrorStyles();
  return shell;
}

/** Convenience factories for the three standard error pages. */
export function Error403Page(): Promise<HTMLElement> {
  return ErrorPage({
    code: '403',
    title: '— Forbidden',
    subtitle: 'Error · Access denied',
    message: "You don't have permission to view this page.",
    description: "Your current role doesn't grant access to this resource. If you believe this is a mistake, please contact your administrator to request the appropriate permissions.",
    icon: 'shield-lock-fill',
    tone: 'danger',
  });
}

export function Error404Page(): Promise<HTMLElement> {
  return ErrorPage({
    code: '404',
    title: '— Not Found',
    subtitle: 'Error · Page not found',
    message: "We can't find the page you're looking for.",
    description: "The page may have been moved, deleted, or never existed. Check the URL or use the buttons below to navigate back to familiar territory.",
    icon: 'compass',
    tone: 'accent',
  });
}

export function Error500Page(): Promise<HTMLElement> {
  return ErrorPage({
    code: '500',
    title: '— Internal Server Error',
    subtitle: 'Error · Server error',
    message: 'Something went wrong on our end.',
    description: 'The server encountered an unexpected error. Our team has been notified. Please try again in a few moments, or contact your administrator if the problem persists.',
    icon: 'exclamation-triangle-fill',
    tone: 'danger',
    primaryActionLabel: 'Try Again',
    primaryActionIcon: 'arrow-clockwise',
  });
}

function injectErrorStyles(): void {
  if (document.getElementById('error-styles')) return;
  const style = document.createElement('style');
  style.id = 'error-styles';
  style.textContent = `
    .error-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background:
        radial-gradient(circle at 30% 20%, var(--accent-soft) 0%, transparent 50%),
        linear-gradient(135deg, var(--bg) 0%, var(--surface) 100%);
      position: relative;
      overflow: hidden;
    }
    .error-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
      max-width: 1100px;
      width: 100%;
      position: relative;
      z-index: 2;
    }
    .error-visual { text-align: center; }
    .error-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: .65rem;
      margin-bottom: 1.5rem;
    }
    .error-eyebrow-line {
      width: 32px; height: 1px;
      background: var(--accent);
    }
    .error-eyebrow span:last-child {
      font-size: .72rem;
      text-transform: uppercase;
      letter-spacing: .25em;
      color: var(--accent);
      font-weight: 600;
    }
    .error-number {
      font-family: var(--font-serif);
      font-size: clamp(8rem, 18vw, 16rem);
      font-weight: 700;
      line-height: .85;
      letter-spacing: -.05em;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-darker) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .error-number-sub {
      font-family: var(--font-serif);
      font-style: italic;
      font-size: 1.5rem;
      color: var(--text-muted);
      margin-top: .5rem;
    }
    .error-content { max-width: 480px; }
    .error-brand {
      display: flex;
      align-items: center;
      gap: .75rem;
      margin-bottom: 2rem;
    }
    .error-brand-mark {
      width: 38px; height: 38px;
      border-radius: var(--radius-sm);
      background: linear-gradient(135deg, var(--accent), var(--accent-darker));
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.15rem;
      box-shadow: var(--shadow-accent);
    }
    .error-brand-name {
      font-family: var(--font-serif);
      font-weight: 700;
      font-size: .95rem;
      line-height: 1.2;
    }
    .error-brand-sub {
      font-size: .65rem;
      color: var(--text-muted);
      letter-spacing: .15em;
      text-transform: uppercase;
    }
    .error-icon-large {
      width: 70px; height: 70px;
      border-radius: var(--radius);
      background: var(--accent-soft);
      color: var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-size: 2rem;
      margin-bottom: 1.5rem;
    }
    .error-icon-large.danger {
      background: var(--danger-soft);
      color: var(--danger);
    }
    .error-title {
      font-family: var(--font-serif);
      font-size: clamp(1.8rem, 3vw, 2.3rem);
      line-height: 1.15;
      letter-spacing: -.025em;
      margin-bottom: 1rem;
      font-weight: 700;
    }
    .error-sub {
      color: var(--text-muted);
      font-size: .95rem;
      line-height: 1.7;
      margin-bottom: 2rem;
    }
    .error-actions {
      display: flex;
      gap: .75rem;
      flex-wrap: wrap;
      margin-bottom: 2.5rem;
    }
    .error-meta {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }
    .error-meta-item { display: flex; flex-direction: column; }
    .error-meta-label {
      font-size: .65rem;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: var(--text-muted);
      font-weight: 600;
    }
    .error-meta-value {
      font-family: var(--font-mono);
      font-size: .82rem;
      color: var(--text);
      margin-top: .2rem;
    }
    .error-meta-divider {
      width: 1px;
      height: 32px;
      background: var(--border);
    }
    .error-deco {
      position: absolute;
      border: 1px solid var(--border);
      border-radius: 50%;
      pointer-events: none;
    }
    .error-deco-1 { width: 350px; height: 350px; top: -100px; right: -100px; opacity: .4; }
    .error-deco-2 { width: 200px; height: 200px; bottom: -80px; left: -80px; opacity: .3; }
    @media (max-width: 991.98px) {
      .error-grid { grid-template-columns: 1fr; gap: 2rem; text-align: center; }
      .error-brand { justify-content: center; }
      .error-icon-large { margin-left: auto; margin-right: auto; }
      .error-actions { justify-content: center; }
      .error-meta { justify-content: center; }
      .error-eyebrow { justify-content: center; }
    }
    @media (max-width: 575.98px) {
      .error-number { font-size: 6rem; }
      .error-title { font-size: 1.5rem; }
      .error-meta { flex-direction: column; gap: .65rem; }
      .error-meta-divider { width: 100%; height: 1px; }
    }
  `;
  document.head.appendChild(style);
}
