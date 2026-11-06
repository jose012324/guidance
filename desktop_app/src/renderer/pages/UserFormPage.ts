/**
 * User create/edit form page.
 */
import { div, span, button, icon, el } from '../lib/dom';
import { usersApi, authApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';
import type { Role } from '../../shared/types';

export async function UserFormPage(pk?: string): Promise<HTMLElement> {
  const isCreate = !pk;
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/users', isCreate ? 'Add New User' : 'Edit User',
    isCreate ? 'Create a new system user with a defined role and initial password.' : 'Update user information.', [body], []);

  let roles: Role[] = [];
  try {
    const r = await authApi.roles();
    if (r.success && r.data) roles = r.data;
  } catch {}

  let initial: any = {};
  if (!isCreate) {
    try {
      const res = await usersApi.detail(Number(pk));
      if (res.success && res.data) initial = res.data.user;
    } catch (err: any) {
      body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed to load</h4><p>${err.message}</p></div>`;
      return shell;
    }
  }

  body.innerHTML = '';
  const form = el('form', '') as HTMLFormElement;

  function field(label: string, name: string, value = '', type = 'text', required = false): HTMLInputElement {
    const input = el('input', 'form-control') as HTMLInputElement;
    input.type = type; input.name = name; input.value = value; input.required = required;
    form.appendChild(div('mb-3', [
      el('label', 'form-label', [label + (required ? ' *' : '')]),
      input,
    ]));
    return input;
  }

  const fnInput = field('First Name', 'first_name', initial.first_name || '', 'text', true);
  const mnInput = field('Middle Name', 'middle_name', initial.middle_name || '');
  const lnInput = field('Last Name', 'last_name', initial.last_name || '', 'text', true);
  const unInput = field('Username', 'username', initial.username || '', 'text', true);
  const emInput = field('Email', 'email', initial.email || '', 'email', true);
  const pwInput = field(isCreate ? 'Initial Password' : 'New Password (leave blank to keep current)', 'password', '', 'password', isCreate);
  const eidInput = field('Employee ID', 'employee_id', initial.employee_id || '');
  const cnInput = field('Contact Number', 'contact_number', initial.contact_number || '');

  // Role select
  const roleSelect = el('select', 'form-select') as HTMLSelectElement;
  roleSelect.name = 'role';
  roleSelect.appendChild(new Option('— Select Role —', ''));
  for (const r of roles) {
    const opt = new Option(r.name, String(r.id));
    if (initial.role && initial.role.id === r.id) opt.selected = true;
    roleSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Role *']), roleSelect]));

  // Status select
  const statusSelect = el('select', 'form-select') as HTMLSelectElement;
  statusSelect.name = 'status';
  for (const [v, l] of [['active', 'Active'], ['inactive', 'Inactive'], ['pending', 'Pending'], ['locked', 'Locked']]) {
    const opt = new Option(l as string, v as string);
    if (initial.status === v) opt.selected = true;
    statusSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Status']), statusSelect]));

  const submitBtn = button('btn btn-primary', [icon('save'), span('', [isCreate ? 'Create User' : 'Save Changes'])]);
  form.appendChild(div('d-flex justify-content-end gap-2 mt-3', [
    button('btn btn-outline-secondary', [icon('arrow-left'), span('', ['Cancel'])], () => navigate('/users')),
    submitBtn,
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data: any = {
      first_name: fnInput.value, middle_name: mnInput.value, last_name: lnInput.value,
      username: unInput.value, email: emInput.value, employee_id: eidInput.value,
      contact_number: cnInput.value, role: roleSelect.value ? Number(roleSelect.value) : undefined,
      status: statusSelect.value,
    };
    if (pwInput.value) data.password = pwInput.value;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Saving…</span>';
    try {
      if (isCreate) {
        await usersApi.create(data);
        toastSuccess('User created');
      } else {
        await usersApi.update(Number(pk), data);
        toastSuccess('User updated');
      }
      navigate('/users');
    } catch (err: any) {
      toastError(err.message || 'Save failed');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(icon('save'));
      submitBtn.appendChild(span('', [isCreate ? 'Create User' : 'Save Changes']));
    }
  });

  body.appendChild(div('card', [div('card-body', [form])]));
  return shell;
}
