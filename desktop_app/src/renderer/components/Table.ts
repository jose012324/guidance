/**
 * Reusable table + pagination + filter-bar builders.
 */
import { div, span, button, icon, el, p } from '../lib/dom';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => string | HTMLElement;
}

/** Keep text a user has typed into a filter while its results refresh. */
export function preserveFilterDrafts(container: HTMLElement): () => void {
  const values = Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.filter-bar input, .filter-bar select'))
    .map(input => input.value);
  return () => {
    container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.filter-bar input, .filter-bar select')
      .forEach((input, index) => { if (values[index] !== undefined) input.value = values[index]; });
  };
}

export function buildTable<T>(
  columns: Column<T>[],
  rows: T[],
  emptyMessage = 'No records found',
): HTMLElement {
  if (rows.length === 0) {
    return div('table-card', [
      div('empty-state', [
        icon('inbox'),
        el('h4', '', ['No records']),
        p('', [emptyMessage]),
      ]),
    ]);
  }

  const thead = el('thead', '', [el('tr', '', columns.map(c => el('th', '', [c.label])))]);
  const tbody = el('tbody', '', rows.map(row => {
    const tr = el('tr', '');
    for (const col of columns) {
      const td = el('td', '');
      const val = col.render(row);
      if (typeof val === 'string') td.innerHTML = val;
      else td.appendChild(val);
      tr.appendChild(td);
    }
    return tr;
  }));

  const table = el('table', 'table') as HTMLTableElement;
  table.appendChild(thead);
  table.appendChild(tbody);
  return div('table-card', [div('table-responsive', [table])]);
}

export function buildPagination(
  pagination: { page: number; total_pages: number; total_count: number; has_next: boolean; has_previous: boolean },
  onPageChange: (page: number) => void,
): HTMLElement {
  const { page, total_pages, total_count, has_previous, has_next } = pagination;
  const info = span('text-muted-soft small', [`Showing page ${page} of ${total_pages} · ${total_count} total`]);

  const buttons: HTMLElement[] = [];
  const makeBtn = (label: string | HTMLElement, p: number | null, disabled: boolean, active = false) => {
    const btn = button(`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`, [label], () => {
      if (p !== null && !disabled) onPageChange(p);
    });
    if (disabled) btn.disabled = true;
    buttons.push(btn);
  };

  makeBtn(icon('chevron-left'), has_previous ? page - 1 : null, !has_previous);
  // Show up to 5 page numbers around current
  const start = Math.max(1, page - 2);
  const end = Math.min(total_pages, page + 2);
  for (let i = start; i <= end; i++) {
    makeBtn(String(i), i, false, i === page);
  }
  makeBtn(icon('chevron-right'), has_next ? page + 1 : null, !has_next);

  return div('d-flex justify-content-between align-items-center p-3', [
    info,
    div('d-flex gap-2', buttons),
  ], { style: 'border-top: 1px solid var(--border);' });
}

export function buildFilterBar(
  fields: { name: string; label: string; type?: 'text' | 'select'; options?: { value: string; label: string }[]; value?: string }[],
  onSubmit: (values: Record<string, string>) => void,
  onReset?: () => void,
): HTMLElement {
  const inputs: Record<string, HTMLInputElement | HTMLSelectElement> = {};
  const children: HTMLElement[] = [];
  for (const f of fields) {
    const wrap = div('');
    const label = el('label', 'form-label small', [f.label]);
    let input: HTMLInputElement | HTMLSelectElement;
    if (f.type === 'select' && f.options) {
      input = el('select', 'form-control') as HTMLSelectElement;
      for (const opt of f.options) {
        input.appendChild(new Option(opt.label, opt.value));
      }
    } else {
      input = el('input', 'form-control') as HTMLInputElement;
      input.type = f.type || 'text';
    }
    if (f.value) input.value = f.value;
    inputs[f.name] = input;
    wrap.appendChild(label);
    wrap.appendChild(input);
    children.push(wrap);
  }

  const submitBtn = button('btn btn-soft', [icon('funnel'), span('', ['Filter'])], () => {
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(inputs)) values[k] = v.value;
    onSubmit(values);
  });
  children.push(submitBtn);

  if (onReset) {
    const resetBtn = button('btn btn-outline-secondary', [icon('arrow-clockwise')], onReset);
    children.push(resetBtn);
  }

  return div('filter-bar', children);
}
