/**
 * Counseling detail page.
 */
import { div, span, button, icon, el, p } from '../lib/dom';
import { counselingApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';

export async function CounselingDetailPage(pk: string): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/counseling', 'Counseling Session', '', [body], []);

  try {
    const res = await counselingApi.detail(Number(pk));
    if (res.success && res.data) {
      const c = res.data.session;
      body.innerHTML = '';

      body.appendChild(div('row g-3', [
        div('col-lg-8', [
          div('card mb-3', [
            div('card-header', [icon('info-circle'), span('', ['Session Details'])]),
            div('card-body', [
              descList([
                ['Student', c.student.full_name],
                ['Counselor', c.counselor?.full_name || '—'],
                ['Session Date', new Date(c.session_date).toLocaleDateString()],
                ['Concern Type', c.concern_type_display],
                ['Status', `<span class="badge ${c.status}">${c.status_display}</span>`],
                ['Follow-up', c.follow_up_date ? new Date(c.follow_up_date).toLocaleDateString() : '—'],
              ]),
            ]),
          ]),
          c.summary ? div('card mb-3', [div('card-header', [icon('card-text'), span('', ['Summary'])]), div('card-body', [p('mb-0', [c.summary])])]) : null,
          c.notes ? div('card mb-3', [div('card-header', [icon('journal-text'), span('', ['Session Notes'])]), div('card-body', [p('mb-0', [c.notes])])]) : null,
          c.recommendations ? div('card mb-3', [div('card-header', [icon('clipboard-check'), span('', ['Recommendations'])]), div('card-body', [p('mb-0', [c.recommendations])])]) : null,
          div('card', [
            div('card-header', [icon('sticky'), span('', [`Counselor Notes (${c.notes_list?.length || 0})`])]),
            div('card-body', [
              ...(c.notes_list || []).map(n => div('d-flex gap-3 py-2', [
                div('user-avatar', [n.author?.first_name?.[0]?.toUpperCase() || 'A'], { style: 'width:36px;height:36px;font-size:.85rem;' }) as HTMLElement,
                div('flex-grow-1', [
                  div('d-flex justify-content-between', [
                    el('strong', '', [n.author?.full_name || 'Unknown']),
                    span('text-muted-soft small', [new Date(n.created_at).toLocaleString()]),
                  ]),
                  p('mb-0', [n.note]),
                ]),
              ], { style: 'border-bottom: 1px solid var(--border-soft);' })),
              addNoteForm(Number(pk)),
            ]),
          ]),
        ].filter(Boolean) as HTMLElement[]),
        div('col-lg-4', [
          div('card', [
            div('card-header', [icon('three-dots'), span('', ['Actions'])]),
            div('card-body', [
              button('btn btn-outline-secondary btn-sm w-100 mb-2', [icon('pencil'), span('', ['Edit Session'])], () => navigate(`/counseling/${pk}/edit`)),
              c.status !== 'closed' ? button('btn btn-success btn-sm w-100 mb-2', [icon('check-circle'), span('', ['Close Session'])], async () => {
                try { await counselingApi.close(Number(pk)); toastSuccess('Session closed'); navigate('/counseling'); }
                catch (e: any) { toastError(e.message); }
              }) : null,
              button('btn btn-outline-danger btn-sm w-100', [icon('trash'), span('', ['Delete Session'])], async () => {
                if (confirm('Delete this session?')) {
                  try { await counselingApi.delete(Number(pk)); toastSuccess('Session deleted'); navigate('/counseling'); }
                  catch (e: any) { toastError(e.message); }
                }
              }),
            ].filter(Boolean) as HTMLElement[]),
          ]),
        ]),
      ]));
    }
  } catch (err: any) {
    body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed to load</h4><p>${err.message}</p></div>`;
  }

  const actions = shell.querySelector('.page-header-actions');
  if (actions) {
    actions.insertBefore(button('btn btn-primary', [icon('pencil'), span('', ['Edit'])], () => navigate(`/counseling/${pk}/edit`)), actions.firstChild);
  }

  return shell;
}

function addNoteForm(sessionPk: number): HTMLElement {
  const form = el('form', '') as HTMLFormElement;
  const textarea = el('textarea', 'form-control') as HTMLTextAreaElement;
  textarea.rows = 3; textarea.required = true; textarea.placeholder = 'Add a note...';
  const submit = button('btn btn-primary btn-sm mt-2', [icon('plus-circle'), span('', ['Add Note'])]);
  form.appendChild(div('mb-2', [textarea]));
  form.appendChild(submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    try {
      await counselingApi.addNote(sessionPk, textarea.value, false);
      toastSuccess('Note added');
      // Re-render page
      window.location.reload();
    } catch (err: any) {
      toastError(err.message);
      submit.disabled = false;
    }
  });
  return form;
}

function descList(rows: [string, string][]): HTMLElement {
  const dl = el('dl', 'row mb-0', []) as HTMLElement;
  for (const [k, v] of rows) {
    dl.appendChild(el('dt', 'text-muted-soft', [k], { style: 'flex: 0 0 30%;' }));
    const dd = el('dd', '', [], { style: 'flex: 1; margin-left: 0;' });
    dd.innerHTML = v;
    dl.appendChild(dd);
  }
  return dl;
}
