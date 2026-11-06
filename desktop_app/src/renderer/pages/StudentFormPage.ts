/**
 * Student create/edit form page.
 */
import { div, span, button, icon, el } from '../lib/dom';
import { studentsApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';

export async function StudentFormPage(pk?: string): Promise<HTMLElement> {
  const isCreate = !pk;
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/students', isCreate ? 'Register Student' : 'Edit Student',
    isCreate ? 'Add a new student to the guidance office records.' : 'Update student information.', [body], []);

  let initial: any = {};
  if (!isCreate) {
    try {
      const res = await studentsApi.detail(Number(pk));
      if (res.success && res.data) initial = res.data.student;
    } catch (err: any) {
      body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed to load</h4><p>${err.message}</p></div>`;
      return shell;
    }
  }

  body.innerHTML = '';
  const form = el('form', '') as HTMLFormElement;

  function field(label: string, name: string, value = '', type = 'text', required = false, placeholder = ''): HTMLInputElement {
    const input = el('input', 'form-control') as HTMLInputElement;
    input.type = type; input.name = name; input.value = value; input.required = required; input.placeholder = placeholder;
    form.appendChild(div('mb-3', [el('label', 'form-label', [label + (required ? ' *' : '')]), input]));
    return input;
  }

  // Personal info
  form.appendChild(div('auth-section-label', ['Personal Information']));
  const snInput = field('Student Number', 'student_number', initial.student_number || '', 'text', true);
  const fnInput = field('First Name', 'first_name', initial.first_name || '', 'text', true);
  const mnInput = field('Middle Name', 'middle_name', initial.middle_name || '');
  const lnInput = field('Last Name', 'last_name', initial.last_name || '', 'text', true);
  const bdInput = field('Birthdate', 'birthdate', initial.birthdate ? initial.birthdate.slice(0, 10) : '', 'date');

  // Gender select
  const genderSelect = el('select', 'form-select') as HTMLSelectElement;
  for (const [v, l] of [['male', 'Male'], ['female', 'Female'], ['other', 'Other']]) {
    const opt = new Option(l as string, v as string);
    if (initial.gender === v) opt.selected = true;
    genderSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Gender']), genderSelect]));

  // Status select
  const statusSelect = el('select', 'form-select') as HTMLSelectElement;
  for (const [v, l] of [['active', 'Active'], ['inactive', 'Inactive'], ['graduated', 'Graduated'], ['transferred', 'Transferred'], ['inc', 'INC']]) {
    const opt = new Option(l as string, v as string);
    if (initial.status === v) opt.selected = true;
    statusSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Status']), statusSelect]));

  // Contact
  form.appendChild(div('auth-section-label', ['Contact Information']));
  const addrInput = el('textarea', 'form-control') as HTMLTextAreaElement;
  addrInput.name = 'address'; addrInput.value = initial.address || ''; addrInput.rows = 2;
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Address']), addrInput]));
  const cnInput = field('Contact Number', 'contact_number', initial.contact_number || '');

  // Academic
  form.appendChild(div('auth-section-label', ['Academic Information']));
  const glSelect = el('select', 'form-select') as HTMLSelectElement;
  glSelect.appendChild(new Option('— Select —', ''));
  for (const g of ['1st Year', '2nd Year', '3rd Year', '4th Year']) {
    const opt = new Option(g, g);
    if (initial.grade_level === g) opt.selected = true;
    glSelect.appendChild(opt);
  }
  form.appendChild(div('mb-3', [el('label', 'form-label', ['Year Level']), glSelect]));
  const secInput = field('Course & Section', 'section', initial.section || '', 'text', false, 'e.g. BSIT-1A');
  const syInput = field('School Year', 'school_year', initial.school_year || '', 'text', false, 'e.g. 2025-2026');

  const submitBtn = button('btn btn-primary', [icon('save'), span('', [isCreate ? 'Register Student' : 'Save Changes'])]);
  form.appendChild(div('d-flex justify-content-end gap-2 mt-3', [
    button('btn btn-outline-secondary', [icon('arrow-left'), span('', ['Cancel'])], () => navigate('/students')),
    submitBtn,
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data: any = {
      student_number: snInput.value, first_name: fnInput.value, middle_name: mnInput.value,
      last_name: lnInput.value, birthdate: bdInput.value || null,
      gender: genderSelect.value, status: statusSelect.value,
      address: addrInput.value, contact_number: cnInput.value,
      grade_level: glSelect.value, section: secInput.value, school_year: syInput.value,
    };
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Saving…</span>';
    try {
      const res = isCreate ? await studentsApi.create(data) : await studentsApi.update(Number(pk), data);
      if (res.success) {
        toastSuccess(isCreate ? 'Student registered' : 'Student updated');
        navigate(`/students/${res.data!.student.id}`);
      }
    } catch (err: any) {
      toastError(err.message || 'Save failed');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(icon('save'));
      submitBtn.appendChild(span('', [isCreate ? 'Register Student' : 'Save Changes']));
    }
  });

  body.appendChild(div('card', [div('card-body', [form])]));
  return shell;
}
