/** Notifications page. */
import { div, span, button, icon, el, p } from '../lib/dom';
import { notificationsApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { toastSuccess } from '../lib/toast';
import { enableLiveRefresh } from '../lib/router';

export async function NotificationsPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/notifications', 'Notification Center', 'View and manage your notifications.', [body], []);

  let filter: 'all' | 'unread' = 'all';
  let loadVersion = 0;

  async function load(silent = false) {
    const version = ++loadVersion;
    if (!silent) { body.innerHTML = ''; body.appendChild(loadingEl()); }
    try {
      const res = await notificationsApi.list(filter, 1, 50);
      if (version !== loadVersion) return;
      if (res.success && res.data) {
        const items = res.data.items;
        const unread = res.data.unread_count;
        body.innerHTML = '';

        body.appendChild(div('d-flex justify-content-between align-items-center mb-3', [
          div('btn-group', [
            button(`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`, [span('', ['All'])], () => { filter = 'all'; load(); }),
            button(`btn btn-sm ${filter === 'unread' ? 'btn-primary' : 'btn-outline-secondary'}`, [span('', [`Unread (${unread})`])], () => { filter = 'unread'; load(); }),
          ]),
          unread > 0 ? button('btn btn-soft btn-sm', [icon('check2-all'), span('', ['Mark All Read'])], async () => {
            await notificationsApi.markAllRead(); toastSuccess('All marked as read'); load();
          }) : span('', []),
        ]));

        body.appendChild(div('card', [
          div('card-body', [
            items.length === 0
              ? div('empty-state', [icon('bell-slash'), el('h4', '', ['No notifications']), el('p', '', ["You're all caught up!"])])
              : div('', items.map(n => div('notification-item d-flex gap-3', [
                  div('notif-icon', [icon('bell-fill')], { style: `width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--surface-2); color: var(--accent); flex-shrink: 0;` } as any),
                  div('flex-grow-1', [
                    div('d-flex justify-content-between', [
                      el('strong', '', [n.title]),
                      span('text-muted-soft small', [`${timeAgo(n.created_at)} ago`]),
                    ]),
                    p('mb-0 text-muted-soft small', [n.message]),
                    span('text-muted-soft small', [`${n.category_display} · ${n.priority_display} priority`]),
                  ]),
                  !n.is_read ? button('btn btn-sm btn-soft', [icon('check')], async () => {
                    await notificationsApi.markRead(n.id); load();
                  }) : null,
                ], { style: `padding: .9rem 1.25rem; border-bottom: 1px solid var(--border-soft); ${!n.is_read ? 'background: var(--accent-soft);' : ''}` } as any))),
          ]),
        ]));
      }
    } catch (e: any) { if (!silent && version === loadVersion) body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; }
  }
  enableLiveRefresh(shell, () => load(true));
  load();
  return shell;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}
