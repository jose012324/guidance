/**
 * Student detail page — full tabbed interface matching students/detail.html.
 * Tabs: Personal Info | Counseling History | Referrals | Activity Timeline | Documents
 * With Add Guardian modal + Upload Document modal.
 */
import { div, span, button, icon, el, p } from '../lib/dom';
import { studentsApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate, enableLiveRefresh } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';
import { showModal } from '../components/Modal';
import type { Student } from '../../shared/types';

export async function StudentDetailPage(pk: string): Promise<HTMLElement> {
  let activeTab = 'personal';
  let currentStudent: Student | null = null;

  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/students', 'Student Profile', '', [body], []);
  let loadVersion = 0;

  async function load(silent = false) {
    const version = ++loadVersion;
    if (!silent) { body.innerHTML = ''; body.appendChild(loadingEl()); }
    try {
      const res = await studentsApi.detail(Number(pk));
      if (version !== loadVersion) return;
      if (res.success && res.data) {
        currentStudent = res.data.student;
        body.innerHTML = '';
        renderPage();
      }
    } catch (err: any) {
      if (!silent && version === loadVersion) body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed to load</h4><p>${err.message}</p></div>`;
    }
  }

  function renderPage() {
    if (!currentStudent) return;
    const s = currentStudent;

    // Header card
    body.appendChild(div('card mb-4', [
      div('card-body', [
        div('d-flex align-items-center gap-3', [
          div('user-avatar', [s.first_name?.[0]?.toUpperCase() || 'S'], { style: 'width:70px;height:70px;font-size:1.8rem;' } as any),
          div('', [
            el('h2', 'mb-0', [s.full_name]),
            span('text-muted-soft mb-2', [`${s.student_number} · ${s.gender_display || ''} · ${s.age || '—'} years old`]),
            div('d-flex gap-2 mt-2', [
              span(`badge ${s.status}`, [s.status_display]),
              s.grade_level ? span('badge secondary', [`${s.grade_level} ${s.section || ''}`]) : null,
              s.school_year ? span('badge secondary', [`SY ${s.school_year}`]) : null,
            ].filter(Boolean) as HTMLElement[]),
          ]),
        ]),
      ]),
    ]));

    // Tabs
    const tabsBar = div('profile-tabs', []);
    const tabs = [
      { id: 'personal', label: 'Personal Info' },
      { id: 'counseling', label: `Counseling History (${s.counseling_sessions?.length || 0})` },
      { id: 'referrals', label: `Referrals (${s.referrals?.length || 0})` },
      { id: 'timeline', label: 'Activity Timeline' },
      { id: 'documents', label: `Documents (${s.documents?.length || 0})` },
    ];
    for (const t of tabs) {
      const tabBtn = button(`nav-link ${activeTab === t.id ? 'active' : ''}`, [span('', [t.label])], () => {
        activeTab = t.id;
        body.innerHTML = '';
        renderPage();
      });
      tabsBar.appendChild(tabBtn);
    }
    body.appendChild(tabsBar);

    // Render the active tab
    if (activeTab === 'personal') renderPersonalTab(s);
    else if (activeTab === 'counseling') renderCounselingTab(s);
    else if (activeTab === 'referrals') renderReferralsTab(s);
    else if (activeTab === 'timeline') renderTimelineTab(s);
    else if (activeTab === 'documents') renderDocumentsTab(s);
  }

  function renderPersonalTab(s: Student) {
    body.appendChild(div('row g-3', [
      div('col-lg-8', [
        div('card', [
          div('card-header', [icon('info-circle'), span('', ['Personal Information'])]),
          div('card-body', [
            descList([
              ['Student Number', s.student_number],
              ['Full Name', s.full_name],
              ['Gender', s.gender_display || '—'],
              ['Birthdate', s.birthdate ? new Date(s.birthdate).toLocaleDateString() : '—'],
              ['Age', s.age ? `${s.age} years` : '—'],
              ['Address', s.address || '—'],
              ['Contact', s.contact_number || '—'],
              ['Year Level', s.grade_level || '—'],
              ['Course & Section', s.section || '—'],
              ['School Year', s.school_year || '—'],
              ['Status', `<span class="badge ${s.status}">${s.status_display}</span>`],
            ]),
          ]),
        ]),
      ]),
      div('col-lg-4', [
        div('card', [
          div('card-header d-flex justify-content-between align-items-center', [
            span('', [icon('people'), span('', ['Guardians'])]),
            button('btn btn-sm btn-soft', [icon('plus'), span('', ['Add'])], () => showAddGuardianModal()),
          ]),
          div('card-body', [
            ...(s.guardians || []).map(g => div('d-flex justify-content-between py-2', [
              div('', [
                div('fw-medium', [g.full_name + (g.is_primary ? ' ' : '')]),
                g.is_primary ? span('badge bg-primary', ['Primary']) : null,
                div('', [span('text-muted-soft small', [`${g.relationship_display} · ${g.contact_number || '—'}`])]),
              ].filter(Boolean) as HTMLElement[]),
              button('btn btn-sm btn-outline-danger', [icon('trash')], async () => {
                if (confirm(`Delete guardian ${g.full_name}?`)) {
                  try {
                    await studentsApi.deleteGuardian(s.id, g.id);
                    toastSuccess('Guardian deleted');
                    load();
                  } catch (e: any) { toastError(e.message); }
                }
              }),
            ], { style: 'border-bottom: 1px solid var(--border-soft);' })),
            (s.guardians || []).length === 0 ? div('empty-state', [icon('people'), el('p', '', ['No guardians added.'])]) : null,
          ]),
        ]),
      ]),
    ]));
  }

  function renderCounselingTab(s: Student) {
    body.appendChild(div('card', [
      div('card-header d-flex justify-content-between align-items-center', [
        span('', [icon('chat-heart'), span('', ['Counseling History'])]),
        button('btn btn-sm btn-soft', [icon('plus'), span('', ['New Session'])], () => navigate(`/counseling/create`)),
      ]),
      div('card-body', [
        (s.counseling_sessions && s.counseling_sessions.length)
          ? simpleTable([
              ['Date', 'Counselor', 'Concern', 'Status', ''],
              ...s.counseling_sessions.map(c => [
                new Date(c.session_date).toLocaleDateString(),
                c.counselor?.full_name || '—',
                c.concern_type_display,
                `<span class="badge ${c.status}">${c.status_display}</span>`,
                `<a href="#/counseling/${c.id}" class="btn btn-sm btn-soft">View</a>`,
              ]),
            ])
          : div('empty-state', [icon('chat-heart'), el('p', '', ['No counseling sessions yet.'])]),
      ]),
    ]));
  }

  function renderReferralsTab(s: Student) {
    body.appendChild(div('card', [
      div('card-header d-flex justify-content-between align-items-center', [
        span('', [icon('send-exclamation'), span('', ['Referral History'])]),
        button('btn btn-sm btn-soft', [icon('plus'), span('', ['New Referral'])], () => navigate(`/referrals/create`)),
      ]),
      div('card-body', [
        (s.referrals && s.referrals.length)
          ? simpleTable([
              ['Date', 'Type', 'Priority', 'Status', ''],
              ...s.referrals.map(r => [
                new Date(r.referred_at).toLocaleDateString(),
                r.referral_type_display,
                r.priority_display,
                `<span class="badge ${r.status}">${r.status_display}</span>`,
                `<a href="#/referrals/${r.id}" class="btn btn-sm btn-soft">View</a>`,
              ]),
            ])
          : div('empty-state', [icon('send-exclamation'), el('p', '', ['No referrals yet.'])]),
      ]),
    ]));
  }

  function renderTimelineTab(s: Student) {
    body.appendChild(div('card', [
      div('card-header', [icon('clock-history'), span('', ['Activity Timeline'])]),
      div('card-body', [
        (s.activities && s.activities.length)
          ? div('timeline', s.activities.map(a => div('timeline-item', [
              div('d-flex justify-content-between', [
                el('strong', '', [a.title]),
                span('text-muted-soft small', [new Date(a.timestamp).toLocaleString()]),
              ]),
              p('mb-0 text-muted-soft small', [a.description || '']),
              span('text-muted-soft small', [`By ${a.performed_by?.full_name || 'System'} · ${a.activity_type_display}`]),
            ])))
          : div('empty-state', [icon('clock-history'), el('p', '', ['No activity recorded.'])]),
      ]),
    ]));
  }

  function renderDocumentsTab(s: Student) {
    body.appendChild(div('card', [
      div('card-header d-flex justify-content-between align-items-center', [
        span('', [icon('file-earmark'), span('', ['Uploaded Documents'])]),
        button('btn btn-sm btn-soft', [icon('upload'), span('', ['Upload'])], () => showUploadDocumentModal()),
      ]),
      div('card-body', [
        (s.documents && s.documents.length)
          ? div('', s.documents.map(d => div('d-flex justify-content-between align-items-center py-2', [
              div('d-flex align-items-center gap-3', [
                icon('file-earmark-text fs-4 text-muted-soft'),
                div('', [
                  div('fw-medium', [d.title]),
                  span('text-muted-soft small', [`${d.document_type_display} · Uploaded ${new Date(d.uploaded_at).toLocaleDateString()}`]),
                ]),
              ]),
              div('d-flex gap-1', [
                d.file ? button('btn btn-sm btn-soft', [icon('download')], () => {
                  window.open(d.file!, '_blank');
                }) : null,
                button('btn btn-sm btn-outline-danger', [icon('trash')], async () => {
                  if (confirm(`Delete document "${d.title}"?`)) {
                    try {
                      await studentsApi.deleteDocument(s.id, d.id);
                      toastSuccess('Document deleted');
                      load();
                    } catch (e: any) { toastError(e.message); }
                  }
                }),
              ].filter(Boolean) as HTMLElement[]),
            ], { style: 'border-bottom: 1px solid var(--border-soft);' })))
          : div('empty-state', [icon('file-earmark'), el('p', '', ['No documents uploaded.'])]),
      ]),
    ]));
  }

  function showAddGuardianModal() {
    if (!currentStudent) return;
    const form = el('form', '') as HTMLFormElement;

    const fnInput = el('input', 'form-control') as HTMLInputElement;
    fnInput.required = true;
    form.appendChild(div('mb-3', [el('label', 'form-label', ['Full Name *']), fnInput]));

    const relSelect = el('select', 'form-select') as HTMLSelectElement;
    for (const [v, l] of [['mother', 'Mother'], ['father', 'Father'], ['guardian', 'Guardian'], ['sibling', 'Sibling'], ['relative', 'Relative'], ['other', 'Other']]) {
      relSelect.appendChild(new Option(l as string, v as string));
    }
    form.appendChild(div('mb-3', [el('label', 'form-label', ['Relationship']), relSelect]));

    const cnInput = el('input', 'form-control') as HTMLInputElement;
    form.appendChild(div('mb-3', [el('label', 'form-label', ['Contact Number']), cnInput]));

    const emInput = el('input', 'form-control') as HTMLInputElement;
    emInput.type = 'email';
    form.appendChild(div('mb-3', [el('label', 'form-label', ['Email']), emInput]));

    const addrInput = el('textarea', 'form-control') as HTMLTextAreaElement;
    addrInput.rows = 2;
    form.appendChild(div('mb-3', [el('label', 'form-label', ['Address']), addrInput]));

    const primaryInput = el('input', 'form-check-input') as HTMLInputElement;
    primaryInput.type = 'checkbox';
    primaryInput.id = 'isPrimary';
    form.appendChild(div('form-check', [primaryInput, el('label', 'form-check-label', ['Primary guardian'], { for: 'isPrimary' })]));

    const footer = div('modal-footer', [
      button('btn btn-outline-secondary', [span('', ['Cancel'])], () => modal.close()),
      button('btn btn-primary', [span('', ['Add Guardian'])], () => {
        form.requestSubmit();
      }),
    ]);

    const modal = showModal({
      title: 'Add Guardian',
      body: form,
      footer,
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await studentsApi.addGuardian(currentStudent!.id, {
          full_name: fnInput.value,
          relationship: relSelect.value,
          contact_number: cnInput.value,
          email: emInput.value,
          address: addrInput.value,
          is_primary: primaryInput.checked,
        });
        toastSuccess('Guardian added');
        modal.close();
        load();
      } catch (err: any) {
        toastError(err.message);
      }
    });
  }

  function showUploadDocumentModal() {
    if (!currentStudent) return;
    const form = el('form', '') as HTMLFormElement;

    const titleInput = el('input', 'form-control') as HTMLInputElement;
    titleInput.required = true;
    form.appendChild(div('mb-3', [el('label', 'form-label', ['Title *']), titleInput]));

    const typeSelect = el('select', 'form-select') as HTMLSelectElement;
    for (const [v, l] of [['form', 'Enrollment Form'], ['report', 'Report Card'], ['certificate', 'Certificate'], ['referral', 'Referral Letter'], ['medical', 'Medical Record'], ['other', 'Other']]) {
      typeSelect.appendChild(new Option(l as string, v as string));
    }
    form.appendChild(div('mb-3', [el('label', 'form-label', ['Type']), typeSelect]));

    const fileInput = el('input', 'form-control') as HTMLInputElement;
    fileInput.type = 'file';
    fileInput.required = true;
    form.appendChild(div('mb-3', [el('label', 'form-label', ['File *']), fileInput]));

    const descInput = el('textarea', 'form-control') as HTMLTextAreaElement;
    descInput.rows = 2;
    form.appendChild(div('mb-3', [el('label', 'form-label', ['Description']), descInput]));

    const footer = div('modal-footer', [
      button('btn btn-outline-secondary', [span('', ['Cancel'])], () => modal.close()),
      button('btn btn-primary', [span('', ['Upload'])], () => {
        form.requestSubmit();
      }),
    ]);

    const modal = showModal({
      title: 'Upload Document',
      body: form,
      footer,
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!fileInput.files || !fileInput.files[0]) {
        toastError('Please select a file');
        return;
      }
      try {
        await studentsApi.addDocument(currentStudent!.id, {
          title: titleInput.value,
          document_type: typeSelect.value,
          description: descInput.value,
          file: fileInput.files[0],
        });
        toastSuccess('Document uploaded');
        modal.close();
        load();
      } catch (err: any) {
        toastError(err.message);
      }
    });
  }

  // Initial load
  enableLiveRefresh(shell, () => load(true));
  load();

  // Inject Edit + Delete buttons into header
  const actions = shell.querySelector('.page-header-actions');
  if (actions) {
    actions.insertBefore(button('btn btn-outline-danger', [icon('trash'), span('', ['Delete'])], () => navigate(`/students/${pk}/delete`)), actions.firstChild);
    actions.insertBefore(button('btn btn-primary', [icon('pencil'), span('', ['Edit'])], () => navigate(`/students/${pk}/edit`)), actions.firstChild);
  }

  return shell;

  function descList(rows: [string, string][]): HTMLElement {
    const dl = el('dl', 'row mb-0', []) as HTMLElement;
    for (const [k, v] of rows) {
      dl.appendChild(el('dt', 'text-muted-soft', [k], { style: 'flex: 0 0 25%;' }));
      const dd = el('dd', '', [], { style: 'flex: 1; margin-left: 0;' });
      dd.innerHTML = v;
      dl.appendChild(dd);
    }
    return dl;
  }

  function simpleTable(rows: string[][]): HTMLElement {
    if (rows.length <= 1) return div('text-center text-muted-soft py-3', ['No records.']);
    const [header, ...rest] = rows;
    const table = el('table', 'table table-hover') as HTMLTableElement;
    const thead = el('thead', '', [el('tr', '', header.map(h => el('th', '', [h])))]);
    const tbody = el('tbody', '', rest.map(r => el('tr', '', r.map(c => { const td = el('td', ''); td.innerHTML = c; return td; }))));
    table.appendChild(thead); table.appendChild(tbody);
    return div('table-responsive', [table]);
  }
}
