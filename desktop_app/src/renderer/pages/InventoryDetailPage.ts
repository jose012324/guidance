/** Inventory detail page with stock adjustment. */
import { div, span, button, icon, el } from '../lib/dom';
import { inventoryApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate, enableLiveRefresh } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';

export async function InventoryDetailPage(pk: string): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/inventory', 'Item Details', '', [body], []);
  let loadVersion = 0;

  async function load(silent = false) {
    const version = ++loadVersion;
    if (!silent) { body.innerHTML = ''; body.appendChild(loadingEl()); }
    try {
      const res = await inventoryApi.detail(Number(pk));
      if (version !== loadVersion) return;
      if (res.success && res.data) {
        const i = res.data.item;
        body.innerHTML = '';

        // Stats row
        body.appendChild(div('row g-3 mb-3', [
          div('col-md-4', [div('stat-card', [div('stat-icon bg-accent', [icon('box')]), div('stat-info', [div('stat-value', [String(i.quantity)]), div('stat-label', [`In Stock (${i.unit})`])])])]),
          div('col-md-4', [div('stat-card', [div('stat-icon bg-warning', [icon('exclamation-triangle')]), div('stat-info', [div('stat-value', [String(i.reorder_level)]), div('stat-label', ['Reorder Level'])])])]),
          div('col-md-4', [div('stat-card', [div(`stat-icon ${i.stock_status === 'available' ? 'bg-success' : i.stock_status === 'low_stock' ? 'bg-warning' : 'bg-danger'}`, [icon('circle-fill')]), div('stat-info', [div('stat-value', [i.stock_status_display], { style: 'font-size: 1.3rem;' } as any)]), div('stat-label', ['Current Status'])])]),
        ]));

        // Stock adjustment
        const adjustForm = el('form', '') as HTMLFormElement;
        const moveSelect = el('select', 'form-control') as HTMLSelectElement;
        moveSelect.appendChild(new Option('Stock In', 'in'));
        moveSelect.appendChild(new Option('Stock Out', 'out'));
        moveSelect.appendChild(new Option('Adjustment', 'adjust'));
        const qtyInput = el('input', 'form-control') as HTMLInputElement;
        qtyInput.type = 'number'; qtyInput.min = '1'; qtyInput.value = '1'; qtyInput.required = true;
        const noteInput = el('input', 'form-control') as HTMLInputElement;
        noteInput.placeholder = 'Optional note';
        const applyBtn = button('btn btn-primary w-100', [icon('check-lg'), span('', ['Apply'])]);
        adjustForm.appendChild(div('row g-2', [
          div('col-md-3', [el('label', 'form-label', ['Action']), moveSelect]),
          div('col-md-3', [el('label', 'form-label', ['Quantity']), qtyInput]),
          div('col-md-4', [el('label', 'form-label', ['Note']), noteInput]),
          div('col-md-2', [el('label', 'form-label', [' ']), applyBtn]),
        ]));
        adjustForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          applyBtn.disabled = true;
          try { await inventoryApi.adjust(i.id, moveSelect.value as any, Number(qtyInput.value), noteInput.value); toastSuccess('Stock adjusted'); load(); }
          catch (err: any) { toastError(err.message); applyBtn.disabled = false; }
        });

        body.appendChild(div('card mb-3', [div('card-header', [icon('arrow-down-up'), span('', ['Stock Adjustment'])]), div('card-body', [adjustForm])]));

        // Movement history
        body.appendChild(div('card mb-3', [
          div('card-header', [icon('clock-history'), span('', ['Stock Movement History'])]),
          div('card-body', [
            simpleTable([
              ['Type', 'Qty', 'Balance', 'By', 'Date', 'Note'],
              ...(i.movements || []).map(m => [
                `<span class="badge secondary">${m.movement_type_display}</span>`,
                String(m.quantity), String(m.balance_after),
                m.performed_by?.full_name || '—',
                new Date(m.timestamp).toLocaleString(),
                m.note || '—',
              ]),
            ]),
          ]),
        ]));

        // Borrowed records
        body.appendChild(div('card', [
          div('card-header', [icon('arrow-left-right'), span('', ['Borrowing History'])]),
          div('card-body', [
            simpleTable([
              ['Borrower', 'Qty', 'Borrowed', 'Return Due', 'Status'],
              ...(i.borrowed_records || []).map(b => [
                b.borrower_name, String(b.quantity),
                new Date(b.borrow_date).toLocaleDateString(),
                b.expected_return_date ? new Date(b.expected_return_date).toLocaleDateString() : '—',
                `<span class="badge ${b.status}">${b.status_display}</span>`,
              ]),
            ]),
          ]),
        ]));
      }
    } catch (e: any) { if (!silent && version === loadVersion) body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; }
  }
  enableLiveRefresh(shell, () => load(true));
  load();

  const actions = shell.querySelector('.page-header-actions');
  if (actions) {
    actions.insertBefore(button('btn btn-outline-danger', [icon('trash'), span('', ['Delete'])], () => navigate(`/inventory/${pk}/delete`)), actions.firstChild);
    actions.insertBefore(button('btn btn-primary', [icon('pencil'), span('', ['Edit'])], () => navigate(`/inventory/${pk}/edit`)), actions.firstChild);
  }

  return shell;
}

function simpleTable(rows: string[][]): HTMLElement {
  if (rows.length <= 1) return div('text-center text-muted-soft py-3', ['No records.']);
  const [header, ...rest] = rows;
  const table = el('table', 'table table-sm') as HTMLTableElement;
  const thead = el('thead', '', [el('tr', '', header.map(h => el('th', '', [h])))]);
  const tbody = el('tbody', '', rest.map(r => el('tr', '', r.map(c => { const td = el('td', ''); td.innerHTML = c; return td; }))));
  table.appendChild(thead); table.appendChild(tbody);
  return div('table-responsive', [table]);
}
