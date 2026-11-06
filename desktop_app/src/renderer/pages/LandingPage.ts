/**
 * Landing page — exact replica of Django public/landing.html
 * Editorial academic design with asymmetric hero, marquee, stats, features, quote, process, CTA, footer
 */
import { div, span, h1, h2, h3, h4, p, button, icon, el, a } from '../lib/dom';
import { navigate } from '../lib/router';
import { getUser } from '../lib/auth';
import { settingsApi, resolveMediaUrl } from '../lib/api';

export async function LandingPage(): Promise<HTMLElement> {
  const user = getUser();

  // Fetch public settings for dynamic school name and logo
  let schoolName = 'Guidance Office';
  let schoolYear = '2025-2026';
  let schoolLogo: string | null = null;
  let systemTitle = 'Guidance Office Records Management System';
  let schoolAddress = '';
  let contactEmail = '';
  let contactPhone = '';
  try {
    const res = await settingsApi.public();
    if (res.success && res.data) {
      schoolName = res.data.settings.school_name || schoolName;
      schoolYear = res.data.settings.school_year || schoolYear;
      schoolLogo = resolveMediaUrl(res.data.settings.school_logo);
      systemTitle = res.data.settings.system_title || systemTitle;
      schoolAddress = res.data.settings.school_address || '';
      contactEmail = res.data.settings.contact_email || '';
      contactPhone = res.data.settings.contact_phone || '';
    }
  } catch {}

  const shell = div('public-layout', [
    // SECTION 01 — EDITORIAL HERO (asymmetric)
    createHeroSection(user, schoolName, schoolYear, schoolLogo),
    // SECTION 02 — TRUST MARQUEE
    createMarqueeSection(),
    // SECTION 03 — STATISTICS BAND
    createStatsBandSection(),
    // SECTION 04 — FEATURES
    createFeaturesSection(),
    // SECTION 05 — PULL QUOTE
    createQuoteSection(schoolYear),
    // SECTION 06 — PROCESS / HOW IT WORKS
    createProcessSection(),
    // SECTION 07 — CALL TO ACTION
    createCTASection(user),
    // SECTION 08 — FOOTER
    createFooter(schoolName, schoolLogo, systemTitle, schoolAddress, contactEmail, contactPhone),
  ]);

  return shell;
}

function createHeroSection(user: any, schoolName: string, schoolYear: string, schoolLogo: string | null): HTMLElement {
  const heroCopy = div('lnd-hero-copy', [
    div('lnd-hero-meta', [
      span('lnd-meta-line', []),
      span('lnd-meta-text', [`${schoolName} · Vol. 01 · ${schoolYear}`]),
    ]),
    (() => {
      const title = h1('lnd-hero-title', []);
      title.innerHTML = 'Where student<br>records meet<br><em>quiet precision.</em>';
      return title;
    })(),
    p('lnd-hero-sub', ['A unified platform for student records, counseling sessions, and referrals — designed for educational institutions that value precision, privacy, and care.']),
    div('lnd-hero-cta', [
      user
        ? button('btn btn-primary btn-lg', [icon('grid-1x2-fill'), span('', ['Go to Dashboard'])], () => navigate('/dashboard'))
        : button('btn btn-primary btn-lg', [icon('box-arrow-in-right'), span('', ['Sign In'])], () => navigate('/login')),
      // Register entry point temporarily disabled.
      // user
      //   ? null
      //   : button('btn btn-outline-primary btn-lg', [span('', ['Create Account'])], () => navigate('/register')),
    ].filter(Boolean) as HTMLElement[]),
    div('lnd-hero-footnote', [
      icon('shield-check'),
      span('', ['Secure · Confidential · Role-based access']),
    ]),
  ]);

  const previewCard = div('lnd-preview-card', [
    div('lnd-preview-header', [
      div('lnd-preview-dots', [span('', []), span('', []), span('', [])]),
      div('lnd-preview-title', [`${schoolName} · Dashboard`]),
    ]),
    div('lnd-preview-body', [
      div('lnd-preview-row', [
        createPreviewStat('156', 'Students'),
        createPreviewStat('48', 'Sessions'),
        createPreviewStat('36', 'Referrals'),
      ]),
      createPreviewChart(),
      div('lnd-preview-activity', [
        createActivityItem('bg-success', 'New counseling session recorded', '2m ago'),
        createActivityItem('bg-warning', 'Student record inventory updated', '15m ago'),
        createActivityItem('bg-info', 'New referral created', '1h ago'),
      ]),
    ]),
  ]);

  const floating1 = div('lnd-floating-card lnd-floating-1', [
    icon('shield-lock-fill'),
    div('', [
      div('lnd-floating-title', ['Encrypted']),
      div('lnd-floating-sub', ['End-to-end security']),
    ]),
  ]);

  const floating2 = div('lnd-floating-card lnd-floating-2', [
    icon('graph-up-arrow'),
    div('', [
      div('lnd-floating-title', ['+24%']),
      div('lnd-floating-sub', ['Sessions this month']),
    ]),
  ]);

  const heroVisual = div('lnd-hero-visual', [previewCard, floating1, floating2]);

  return div('lnd-hero', [heroCopy, heroVisual]);
}

function createPreviewStat(value: string, label: string): HTMLElement {
  return div('lnd-preview-stat', [
    div('lnd-preview-stat-value', [value]),
    div('lnd-preview-stat-label', [label]),
  ]);
}

function createPreviewChart(): HTMLElement {
  const chart = div('lnd-preview-chart', []);
  const heights = ['35%', '60%', '45%', '80%', '55%', '90%'];
  chart.innerHTML = heights.map(h => `<div class="lnd-preview-bar" style="height: ${h}"></div>`).join('');
  return chart;
}

function createActivityItem(dotClass: string, text: string, time: string): HTMLElement {
  return div('lnd-preview-activity-item', [
    span(`lnd-activity-dot ${dotClass}`, []),
    span('', [text]),
    el('small', '', [time]),
  ]);
}

function createMarqueeSection(): HTMLElement {
  const marquee = div('lnd-marquee', []);
  const items = ['Student Records', 'Counseling Tracking', 'Referral Monitoring', 'Student Record Inventory', 'Reports & Analytics', 'Audit Trails', 'Role-Based Access'];
  const track = div('lnd-marquee-track', []);
  let html = '';
  for (let i = 0; i < 2; i++) {
    items.forEach(item => {
      html += `<span>${item}</span><span class="lnd-marquee-dot">·</span>`;
    });
  }
  track.innerHTML = html;
  marquee.appendChild(track);
  return marquee;
}

function createStatsBandSection(): HTMLElement {
  const statsGrid = div('lnd-stats-grid', []);
  const stats = [
    { num: '156', cap: 'Students<br>managed' },
    { num: '48', cap: 'Counseling<br>records' },
    { num: '36', cap: 'Referrals<br>monitored' },
    { num: '3', cap: 'Defined<br>user roles' },
  ];
  
  stats.forEach((stat, i) => {
    const block = div('lnd-stat-block', []);
    block.innerHTML = `<div class="lnd-stat-num">${stat.num}</div><div class="lnd-stat-cap">${stat.cap}</div>`;
    statsGrid.appendChild(block);
    if (i < stats.length - 1) {
      statsGrid.appendChild(div('lnd-stat-divider', []));
    }
  });

  return div('lnd-stats-band', [
    div('lnd-container', [
      div('lnd-section-eyebrow', [span('lnd-section-number', ['01']), span('', ['By the numbers'])]),
      (() => {
        const title = h2('lnd-section-title', []);
        title.innerHTML = 'A system that scales with<br>your guidance office.';
        return title;
      })(),
      statsGrid,
    ]),
  ]);
}

function createFeaturesSection(): HTMLElement {
  const features = [
    { num: '01', icon: 'mortarboard', title: 'Student Records', desc: 'Centralized directory with personal, academic, and guardian information — searchable, filterable, and fully audited.', items: ['Personal & academic info', 'Guardian contacts', 'Document uploads'] },
    { num: '02', icon: 'chat-heart', title: 'Counseling Tracking', desc: 'Document each session, monitor cases, and schedule follow-ups with timeline-based progress tracking.', items: ['Session notes & recommendations', 'Follow-up reminders', 'Counselor notes (private/public)'] },
    { num: '03', icon: 'send-exclamation', title: 'Referral Monitoring', desc: 'From initial referral to closure — track priority, status changes, and counselor notes in one place.', items: ['Priority levels (low → urgent)', 'Timeline-based updates', 'Auto-notifications to counselors'] },
    { num: '04', icon: 'clipboard-data', title: 'Student Record Inventory', desc: 'A single overview of every student record — counts, guidance coverage, cases, and referrals with visual breakdowns.', items: ['Record & coverage counts', 'Year level & course breakdowns', 'Case and referral totals'] },
    { num: '05', icon: 'file-earmark-bar-graph', title: 'Reporting & Analytics', desc: 'Generate and export CSV reports across student records, counseling, referrals, and user activity logs.', items: ['4 report types', 'Date-range filtering', 'CSV / Excel exports'] },
    { num: '06', icon: 'shield-lock', title: 'Role-Based Security', desc: 'Fine-grained permissions for Administrators, Guidance Staff, and Counselors with full audit logging.', items: ['3 user roles', 'Login lockout protection', 'Full system audit trail'] },
  ];

  const featureGrid = div('lnd-feature-grid', []);
  features.forEach(f => {
    const feature = el('article', 'lnd-feature', []);
    feature.innerHTML = `
      <div class="lnd-feature-num">${f.num}</div>
      <div class="lnd-feature-icon"><i class="bi bi-${f.icon}"></i></div>
      <h3>${f.title}</h3>
      <p>${f.desc}</p>
      <ul class="lnd-feature-list">
        ${f.items.map(item => `<li>${item}</li>`).join('')}
      </ul>
    `;
    featureGrid.appendChild(feature);
  });

  return div('lnd-features', [
    div('lnd-container', [
      div('lnd-section-eyebrow', [span('lnd-section-number', ['02']), span('', ['System capabilities'])]),
      (() => {
        const title = h2('lnd-section-title', []);
        title.innerHTML = 'Everything the guidance<br>office needs. Nothing it doesn\'t.';
        return title;
      })(),
      p('lnd-section-lead', ['Built with a modular, role-based architecture for schools of any size. Each module works independently yet integrates seamlessly into a single dashboard.']),
      featureGrid,
    ]),
  ]);
}

function createQuoteSection(schoolYear: string): HTMLElement {
  const quote = div('lnd-quote', []);
  quote.innerHTML = `
    <div class="lnd-container">
      <div class="lnd-quote-mark">"</div>
      <blockquote>
        A guidance office is the quiet architecture of a school —
        where every record carries a student's story. This system
        honors that weight with precision, privacy, and care.
      </blockquote>
      <div class="lnd-quote-attribution">
        <span class="lnd-quote-line"></span>
        <div>
          <div class="lnd-quote-author">Editorial Statement</div>
          <div class="lnd-quote-source">Design Philosophy · ${schoolYear}</div>
        </div>
      </div>
    </div>
  `;
  return quote;
}

function createProcessSection(): HTMLElement {
  const steps = [
    { num: '01', title: 'Sign in securely', desc: 'Username or email login with optional remember-me and account lockout protection.' },
    { num: '02', title: 'Access your dashboard', desc: 'Role-based dashboard surfaces the metrics that matter — student records, sessions, and referrals.' },
    { num: '03', title: 'Work in your module', desc: 'Create, edit, and track records. Every action is logged in the audit trail for transparency.' },
    { num: '04', title: 'Export & report', desc: 'Generate CSV / Excel reports across any module with date-range filters and print preview.' },
  ];

  const processGrid = div('lnd-process-grid', []);
  steps.forEach(step => {
    const stepEl = div('lnd-process-step', []);
    stepEl.innerHTML = `
      <div class="lnd-process-num">${step.num}</div>
      <h4>${step.title}</h4>
      <p>${step.desc}</p>
    `;
    processGrid.appendChild(stepEl);
  });

  return div('lnd-process', [
    div('lnd-container', [
      div('lnd-section-eyebrow', [span('lnd-section-number', ['03']), span('', ['How it works'])]),
      (() => {
        const title = h2('lnd-section-title', []);
        title.innerHTML = 'From sign-in to insight.<br>Four deliberate steps.';
        return title;
      })(),
      processGrid,
    ]),
  ]);
}

function createCTASection(user: any): HTMLElement {
  const ctaCard = div('lnd-cta-card', []);
  ctaCard.innerHTML = `
    <div class="lnd-cta-eyebrow">Get started today</div>
    <h2 class="lnd-cta-title">
      Ready to bring your<br>
      guidance office online?
    </h2>
    <p class="lnd-cta-sub">
      Create your account in seconds. Your administrator will approve access
      so you can begin managing records with confidence.
    </p>
  `;

  const actions = div('lnd-cta-actions', [
    user
      ? button('btn btn-light btn-lg', [icon('grid-1x2-fill'), span('', ['Open Dashboard'])], () => navigate('/dashboard'))
      // Register entry point temporarily disabled.
      // : button('btn btn-light btn-lg', [icon('person-plus'), span('', ['Create Account'])], () => navigate('/register')),
      : null,
    user
      ? null
      : button('btn btn-outline-light btn-lg', [icon('box-arrow-in-right'), span('', ['Sign In'])], () => navigate('/login')),
  ].filter(Boolean) as HTMLElement[]);
  ctaCard.appendChild(actions);

  return div('lnd-cta', [
    div('lnd-container', [ctaCard]),
  ]);
}

function createFooter(schoolName: string, schoolLogo: string | null, systemTitle: string, schoolAddress: string, contactEmail: string, contactPhone: string): HTMLElement {
  const footer = el('footer', 'public-footer', []);
  const logoHtml = schoolLogo
    ? `<img src="${schoolLogo}" alt="logo" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">`
    : '<i class="bi bi-mortarboard-fill"></i>';
  footer.innerHTML = `
    <div class="public-footer-grid">
      <div>
        <div class="public-footer-brand">
          <div class="footer-logo-circle">${logoHtml}</div>
          <div>
            <div style="font-family: var(--font-serif); font-size: 1.1rem; font-weight: 700;">${schoolName}</div>
            <div style="font-size: .72rem; opacity: .6; letter-spacing: .1em; text-transform: uppercase;">Records & Analytics</div>
          </div>
        </div>
        <p style="max-width: 380px;">${systemTitle} — a unified platform for student records, counseling, and referrals.</p>
      </div>
      <div>
        <h5>Platform</h5>
        <ul>
          <li><a href="#/login">Sign In</a></li>
          <!-- Register entry point temporarily disabled. -->
          <!-- <li><a href="#/register">Create Account</a></li> -->
          <li><a href="#features">Features</a></li>
        </ul>
      </div>
      <div>
        <h5>Modules</h5>
        <ul>
          <li>Student Records</li>
          <li>Counseling Tracking</li>
          <li>Referral Monitoring</li>
          <li>Student Record Inventory</li>
        </ul>
      </div>
      <div>
        <h5>Contact</h5>
        <ul>
          ${schoolAddress ? `<li><i class="bi bi-geo-alt me-2"></i>${schoolAddress}</li>` : ''}
          ${contactPhone ? `<li><i class="bi bi-telephone me-2"></i>${contactPhone}</li>` : ''}
          ${contactEmail ? `<li><i class="bi bi-envelope me-2"></i>${contactEmail}</li>` : ''}
          ${!schoolAddress && !contactPhone && !contactEmail ? '<li style="opacity: .5;">Contact information not configured.</li>' : ''}
        </ul>
      </div>
    </div>
    <div class="public-footer-bottom">
      <div class="footer-credits">
        <span>© ${new Date().getFullYear()} ${schoolName}. All rights reserved.</span>
      </div>
      <div class="footer-tech">
        <i class="bi bi-code-slash me-1"></i>Electron · TypeScript · Django
      </div>
    </div>
  `;
  return footer;
}
