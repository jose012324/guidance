/**
 * Counseling list page.
 */
import { div, span, button, icon } from '../lib/dom';
import { counselingApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { buildTable, buildPagination, buildFilterBar, preserveFilterDrafts } from '../components/Table';
import { navigate, enableLiveRefresh } from '../lib/router';
import type { CounselingSession } from '../../shared/types';

export async function CounselingListPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/counseling', 'Counseling Records', 'Track sessions, monitor cases, and review counseling history.', [body], [
    { label: 'New Session', icon: 'plus-circle', variant: 'primary', onClick: () => navigate('/counseling/create') },
  ]);

  let currentPage = 1;
  let currentFilters: any = {};
  let loadVersion = 0;

  async function load(silent = false) {
    const version = ++loadVersion;
    if (!silent) { body.innerHTML = ''; body.appendChild(loadingEl()); }
    try {
      const res = await counselingApi.list({ ...currentFilters, page: currentPage, per_page: 15 });
      if (version !== loadVersion) return;
      if (res.success && res.data) {
        const { items, pagination } = res.data;
        const restoreDrafts = silent ? preserveFilterDrafts(body) : null;
        body.innerHTML = '';
        body.appendChild(buildFilterBar([
          { name: 'search', label: 'Search', value: currentFilters.search },
          { name: 'concern_type', label: 'Concern', type: 'select', options: [
            { value: '', label: 'All' }, { value: 'academic', label: 'Academic' }, { value: 'behavioral', label: 'Behavioral' },
            { value: 'personal', label: 'Personal' }, { value: 'social', label: 'Social' }, { value: 'career', label: 'Career' },
            { value: 'mental_health', label: 'Mental Health' }, { value: 'crisis', label: 'Crisis' }, { value: 'follow_up', label: 'Follow-up' }, { value: 'other', label: 'Other' },
          ], value: currentFilters.concern_type },
          { name: 'status', label: 'Status', type: 'select', options: [
            { value: '', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'ongoing', label: 'Ongoing' }, { value: 'closed', label: 'Closed' },
          ], value: currentFilters.status },
          { name: 'date_from', label: 'From', value: currentFilters.date_from },
          { name: 'date_to', label: 'To', value: currentFilters.date_to },
        ], (values) => { currentFilters = values; currentPage = 1; load(); }, () => { currentFilters = {}; currentPage = 1; load(); }));

        body.appendChild(buildTable<CounselingSession>(
          [
            { key: 'date', label: 'Date', render: c => new Date(c.session_date).toLocaleDateString() },
            { key: 'student', label: 'Student', render: c => c.student.full_name },
            { key: 'counselor', label: 'Counselor', render: c => c.counselor?.full_name || '—' },
            { key: 'concern', label: 'Concern', render: c => `<span class="badge secondary">${c.concern_type_display}</span>` },
            { key: 'status', label: 'Status', render: c => `<span class="badge ${c.status}">${c.status_display}</span>` },
            { key: 'follow_up', label: 'Follow-up', render: c => c.follow_up_date ? new Date(c.follow_up_date).toLocaleDateString() : '—' },
            { key: 'actions', label: '', render: c => {
              const wrap = div('d-flex gap-1');
              wrap.appendChild(button('btn btn-sm btn-soft', [icon('eye')], () => navigate(`/counseling/${c.id}`)));
              wrap.appendChild(button('btn btn-sm btn-outline-secondary', [icon('pencil')], () => navigate(`/counseling/${c.id}/edit`)));
              wrap.appendChild(button('btn btn-sm btn-outline-danger', [icon('trash')], () => navigate(`/counseling/${c.id}/delete`)));
              return wrap;
            } },
          ],
          items, 'No sessions found.',
        ));
        body.appendChild(buildPagination(pagination, (p) => { currentPage = p; load(); }));
        restoreDrafts?.();
      }
    } catch (err: any) {
      if (!silent && version === loadVersion) body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed to load</h4><p>${err.message}</p></div>`;
    }
  }
  enableLiveRefresh(shell, () => load(true));
  load();
  return shell;
}
