/**
 * Counseling create/edit form page.
 */
import { div, span, button, icon, el } from '../lib/dom';
import { counselingApi, authApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';
import { createStudentSearch, StudentResult } from '../lib/studentSearch';

export async function CounselingFormPage(pk?: string): Promise<HTMLElement> {
  const isCreate = !pk;
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/counseling', isCreate ? 'New Counseling Session' : 'Edit Counseling Session',
    'Document the session details, notes, and recommendations.', [body], []);

  // Load counselors + session (if editing). Student is no longer preloaded
  // in bulk — the search widget fetches its own debounced matches.
  const [counselorsRes, sessionRes] = await Promise.all([
    authApi.roles(),
    isCreate ? Promise.resolve(null) : counselingApi.detail(Number(pk)),
  ]);

  // Counselors list
  let counselors: any[] = [];
  try {
    const { usersApi } = await import('../lib/api');
    const counselorRole = counselorsRes.data?.find((r: any) => r.name === 'Counselor');
    if (counselorRole) {
      const res = await usersApi.list({ role: counselorRole.id, per_page: 100 });
      counselors = res.data?.items || [];
    }
  } catch {}

  const session: any = sessionRes?.data?.session || {};
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

  // Student search-select (replaces the old <select>). The hidden field
  // still uses name="student" so the API contract is unchanged. The
  // widget renders its own label.
  const studentSearch = createStudentSearch({ label: 'Student', required: true, initial: initialStudent });
  form.appendChild(studentSearch.container);

  // Counselor select
  const counselorSelect = el('select', 'form-select') as HTMLSelectElement;
  counselorSelect.name = 'counselor'; counselorSelect.required = true;
  counselorSelect.appendChild(new Option('— Select Counselor —', ''));
  for (const c of counselors) {
    const opt = new Option(c.full_name, String(c.id));
    if (session.counselor && session.counselor.id === c.id) opt.selected = true;
    counselorSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Counselor *']), counselorSelect]));

  // Session date
  const dateInput = el('input', 'form-control') as HTMLInputElement;
  dateInput.type = 'date'; dateInput.name = 'session_date'; dateInput.required = true;
  dateInput.value = session.session_date ? session.session_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Session Date *']), dateInput]));

  // Concern type
  const concernSelect = el('select', 'form-select') as HTMLSelectElement;
  concernSelect.name = 'concern_type';
  for (const [v, l] of [['academic', 'Academic'], ['behavioral', 'Behavioral'], ['personal', 'Personal'], ['social', 'Social'], ['career', 'Career'], ['mental_health', 'Mental Health'], ['crisis', 'Crisis'], ['follow_up', 'Follow-up'], ['other', 'Other']]) {
    const opt = new Option(l as string, v as string);
    if (session.concern_type === v) opt.selected = true;
    concernSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Concern Type']), concernSelect]));

  // Status
  const statusSelect = el('select', 'form-select') as HTMLSelectElement;
  statusSelect.name = 'status';
  for (const [v, l] of [['open', 'Open'], ['ongoing', 'Ongoing'], ['closed', 'Closed']]) {
    const opt = new Option(l as string, v as string);
    if (session.status === v) opt.selected = true;
    statusSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Status']), statusSelect]));

  // Follow-up date
  const followInput = el('input', 'form-control') as HTMLInputElement;
  followInput.type = 'date'; followInput.name = 'follow_up_date';
  followInput.value = session.follow_up_date ? session.follow_up_date.slice(0, 10) : '';
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Follow-up Date']), followInput]));

  // Summary
  const summaryInput = el('textarea', 'form-control') as HTMLTextAreaElement;
  summaryInput.name = 'summary'; summaryInput.rows = 2; summaryInput.value = session.summary || '';
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Summary']), summaryInput]));

  // Notes
  const notesInput = el('textarea', 'form-control') as HTMLTextAreaElement;
  notesInput.name = 'notes'; notesInput.rows = 4; notesInput.value = session.notes || '';
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Detailed Notes']), notesInput]));

  // Recommendations
  const recInput = el('textarea', 'form-control') as HTMLTextAreaElement;
  recInput.name = 'recommendations'; recInput.rows = 3; recInput.value = session.recommendations || '';
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Recommendations']), recInput]));

  const submitBtn = button('btn btn-primary', [icon('save'), span('', [isCreate ? 'Create Session' : 'Save Changes'])]);
  form.appendChild(div('d-flex justify-content-end gap-2 mt-3', [
    button('btn btn-outline-secondary', [icon('arrow-left'), span('', ['Cancel'])], () => navigate('/counseling')),
    submitBtn,
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // The student widget writes the selected pk into its hidden input.
    if (!studentSearch.getValue()) {
      toastError('Please select a student.');
      return;
    }
    const data: any = {
      student: studentSearch.getValue(), counselor: counselorSelect.value,
      session_date: dateInput.value, concern_type: concernSelect.value,
      status: statusSelect.value, summary: summaryInput.value, notes: notesInput.value,
      recommendations: recInput.value,
    };
    if (followInput.value) data.follow_up_date = followInput.value;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Saving…</span>';
    try {
      const res = isCreate ? await counselingApi.create(data) : await counselingApi.update(Number(pk), data);
      if (res.success) {
        toastSuccess(isCreate ? 'Session created' : 'Session updated');
        navigate(`/counseling/${res.data!.session.id}`);
      }
    } catch (err: any) {
      toastError(err.message || 'Save failed');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(icon('save'));
      submitBtn.appendChild(span('', [isCreate ? 'Create Session' : 'Save Changes']));
    }
  });

  body.appendChild(div('card', [div('card-body', [form])]));
  return shell;
}
