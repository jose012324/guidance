/**
 * Borrowed item return page — matches inventory/borrowed_return.html.
 * Form to mark a borrowed item as returned with date + optional notes.
 */
import { div, span, button, icon, el, p } from '../lib/dom';
import { borrowedApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';

export async function BorrowedReturnPage(pk: string): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/borrowed', 'Return Item', '', [body], []);

  // Fetch the borrowed record
  let record: any = null;
  try {
    // The borrowed_list endpoint returns all borrowed items — find ours
    const res = await borrowedApi.list({ per_page: 1000 });
    if (res.success && res.data) {
      record = res.data.items.find((b: any) => b.id === Number(pk));
    }
  } catch (e: any) {
    body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed to load</h4><p>${e.message}</p></div>`;
    return shell;
  }

  if (!record) {
    body.innerHTML = '<div class="empty-state"><i class="bi bi-compass"></i><h4>Record not found</h4><p>This borrowed item record does not exist.</p></div>';
    return shell;
  }

  body.innerHTML = '';

  // Build the form
  const form = el('form', '') as HTMLFormElement;

  // Display read-only info
  const infoCard = div('card mb-3', [
    div('card-header', [icon('arrow-return-left'), span('', ['Return Details'])]),
    div('card-body', [
      descList([
        ['Borrower', record.borrower_name],
        ['Department', record.department || '—'],
        ['Item', record.item.name],
        ['Quantity', String(record.quantity)],
        ['Borrow Date', new Date(record.borrow_date).toLocaleDateString()],
        ['Expected Return', record.expected_return_date ? new Date(record.expected_return_date).toLocaleDateString() : '—'],
        ['Current Status', `<span class="badge ${record.status}">${record.status_display}</span>`],
      ]),
    ]),
  ]);

  // Actual return date input
  const dateInput = el('input', 'form-control') as HTMLInputElement;
  dateInput.type = 'date';
  dateInput.value = new Date().toISOString().slice(0, 10);
  dateInput.required = true;
  const dateField = div('mb-3', [
    el('label', 'form-label', ['Actual Return Date *']),
    dateInput,
  ]);

  // Notes textarea
  const notesInput = el('textarea', 'form-control') as HTMLTextAreaElement;
  notesInput.rows = 3;
  notesInput.placeholder = 'Optional notes about the return condition...';
  const notesField = div('mb-3', [
    el('label', 'form-label', ['Notes (optional)']),
    notesInput,
  ]);

  // Submit + cancel buttons
  const submitBtn = button('btn btn-success', [
    icon('check-circle'),
    span('', ['Mark Returned']),
  ], () => {});
  submitBtn.type = 'submit';
  const cancelBtn = button('btn btn-outline-secondary', [
    icon('arrow-left'),
    span('', ['Cancel']),
  ], () => navigate('/borrowed'));

  const actions = div('d-flex justify-content-end gap-2', [cancelBtn, submitBtn]);

  form.appendChild(dateField);
  form.appendChild(notesField);
  form.appendChild(actions);

  // Card with form
  const formCard = div('card', [
    div('card-body', [form]),
  ]);

  body.appendChild(infoCard);
  body.appendChild(formCard);

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Processing…</span>';
    try {
      await borrowedApi.return(Number(pk), {
        actual_return_date: dateInput.value,
        notes: notesInput.value || undefined,
      });
      toastSuccess('Item marked as returned');
      navigate('/borrowed');
    } catch (err: any) {
      toastError(err.message || 'Failed to mark returned');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(icon('check-circle'));
      submitBtn.appendChild(span('', ['Mark Returned']));
    }
  });

  return shell;
}

function descList(rows: [string, string][]): HTMLElement {
  const dl = el('dl', 'row mb-0', []) as HTMLElement;
  for (const [k, v] of rows) {
    dl.appendChild(el('dt', 'text-muted-soft', [k], { style: 'flex: 0 0 40%;' }));
    const dd = el('dd', '', [], { style: 'flex: 1; margin-left: 0;' });
    dd.innerHTML = v;
    dl.appendChild(dd);
  }
  return dl;
}
