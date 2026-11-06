/**
 * Shared page wrapper — builds the page header + body content.
 *
 * It returns only the page content; the router mounts it inside the
 * persistent app shell (sidebar + topbar) so navigation never rebuilds the
 * shell.
 */
import { div, span, h1, p, button, icon, a } from '../lib/dom';

export interface PageHeaderAction {
  label: string;
  icon?: string;
  onClick: () => void;
  variant?: 'primary' | 'soft' | 'outline-secondary' | 'danger' | 'success' | 'outline-primary';
  href?: string;
}

export async function pageWrapper(
  _currentRoute: string,
  title: string,
  subtitle: string,
  bodyContent: HTMLElement[],
  actions: PageHeaderAction[] = [],
): Promise<HTMLElement> {
  const headerActionsEl = div('page-header-actions', actions.map(act => {
    if (act.href) {
      const link = a(act.href, `btn btn-${act.variant || 'primary'}`, [
        act.icon ? icon(act.icon) : null,
        span('', [act.label]),
      ]);
      return link;
    }
    return button(`btn btn-${act.variant || 'primary'}`, [
      act.icon ? icon(act.icon) : null,
      span('', [act.label]),
    ], act.onClick);
  }));

  const header = div('page-header', [
    div('', [
      h1('', [title]),
      p('page-subtitle', [subtitle]),
    ]),
    headerActionsEl,
  ]);

  // Only the content — the router slots this into the persistent shell's
  // <main class="app-content">.
  return div('', [header, ...bodyContent]);
}

export function loadingEl(): HTMLElement {
  return div('loading-screen', [
    div('spinner'),
    p('', ['Loading...']),
  ]);
}