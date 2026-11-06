/**
 * Students list page.
 */
import { div, span, button, icon } from '../lib/dom';
import { studentsApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { buildTable, buildPagination, buildFilterBar, preserveFilterDrafts } from '../components/Table';
import { navigate, enableLiveRefresh } from '../lib/router';
import type { Student } from '../../shared/types';

export async function StudentsListPage(): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/students', 'Student Directory', 'Browse, search, and manage student records.', [body], [
    { label: 'Register Student', icon: 'person-plus', variant: 'primary', onClick: () => navigate('/students/create') },
  ]);

  let currentPage = 1;
  let currentFilters: any = {};
  let loadVersion = 0;

  async function load(silent = false) {
    const version = ++loadVersion;
    if (!silent) { body.innerHTML = ''; body.appendChild(loadingEl()); }
    try {
      const res = await studentsApi.list({ ...currentFilters, page: currentPage, per_page: 15 });
      if (version !== loadVersion) return;
      if (res.success && res.data) {
        const { items, pagination } = res.data;
        const restoreDrafts = silent ? preserveFilterDrafts(body) : null;
        body.innerHTML = '';
        body.appendChild(buildFilterBar([
          { name: 'search', label: 'Search', value: currentFilters.search },
          { name: 'grade_level', label: 'Year', type: 'select', options: [
            { value: '', label: 'All' },
            ...['1st Year', '2nd Year', '3rd Year', '4th Year'].map(g => ({ value: g, label: g })),
          ], value: currentFilters.grade_level },
          { name: 'gender', label: 'Gender', type: 'select', options: [
            { value: '', label: 'All' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' },
          ], value: currentFilters.gender },
          { name: 'status', label: 'Status', type: 'select', options: [
            { value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'graduated', label: 'Graduated' }, { value: 'transferred', label: 'Transferred' }, { value: 'inc', label: 'INC' },
          ], value: currentFilters.status },
          { name: 'school_year', label: 'School Year', value: currentFilters.school_year },
        ], (values) => { currentFilters = values; currentPage = 1; load(); }, () => { currentFilters = {}; currentPage = 1; load(); }));

        body.appendChild(buildTable<Student>(
          [
            { key: 'student_number', label: 'Student #', render: s => `<span class="fw-medium">${s.student_number}</span>` },
            { key: 'name', label: 'Name', render: s => `<a href="#/students/${s.id}">${s.last_name}, ${s.first_name}</a>` },
            { key: 'gender', label: 'Gender', render: s => s.gender_display },
            { key: 'grade', label: 'Year', render: s => s.grade_level || '—' },
            { key: 'section', label: 'Course & Section', render: s => s.section || '—' },
            { key: 'school_year', label: 'SY', render: s => s.school_year || '—' },
            { key: 'status', label: 'Status', render: s => `<span class="badge ${s.status}">${s.status_display}</span>` },
            { key: 'actions', label: '', render: s => {
              const wrap = div('d-flex gap-1');
              wrap.appendChild(button('btn btn-sm btn-soft', [icon('eye')], () => navigate(`/students/${s.id}`)));
              wrap.appendChild(button('btn btn-sm btn-outline-secondary', [icon('pencil')], () => navigate(`/students/${s.id}/edit`)));
              wrap.appendChild(button('btn btn-sm btn-outline-danger', [icon('trash')], () => navigate(`/students/${s.id}/delete`)));
              return wrap;
            } },
          ],
          items, 'No students found.',
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
}
