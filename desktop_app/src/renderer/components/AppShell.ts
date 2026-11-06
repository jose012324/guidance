/**
 * App shell — the authenticated layout with sidebar + topbar.
 *
 * The shell is built once and kept mounted across navigations: switching
 * pages only swaps the content inside `<main class="app-content">`, so the
 * sidebar, topbar and footer never flicker or rebuild. Pages supply only
 * their content element (see PageWrapper) and renderAppShell() slots it in.
 */
import { div, aside, nav, span, button, icon, el, p } from '../lib/dom';
import { navigate } from '../lib/router';
import { getUser, can, getTheme, setTheme } from '../lib/auth';
import { notificationsApi, settingsApi, resolveMediaUrl } from '../lib/api';
import { showModal } from './Modal';

// Keep branding in sync with settings changes from this app or another client.
let cachedSchoolName = 'Guidance Office';
let cachedSchoolLogo: string | null = null;
let schoolBrandFetchedAt = 0;
let schoolBrandRequest: Promise<void> | null = null;
let schoolBrandRevision = 0;

async function getSchoolName(): Promise<string> {
  await refreshSchoolBrand();
  return cachedSchoolName;
}

export function applySchoolBrand(settings: { school_name?: string | null; school_logo?: string | null }): void {
  schoolBrandRevision++;
  if (settings.school_name) cachedSchoolName = settings.school_name;
  if ('school_logo' in settings) cachedSchoolLogo = resolveMediaUrl(settings.school_logo);
  schoolBrandFetchedAt = Date.now();
  document.querySelectorAll<HTMLElement>('.sidebar-brand .brand-title').forEach(title => {
    title.textContent = cachedSchoolName;
  });
  document.querySelectorAll<HTMLElement>('.shell-footer-school').forEach(footer => {
    footer.textContent = `© ${new Date().getFullYear()} ${cachedSchoolName} · All rights reserved`;
  });
}

export async function refreshSchoolBrand(force = false): Promise<void> {
  if (schoolBrandRequest) return schoolBrandRequest;
  if (!force && Date.now() - schoolBrandFetchedAt < 4000) return;
  schoolBrandRequest = (async () => {
    const revision = schoolBrandRevision;
    try {
      const res = await settingsApi.public();
      if (res.success && res.data && revision === schoolBrandRevision) {
        applySchoolBrand(res.data.settings);
      }
    } catch {
      // Keep the last successful branding while the backend is unavailable.
    }
  })().finally(() => { schoolBrandRequest = null; });
  return schoolBrandRequest;
}

function getSchoolLogo(): string | null {
  return cachedSchoolLogo;
}

interface NavItem {
  label: string;
  icon: string;
  route: string;
  permission?: string;
  section: string;
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'grid-1x2-fill', route: '/dashboard', section: 'Main' },
  { label: 'User Management', icon: 'people-fill', route: '/users', permission: 'users.view', section: 'Administration' },
  { label: 'Students', icon: 'mortarboard', route: '/students', section: 'Records' },
  { label: 'Counseling', icon: 'chat-heart-fill', route: '/counseling', section: 'Records' },
  { label: 'Referrals', icon: 'send-exclamation-fill', route: '/referrals', section: 'Records' },
  // Office inventory is temporarily hidden from every role's sidebar.
  // { label: 'Inventory', icon: 'box-seam-fill', route: '/inventory', permission: 'inventory.view', section: 'Resources' },
  { label: 'Student Record Inventory', icon: 'clipboard-data-fill', route: '/student-record-inventory', permission: 'students.view', section: 'Resources' },
  { label: 'Reports', icon: 'file-earmark-bar-graph-fill', route: '/reports', permission: 'reports.view', section: 'Resources' },
  { label: 'Database', icon: 'database-fill', route: '/database', permission: 'database.manage', section: 'System' },
  { label: 'Settings', icon: 'gear-fill', route: '/settings', permission: 'settings.manage', section: 'System' },
];

/** Longest-prefix match so detail routes (e.g. /users/5) map to their section. */
function navMatch(page: string): NavItem | undefined {
  return NAV.find(n => page === n.route || page.startsWith(n.route + '/'));
}

interface MountedShell {
  shell: HTMLElement;
  mainEl: HTMLElement;
  topbarTitleEl: HTMLElement;
  navLinks: Array<{ route: string; el: HTMLElement }>;
  userKey: string;
  currentPage: string;
}

// The shell that is currently mounted in the DOM (null until first login).
let mounted: MountedShell | null = null;

function userKey(): string {
  const user = getUser();
  if (!user) return '';
  return `${user.id}|${user.username}|${user.role?.name || ''}`;
}

export function hasMountedShell(): boolean {
  return !!mounted;
}

/** Drop the cached shell (e.g. on logout) so the next login rebuilds it. */
export function disposeAppShell(): void {
  mounted = null;
}

/** Show the loading spinner inside the content area, keeping the shell visible. */
export function showShellLoading(): void {
  if (!mounted) return;
  mounted.mainEl.replaceChildren(
    div('loading-screen', [div('spinner'), p('', ['Loading...'])]),
  );
}

/**
 * Return the app shell, building it on first use then reusing it. On later
 * calls only the active nav item, topbar title and content are updated, so
 * the sidebar/topbar stay put instead of being rebuilt.
 */
export async function renderAppShell(
  currentPage: string,
  contentEl: HTMLElement,
): Promise<HTMLElement> {
  const key = userKey();
  if (mounted && mounted.userKey === key) {
    updateShell(mounted, currentPage, contentEl);
    return mounted.shell;
  }

  const schoolName = await getSchoolName();
  mounted = await buildShell(currentPage, contentEl, schoolName, getSchoolLogo(), key);
  return mounted.shell;
}

function updateShell(shell: MountedShell, currentPage: string, contentEl: HTMLElement): void {
  shell.currentPage = currentPage;
  for (const link of shell.navLinks) {
    const isActive = currentPage === link.route || currentPage.startsWith(link.route + '/');
    link.el.classList.toggle('active', isActive);
  }
  shell.topbarTitleEl.textContent = navMatch(currentPage)?.label || 'Dashboard';
  shell.mainEl.replaceChildren(contentEl);
}

async function buildShell(
  currentPage: string,
  contentEl: HTMLElement,
  schoolName: string,
  schoolLogo: string | null,
  key: string,
): Promise<MountedShell> {
  const user = getUser();

  // ----- Sidebar -----
  // If the logo file 404s (e.g. media folder not present on this machine),
  // fall back to the mortarboard icon instead of a broken image.
  const brandLogo = schoolLogo
    ? (() => { const img = document.createElement('img'); img.src = schoolLogo; img.alt = 'logo'; img.className = 'brand-logo'; img.onerror = () => img.replaceWith(icon('mortarboard-fill')); return img; })()
    : icon('mortarboard-fill');
  const brand = div('sidebar-brand', [
    div(schoolLogo ? 'brand-logo' : 'brand-logo-placeholder', [brandLogo]),
    div('brand-text', [
      span('brand-title', [schoolName]),
      span('brand-sub', ['Records & Inventory']),
    ]),
  ]);

  const navLinks: Array<{ route: string; el: HTMLElement }> = [];
  const navItems: HTMLElement[] = [];
  let lastSection = '';
  for (const item of NAV) {
    if (item.permission && !can(user, item.permission)) continue;
    if (item.section !== lastSection) {
      navItems.push(div('sidebar-nav-section', [item.section]));
      lastSection = item.section;
    }
    const isActive = currentPage === item.route || currentPage.startsWith(item.route + '/');
    const link = button(
      `nav-link ${isActive ? 'active' : ''}`,
      [icon(item.icon), span('', [item.label])],
      () => navigate(item.route),
    ) as unknown as HTMLElement;
    // Cast button to look like nav-link (button styled identically)
    navLinks.push({ route: item.route, el: link });
    navItems.push(link);
  }
  const sidebarNav = nav('sidebar-nav', navItems);

  // User card (avatar falls back to initials if the file is missing/404)
  const avatarFallback = (user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U');
  const avatarContent = user?.avatar
    ? (() => { const img = document.createElement('img'); img.src = resolveMediaUrl(user.avatar)!; img.alt = 'avatar'; img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;'; img.onerror = () => img.replaceWith(document.createTextNode(avatarFallback)); return img; })()
    : avatarFallback;
  const userCard = button('user-card', [
    div('user-avatar', [avatarContent]),
    div('user-info', [
      div('user-name', [user?.full_name || 'User']),
      div('user-role', [user?.role?.name || '—']),
    ]),
  ], () => navigate('/account'));

  // Logout button — shows confirmation modal then navigates to logout page
  const logoutBtn = button('btn-logout', [icon('box-arrow-right')], () => {
    const modalBody = div('', [
      div('d-flex gap-3', [
        div('stat-icon bg-warning', [icon('exclamation-triangle-fill')], { style: 'width: 48px; height: 48px; flex-shrink: 0;' } as any),
        div('', [
          p('mb-2 fw-medium', ['Are you sure you want to log out?']),
          p('mb-0 text-muted-soft small', ['You will need to sign in again to access the system.']),
        ]),
      ]),
    ]);
    const footer = div('modal-footer', [
      button('btn btn-outline-secondary', [span('', ['Cancel'])], () => modal.close()),
      button('btn btn-danger', [icon('box-arrow-right'), span('', ['Log Out'])], () => {
        modal.close();
        navigate('/logout');
      }),
    ]);
    const modal = showModal({
      title: 'Confirm Logout',
      body: modalBody,
      footer,
      size: 'sm',
    });
  });
  logoutBtn.title = 'Logout';

  const sidebarFooter = div('sidebar-footer', [userCard, logoutBtn]);
  const sidebar = aside('app-sidebar', [brand, sidebarNav, sidebarFooter]);

  // ----- Topbar -----
  const topbarTitleEl = span('topbar-title', [navMatch(currentPage)?.label || 'Dashboard']);
  const topbarTitle = div('', [topbarTitleEl]);

  // Theme toggle
  const themeBtn = button('icon-btn', [
    getTheme() === 'dark' ? icon('sun-fill') : icon('moon-stars-fill'),
  ], () => {
    const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    // CSS variables update the existing page; just swap the icon.
    themeBtn.replaceChildren(getTheme() === 'dark' ? icon('sun-fill') : icon('moon-stars-fill'));
  });
  themeBtn.title = 'Toggle theme';
  themeBtn.id = 'themeToggleBtn';

  // Notifications
  const notifBtn = button('icon-btn position-relative', [icon('bell-fill')], () => navigate('/notifications'));
  notifBtn.id = 'notifBtn';
  const notifBadge = span('badge-notif', [], { style: 'display:none;' });
  notifBtn.appendChild(notifBadge);

  const topbarActions = div('topbar-actions', [themeBtn, notifBtn]);
  const topbar = el('header', 'app-topbar', [topbarTitle, topbarActions]) as HTMLElement;

  // ----- Main -----
  const mainEl = el('main', 'app-content', [contentEl]) as HTMLElement;

  // ----- Footer -----
  const footer = el('footer', 'app-footer', [
    span('shell-footer-school', [`© ${new Date().getFullYear()} ${schoolName} · All rights reserved`]),
    span('footer-version', ['v1.0.0']),
  ]);

  const mainCol = div('app-main', [topbar, mainEl, footer]);
  const shell = div('app-shell', [sidebar, mainCol]);
  shell.dataset.appShell = '1';

  // Poll notifications count
  if (user) {
    notificationsApi.unreadCount().then(res => {
      if (res.success && res.data && res.data.count > 0) {
        notifBadge.textContent = String(res.data.count);
        notifBadge.setAttribute('style', '');
      }
    }).catch(() => {});
  }

  return { shell, mainEl, topbarTitleEl, navLinks, userKey: key, currentPage };
}