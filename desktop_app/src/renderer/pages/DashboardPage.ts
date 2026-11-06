/**
 * Dashboard page — KPIs + trend chart + activity feed + low stock.
 */
import { div, span, p, icon, el } from '../lib/dom';
import { dashboardApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import type { DashboardStats } from '../../shared/types';

export async function DashboardPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/dashboard', 'Dashboard', "Here's what's happening in your guidance office today.", [body], []);

  try {
    const res = await dashboardApi.stats();
    if (res.success && res.data) {
      const stats = res.data as DashboardStats;
      body.innerHTML = '';
      body.appendChild(renderStats(stats));
      body.appendChild(renderCharts(stats));
      body.appendChild(renderActivityAndLowStock(stats));
      // Render charts after DOM is painted
      setTimeout(() => renderChartCanvases(stats), 50);
    }
  } catch (err: any) {
    body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed to load</h4><p>${err.message}</p></div>`;
  }

  return shell;
}

function renderStats(stats: DashboardStats): HTMLElement {
  const kpis = stats.kpis;
  // Inventory-related KPI cards are commented out to match dashboard.html
  // (Inventory Items, Low Stock Items, Active Borrowed Items).
  const cards = [
    { icon: 'mortarboard-fill', cls: 'bg-accent', value: kpis.total_students, label: 'Total Students' },
    { icon: 'chat-heart-fill', cls: 'bg-success', value: kpis.sessions_total, label: 'Counseling Sessions' },
    { icon: 'send-exclamation-fill', cls: 'bg-warning', value: kpis.referrals_pending, label: 'Pending Referrals' },
    // { icon: 'box-seam-fill', cls: 'bg-info', value: kpis.inventory_total, label: 'Inventory Items' },
    { icon: 'check-circle-fill', cls: 'bg-success', value: kpis.active_students, label: 'Active Students' },
    { icon: 'hourglass-split', cls: 'bg-accent', value: kpis.sessions_open, label: 'Open Sessions' },
    // { icon: 'exclamation-triangle-fill', cls: 'bg-warning', value: kpis.low_stock_count, label: 'Low Stock Items' },
    // { icon: 'arrow-left-right', cls: 'bg-info', value: kpis.borrowed_active, label: 'Active Borrowed Items' },
  ];

  // Create two rows of 4 cards each, matching Django template pattern.
  // Note: cards is currently 5 (4 in row 1, 1 in row 2) to mirror dashboard.html,
  // which keeps the same column layout and gaps as the original template.
  const row1 = div('row g-3 mb-3', []);
  const row2 = div('row g-3 mb-4', []);

  cards.forEach((c, i) => {
    const delay = (i % 4) * 100; // 0, 100, 200, 300 for each row
    const row = i < 4 ? row1 : row2;
    const cardHtml = `
      <div class="col-sm-6 col-xl-3" data-aos="fade-up" data-aos-delay="${delay}">
        <div class="stat-card">
          <div class="stat-icon ${c.cls}"><i class="bi bi-${c.icon}"></i></div>
          <div class="stat-info">
            <div class="stat-value">${c.value}</div>
            <div class="stat-label">${c.label}</div>
          </div>
        </div>
      </div>
    `;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHtml;
    while (tempDiv.firstChild) {
      row.appendChild(tempDiv.firstChild);
    }
  });

  const container = div('', [row1, row2]);
  return container;
}

function renderCharts(stats: DashboardStats): HTMLElement {
  return div('row g-3 mb-4', [
    div('col-lg-8', [
      div('card h-100', [
        div('card-header d-flex justify-content-between align-items-center', [
          span('', [icon('graph-up'), span('', ['Monthly Trends'])]),
          el('small', 'text-muted-soft', ['Last 6 months']),
        ]),
        div('card-body', [el('canvas', '', [], { id: 'trendChart', height: '110' })]),
      ]),
    ]),
    div('col-lg-4', [
      div('card h-100', [
        div('card-header', [icon('pie-chart-fill'), span('', ['Counseling by Concern Type'])]),
        div('card-body d-flex align-items-center', [el('canvas', '', [], { id: 'concernChart' })]),
      ]),
    ]),
  ]);
}

function renderActivityAndLowStock(stats: DashboardStats): HTMLElement {
  const activityHtml = stats.activity_logs.map(l => {
    const iconMap: Record<string, string> = {
      create: 'plus-circle-fill', update: 'pencil-fill', delete: 'trash-fill',
      login: 'box-arrow-in-right', logout: 'box-arrow-right', backup: 'database-fill',
    };
    const ic = iconMap[l.action] || 'activity';
    return `<div class="d-flex gap-3 py-2" style="border-bottom: 1px solid var(--border-soft);">
      <div class="stat-icon bg-accent" style="width:36px; height:36px; font-size:.9rem;"><i class="bi bi-${ic}"></i></div>
      <div class="flex-grow-1">
        <div class="small fw-medium">${l.description || l.entity}</div>
        <small class="text-muted-soft">${l.user?.full_name || 'System'} · ${timeAgo(l.timestamp)}</small>
      </div>
    </div>`;
  }).join('') || '<div class="empty-state"><i class="bi bi-activity"></i><p class="mb-0">No recent activity.</p></div>';

  // Low Stock Alerts card is commented out to match dashboard.html.
  // Keeping the markup around (in the same place as the template) so it's
  // trivial to restore later — flip INCLUDE_LOW_STOCK to true.
  const INCLUDE_LOW_STOCK = false;
  const lowStockHtml = stats.low_stock_items.length
    ? stats.low_stock_items.map(i => `<div class="d-flex justify-content-between align-items-center py-2" style="border-bottom: 1px solid var(--border-soft);">
        <div><div class="fw-medium">${i.name}</div><small class="text-muted-soft">${i.item_code} · ${i.quantity} ${i.unit} left</small></div>
        <span class="badge ${i.stock_status}">${i.stock_status_display}</span>
      </div>`).join('')
    : '<div class="empty-state"><i class="bi bi-check-circle"></i><p class="mb-0">All items well stocked.</p></div>';

  const wrap = document.createElement('div');
  wrap.className = 'row g-3';
  // Recent Activity card is full-width when the Low Stock Alerts card is hidden,
  // matching the commented-out block in dashboard.html (only col-lg-7 stays).
  wrap.innerHTML = INCLUDE_LOW_STOCK
    ? `
    <div class="col-lg-7">
      <div class="card h-100">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-activity me-2"></i>Recent Activity</span>
          <a href="#/database" class="small">View all logs</a>
        </div>
        <div class="card-body">${activityHtml}</div>
      </div>
    </div>
    <div class="col-lg-5">
      <div class="card h-100">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>Low Stock Alerts</span>
          <a href="#/inventory/stock-monitoring" class="small">View all</a>
        </div>
        <div class="card-body">${lowStockHtml}</div>
      </div>
    </div>
  `
    : `
    <div class="col-lg-7">
      <div class="card h-100">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-activity me-2"></i>Recent Activity</span>
          <a href="#/database" class="small">View all logs</a>
        </div>
        <div class="card-body">${activityHtml}</div>
      </div>
    </div>
  `;
  return wrap;
}

function renderChartCanvases(stats: DashboardStats): void {
  const trendEl = document.getElementById('trendChart') as HTMLCanvasElement | null;
  if (trendEl && (window as any).Chart) {
    new (window as any).Chart(trendEl.getContext('2d'), {
      type: 'line',
      data: {
        labels: stats.counseling_trend.map(t => t.label),
        datasets: [
          {
            label: 'Counseling Sessions',
            data: stats.counseling_trend.map(t => t.value),
            borderColor: '#1a3a6b', backgroundColor: 'rgba(26, 58, 107, .1)',
            fill: true, tension: .4, borderWidth: 2,
            pointBackgroundColor: '#1a3a6b', pointBorderColor: '#fff',
            pointBorderWidth: 2, pointRadius: 4,
          },
          {
            label: 'Referrals',
            data: stats.referral_trend.map(t => t.value),
            borderColor: '#b8730a', backgroundColor: 'rgba(184, 115, 10, .1)',
            fill: true, tension: .4, borderWidth: 2,
            pointBackgroundColor: '#b8730a', pointBorderColor: '#fff',
            pointBorderWidth: 2, pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 15 } } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, color: '#9aa0a6' }, grid: { color: 'rgba(0,0,0,.05)' } },
          x: { ticks: { color: '#9aa0a6' }, grid: { display: false } },
        },
      },
    });
  }
  const concernEl = document.getElementById('concernChart') as HTMLCanvasElement | null;
  if (concernEl && (window as any).Chart) {
    const colors = ['#1a3a6b', '#b8730a', '#1c7c54', '#2c7da0', '#b91c1c', '#6f42c1', '#9aa0a6'];
    new (window as any).Chart(concernEl.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: stats.concern_chart.map(c => c.label),
        datasets: [{
          data: stats.concern_chart.map(c => c.value),
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg'),
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } } },
        cutout: '65%',
      },
    });
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
