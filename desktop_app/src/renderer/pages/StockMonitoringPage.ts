/** Stock monitoring center. */
import { div, span, icon, el } from '../lib/dom';
import { inventoryApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';

export async function StockMonitoringPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/inventory/stock-monitoring', 'Stock Monitoring Center',
    'Real-time inventory health overview with low-stock and out-of-stock alerts.', [body], []);

  try {
    const res = await inventoryApi.stockMonitoring();
    if (res.success && res.data) {
      const data = res.data;
      body.innerHTML = '';
      body.appendChild(div('row g-3 mb-4', [
        div('col-sm-6 col-xl-3', [div('stat-card', [div('stat-icon bg-accent', [icon('box-seam-fill')]), div('stat-info', [div('stat-value', [String(data.kpis.total)]), div('stat-label', ['Total Items'])])])]),
        div('col-sm-6 col-xl-3', [div('stat-card', [div('stat-icon bg-success', [icon('check-circle-fill')]), div('stat-info', [div('stat-value', [String(data.kpis.available)]), div('stat-label', ['Available'])])])]),
        div('col-sm-6 col-xl-3', [div('stat-card', [div('stat-icon bg-warning', [icon('exclamation-triangle-fill')]), div('stat-info', [div('stat-value', [String(data.kpis.low_stock)]), div('stat-label', ['Low Stock'])])])]),
        div('col-sm-6 col-xl-3', [div('stat-card', [div('stat-icon bg-danger', [icon('x-circle-fill')]), div('stat-info', [div('stat-value', [String(data.kpis.out_of_stock)]), div('stat-label', ['Out of Stock'])])])]),
      ]));

      body.appendChild(div('card mb-3', [
        div('card-header', [icon('exclamation-triangle-fill text-warning'), span('', ['Low Stock Items'])]),
        div('card-body', [simpleTable([
          ['Item Code', 'Name', 'Category', 'Quantity', 'Reorder'],
          ...data.low_stock.map(i => [i.item_code, i.name, i.category_display, `${i.quantity} ${i.unit}`, String(i.reorder_level)]),
        ], 'No low stock items.')]),
      ]));

      body.appendChild(div('card', [
        div('card-header', [icon('x-circle-fill text-danger'), span('', ['Out of Stock Items'])]),
        div('card-body', [simpleTable([
          ['Item Code', 'Name', 'Category', 'Reorder'],
          ...data.out_of_stock.map(i => [i.item_code, i.name, i.category_display, String(i.reorder_level)]),
        ], 'No out-of-stock items.')]),
      ]));
    }
  } catch (e: any) { body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; }
  return shell;
}

function simpleTable(rows: string[][], emptyMsg: string): HTMLElement {
  if (rows.length <= 1) return div('empty-state', [icon('check-circle'), el('p', '', [emptyMsg])]);
  const [header, ...rest] = rows;
  const table = el('table', 'table table-hover') as HTMLTableElement;
  const thead = el('thead', '', [el('tr', '', header.map(h => el('th', '', [h])))]);
  const tbody = el('tbody', '', rest.map(r => el('tr', '', r.map(c => { const td = el('td', ''); td.innerHTML = c; return td; }))));
  table.appendChild(thead); table.appendChild(tbody);
  return div('table-responsive', [table]);
}
