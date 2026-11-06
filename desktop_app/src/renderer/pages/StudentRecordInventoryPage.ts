/** Student record inventory, using the same statistics as the Django page. */
import { div, span, icon, el } from '../lib/dom';
import { studentsApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { enableLiveRefresh } from '../lib/router';
import type { StudentRecordInventory } from '../../shared/types';

type Breakdown = Array<{ label: string; value: number }>;
const tones = ['accent', 'success', 'info', 'warning', 'danger'];

function metric(label: string, value: number, glyph: string, tone: string, hint = ''): HTMLElement {
  return div(`ri-stat ri-${tone}`, [
    span('ri-stat-icon', [icon(glyph)]),
    div('', [div('ri-stat-label', [label]), el('strong', '', [value.toLocaleString()]), hint ? el('small', '', [hint]) : null]),
  ]);
}

function panel(title: string, glyph: string, content: HTMLElement): HTMLElement {
  return el('section', 'ri-panel', [el('h2', '', [icon(glyph), title]), content]);
}

function bars(rows: Breakdown, horizontal = false): HTMLElement {
  const max = Math.max(1, ...rows.map(row => row.value));
  return div(`ri-bars ${horizontal ? 'ri-bars-horizontal' : ''}`, rows.map((row, i) => {
    const bar = div(`ri-bar ri-${tones[i % tones.length]}`, [], { style: `--ri-height:${Math.max(3, row.value / max * 100)}%` });
    return div('ri-bar-item', [el('strong', '', [row.value.toLocaleString()]), bar, span('', [row.label])]);
  }));
}

function donut(rows: Breakdown): HTMLElement {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let position = 0;
  const stops = rows.map((row, i) => {
    const end = position + (total ? row.value / total * 100 : 0);
    const stop = `var(--ri-${tones[i % tones.length]}) ${position}% ${end}%`;
    position = end;
    return stop;
  });
  const ring = div('ri-donut', [div('ri-donut-middle', [el('strong', '', [total.toLocaleString()]), span('', ['Total'])])]);
  ring.style.background = total ? `conic-gradient(${stops.join(',')})` : 'var(--surface-2)';
  const legend = div('ri-legend', rows.map((row, i) => div('', [
    span(`ri-legend-dot ri-${tones[i % tones.length]}`),
    span('', [row.label]),
    el('strong', '', [row.value.toLocaleString()]),
  ])));
  return div('ri-donut-layout', [ring, legend]);
}

function chartContent(id: string, fallback: HTMLElement, tall = false): HTMLElement {
  if (!(window as any).Chart) return fallback;
  return div(`ri-chart ${tall ? 'ri-chart-tall' : ''}`, [el('canvas', '', [], { id, role: 'img' })]);
}

type ChartSpec = { id: string; rows: Breakdown; type: 'bar' | 'doughnut'; horizontal?: boolean };

export function drawCharts(data: StudentRecordInventory, body: HTMLElement, previousHidden: Record<string, string[]>): Record<string, any> {
  const ChartCtor = (window as any).Chart;
  if (!ChartCtor) return {};
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  const colors = [
    token('--accent', '#1a3a6b'), token('--success', '#1c7c54'),
    token('--info', '#2c7da0'), token('--warning', '#b8730a'), token('--danger', '#b91c1c'),
  ];
  const text = token('--text-muted', '#5c6470');
  const foreground = token('--text', '#0a0d12');
  const border = token('--border', '#e2e5e9');
  const surface = token('--bg', '#fff');
  const specs: ChartSpec[] = [
    { id: 'riYearChart', rows: data.year_levels, type: 'bar' },
    { id: 'riProgramChart', rows: data.programs, type: 'doughnut' },
    { id: 'riGenderChart', rows: data.genders, type: 'doughnut' },
    { id: 'riConcernChart', rows: data.concerns, type: 'bar', horizontal: true },
    { id: 'riStatusChart', rows: data.referral_statuses, type: 'doughnut' },
  ];
  const instances: Record<string, any> = {};
  for (const spec of specs) {
    const canvas = body.querySelector<HTMLCanvasElement>(`#${spec.id}`);
    if (!canvas) continue;
    const values = spec.rows.map(row => row.value);
    const total = values.reduce((sum, value) => sum + value, 0);
    const isDonut = spec.type === 'doughnut';
    const centerText = {
      id: 'inventoryCenterText',
      afterDraw(chart: any) {
        const area = chart.chartArea;
        if (!area) return;
        const visible = values.reduce((sum, value, index) => sum + (chart.getDataVisibility(index) ? value : 0), 0);
        const x = (area.left + area.right) / 2;
        const y = (area.top + area.bottom) / 2;
        chart.ctx.save();
        chart.ctx.fillStyle = foreground;
        chart.ctx.font = '600 20px Inter, sans-serif';
        chart.ctx.textAlign = 'center';
        chart.ctx.fillText(visible.toLocaleString(), x, y);
        chart.ctx.fillStyle = text;
        chart.ctx.font = '11px Inter, sans-serif';
        chart.ctx.fillText('Total', x, y + 17);
        chart.ctx.restore();
      },
    };
    const chart = new ChartCtor(canvas, {
      type: spec.type,
      data: {
        labels: spec.rows.map(row => row.label),
        datasets: [{
          data: values,
          backgroundColor: values.map((_, index) => colors[index % colors.length]),
          borderColor: surface,
          borderWidth: isDonut ? 2 : 0,
          borderRadius: isDonut ? 0 : 5,
          barThickness: spec.horizontal ? 14 : undefined,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        indexAxis: spec.horizontal ? 'y' : 'x',
        cutout: isDonut ? '62%' : undefined,
        plugins: {
          legend: {
            display: isDonut,
            position: 'right',
            labels: {
              color: text,
              boxWidth: 10,
              font: { size: 10 },
              generateLabels: (current: any) => current.data.labels.map((label: string, index: number) => ({
                text: `${label}  ${values[index].toLocaleString()} (${total ? Math.round(values[index] / total * 100) : 0}%)`,
                fillStyle: colors[index % colors.length],
                strokeStyle: colors[index % colors.length],
                hidden: !current.getDataVisibility(index),
                index,
              })),
            },
            onClick: (_event: unknown, item: { index: number }, legend: any) => {
              legend.chart.toggleDataVisibility(item.index);
              legend.chart.update();
            },
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const value = Number(context.raw) || 0;
                return `${context.label}: ${value.toLocaleString()}${isDonut && total ? ` (${Math.round(value / total * 100)}%)` : ''}`;
              },
            },
          },
        },
        scales: isDonut ? undefined : {
          x: { beginAtZero: !!spec.horizontal, ticks: { color: text, precision: spec.horizontal ? 0 : undefined }, grid: { color: spec.horizontal ? border : 'transparent' } },
          y: { beginAtZero: !spec.horizontal, ticks: { color: text, precision: spec.horizontal ? undefined : 0 }, grid: { color: spec.horizontal ? 'transparent' : border } },
        },
      },
      plugins: isDonut ? [centerText] : [],
    });
    for (const hidden of previousHidden[spec.id] || []) {
      const index = spec.rows.findIndex(row => row.label === hidden);
      if (index >= 0) chart.toggleDataVisibility(index);
    }
    if (previousHidden[spec.id]?.length) chart.update('none');
    instances[spec.id] = chart;
  }
  return instances;
}

function overview(label: string, value: number, glyph: string): HTMLElement {
  return div('ri-overview', [span('ri-overview-icon', [icon(glyph)]), div('', [label, el('strong', '', [value.toLocaleString()]), el('small', '', ['Unique students'])])]);
}

export function renderInventory(data: StudentRecordInventory): HTMLElement {
  const k = data.kpis;
  return div('record-inventory', [
    div('ri-stat-grid ri-four', [
      metric('Total Registered Students', k.total_students, 'people-fill', 'accent'),
      metric('Active Students', k.active_students, 'person-fill', 'success'),
      metric('Inactive Students', k.inactive_students, 'person-x-fill', 'danger'),
      metric('Newly Registered Students', k.newly_registered_students, 'person-plus-fill', 'info', 'Past 30 days'),
    ]),
    div('ri-stat-grid ri-four', [
      metric('With Guidance Records', k.with_guidance_records, 'file-earmark-text-fill', 'warning'),
      metric('Without Guidance Records', k.without_guidance_records, 'file-earmark-minus-fill', 'info'),
      metric('Active Cases', k.active_cases, 'exclamation-triangle-fill', 'accent'),
      metric('Closed Cases', k.closed_cases, 'check-circle-fill', 'success'),
    ]),
    div('ri-stat-grid ri-five', [
      metric('Pending Referrals', k.pending_referrals, 'clock-fill', 'accent'),
      metric('Referred Students', k.referred_students, 'arrow-left-right', 'info'),
      metric('Completed Referrals', k.completed_referrals, 'check2-circle', 'success'),
      metric('Urgent Cases', k.urgent_cases, 'exclamation-circle-fill', 'warning'),
      metric('Emergency Cases', k.emergency_cases, 'exclamation-diamond-fill', 'danger'),
    ]),
    div('ri-chart-grid', [
      panel('Students by Year Level', 'mortarboard', chartContent('riYearChart', bars(data.year_levels))),
      panel('Students by Course & Section', 'diagram-3', chartContent('riProgramChart', donut(data.programs))),
      panel('Students by Gender', 'people', chartContent('riGenderChart', donut(data.genders))),
      panel('Cases by Concern', 'person-hearts', chartContent('riConcernChart', bars(data.concerns, true), true)),
      panel('Referral Status', 'send-check', chartContent('riStatusChart', donut(data.referral_statuses))),
      panel('Counseling & Referral Overview', 'clipboard-data', div('', [
        overview('Students with Counseling Sessions', k.counseling_students, 'chat-heart-fill'),
        overview('Students with Referrals', k.referred_students, 'arrow-left-right'),
      ])),
    ]),
  ]);
}

export async function StudentRecordInventoryPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/student-record-inventory', 'Student Record Inventory',
    'Overview of student records in the Guidance Office system.', [body], []);
  let latestData: StudentRecordInventory | null = null;
  let lastSignature = '';
  let charts: Record<string, any> = {};
  let loadVersion = 0;
  let chartRenderVersion = 0;
  const hiddenLabels = () => {
    const hidden: Record<string, string[]> = {};
    for (const [id, chart] of Object.entries(charts)) {
      if (chart.config.type !== 'doughnut') continue;
      hidden[id] = (chart.data.labels as string[]).filter((label, index) => !chart.getDataVisibility(index));
    }
    return hidden;
  };
  const clearCharts = () => {
    const hidden = hiddenLabels();
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};
    return hidden;
  };
  const renderData = (data: StudentRecordInventory) => {
    const version = ++chartRenderVersion;
    const hidden = clearCharts();
    body.replaceChildren(renderInventory(data));
    setTimeout(() => {
      if (version === chartRenderVersion && body.isConnected) charts = drawCharts(data, body, hidden);
    }, 0);
  };
  const load = async (silent = false) => {
    const version = ++loadVersion;
    try {
      const result = await studentsApi.recordInventory();
      if (version !== loadVersion) return;
      if (!result.data) {
        if (!silent) body.replaceChildren(div('empty-state', ['No inventory data available.']));
        return;
      }
      const signature = JSON.stringify(result.data);
      latestData = result.data;
      if (signature !== lastSignature || (!!(window as any).Chart && !body.querySelector('.ri-chart'))) {
        lastSignature = signature;
        renderData(result.data);
      }
    } catch (error) {
      if (!silent) body.replaceChildren(div('empty-state', [error instanceof Error ? error.message : 'Unable to load student records.']));
    }
  };
  const themeObserver = new MutationObserver(() => { if (latestData) renderData(latestData); });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  shell.addEventListener('desktop:dispose', () => { themeObserver.disconnect(); chartRenderVersion++; clearCharts(); });
  enableLiveRefresh(shell, () => load(true));
  await load();
  return shell;
}
