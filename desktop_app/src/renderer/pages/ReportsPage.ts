/** Reports home page — matches Django reports/home.html exactly. */
import { div, span, button, icon, el } from '../lib/dom';
import { reportsApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';

const REPORT_CARDS = [
  { key: 'students', name: 'Student Record Report', icon: 'mortarboard-fill', cls: 'bg-accent', description: 'Record inventory summary of student records.' },
  { key: 'counseling', name: 'Counseling Report', icon: 'chat-heart-fill', cls: 'bg-success', description: 'All counseling sessions with student, counselor, and concern type.' },
  { key: 'referrals', name: 'Referral Report', icon: 'send-exclamation-fill', cls: 'bg-warning', description: 'All referrals with priority, status, and timeline.' },
  // Inventory Report — hidden (inventory module not implemented)
  // { key: 'inventory', name: 'Inventory Report', icon: 'box-seam-fill', cls: 'bg-info', description: 'Stock levels, categories, and reorder thresholds.' },
  // Borrowing Report — hidden (inventory module not implemented)
  // { key: 'borrowing', name: 'Borrowing Report', icon: 'arrow-left-right', cls: 'bg-accent', description: 'All borrowing records with return status.' },
  { key: 'user-activity', name: 'User Activity Logs', icon: 'activity', cls: 'bg-success', description: 'Audit log of all user actions across the system.' },
];

export async function ReportsPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/reports', 'Reports & Analytics Center', 'Generate, view, and export reports across all modules.', [body], []);

  body.innerHTML = '';

  // Stat cards — same design as dashboard KPI cards
  const row = div('row g-3 mb-4', []);
  REPORT_CARDS.forEach((r, i) => {
    const delay = (i % 2) * 100;
    const cardHtml = `
      <div class="col-sm-6" data-aos="fade-up" data-aos-delay="${delay}">
        <div class="stat-card" style="cursor: pointer;">
          <div class="stat-icon ${r.cls}"><i class="bi bi-${r.icon}"></i></div>
          <div class="stat-info">
            <div class="stat-value" style="font-size: 1rem; font-weight: 600;">${r.name}</div>
            <div class="stat-label">${r.description}</div>
          </div>
        </div>
      </div>
    `;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHtml.trim();
    const col = tempDiv.firstElementChild as HTMLElement;
    col.addEventListener('click', () => navigate(`/reports/${r.key}`));
    row.appendChild(col);
  });
  body.appendChild(row);

  // Info card
  const infoCard = div('card', [
    div('card-body', [
      el('h5', 'mb-2', [icon('info-circle'), span('', ['About Reports'])]),
      el('p', 'text-muted-soft mb-0 small', [
        'The Student Record Report surfaces a full record-inventory summary, while the other reports support a date range filter (defaults to the last 30 days). Every report can be exported to ',
        (() => { const s = document.createElement('strong'); s.textContent = 'CSV'; return s; })(),
        ' (Excel-compatible, UTF-8 with BOM). Click "Export CSV" on any report page to download. ',
        'PDF and Excel-native exports are planned for a future release.',
      ]),
    ]),
  ]);
  body.appendChild(infoCard);

  return shell;
}
