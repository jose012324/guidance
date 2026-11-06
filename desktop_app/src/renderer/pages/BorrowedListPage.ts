/** Borrowed items list. */
import { div, span, button, icon } from '../lib/dom';
import { borrowedApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { buildTable, buildPagination, buildFilterBar, preserveFilterDrafts } from '../components/Table';
import { navigate, enableLiveRefresh } from '../lib/router';
import type { BorrowedItem } from '../../shared/types';

export async function BorrowedListPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/borrowed', 'Borrowed Items', 'Track items borrowed from inventory and their return status.', [body], [
    { label: 'Record Borrowing', icon: 'plus-circle', variant: 'primary', onClick: () => navigate('/borrowed/create') },
  ]);
  let page = 1, filters: any = {};
  let loadVersion = 0;
  async function load(silent = false) {
    const version = ++loadVersion;
    if (!silent) { body.innerHTML = ''; body.appendChild(loadingEl()); }
    try {
      const res = await borrowedApi.list({ ...filters, page, per_page: 15 });
      if (version !== loadVersion) return;
      if (res.success && res.data) {
        const { items, pagination } = res.data;
        const restoreDrafts = silent ? preserveFilterDrafts(body) : null;
        body.innerHTML = '';
        body.appendChild(buildFilterBar([
          { name: 'search', label: 'Search', value: filters.search },
          { name: 'status', label: 'Status', type: 'select', options: [
            { value: '', label: 'All' }, { value: 'borrowed', label: 'Borrowed' }, { value: 'returned', label: 'Returned' }, { value: 'overdue', label: 'Overdue' },
          ], value: filters.status },
        ], (v) => { filters = v; page = 1; load(); }, () => { filters = {}; page = 1; load(); }));
        body.appendChild(buildTable<BorrowedItem>([
          { key: 'borrower', label: 'Borrower', render: b => b.borrower_name },
          { key: 'item', label: 'Item', render: b => b.item.name },
          { key: 'qty', label: 'Qty', render: b => String(b.quantity) },
          { key: 'borrow_date', label: 'Borrowed', render: b => new Date(b.borrow_date).toLocaleDateString() },
          { key: 'expected', label: 'Return Due', render: b => b.expected_return_date ? new Date(b.expected_return_date).toLocaleDateString() : '—' },
          { key: 'status', label: 'Status', render: b => `<span class="badge ${b.status}">${b.status_display}</span>` },
          { key: 'actions', label: '', render: b => b.status !== 'returned' ? button('btn btn-sm btn-success', [icon('arrow-return-left'), span('', ['Return'])], () => navigate(`/borrowed/${b.id}/return`)) : span('text-muted-soft', ['—']) },
        ], items, 'No borrowed items.'));
        body.appendChild(buildPagination(pagination, (p) => { page = p; load(); }));
        restoreDrafts?.();
      }
    } catch (e: any) { if (!silent && version === loadVersion) body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; }
  }
  enableLiveRefresh(shell, () => load(true));
  load();
  return shell;
}
