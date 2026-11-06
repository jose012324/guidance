/**
 * Database management page — audit logs viewer + backup management.
 * Matches settings/database.html with full backup modal functionality.
 */
import { div, span, button, icon, el, p } from '../lib/dom';
import { databaseApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { buildPagination, buildFilterBar, preserveFilterDrafts } from '../components/Table';
import { enableLiveRefresh } from '../lib/router';
import { showModal } from '../components/Modal';
import { toastSuccess, toastError } from '../lib/toast';

export async function DatabasePage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/database', 'Database Management', 'View audit logs and create database backups.', [body], [
    { label: 'Restore Database', icon: 'database-restore', variant: 'danger', onClick: () => showRestoreModal(load) },
    { label: 'Create Backup', icon: 'database-check', variant: 'primary', onClick: () => showBackupModal(load) },
  ]);

  let page = 1, filters: any = {};
  let loadVersion = 0;

  async function load(silent = false) {
    const version = ++loadVersion;
    if (!silent) { body.innerHTML = ''; body.appendChild(loadingEl()); }
    try {
      const res = await databaseApi.auditLogs({ ...filters, page, per_page: 25 });
      if (version !== loadVersion) return;
      if (res.success && res.data) {
        const { items, pagination, entities, actions, summary } = res.data;
        const restoreDrafts = silent ? preserveFilterDrafts(body) : null;
        body.innerHTML = '';

        // KPIs
        body.appendChild(div('row g-3 mb-4', [
          div('col-sm-6 col-xl-3', [div('stat-card', [div('stat-icon bg-accent', [icon('list-ul')]), div('stat-info', [div('stat-value', [String(summary.total_logs)]), div('stat-label', ['Total Log Entries'])])])]),
          div('col-sm-6 col-xl-3', [div('stat-card', [div('stat-icon bg-info-soft', [icon('box-arrow-in-right')]), div('stat-info', [div('stat-value', [String(summary.total_logins)]), div('stat-label', ['Total Login Events'])])])]),
          div('col-sm-6 col-xl-3', [div('stat-card', [div('stat-icon bg-success-soft', [icon('calendar-check')]), div('stat-info', [div('stat-value', [String(summary.logins_today)]), div('stat-label', ['Logins Today'])])])]),
          div('col-sm-6 col-xl-3', [div('stat-card', [div('stat-icon bg-danger-soft', [icon('shield-exclamation')]), div('stat-info', [div('stat-value', [String(summary.failed_logins)]), div('stat-label', ['Failed Login Attempts'])])])]),
        ]));

        // Filter bar
        body.appendChild(buildFilterBar([
          { name: 'entity', label: 'Entity', type: 'select', options: [{ value: '', label: 'All' }, ...entities.map((e: string) => ({ value: e, label: e }))], value: filters.entity },
          { name: 'action', label: 'Action', type: 'select', options: [{ value: '', label: 'All' }, ...actions.map((a: any) => ({ value: a.value, label: a.label }))], value: filters.action },
        ], (v) => { filters = v; page = 1; load(); }, () => { filters = {}; page = 1; load(); }));

        // Audit log table
        body.appendChild(div('table-card', [
          div('table-responsive', [(() => {
            const table = el('table', 'table table-hover') as HTMLTableElement;
            const thead = el('thead', '', [el('tr', '', [
              el('th', '', ['Timestamp']), el('th', '', ['User']), el('th', '', ['Action']),
              el('th', '', ['Entity']), el('th', '', ['Description']), el('th', '', ['IP']),
            ])]);
            table.appendChild(thead);
            const tbody = el('tbody', '', items.map(l => {
              const tr = el('tr', '');
              const cells = [
                new Date(l.timestamp).toLocaleString(),
                l.user?.full_name || 'System',
                `<span class="badge secondary">${l.action_display}</span>`,
                `<strong>${l.entity}</strong>${l.entity_id ? ` <small class="text-muted-soft">#${l.entity_id}</small>` : ''}`,
                l.description || '—',
                l.ip_address || '—',
              ];
              for (const c of cells) { const td = el('td', ''); td.innerHTML = c; tr.appendChild(td); }
              return tr;
            }));
            table.appendChild(tbody);
            return table;
          })()]),
          buildPagination(pagination, (p) => { page = p; load(); }),
        ]));
        restoreDrafts?.();
      }
    } catch (e: any) { if (!silent && version === loadVersion) body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; }
  }
  enableLiveRefresh(shell, () => load(true));
  load();
  return shell;
}

/**
 * Backup modal — matches the Django database.html backup modal pattern.
 * Shows a confirmation checkbox, then triggers the backup and downloads the file.
 */
function showBackupModal(onSuccess: () => void): void {
  const form = el('form', '') as HTMLFormElement;

  const info = div('mb-3', [
    p('', ['This will create a snapshot of the SQLite database file and download it to your computer.']),
  ]);

  const confirmInput = el('input', 'form-check-input') as HTMLInputElement;
  confirmInput.type = 'checkbox';
  confirmInput.id = 'confirmBackup';
  confirmInput.required = true;
  const confirmRow = div('form-check', [
    confirmInput,
    el('label', 'form-check-label', ['I understand this will create a backup file.'], { for: 'confirmBackup' }),
  ]);

  form.appendChild(info);
  form.appendChild(confirmRow);

  const submitBtn = button('btn btn-primary', [icon('download'), span('', ['Backup Now'])], () => {});
  const cancelBtn = button('btn btn-outline-secondary', [span('', ['Cancel'])], () => modal.close());

  const footer = div('modal-footer', [cancelBtn, submitBtn]);

  const modal = showModal({
    title: 'Create Database Backup',
    body: form,
    footer,
    size: 'lg',
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirmInput.checked) {
      toastError('Please confirm the backup action');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Creating backup…</span>';
    try {
      const blob = await databaseApi.backup();
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `db_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.sqlite3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastSuccess('Database backup created');
      modal.close();
      onSuccess();
    } catch (err: any) {
      toastError(err.message || 'Backup failed');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(icon('download'));
      submitBtn.appendChild(span('', ['Backup Now']));
    }
  });

  submitBtn.type = 'submit';
}

/**
 * Restore modal — matches the Django database.html restore modal pattern.
 * Allows the admin to upload a .sqlite3 backup file and restore it.
 * Includes safety warning + confirmation checkbox + file picker.
 */
function showRestoreModal(onSuccess: () => void): void {
  const form = el('form', '') as HTMLFormElement;

  // Warning banner
  const warning = div('alert alert-warning d-flex align-items-start gap-2', [
    icon('exclamation-triangle-fill mt-1'),
    div('', [
      span('fw-bold', ['Warning: ']),
      span('', ['Restoring the database will replace ALL current data with the contents of the uploaded backup file. This action cannot be undone.']),
    ]),
  ], { style: 'background: var(--warning-soft); border: 1px solid var(--warning); color: var(--warning); border-radius: var(--radius-sm); padding: .85rem 1rem; margin-bottom: 1rem;' } as any);

  form.appendChild(warning);

  // Description
  form.appendChild(p('mb-3', ['Select a .sqlite3 backup file to restore from. A safety backup of the current database will be created automatically before the restore is performed.']) as HTMLElement);

  // File input
  const fileInput = el('input', 'form-control') as HTMLInputElement;
  fileInput.type = 'file';
  fileInput.accept = '.sqlite3,.sqlite,.db';
  fileInput.required = true;
  const fileField = div('mb-3', [
    el('label', 'form-label', ['Backup File *']),
    fileInput,
    el('small', 'text-muted-soft', ['Accepted formats: .sqlite3, .sqlite, .db (max 100 MB)']),
  ]);
  form.appendChild(fileField);

  // Confirmation checkbox
  const confirmInput = el('input', 'form-check-input') as HTMLInputElement;
  confirmInput.type = 'checkbox';
  confirmInput.id = 'confirmRestore';
  confirmInput.required = true;
  confirmInput.value = 'true';
  const confirmRow = div('form-check mb-3', [
    confirmInput,
    el('label', 'form-check-label', [
      span('', ['I understand this will ']),
      el('strong', '', ['replace all current data']),
      span('', [' and that a server restart is recommended after restore.']),
    ], { for: 'confirmRestore' }),
  ]);
  form.appendChild(confirmRow);

  // Info banner about safety backup
  const info = div('alert alert-info small mb-0', [
    icon('info-circle me-1'),
    span('', [' ']),
    el('strong', '', ['Safety backup: ']),
    span('', ['A snapshot of the current database will be saved as ']),
    el('code', '', ['pre_restore_<timestamp>.sqlite3']),
    span('', [' before the restore is applied.']),
  ], { style: 'background: var(--info-soft); border: 1px solid var(--info); color: var(--info); border-radius: var(--radius-sm); padding: .75rem 1rem; margin-top: 1rem;' } as any);
  form.appendChild(info);

  const submitBtn = button('btn btn-danger', [icon('database-restore'), span('', ['Restore Database'])], () => {});
  const cancelBtn = button('btn btn-outline-secondary', [span('', ['Cancel'])], () => modal.close());

  const footer = div('modal-footer', [cancelBtn, submitBtn]);

  const modal = showModal({
    title: 'Restore Database',
    body: form,
    footer,
    size: 'lg',
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirmInput.checked) {
      toastError('Please confirm the restore action');
      return;
    }
    if (!fileInput.files || !fileInput.files[0]) {
      toastError('Please select a backup file');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Restoring…</span>';
    try {
      const result = await databaseApi.restore(fileInput.files[0]);
      toastSuccess(result.message || 'Database restored successfully');
      modal.close();
      onSuccess();
    } catch (err: any) {
      toastError(err.message || 'Restore failed');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(icon('database-restore'));
      submitBtn.appendChild(span('', ['Restore Database']));
    }
  });

  submitBtn.type = 'submit';
}
