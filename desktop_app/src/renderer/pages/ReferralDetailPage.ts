/** Referral detail page with timeline + update form. */
import { div, span, button, icon, el, p } from '../lib/dom';
import { referralsApi } from '../lib/api';
import { pageWrapper, loadingEl } from '../components/PageWrapper';
import { navigate } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';

export async function ReferralDetailPage(pk: string): Promise<HTMLElement> {
  const body = div('', [loadingEl()]);
  const shell = await pageWrapper('/referrals', `Referral #${pk}`, '', [body], []);

  try {
    const res = await referralsApi.detail(Number(pk));
    if (res.success && res.data) {
      const r = res.data.referral;
      body.innerHTML = '';
      body.appendChild(div('row g-3', [
        div('col-lg-8', [
          div('card mb-3', [
            div('card-header', [icon('info-circle'), span('', ['Referral Information'])]),
            div('card-body', [
              descList([
                ['Student', r.student.full_name],
                ['Referred By', r.referred_by?.full_name || '—'],
                ['Assigned To', r.assigned_counselor?.full_name || 'Unassigned'],
                ['Referral Type / Destination', r.referral_type_display],
                ['Priority', `<span class="badge ${r.priority === 'urgent' ? 'overdue' : r.priority === 'high' ? 'low_stock' : 'secondary'}">${r.priority_display}</span>`],
                ['Status', `<span class="badge ${r.status}">${r.status_display}</span>`],
                ['Referred At', new Date(r.referred_at).toLocaleString()],
                ...(r.completed_at ? [['Completed At', new Date(r.completed_at).toLocaleString()]] as [string, string][] : []),
              ]),
            ]),
          ]),
          div('card mb-3', [div('card-header', [icon('card-text'), span('', ['Reason'])]), div('card-body', [p('mb-0', [r.reason])])]),
          r.description ? div('card mb-3', [div('card-header', [icon('journal-text'), span('', ['Description'])]), div('card-body', [p('mb-0', [r.description])])]) : null,
          div('card', [
            div('card-header', [icon('clock-history'), span('', ['Referral Timeline'])]),
            div('card-body', [
              div('timeline', (r.updates || []).map(u => div('timeline-item', [
                div('d-flex justify-content-between', [
                  el('strong', '', [`Status → ${u.new_status}`]),
                  span('text-muted-soft small', [new Date(u.created_at).toLocaleString()]),
                ]),
                p('mb-0', [u.note]),
                span('text-muted-soft small', [`By ${u.author?.full_name || 'System'}`]),
              ]))),
              updateForm(Number(pk)),
            ]),
          ]),
        ].filter(Boolean) as HTMLElement[]),
        div('col-lg-4', [
          div('card', [
            div('card-header', [icon('three-dots'), span('', ['Actions'])]),
            div('card-body', [
              button('btn btn-outline-secondary btn-sm w-100 mb-2', [icon('pencil'), span('', ['Edit'])], () => navigate(`/referrals/${pk}/edit`)),
              r.status !== 'completed' ? button('btn btn-success btn-sm w-100 mb-2', [icon('check-circle'), span('', ['Mark Completed'])], async () => {
                try { await referralsApi.close(Number(pk)); toastSuccess('Referral closed'); navigate('/referrals'); }
                catch (e: any) { toastError(e.message); }
              }) : null,
              button('btn btn-outline-danger btn-sm w-100', [icon('trash'), span('', ['Delete'])], async () => {
                if (confirm('Delete this referral?')) {
                  try { await referralsApi.delete(Number(pk)); toastSuccess('Deleted'); navigate('/referrals'); }
                  catch (e: any) { toastError(e.message); }
                }
              }),
            ].filter(Boolean) as HTMLElement[]),
          ]),
        ]),
      ]));
    }
  } catch (err: any) { body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h4>Failed</h4><p>${err.message}</p></div>`; }
  const actions = shell.querySelector('.page-header-actions');
  if (actions) actions.insertBefore(button('btn btn-primary', [icon('pencil'), span('', ['Edit'])], () => navigate(`/referrals/${pk}/edit`)), actions.firstChild);
  return shell;
}

function updateForm(referralPk: number): HTMLElement {
  const form = el('form', '') as HTMLFormElement;
  const statusSelect = el('select', 'form-control') as HTMLSelectElement;
  for (const [v, l] of [['pending', 'Pending'], ['ongoing', 'Ongoing'], ['completed', 'Completed']]) {
    statusSelect.appendChild(new Option(l as string, v as string));
  }
  const noteInput = el('textarea', 'form-control') as HTMLTextAreaElement;
  noteInput.rows = 2; noteInput.required = true; noteInput.placeholder = 'Note...';
  const submit = button('btn btn-primary btn-sm mt-2', [icon('plus-circle'), span('', ['Add Update'])]);
  form.appendChild(div('mb-2', [el('label', 'form-label', ['New Status']), statusSelect]));
  form.appendChild(div('mb-2', [el('label', 'form-label', ['Note']), noteInput]));
  form.appendChild(submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    try { await referralsApi.addUpdate(referralPk, statusSelect.value, noteInput.value); toastSuccess('Update added'); window.location.reload(); }
    catch (err: any) { toastError(err.message); submit.disabled = false; }
  });
  return form;
}

function descList(rows: [string, string][]): HTMLElement {
  const dl = el('dl', 'row mb-0', []) as HTMLElement;
  for (const [k, v] of rows) {
    dl.appendChild(el('dt', 'text-muted-soft', [k], { style: 'flex: 0 0 30%;' }));
    const dd = el('dd', '', [], { style: 'flex: 1; margin-left: 0;' }); dd.innerHTML = v;
    dl.appendChild(dd);
  }
  return dl;
}
