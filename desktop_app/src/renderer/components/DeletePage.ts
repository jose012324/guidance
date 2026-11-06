/**
 * Shared delete confirmation page component.
 * Matches the design pattern of all Django delete.html templates.
 */
import { div, span, button, icon, el, h1, p } from '../lib/dom';
import { navigate } from '../lib/router';
import { toastSuccess, toastError } from '../lib/toast';

export interface DeletePageConfig {
  /** Page title (e.g. "Delete User") */
  title: string;
  /** Subtitle shown under the title */
  subtitle: string;
  /** The name of the entity being deleted (e.g. "John Smith") */
  entityName: string;
  /** Optional secondary info (e.g. username, item code) */
  entitySecondary?: string;
  /** Optional warning message shown below the prompt */
  warning?: string;
  /** The route to navigate to after successful deletion */
  backRoute: string;
  /** The delete function — returns a Promise */
  onDelete: () => Promise<any>;
  /** Active sidebar route (for highlighting) */
  activeRoute: string;
}

export function DeletePage(config: DeletePageConfig): HTMLElement {
  const shell = div('delete-shell', []);

  const card = div('delete-card', []);

  // Header
  const header = div('delete-card-header', [
    icon('exclamation-triangle'),
    span('', ['Confirm Deletion']),
  ]);

  // Body
  const body = div('delete-card-body', [
    h1('delete-title', [config.title]),
    p('delete-subtitle', [config.subtitle]),
    div('delete-prompt', [
      p('mb-2', ['Are you sure you want to permanently delete:']),
      div('delete-entity-card', [
        div('delete-entity-icon', [icon('trash-fill')]),
        div('delete-entity-info', [
          div('delete-entity-name', [config.entityName]),
          config.entitySecondary ? span('delete-entity-secondary', [config.entitySecondary]) : null,
        ]),
      ]),
      config.warning ? div('delete-warning', [
        icon('exclamation-triangle-fill'),
        span('', [config.warning]),
      ]) : null,
    ].filter(Boolean) as HTMLElement[]),
  ]);

  // Form
  const form = el('form', 'delete-form') as HTMLFormElement;
  const submitBtn = button('btn btn-danger', [
    icon('trash'),
    span('', ['Yes, Delete']),
  ], () => {});
  submitBtn.type = 'submit';
  const cancelBtn = button('btn btn-outline-secondary', [
    icon('arrow-left'),
    span('', ['Cancel']),
  ], () => navigate(config.backRoute));
  cancelBtn.type = 'button'; // Prevent form submission
  form.appendChild(div('delete-form-actions', [
    cancelBtn,
    submitBtn,
  ]));

  body.appendChild(form);
  card.appendChild(header);
  card.appendChild(body);
  shell.appendChild(card);

  injectDeleteStyles();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Deleting…</span>';
    try {
      await config.onDelete();
      toastSuccess(`${config.title} completed`);
      navigate(config.backRoute);
    } catch (err: any) {
      toastError(err.message || 'Delete failed');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '';
      submitBtn.appendChild(icon('trash'));
      submitBtn.appendChild(span('', ['Yes, Delete']));
    }
  });

  return shell;
}

function injectDeleteStyles(): void {
  if (document.getElementById('delete-styles')) return;
  const style = document.createElement('style');
  style.id = 'delete-styles';
  style.textContent = `
    .delete-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background:
        radial-gradient(circle at 30% 30%, var(--danger-soft) 0%, transparent 50%),
        linear-gradient(135deg, var(--bg) 0%, var(--surface) 100%);
    }
    .delete-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      max-width: 560px;
      width: 100%;
      overflow: hidden;
    }
    .delete-card-header {
      background: var(--danger);
      color: #fff;
      padding: 1.1rem 1.5rem;
      display: flex;
      align-items: center;
      gap: .65rem;
      font-family: var(--font-serif);
      font-weight: 700;
      font-size: 1.05rem;
    }
    .delete-card-body { padding: 2rem; }
    .delete-title {
      font-family: var(--font-serif);
      font-size: 1.6rem;
      letter-spacing: -.025em;
      margin-bottom: .5rem;
    }
    .delete-subtitle {
      color: var(--text-muted);
      font-size: .9rem;
      margin-bottom: 1.5rem;
    }
    .delete-prompt {
      padding: 1.25rem;
      background: var(--surface);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-soft);
    }
    .delete-entity-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--bg);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      margin-top: .75rem;
    }
    .delete-entity-icon {
      width: 44px; height: 44px;
      border-radius: var(--radius-sm);
      background: var(--danger-soft);
      color: var(--danger);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.2rem;
      flex-shrink: 0;
    }
    .delete-entity-info { flex: 1; min-width: 0; }
    .delete-entity-name {
      font-family: var(--font-serif);
      font-weight: 700;
      font-size: 1.05rem;
      color: var(--text);
    }
    .delete-entity-secondary {
      font-size: .82rem;
      color: var(--text-muted);
      display: block;
      margin-top: .15rem;
    }
    .delete-warning {
      margin-top: 1rem;
      padding: .75rem 1rem;
      background: var(--warning-soft);
      border: 1px solid var(--warning);
      border-radius: var(--radius-sm);
      color: var(--warning);
      font-size: .82rem;
      display: flex;
      align-items: center;
      gap: .5rem;
    }
    .delete-form { margin-top: 1.5rem; }
    .delete-form-actions {
      display: flex;
      justify-content: flex-end;
      gap: .5rem;
    }
  `;
  document.head.appendChild(style);
}
