/** Referrals list page. */
import { div, span, button, icon } from '../lib/dom';
import { referralsApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { buildTable, buildPagination, buildFilterBar, preserveFilterDrafts } from '../components/Table';
import { navigate, enableLiveRefresh } from '../lib/router';
import type { Referral } from '../../shared/types';
import { REFERRAL_TYPES } from '../lib/referralTypes';

export async function ReferralsListPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/referrals', 'Referral Management', 'Create, monitor, and close student referrals.', [body], [
    { label: 'New Referral', icon: 'plus-circle', variant: 'primary', onClick: () => navigate('/referrals/create') },
  ]);
  let page = 1, filters: any = {};
  let loadVersion = 0;
  async function load(silent = false) {
    const version = ++loadVersion;
    if (!silent) { body.innerHTML = ''; body.appendChild(loadingEl()); }
    try {
      const res = await referralsApi.list({ ...filters, page, per_page: 15 });
      if (version !== loadVersion) return;
      if (res.success && res.data) {
        const { items, pagination } = res.data;
        const restoreDrafts = silent ? preserveFilterDrafts(body) : null;
        body.innerHTML = '';
        body.appendChild(buildFilterBar([
          { name: 'search', label: 'Search student, reason, or type', value: filters.search },
          { name: 'status', label: 'Status', type: 'select', options: [
            { value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'ongoing', label: 'Ongoing' }, { value: 'completed', label: 'Completed' },
          ], value: filters.status },
          { name: 'priority', label: 'Priority', type: 'select', options: [
            { value: '', label: 'All' }, { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
          ], value: filters.priority },
          { name: 'referral_type', label: 'Type', type: 'select', options: [
            { value: '', label: 'All Types' },
            ...REFERRAL_TYPES.map(([value, label]) => ({ value, label })),
          ], value: filters.referral_type },
        ], (v) => { filters = v; page = 1; load(); }, () => { filters = {}; page = 1; load(); }));
        body.appendChild(buildTable<Referral>([
          { key: 'id', label: '#', render: r => `#${r.id}` },
          { key: 'student', label: 'Student', render: r => r.student.full_name },
          { key: 'type', label: 'Type', render: r => r.referral_type_display },
          { key: 'priority', label: 'Priority', render: r => `<span class="badge ${r.priority === 'urgent' ? 'overdue' : r.priority === 'high' ? 'low_stock' : 'secondary'}">${r.priority_display}</span>` },
          { key: 'status', label: 'Status', render: r => `<span class="badge ${r.status}">${r.status_display}</span>` },
          { key: 'assigned', label: 'Assigned To', render: r => r.assigned_counselor?.full_name || '—' },
          { key: 'date', label: 'Referred', render: r => r.referred_at ? new Date(r.referred_at).toLocaleDateString() : '—' },
          { key: 'actions', label: '', render: r => {
            const wrap = div('d-flex gap-1');
            wrap.appendChild(button('btn btn-sm btn-soft', [icon('eye')], () => navigate(`/referrals/${r.id}`)));
            wrap.appendChild(button('btn btn-sm btn-outline-secondary', [icon('pencil')], () => navigate(`/referrals/${r.id}/edit`)));
            wrap.appendChild(button('btn btn-sm btn-outline-danger', [icon('trash')], () => navigate(`/referrals/${r.id}/delete`)));
            return wrap;
          } },
        ], items, 'No referrals found.'));
        body.appendChild(buildPagination(pagination, (p) => { page = p; load(); }));
        restoreDrafts?.();
      }
    } catch (e: any) { if (!silent && version === loadVersion) body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; }
  }
  enableLiveRefresh(shell, () => load(true));
  load();
  return shell;
}
