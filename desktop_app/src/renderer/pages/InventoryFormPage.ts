/** Inventory create/edit form page. */
import { div, span, button, icon, el } from '../lib/dom';
import { inventoryApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';

export async function InventoryFormPage(pk?: string): Promise<HTMLElement> {
  const isCreate = !pk;
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/inventory', isCreate ? 'Add Inventory Item' : 'Edit Item',
    isCreate ? 'Item code auto-generates if left blank.' : 'Update item information.', [body], []);

  let initial: any = {};
  if (!isCreate) {
    try { const r = await inventoryApi.detail(Number(pk)); initial = r.data?.item || {}; }
    catch (e: any) { body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; return shell; }
  }

  body.innerHTML = '';
  const form = el('form', '') as HTMLFormElement;

  const codeInput = (() => { const i = el('input', 'form-control') as HTMLInputElement; i.name = 'item_code'; i.value = initial.item_code || ''; i.placeholder = 'Auto-generated if blank'; return i; })();
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Item Code']), codeInput]));
  const nameInput = (() => { const i = el('input', 'form-control') as HTMLInputElement; i.name = 'name'; i.value = initial.name || ''; i.required = true; return i; })();
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Name *']), nameInput]));

  const catSelect = el('select', 'form-select') as HTMLSelectElement;
  for (const [v, l] of [['office_supplies', 'Office Supplies'], ['furniture', 'Furniture'], ['equipment', 'Equipment'], ['forms', 'Forms & Documents'], ['other', 'Other']]) {
    const opt = new Option(l as string, v as string);
    if (initial.category === v) opt.selected = true;
    catSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Category']), catSelect]));

  const unitSelect = el('select', 'form-select') as HTMLSelectElement;
  for (const [v, l] of [['piece', 'Piece'], ['box', 'Box'], ['pack', 'Pack'], ['ream', 'Ream'], ['set', 'Set'], ['unit', 'Unit'], ['bundle', 'Bundle']]) {
    const opt = new Option(l as string, v as string);
    if (initial.unit === v) opt.selected = true;
    unitSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Unit']), unitSelect]));

  const qtyInput = (() => { const i = el('input', 'form-control') as HTMLInputElement; i.type = 'number'; i.min = '0'; i.name = 'quantity'; i.value = String(initial.quantity ?? 0); i.required = true; return i; })();
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Quantity']), qtyInput]));
  const reorderInput = (() => { const i = el('input', 'form-control') as HTMLInputElement; i.type = 'number'; i.min = '0'; i.name = 'reorder_level'; i.value = String(initial.reorder_level ?? 5); i.required = true; return i; })();
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Reorder Level']), reorderInput]));

  const descInput = el('textarea', 'form-control') as HTMLTextAreaElement;
  descInput.rows = 2; descInput.name = 'description'; descInput.value = initial.description || '';
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Description']), descInput]));

  const submitBtn = button('btn btn-primary', [icon('save'), span('', [isCreate ? 'Add Item' : 'Save Changes'])]);
  form.appendChild(div('d-flex justify-content-end gap-2 mt-3', [
    button('btn btn-outline-secondary', [icon('arrow-left'), span('', ['Cancel'])], () => navigate('/inventory')),
    submitBtn,
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data: any = {
      item_code: codeInput.value, name: nameInput.value, category: catSelect.value,
      unit: unitSelect.value, quantity: Number(qtyInput.value), reorder_level: Number(reorderInput.value),
      description: descInput.value,
    };
    submitBtn.disabled = true;
    try {
      const res = isCreate ? await inventoryApi.create(data) : await inventoryApi.update(Number(pk), data);
      if (res.success) { toastSuccess(isCreate ? 'Item added' : 'Item updated'); navigate(`/inventory/${res.data!.item.id}`); }
    } catch (err: any) { toastError(err.message); submitBtn.disabled = false; }
  });

  body.appendChild(div('card', [div('card-body', [form])]));
  return shell;
}
