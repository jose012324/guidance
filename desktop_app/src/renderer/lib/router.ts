/**
 * Minimal hash-based router.
 * Routes are stored as a flat map of path → render function.
 */
type RouteHandler = (params: Record<string, string>) => HTMLElement | Promise<HTMLElement>;

interface Route {
  pattern: string;          // e.g. /students/:pk
  handler: RouteHandler;
  requiresAuth?: boolean;
  permission?: string;
}

const routes: Route[] = [];
let currentRoute: HTMLElement | null = null;
let currentPath = '';
const containerEl: { current: HTMLElement | null } = { current: null };
let pageDirty = false;
let renderVersion = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let refreshInFlight = false;

export function registerRoute(
  pattern: string,
  handler: RouteHandler,
  options: { requiresAuth?: boolean; permission?: string } = {},
): void {
  routes.push({ pattern, handler, ...options });
}

function matchRoute(path: string): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    const params = matchPattern(route.pattern, path);
    if (params !== null) return { route, params };
  }
  return null;
}

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const pParts = pattern.split('/').filter(Boolean);
  const aParts = path.split('/').filter(Boolean);
  if (pParts.length !== aParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) {
      params[pParts[i].slice(1)] = decodeURIComponent(aParts[i]);
    } else if (pParts[i] !== aParts[i]) {
      return null;
    }
  }
  return params;
}

export function navigate(path: string): void {
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path;
  } else {
    renderRoute(path);
  }
}

/** Pages with local filter or pagination state can refresh without rebuilding their shell. */
export function enableLiveRefresh(element: HTMLElement, refresh: () => Promise<void>): void {
  element.addEventListener('desktop:refresh', event => {
    event.preventDefault();
    const detail = (event as CustomEvent<{ pending: Promise<void>[] }>).detail;
    detail.pending.push(refresh());
  });
}

async function renderRoute(path: string, background = false): Promise<void> {
  if (!containerEl.current) return;
  const version = ++renderVersion;
  const match = matchRoute(path);
  if (!match) {
    // Render the 404 error page inline
    try {
      const { Error404Page } = await import('../pages/ErrorPage');
      const { disposeAppShell } = await import('../components/AppShell');
      disposeAppShell();
      containerEl.current.innerHTML = '';
      containerEl.current.appendChild(await Error404Page());
    } catch {
      containerEl.current.innerHTML = '<div class="empty-state"><i class="bi bi-compass"></i><h4>Page not found</h4><p>The page you are looking for does not exist.</p></div>';
    }
    return;
  }

  // Auth check
  if (match.route.requiresAuth) {
    const { getUser } = await import('./auth');
    if (!getUser()) {
      navigate('/login');
      return;
    }
    if (match.route.permission) {
      const { can } = await import('./auth');
      if (!can(getUser(), match.route.permission)) {
        // Render the 403 error page inline
        try {
          const { Error403Page } = await import('../pages/ErrorPage');
          const { disposeAppShell } = await import('../components/AppShell');
          disposeAppShell();
          containerEl.current.innerHTML = '';
          containerEl.current.appendChild(await Error403Page());
        } catch {
          containerEl.current.innerHTML = '<div class="empty-state"><i class="bi bi-shield-lock"></i><h4>Access denied</h4><p>You do not have permission to view this page.</p></div>';
        }
        return;
      }
    }
  }

  // Show loading state. When the persistent shell is already mounted we only
  // show the spinner inside the content area so the sidebar/topbar stay put.
  if (!background) {
    const { hasMountedShell, showShellLoading } = await import('../components/AppShell');
    if (match.route.requiresAuth && hasMountedShell()) {
      showShellLoading();
    } else {
      containerEl.current.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';
    }
  }

  try {
    const el = await match.route.handler(match.params);
    if (version !== renderVersion || !containerEl.current) return;
    const previousScroll = containerEl.current.querySelector('.app-content')?.scrollTop || 0;
    currentRoute?.dispatchEvent(new Event('desktop:dispose'));
    const { renderAppShell, disposeAppShell } = await import('../components/AppShell');
    
    // Use the enter transition only for navigation, not periodic data refresh.
    if (!background) el.classList.add('page-enter');

    if (match.route.requiresAuth) {
      // Slot the page content into the persistent shell. On the first mount
      // the shell is built; afterwards only the content is swapped, so the
      // sidebar/topbar are never rebuilt.
      const shell = await renderAppShell(path, el);
      if (shell.parentElement !== containerEl.current) {
        containerEl.current.replaceChildren(shell);
      }
      const content = shell.querySelector<HTMLElement>('.app-content');
      if (content) content.scrollTop = background ? previousScroll : 0;
    } else {
      // Public pages (landing, login, errors) render standalone.
      disposeAppShell();
      containerEl.current.replaceChildren(el);
    }

    if (!background) {
      // Trigger reflow then activate transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.remove('page-enter');
          el.classList.add('page-enter-active');
          el.addEventListener('transitionend', () => {
            el.classList.remove('page-enter-active');
          }, { once: true });
        });
      });
    }
    currentRoute = el;
    currentPath = path;
  } catch (e) {
    if (background) return; // Keep the last working page during a transient refresh error.
    // Render the 500 error page inline (standalone, so drop the cached shell).
    try {
      const { Error500Page } = await import('../pages/ErrorPage');
      const { disposeAppShell } = await import('../components/AppShell');
      disposeAppShell();
      containerEl.current.innerHTML = '';
      const errorPage = await Error500Page();
      // Append the actual error message as a debug footer
      const msg = e instanceof Error ? e.message : String(e);
      const debugFooter = document.createElement('div');
      debugFooter.style.cssText = 'text-align:center; margin-top: 1rem; padding: .75rem; background: var(--danger-soft); color: var(--danger); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: .8rem;';
      debugFooter.textContent = `Error: ${msg}`;
      errorPage.appendChild(debugFooter);
      containerEl.current.appendChild(errorPage);
    } catch {
      const msg = e instanceof Error ? e.message : String(e);
      containerEl.current.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Error</h4><p>${msg}</p></div>`;
    }
  }
}

export function startRouter(container: HTMLElement): void {
  containerEl.current = container;
  window.addEventListener('hashchange', () => {
    pageDirty = false;
    const path = window.location.hash.slice(1) || '/';
    renderRoute(path);
  });
  // Preserve in-progress forms and applied filters until the user navigates away.
  const markDirty = (event: Event) => {
    if (event.target instanceof HTMLElement && event.target.closest('.app-content')) pageDirty = true;
  };
  container.addEventListener('input', markDirty, true);
  container.addEventListener('change', markDirty, true);
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    const path = window.location.hash.slice(1) || '/';
    const match = matchRoute(path);
    if (!match?.route.requiresAuth || refreshInFlight || document.visibilityState !== 'visible') return;
    refreshInFlight = true;
    try {
      const { authApi, pollPageData } = await import('./api');
      const { getUser, setUser } = await import('./auth');
      try {
        const me = await authApi.me();
        if (me.data?.user && JSON.stringify(getUser()) !== JSON.stringify(me.data.user)) {
          setUser(me.data.user);
        }
      } catch (error) {
        if ((error as { status?: number }).status === 401) {
          setUser(null);
          navigate('/login');
          return;
        }
      }
      if ((window.location.hash.slice(1) || '/') !== path) return;
      const { refreshSchoolBrand } = await import('../components/AppShell');
      await refreshSchoolBrand();
      const active = document.activeElement;
      const modalOpen = !!document.querySelector('.modal.show, .modal-overlay');
      const inputFocused = active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
      const editing = pageDirty || modalOpen || inputFocused;
      // List pages refresh their current filters and page. Other pages fetch
      // current data, and only replace the DOM when no work is in progress.
      const refresh = new CustomEvent<{ pending: Promise<void>[] }>('desktop:refresh', {
        cancelable: true, detail: { pending: [] },
      });
      const canRefreshVisibleList = !pageDirty || !!currentRoute?.querySelector('.filter-bar') || path === '/notifications';
      if (currentPath === path && !modalOpen && !inputFocused && canRefreshVisibleList) {
        currentRoute?.dispatchEvent(refresh);
      }
      if (refresh.defaultPrevented) await Promise.all(refresh.detail.pending);
      else if (editing) await pollPageData(path);
      else await renderRoute(path, true);
      if (refresh.defaultPrevented || editing) {
        const { notificationsApi } = await import('./api');
        const result = await notificationsApi.unreadCount();
        const badge = containerEl.current?.querySelector<HTMLElement>('#notifBtn .badge-notif');
        if (badge && result.data) {
          badge.textContent = result.data.count > 0 ? String(result.data.count) : '';
          badge.style.display = result.data.count > 0 ? '' : 'none';
        }
      }
    } catch {
      // Keep the current page during a temporary connection failure.
    }
    finally { refreshInFlight = false; }
  }, 5000);
  const initialPath = window.location.hash.slice(1) || '/';
  renderRoute(initialPath);
}

// Helper to render a route without navigating (for embedding)
export function renderToElement(
  container: HTMLElement,
  path: string,
): Promise<void> {
  containerEl.current = container;
  return renderRoute(path);
}
