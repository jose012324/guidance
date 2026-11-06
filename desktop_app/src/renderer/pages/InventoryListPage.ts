/** Inventory list page. */
import { div, span, button, icon } from '../lib/dom';
import { inventoryApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { buildTable, buildPagination, buildFilterBar, preserveFilterDrafts } from '../components/Table';
import { navigate, enableLiveRefresh } from '../lib/router';
import type { InventoryItem } from '../../shared/types';

export async function InventoryListPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/inventory', 'Inventory Management', 'Manage office supplies, furniture, equipment, and forms.', [body], [
    { label: 'Stock Monitoring', icon: 'graph-up', variant: 'outline-secondary', onClick: () => navigate('/inventory/stock-monitoring') },
    { label: 'Borrowed Items', icon: 'arrow-left-right', variant: 'outline-secondary', onClick: () => navigate('/borrowed') },
    { label: 'Add Item', icon: 'plus-circle', variant: 'primary', onClick: () => navigate('/inventory/create') },
  ]);
  let page = 1, filters: any = {};
  let loadVersion = 0;
  async function load(silent = false) {
    const version = ++loadVersion;
    if (!silent) { body.innerHTML = ''; body.appendChild(loadingEl()); }
    try {
      const res = await inventoryApi.list({ ...filters, page, per_page: 15 });
      if (version !== loadVersion) return;
      if (res.success && res.data) {
        const { items, pagination } = res.data;
        const restoreDrafts = silent ? preserveFilterDrafts(body) : null;
        body.innerHTML = '';
        body.appendChild(buildFilterBar([
          { name: 'search', label: 'Search', value: filters.search },
          { name: 'category', label: 'Category', type: 'select', options: [
            { value: '', label: 'All' }, { value: 'office_supplies', label: 'Office Supplies' }, { value: 'furniture', label: 'Furniture' },
            { value: 'equipment', label: 'Equipment' }, { value: 'forms', label: 'Forms & Documents' }, { value: 'other', label: 'Other' },
          ], value: filters.category },
          { name: 'stock_status', label: 'Stock', type: 'select', options: [
            { value: '', label: 'All' }, { value: 'available', label: 'Available' }, { value: 'low_stock', label: 'Low Stock' }, { value: 'out_of_stock', label: 'Out of Stock' },
          ], value: filters.stock_status },
        ], (v) => { filters = v; page = 1; load(); }, () => { filters = {}; page = 1; load(); }));
        body.appendChild(buildTable<InventoryItem>([
          { key: 'code', label: 'Item Code', render: i => `<span class="fw-medium">${i.item_code}</span>` },
          { key: 'name', label: 'Name', render: i => i.name },
          { key: 'category', label: 'Category', render: i => `<span class="badge secondary">${i.category_display}</span>` },
          { key: 'qty', label: 'Quantity', render: i => String(i.quantity) },
          { key: 'unit', label: 'Unit', render: i => i.unit },
          { key: 'reorder', label: 'Reorder', render: i => String(i.reorder_level) },
          { key: 'status', label: 'Status', render: i => `<span class="badge ${i.stock_status}">${i.stock_status_display}</span>` },
          { key: 'actions', label: '', render: i => {
            const wrap = div('d-flex gap-1');
            wrap.appendChild(button('btn btn-sm btn-soft', [icon('eye')], () => navigate(`/inventory/${i.id}`)));
            wrap.appendChild(button('btn btn-sm btn-outline-secondary', [icon('pencil')], () => navigate(`/inventory/${i.id}/edit`)));
            wrap.appendChild(button('btn btn-sm btn-danger', [icon('trash')], () => navigate(`/inventory/${i.id}/delete`)));
            return wrap;
          } },
        ], items, 'No items found.'));
        body.appendChild(buildPagination(pagination, (p) => { page = p; load(); }));
        restoreDrafts?.();
      }
    } catch (e: any) { if (!silent && version === loadVersion) body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; }
  }
  enableLiveRefresh(shell, () => load(true));
  load();
  return shell;
}
