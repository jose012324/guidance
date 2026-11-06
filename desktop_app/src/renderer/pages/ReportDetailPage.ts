/** Generic report detail page — shows table + CSV export button. */
import { div, span, button, icon, el } from '../lib/dom';
import { reportsApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import type { StudentRecordInventory } from '../../shared/types';
import { renderInventory, drawCharts } from './StudentRecordInventoryPage';

const STUDENT_REPORT_KPIS: Array<[keyof StudentRecordInventory['kpis'], string]> = [
  ['total_students', 'Total Registered Students'],
  ['active_students', 'Active Students'],
  ['inactive_students', 'Inactive Students'],
  ['newly_registered_students', 'Newly Registered Students'],
  ['with_guidance_records', 'With Guidance Records'],
  ['without_guidance_records', 'Without Guidance Records'],
  ['active_cases', 'Active Cases'],
  ['closed_cases', 'Closed Cases'],
  ['pending_referrals', 'Pending Referrals'],
  ['referred_students', 'Referred Students'],
  ['completed_referrals', 'Completed Referrals'],
  ['urgent_cases', 'Urgent Cases'],
  ['emergency_cases', 'Emergency Cases'],
  ['counseling_students', 'Students with Counseling Sessions'],
];

const STUDENT_REPORT_BREAKDOWNS: Array<[keyof StudentRecordInventory, string]> = [
  ['year_levels', 'Students by Year Level'],
  ['programs', 'Students by Course & Section'],
  ['genders', 'Students by Gender'],
  ['concerns', 'Cases by Concern'],
  ['referral_statuses', 'Referral Status'],
];

export async function ReportDetailPage(type: string): Promise<HTMLElement> {
  const titles: Record<string, string> = {
    students: 'Student Record Report', counseling: 'Counseling Report',
    referrals: 'Referral Report', inventory: 'Inventory Report',
    borrowing: 'Borrowing Report', 'user-activity': 'User Activity Logs',
  };
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/reports', titles[type] || 'Report', '', [body], []);

  // Student Record Report — renders the Student Record Inventory summary
  // (KPI counts + breakdowns) instead of a plain student directory.
  if (type === 'students') {
    await renderStudentRecordReport(body, shell);
    return shell;
  }

  try {
    let items: any[] = [];
    let count = 0;
    let columns: { key: string; label: string; render: (r: any) => string }[] = [];

    switch (type) {
      case 'counseling': {
        const res = await reportsApi.counseling();
        items = res.data?.items || []; count = res.data?.count || 0;
        columns = [
          { key: 'date', label: 'Date', render: r => new Date(r.session_date).toLocaleDateString() },
          { key: 'student', label: 'Student', render: r => r.student.full_name },
          { key: 'counselor', label: 'Counselor', render: r => r.counselor?.full_name || '—' },
          { key: 'concern', label: 'Concern', render: r => r.concern_type_display },
          { key: 'status', label: 'Status', render: r => `<span class="badge ${r.status}">${r.status_display}</span>` },
        ];
        break;
      }
      case 'referrals': {
        const res = await reportsApi.referrals();
        items = res.data?.items || []; count = res.data?.count || 0;
        columns = [
          { key: 'id', label: '#', render: r => `#${r.id}` },
          { key: 'date', label: 'Date', render: r => new Date(r.referred_at).toLocaleDateString() },
          { key: 'student', label: 'Student', render: r => r.student.full_name },
          { key: 'type', label: 'Type', render: r => r.referral_type_display },
          { key: 'priority', label: 'Priority', render: r => r.priority_display },
          { key: 'status', label: 'Status', render: r => `<span class="badge ${r.status}">${r.status_display}</span>` },
        ];
        break;
      }
      case 'inventory': {
        const res = await reportsApi.inventory();
        items = res.data?.items || []; count = res.data?.count || 0;
        columns = [
          { key: 'code', label: 'Item Code', render: r => r.item_code },
          { key: 'name', label: 'Name', render: r => r.name },
          { key: 'category', label: 'Category', render: r => r.category_display },
          { key: 'qty', label: 'Quantity', render: r => String(r.quantity) },
          { key: 'unit', label: 'Unit', render: r => r.unit },
          { key: 'reorder', label: 'Reorder', render: r => String(r.reorder_level) },
          { key: 'status', label: 'Status', render: r => `<span class="badge ${r.stock_status}">${r.stock_status_display}</span>` },
        ];
        break;
      }
      case 'borrowing': {
        const res = await reportsApi.borrowing();
        items = res.data?.items || []; count = res.data?.count || 0;
        columns = [
          { key: 'borrower', label: 'Borrower', render: r => r.borrower_name },
          { key: 'item', label: 'Item', render: r => r.item.name },
          { key: 'qty', label: 'Qty', render: r => String(r.quantity) },
          { key: 'borrowed', label: 'Borrowed', render: r => new Date(r.borrow_date).toLocaleDateString() },
          { key: 'return', label: 'Return', render: r => r.actual_return_date ? new Date(r.actual_return_date).toLocaleDateString() : '—' },
          { key: 'status', label: 'Status', render: r => `<span class="badge ${r.status}">${r.status_display}</span>` },
        ];
        break;
      }
      case 'user-activity': {
        const res = await reportsApi.userActivity();
        items = res.data?.items || []; count = res.data?.count || 0;
        columns = [
          { key: 'timestamp', label: 'Timestamp', render: r => new Date(r.timestamp).toLocaleString() },
          { key: 'user', label: 'User', render: r => r.user?.full_name || 'System' },
          { key: 'action', label: 'Action', render: r => `<span class="badge secondary">${r.action_display}</span>` },
          { key: 'entity', label: 'Entity', render: r => r.entity },
          { key: 'description', label: 'Description', render: r => r.description || '—' },
        ];
        break;
      }
    }

    body.innerHTML = '';
    body.appendChild(div('card', [
      div('card-header d-flex justify-content-between align-items-center', [
        span('', [`${count} records`]),
        button('btn btn-success btn-sm', [icon('filetype-csv'), span('', ['Export CSV'])], () => exportCsv(columns, items, type)),
      ]),
      div('table-responsive', [
        items.length === 0
          ? div('empty-state', [icon('inbox'), el('h4', '', ['No records']), el('p', '', ['No data in this report.'])])
          : (() => {
              const table = el('table', 'table table-sm') as HTMLTableElement;
              table.appendChild(el('thead', '', [el('tr', '', columns.map(c => el('th', '', [c.label])))]));
              const tbody = el('tbody', '', items.map(r => {
                const tr = el('tr', '');
                for (const c of columns) {
                  const td = el('td', ''); td.innerHTML = c.render(r); tr.appendChild(td);
                }
                return tr;
              }));
              table.appendChild(tbody);
              return table;
            })(),
      ]),
    ]));
  } catch (e: any) { body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; }
  return shell;
}

function exportCsv(columns: { label: string; render: (r: any) => string }[], rows: any[], name: string): void {
  // Build CSV from rows using the column renderers (strip HTML)
  const header = columns.map(c => `"${c.label}"`).join(',');
  const lines = rows.map(r => columns.map(c => {
    const html = c.render(r);
    // Strip HTML tags for CSV
    const text = html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
    return `"${text.replace(/"/g, '""')}"`;
  }).join(','));
  const csv = '\ufeff' + [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}_report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Student Record Report — renders the Student Record Inventory KPI counts,
 * breakdowns, and charts (same visual language as the inventory page). */
async function renderStudentRecordReport(body: HTMLElement, shell: HTMLElement): Promise<void> {
  let charts: Record<string, any> = {};
  let latest: StudentRecordInventory | null = null;
  let chartVersion = 0;
  const clearCharts = () => {
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};
  };
  const render = (data: StudentRecordInventory) => {
    const version = ++chartVersion;
    clearCharts();
    body.replaceChildren(
      div('d-flex justify-content-end mb-3', [
        button('btn btn-success btn-sm', [icon('filetype-csv'), span('', ['Export CSV'])], () => exportStudentRecordCsv(data)),
      ]),
      renderInventory(data),
    );
    setTimeout(() => {
      if (version === chartVersion && body.isConnected) charts = drawCharts(data, body, {});
    }, 0);
  };

  try {
    const res = await reportsApi.students();
    const data = res.data;
    if (!data) {
      body.replaceChildren(div('empty-state', [icon('inbox'), el('h4', '', ['No records']), el('p', '', ['No data in this report.'])]));
      return;
    }
    latest = data;
    render(data);
  } catch (e: any) {
    body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`;
    return;
  }

  const themeObserver = new MutationObserver(() => { if (latest) render(latest); });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  shell.addEventListener('desktop:dispose', () => { themeObserver.disconnect(); chartVersion++; clearCharts(); });
}

function exportStudentRecordCsv(data: StudentRecordInventory): void {
  const rows: string[][] = [['Section', 'Label', 'Value']];
  STUDENT_REPORT_KPIS.forEach(([key, label]) => rows.push(['Summary', label, String(data.kpis[key] ?? 0)]));
  STUDENT_REPORT_BREAKDOWNS.forEach(([key, section]) => {
    (data[key] as Array<{ label: string; value: number }>).forEach(row => rows.push([section, row.label, String(row.value)]));
  });
  const csv = '\ufeff' + rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `student_record_report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
