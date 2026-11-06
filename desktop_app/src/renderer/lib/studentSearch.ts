/**
 * Reusable student search-and-select widget for desktop-app forms.
 * Mirrors templates/partials/student_search.html — a debounced typeahead
 * that calls studentsApi.lookup() and shows up to 10 matches in a
 * scrollable dropdown. Replaces the giant <select> the forms used to
 * render, which became unusable past a few hundred students.
 */
import { div, span, el, button } from './dom';
import { studentsApi } from './api';

export interface StudentResult {
  id: number;
  student_number: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  grade_level: string;
  section: string;
  status: string;
}

export interface StudentSearchOptions {
  /** Currently selected student (when editing an existing record). */
  initial?: StudentResult | null;
  /** Placeholder for the search input. */
  placeholder?: string;
  /** When true, the search input gets the `required` attribute. */
  required?: boolean;
  /** id-prefix for the input/result elements (defaults to "student-search"). */
  idPrefix?: string;
}

export interface StudentSearchHandle {
  /** The container element to drop into the form. */
  container: HTMLElement;
  /** The hidden <input name="student"> whose value is the selected pk. */
  hiddenInput: HTMLInputElement;
  /** Read the selected student id, or '' if nothing is picked. */
  getValue(): string;
  /** Reflect an externally-set value (e.g. server-rendered edit page). */
  setValue(pk: string, label?: string): void;
}

/**
 * Build a student search widget. Mount it into a form with
 * `form.appendChild(handle.container)`. The hidden field uses the
 * `student` name to match the existing API contract, so views/URLs/tests
 * don't need to change.
 */
export function createStudentSearch(opts: StudentSearchOptions = {}): StudentSearchHandle {
  const prefix = opts.idPrefix || 'student-search';
  const placeholder = opts.placeholder || 'Type student name or number to search…';

  const hiddenInput = el('input', '', [], { type: 'hidden', name: 'student', id: `${prefix}-hidden`, value: opts.initial?.id ? String(opts.initial.id) : '' }) as HTMLInputElement;

  const searchInput = el('input', 'form-control student-search-input', [], {
    type: 'text',
    id: `${prefix}-search`,
    placeholder,
    autocomplete: 'off',
    'aria-autocomplete': 'list',
    'aria-controls': `${prefix}-results`,
  }) as HTMLInputElement;
  if (opts.required) {
    searchInput.setAttribute('required', 'true');
    searchInput.setAttribute('aria-required', 'true');
  }
  if (opts.initial) {
    searchInput.value = formatLabel(opts.initial);
  }

  const resultsList = div('student-search-results list-group shadow-sm', [], {
    id: `${prefix}-results`,
    role: 'listbox',
    hidden: 'true',
  });

  const statusText = el('small', 'text-muted-soft student-search-status', [], {
    id: `${prefix}-status`,
    'aria-live': 'polite',
  });

  const wrap = div('position-relative', [searchInput, resultsList]);
  const container = div('mb-3 student-search-widget', [wrap, statusText]);

  // Render the label above the widget, matching the web partial's
  // structure. Default to "Student" if the caller doesn't pass one.
  const labelText = `${opts.label || 'Student'}${opts.required ? ' *' : ''}`;
  const labelEl = el('label', 'form-label', [labelText]);
  container.insertBefore(labelEl, wrap);

  // ---------- runtime state ----------
  let debounceTimer: any = null;
  let inflight: AbortController | null = null;
  let activeIndex = -1;
  let lockedLabel = opts.initial ? formatLabel(opts.initial) : '';
  if (lockedLabel) searchInput.dataset.locked = '1';

  function selectStudent(s: StudentResult) {
    hiddenInput.value = String(s.id);
    searchInput.value = formatLabel(s);
    lockedLabel = searchInput.value;
    searchInput.dataset.locked = '1';
    resultsList.hidden = true;
    clearResults();
    statusText.textContent = 'Selected: ' + formatLabel(s);
    searchInput.setCustomValidity('');
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clearSelection() {
    hiddenInput.value = '';
    searchInput.dataset.locked = '';
    lockedLabel = '';
    statusText.textContent = '';
  }

  function renderResults(items: StudentResult[]) {
    clearResults();
    activeIndex = -1;
    if (!items.length) {
      resultsList.appendChild(div('empty', ['No students found.']));
      resultsList.hidden = false;
      return;
    }
    items.forEach((s) => {
      const row = button('list-group-item list-group-item-action', [
        div('fw-medium', [s.full_name]),
        span('text-muted-soft', [
          s.student_number +
            (s.grade_level ? ` · ${s.grade_level}` : '') +
            (s.section ? ` · ${s.section}` : ''),
        ]),
      ]);
      row.setAttribute('type', 'button');
      row.setAttribute('role', 'option');
      row.dataset.id = String(s.id);
      row.dataset.label = formatLabel(s);
      // mousedown beats the input's blur so the click always selects.
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectStudent(s);
      });
      resultsList.appendChild(row);
    });
    resultsList.hidden = false;
  }

  function clearResults() {
    while (resultsList.firstChild) resultsList.removeChild(resultsList.firstChild);
  }

  function runSearch(q: string) {
    if (inflight) inflight.abort();
    inflight = new AbortController();
    statusText.textContent = 'Searching…';
    studentsApi
      .lookup(q)
      .then((res) => {
        if (!res.success || !res.data) {
          statusText.textContent = 'Search failed.';
          resultsList.hidden = true;
          return;
        }
        const items = (res.data.items || []) as StudentResult[];
        renderResults(items);
        statusText.textContent = items.length
          ? `Showing ${items.length} result(s).`
          : 'No students found.';
      })
      .catch((err: any) => {
        if (err && err.name === 'AbortError') return;
        statusText.textContent = 'Search failed.';
        resultsList.hidden = true;
      });
  }

  // Debounce typing — wait 250ms after the last keystroke.
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (searchInput.dataset.locked === '1' && q !== lockedLabel) {
      searchInput.dataset.locked = '';
      clearSelection();
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!q) {
      resultsList.hidden = true;
      clearResults();
      statusText.textContent = '';
      return;
    }
    debounceTimer = setTimeout(() => runSearch(q), 250);
  });

  // Keyboard nav: ArrowDown/Up + Enter.
  searchInput.addEventListener('keydown', (e) => {
    const items = Array.from(resultsList.querySelectorAll<HTMLElement>('.list-group-item'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (resultsList.hidden) return;
      activeIndex = Math.min(items.length - 1, activeIndex + 1);
      items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (resultsList.hidden) return;
      activeIndex = Math.max(0, activeIndex - 1);
      items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (!resultsList.hidden && activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        const id = items[activeIndex].dataset.id;
        const label = items[activeIndex].dataset.label;
        if (id) {
          // Reconstruct a minimal record for selectStudent; the dropdown
          // already showed the full label.
          const s: StudentResult = {
            id: Number(id),
            student_number: label?.replace(/^.*\(([^)]+)\)\s*$/, '$1') || '',
            first_name: '',
            middle_name: '',
            last_name: '',
            full_name: label?.replace(/\s*\([^)]*\)\s*$/, '') || '',
            grade_level: '',
            section: '',
            status: '',
          };
          selectStudent(s);
        }
      }
    } else if (e.key === 'Escape') {
      resultsList.hidden = true;
    }
  });

  // Close on outside click.
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target as Node)) {
      resultsList.hidden = true;
    }
  });

  // Attach a data-id + data-label to each result row so keyboard
  // selection has the data it needs without a second round-trip.
  // (renderResults builds the buttons fresh, so we read those attributes
  // from the .list-group-item children at keydown time — see above.)

  return {
    container,
    hiddenInput,
    getValue: () => hiddenInput.value,
    setValue(pk, label) {
      hiddenInput.value = pk;
      if (label) {
        searchInput.value = label;
        lockedLabel = label;
        searchInput.dataset.locked = '1';
      }
    },
  };
}

function formatLabel(s: StudentResult): string {
  return `${s.full_name} (${s.student_number})`;
}
