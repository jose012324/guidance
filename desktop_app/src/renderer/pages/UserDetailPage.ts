/**
 * User detail page — read-only profile + recent activity.
 */
import { div, span, button, icon, el } from '../lib/dom';
import { usersApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';

export async function UserDetailPage(pk: string): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/users', 'User Details', '', [body], []);

  try {
    const res = await usersApi.detail(Number(pk));
    if (res.success && res.data) {
      const u = res.data.user;
      body.innerHTML = '';
      body.appendChild(div('row g-3', [
        div('col-lg-4', [
          div('card text-center', [
            div('card-body', [
              div('user-avatar mx-auto mb-3', [u.first_name?.[0]?.toUpperCase() || 'U'], { style: 'width:110px;height:110px;font-size:2.5rem;' }) as HTMLElement,
              el('h3', 'mb-1', [u.full_name]),
              span('text-muted-soft mb-2', [u.username]),
              div('d-flex justify-content-center gap-2 mt-2', [
                u.role ? span('badge secondary', [u.role.name]) : null,
                span(`badge ${u.status}`, [u.status_display]),
              ].filter(Boolean) as HTMLElement[]),
            ]),
          ]),
        ]),
        div('col-lg-8', [
          div('card mb-3', [
            div('card-header', [icon('info-circle'), span('', ['Information'])]),
            div('card-body', [
              descList([
                ['Employee ID', u.employee_id || '—'],
                ['Email', u.email],
                ['Contact', u.contact_number || '—'],
                ['Role', u.role?.name || '—'],
                ['Status', u.status_display],
                ['Date Joined', u.date_joined ? new Date(u.date_joined).toLocaleString() : '—'],
                ['Last Login', u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'],
              ]),
            ]),
          ]),
          div('card', [
            div('card-header', [icon('clock-history'), span('', ['Recent Activity'])]),
            div('card-body', [
              ...(res.data.recent_logs.length
                ? res.data.recent_logs.map((l: any) => div('d-flex gap-3 py-2', [
                    icon('activity text-muted-soft'),
                    div('flex-grow-1', [
                      div('small', [l.description]),
                      span('text-muted-soft small', [new Date(l.timestamp).toLocaleString()]),
                    ]),
                  ], { style: 'border-bottom: 1px solid var(--border-soft);' }))
                : [div('empty-state', [icon('clock-history'), el('p', '', ['No recent activity.'])])]),
            ]),
          ]),
        ]),
      ]));
    }
  } catch (err: any) {
    body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed to load</h4><p>${err.message}</p></div>`;
  }

  // Inject Edit + Delete buttons into header
  const actions = shell.querySelector('.page-header-actions');
  if (actions) {
    actions.insertBefore(button('btn btn-outline-danger', [icon('trash'), span('', ['Delete'])], () => navigate(`/users/${pk}/delete`)), actions.firstChild);
    actions.insertBefore(button('btn btn-primary', [icon('pencil'), span('', ['Edit'])], () => navigate(`/users/${pk}/edit`)), actions.firstChild);
  }

  return shell;
}

function descList(rows: [string, string][]): HTMLElement {
  const dl = el('dl', 'row mb-0', []) as HTMLElement;
  dl.style.margin = '0';
  for (const [k, v] of rows) {
    const dt = el('dt', 'text-muted-soft', [k], { style: 'flex: 0 0 25%;' });
    const dd = el('dd', '', [v], { style: 'flex: 1; margin-left: 0;' });
    dl.appendChild(dt);
    dl.appendChild(dd);
  }
  return dl;
}
