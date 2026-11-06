/** Borrowed item create form. */
import { div, span, button, icon, el } from '../lib/dom';
import { borrowedApi, inventoryApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';

export async function BorrowedFormPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/borrowed', 'Record Borrowing', 'Log an item borrowed by a staff member.', [body], []);

  const itemsRes = await inventoryApi.list({ per_page: 1000 });
  const items = itemsRes.data?.items || [];

  body.innerHTML = '';
  const form = el('form', '') as HTMLFormElement;

  const bnInput = el('input', 'form-control') as HTMLInputElement; bnInput.required = true; bnInput.placeholder = 'Borrower name';
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Borrower Name *']), bnInput]));
  const deptInput = el('input', 'form-control') as HTMLInputElement; deptInput.placeholder = 'Department';
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Department']), deptInput]));

  const itemSelect = el('select', 'form-select') as HTMLSelectElement; itemSelect.required = true;
  itemSelect.appendChild(new Option('— Select Item —', ''));
  for (const i of items) itemSelect.appendChild(new Option(`${i.name} (${i.item_code})`, String(i.id)));
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Item *']), itemSelect]));

  const qtyInput = el('input', 'form-control') as HTMLInputElement; qtyInput.type = 'number'; qtyInput.min = '1'; qtyInput.value = '1'; qtyInput.required = true;
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Quantity *']), qtyInput]));

  const bdInput = el('input', 'form-control') as HTMLInputElement; bdInput.type = 'date'; bdInput.value = new Date().toISOString().slice(0, 10); bdInput.required = true;
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Borrow Date']), bdInput]));
  const erdInput = el('input', 'form-control') as HTMLInputElement; erdInput.type = 'date';
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Expected Return Date']), erdInput]));

  const notesInput = el('textarea', 'form-control') as HTMLTextAreaElement; notesInput.rows = 2;
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Notes']), notesInput]));

  const submitBtn = button('btn btn-primary', [icon('save'), span('', ['Record Borrowing'])]);
  form.appendChild(div('d-flex justify-content-end gap-2 mt-3', [
    button('btn btn-outline-secondary', [icon('arrow-left'), span('', ['Cancel'])], () => navigate('/borrowed')),
    submitBtn,
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data: any = {
      borrower_name: bnInput.value, department: deptInput.value, item: itemSelect.value,
      quantity: Number(qtyInput.value), borrow_date: bdInput.value, notes: notesInput.value,
    };
    if (erdInput.value) data.expected_return_date = erdInput.value;
    submitBtn.disabled = true;
    try { await borrowedApi.create(data); toastSuccess('Borrowing recorded'); navigate('/borrowed'); }
    catch (err: any) { toastError(err.message); submitBtn.disabled = false; }
  });

  body.appendChild(div('card', [div('card-body', [form])]));
  return shell;
}
