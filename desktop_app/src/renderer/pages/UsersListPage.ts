/**
 * Users list page — matches users/user_list.html with full action dropdown.
 */
import { div, span, button, icon } from '../lib/dom';
import { usersApi, authApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { buildTable, buildPagination, buildFilterBar, preserveFilterDrafts } from '../components/Table';
import { navigate, enableLiveRefresh } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';
import type { User, Role } from '../../shared/types';

export async function UsersListPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/users', 'User Management', 'Manage system users, roles, and approval workflows.', [body], [
    { label: 'Add User', icon: 'person-plus', variant: 'primary', onClick: () => navigate('/users/create') },
  ]);

  // Fetch roles for filter dropdown
  let roles: Role[] = [];
  try {
    const r = await authApi.roles();
    if (r.success && r.data) roles = r.data;
  } catch {}

  let currentPage = 1;
  let currentFilters: any = {};
  let loadVersion = 0;

  async function load(silent = false) {
    const version = ++loadVersion;
    if (!silent) { body.innerHTML = ''; body.appendChild(loadingEl()); }
    try {
      const res = await usersApi.list({ ...currentFilters, page: currentPage, per_page: 15 });
      if (version !== loadVersion) return;
      if (res.success && res.data) {
        const { items, pagination } = res.data;
        const restoreDrafts = silent ? preserveFilterDrafts(body) : null;
        body.innerHTML = '';

        body.appendChild(buildFilterBar([
          { name: 'search', label: 'Search', value: currentFilters.search },
          { name: 'role', label: 'Role', type: 'select', options: [
            { value: '', label: 'All Roles' },
            ...roles.map(r => ({ value: String(r.id), label: r.name })),
          ], value: currentFilters.role },
          { name: 'status', label: 'Status', type: 'select', options: [
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'pending', label: 'Pending' },
            { value: 'locked', label: 'Locked' },
          ], value: currentFilters.status },
        ], (values) => {
          currentFilters = values;
          currentPage = 1;
          load();
        }, () => { currentFilters = {}; currentPage = 1; load(); }));

        body.appendChild(buildTable<User>(
          [
            { key: 'employee_id', label: 'Employee ID', render: u => `<span class="fw-medium">${u.employee_id || '—'}</span>` },
            { key: 'name', label: 'Name', render: u => `<div class="d-flex align-items-center gap-2"><div class="user-avatar" style="width:32px;height:32px;font-size:.8rem;">${u.first_name?.[0]?.toUpperCase() || 'U'}</div><div><div class="fw-medium">${u.full_name}</div>${u.is_superuser ? '<small class="text-warning">Superuser</small>' : ''}</div></div>` },
            { key: 'username', label: 'Username', render: u => u.username },
            { key: 'email', label: 'Email', render: u => u.email },
            { key: 'role', label: 'Role', render: u => u.role ? `<span class="badge secondary">${u.role.name}</span>` : '—' },
            { key: 'status', label: 'Status', render: u => `<span class="badge ${u.status}">${u.status_display}</span>` },
            { key: 'date_joined', label: 'Joined', render: u => u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—' },
            { key: 'actions', label: '', render: u => renderActionsCell(u) },
          ],
          items,
          'No users found.',
        ));
        body.appendChild(buildPagination(pagination, (p) => { currentPage = p; load(); }));
        restoreDrafts?.();
      }
    } catch (err: any) {
      if (!silent && version === loadVersion) body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed to load</h4><p>${err.message}</p></div>`;
    }
  }
  enableLiveRefresh(shell, () => load(true));
  load();
  return shell;

  function renderActionsCell(u: User): HTMLElement {
    const wrap = div('d-flex gap-1 align-items-center');

    // View button
    wrap.appendChild(button('btn btn-sm btn-soft', [icon('eye')], () => navigate(`/users/${u.id}`)));

    // Edit button
    wrap.appendChild(button('btn btn-sm btn-outline-secondary', [icon('pencil')], () => navigate(`/users/${u.id}/edit`)));

    // Approve (only for pending)
    if (u.status === 'pending') {
      const approveBtn = button('btn btn-sm btn-outline-success', [icon('check-circle')], async () => {
        try { await usersApi.approve(u.id); toastSuccess(`User "${u.username}" approved`); load(); }
        catch (e: any) { toastError(e.message); }
      });
      approveBtn.title = 'Approve';
      wrap.appendChild(approveBtn);
    }

    // Activate / Deactivate (only for active/inactive)
    if (u.status === 'inactive' || u.status === 'pending') {
      const actBtn = button('btn btn-sm btn-outline-success', [icon('unlock')], async () => {
        try { await usersApi.activate(u.id); toastSuccess(`User "${u.username}" activated`); load(); }
        catch (e: any) { toastError(e.message); }
      });
      actBtn.title = 'Activate';
      wrap.appendChild(actBtn);
    } else if (u.status === 'active') {
      const deactBtn = button('btn btn-sm btn-outline-warning', [icon('lock')], async () => {
        try { await usersApi.deactivate(u.id); toastSuccess(`User "${u.username}" deactivated`); load(); }
        catch (e: any) { toastError(e.message); }
      });
      deactBtn.title = 'Deactivate';
      wrap.appendChild(deactBtn);
    }

    // Delete
    wrap.appendChild(button('btn btn-sm btn-outline-danger', [icon('trash')], () => navigate(`/users/${u.id}/delete`)));

    return wrap;
  }
}
