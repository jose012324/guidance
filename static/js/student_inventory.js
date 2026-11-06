(function () {
    const source = document.getElementById('student-inventory-data');
    if (!source || typeof Chart === 'undefined') return;
    const data = JSON.parse(source.textContent);
    let charts = [];
    const renderCharts = () => {
      const hidden = {};
      charts.forEach(chart => {
        if (chart.config.type === 'doughnut') {
          hidden[chart.canvas.id] = chart.data.labels.filter((label, index) => !chart.getDataVisibility(index));
        }
      });
      charts.forEach(chart => chart.destroy());
      charts = [];
      const root = getComputedStyle(document.documentElement);
      const tone = name => root.getPropertyValue(name).trim();
      const colors = ['--color-accent', '--color-success', '--color-info', '--color-warning', '--color-danger'].map(tone);
      const text = tone('--color-text-muted');
      const border = tone('--color-border');
      const foreground = tone('--color-text');
      const surface = tone('--color-bg');
      const common = { responsive: true, maintainAspectRatio: false, animation: false };
      const make = (id, rows, type, horizontal) => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const total = rows.reduce((sum, row) => sum + row.value, 0);
        const isDonut = type === 'doughnut';
        const centerText = {
          id: 'inventoryCenterText',
          afterDraw(chart) {
            const area = chart.chartArea;
            if (!area) return;
            const visible = rows.reduce((sum, row, index) => sum + (chart.getDataVisibility(index) ? row.value : 0), 0);
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
          }
        };
        const chart = new Chart(canvas, {
            type,
            data: {
                labels: rows.map(row => row.label),
                datasets: [{ data: rows.map(row => row.value), backgroundColor: rows.map((_, i) => colors[i % colors.length]), borderColor: surface, borderWidth: isDonut ? 2 : 0, borderRadius: type === 'bar' ? 5 : 0, barThickness: horizontal ? 14 : undefined }]
            },
            options: {
                ...common,
                indexAxis: horizontal ? 'y' : 'x',
                cutout: isDonut ? '62%' : undefined,
                plugins: {
                    legend: {
                        display: isDonut,
                        position: 'right',
                        labels: {
                            color: text,
                            boxWidth: 10,
                            font: { size: 10 },
                            generateLabels: chart => chart.data.labels.map((label, index) => ({
                                text: `${label}  ${rows[index].value.toLocaleString()} (${total ? Math.round(rows[index].value / total * 100) : 0}%)`,
                                fillStyle: colors[index % colors.length],
                                strokeStyle: colors[index % colors.length],
                                hidden: !chart.getDataVisibility(index),
                                index
                            }))
                        },
                        onClick: (_event, item, legend) => {
                            legend.chart.toggleDataVisibility(item.index);
                            legend.chart.update();
                        }
                    },
                    tooltip: { callbacks: { label: context => {
                        const value = Number(context.raw) || 0;
                        return `${context.label}: ${value.toLocaleString()}${isDonut && total ? ` (${Math.round(value / total * 100)}%)` : ''}`;
                    } } }
                },
                scales: type === 'bar' ? {
                    x: { beginAtZero: horizontal, ticks: { color: text, precision: horizontal ? 0 : undefined }, grid: { color: horizontal ? border : 'transparent' } },
                    y: { beginAtZero: !horizontal, ticks: { color: text, precision: horizontal ? undefined : 0 }, grid: { color: horizontal ? 'transparent' : border } }
                } : {}
            },
            plugins: isDonut ? [centerText] : []
        });
        (hidden[id] || []).forEach(label => {
          const index = rows.findIndex(row => row.label === label);
          if (index >= 0) chart.toggleDataVisibility(index);
        });
        if (hidden[id]?.length) chart.update('none');
        charts.push(chart);
      };
      make('riYearChart', data.year_levels, 'bar', false);
      make('riProgramChart', data.programs, 'doughnut', false);
      make('riGenderChart', data.genders, 'doughnut', false);
      make('riConcernChart', data.concerns, 'bar', true);
      make('riStatusChart', data.referral_statuses, 'doughnut', false);
    };
    renderCharts();
    new MutationObserver(renderCharts).observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
})();
