/** Referral create/edit form page. */
import { div, span, button, icon, el } from '../lib/dom';
import { referralsApi, usersApi, authApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';
import { REFERRAL_TYPES } from '../lib/referralTypes';
import { createStudentSearch, StudentResult } from '../lib/studentSearch';

export async function ReferralFormPage(pk?: string): Promise<HTMLElement> {
  const isCreate = !pk;
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/referrals', isCreate ? 'Create Referral' : 'Edit Referral',
    'Document the referral reason, type, and assigned counselor.', [body], []);

  // Counselors
  let counselors: any[] = [];
  try {
    const rolesRes = await authApi.roles();
    const counselorRole = rolesRes.data?.find((r: any) => r.name === 'Counselor');
    if (counselorRole) {
      const res = await usersApi.list({ role: counselorRole.id, per_page: 100 });
      counselors = res.data?.items || [];
    }
  } catch {}

  let session: any = {};
  if (!isCreate) {
    try { const r = await referralsApi.detail(Number(pk)); session = r.data?.referral || {}; }
    catch (e: any) { body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${e.message}</p></div>`; return shell; }
  }

  const initialStudent: StudentResult | null = session.student
    ? {
        id: session.student.id,
        student_number: session.student.student_number,
        first_name: session.student.first_name,
        middle_name: session.student.middle_name || '',
        last_name: session.student.last_name,
        full_name: session.student.full_name,
        grade_level: session.student.grade_level || '',
        section: session.student.section || '',
        status: session.student.status || '',
      }
    : null;

  body.innerHTML = '';
  const form = el('form', '') as HTMLFormElement;

  // Student search-select (replaces the old <select>). The widget
  // renders its own label and writes the chosen pk into its hidden
  // input — the API contract is unchanged.
  const studentSearch = createStudentSearch({ label: 'Student', required: true, initial: initialStudent });
  form.appendChild(studentSearch.container);

  // Counselor
  const counselorSelect = el('select', 'form-select') as HTMLSelectElement;
  counselorSelect.appendChild(new Option('— Unassigned —', ''));
  for (const c of counselors) {
    const opt = new Option(c.full_name, String(c.id));
    if (session.assigned_counselor?.id === c.id) opt.selected = true;
    counselorSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Assigned Counselor']), counselorSelect]));

  // Type
  const typeSelect = el('select', 'form-select') as HTMLSelectElement;
  for (const [v, l] of REFERRAL_TYPES) {
    const opt = new Option(l as string, v as string);
    if (session.referral_type === v) opt.selected = true;
    typeSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Referral Type']), typeSelect]));
  form.appendChild(el('p', 'text-muted-soft small', ['Choose the destination or service for this referral.']));

  // Priority
  const prioritySelect = el('select', 'form-select') as HTMLSelectElement;
  for (const [v, l] of [['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']]) {
    const opt = new Option(l as string, v as string);
    if (session.priority === v) opt.selected = true;
    prioritySelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Priority']), prioritySelect]));

  // Status
  const statusSelect = el('select', 'form-select') as HTMLSelectElement;
  for (const [v, l] of [['pending', 'Pending'], ['ongoing', 'Ongoing'], ['completed', 'Completed']]) {
    const opt = new Option(l as string, v as string);
    if (session.status === v) opt.selected = true;
    statusSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Status']), statusSelect]));

  // Reason
  const reasonInput = el('textarea', 'form-control') as HTMLTextAreaElement;
  reasonInput.rows = 3; reasonInput.required = true; reasonInput.value = session.reason || '';
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Reason *']), reasonInput]));

  // Description
  const descInput = el('textarea', 'form-control') as HTMLTextAreaElement;
  descInput.rows = 4; descInput.value = session.description || '';
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Description / Context']), descInput]));

  const submitBtn = button('btn btn-primary', [icon('save'), span('', [isCreate ? 'Create Referral' : 'Save Changes'])]);
  form.appendChild(div('d-flex justify-content-end gap-2 mt-3', [
    button('btn btn-outline-secondary', [icon('arrow-left'), span('', ['Cancel'])], () => navigate('/referrals')),
    submitBtn,
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!studentSearch.getValue()) {
      toastError('Please select a student.');
      return;
    }
    const data: any = {
      student: studentSearch.getValue(),
      assigned_counselor: counselorSelect.value || undefined,
      referral_type: typeSelect.value, priority: prioritySelect.value,
      status: statusSelect.value, reason: reasonInput.value, description: descInput.value,
    };
    submitBtn.disabled = true;
    try {
      const res = isCreate ? await referralsApi.create(data) : await referralsApi.update(Number(pk), data);
      if (res.success) { toastSuccess(isCreate ? 'Referral created' : 'Referral updated'); navigate(`/referrals/${res.data!.referral.id}`); }
    } catch (err: any) { toastError(err.message); submitBtn.disabled = false; }
  });

  body.appendChild(div('card', [div('card-body', [form])]));
  return shell;
}
