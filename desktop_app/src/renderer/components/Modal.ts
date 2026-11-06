/**
 * Reusable Modal component — matches Django's Bootstrap modal pattern.
 * Used for "Add Guardian", "Upload Document", "Add Note", etc.
 */
import { div, span, button } from '../lib/dom';

export interface ModalConfig {
  title: string;
  body: HTMLElement;
  onClose?: () => void;
  /** Footer actions — if undefined, no footer is rendered */
  footer?: HTMLElement | null;
  /** Modal size — default, large, or small */
  size?: 'sm' | 'lg' | 'xl';
}

export function showModal(config: ModalConfig): { close: () => void; root: HTMLElement } {
  // Backdrop
  const backdrop = div('modal-backdrop', []);
  backdrop.style.zIndex = '1500';

  // Modal
  const sizeClass = config.size === 'sm' ? 'modal-sm' : config.size === 'lg' ? 'modal-lg' : config.size === 'xl' ? 'modal-xl' : '';
  const modal = div(`modal ${sizeClass}`, []);
  modal.style.zIndex = '1600';

  // Header
  const closeBtn = button('btn-close', [], () => {});
  closeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
  closeBtn.style.cssText = 'background: transparent; border: none; color: var(--text-muted); font-size: 1.2rem; cursor: pointer; padding: .5rem;';

  const header = div('modal-header', [
    span('', [config.title]),
    closeBtn,
  ]);

  // Body
  const body = div('modal-body', [config.body]);

  // Assemble
  modal.appendChild(header);
  modal.appendChild(body);
  if (config.footer) modal.appendChild(config.footer);

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Inject modal styles (once)
  injectModalStyles();

  function close() {
    if (config.onClose) config.onClose();
    document.body.removeChild(backdrop);
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  // ESC to close
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  return { close, root: modal };
}

function injectModalStyles(): void {
  if (document.getElementById('modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'modal-styles';
  style.textContent = `
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 13, 18, .55);
      backdrop-filter: blur(2px);
      z-index: 1500;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: m-fade-in .2s ease;
    }
    @keyframes m-fade-in { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      max-width: 540px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: m-zoom-in .25s cubic-bezier(.4, 0, .2, 1);
    }
    .modal.modal-sm { max-width: 400px; }
    .modal.modal-lg { max-width: 720px; }
    .modal.modal-xl { max-width: 960px; }
    @keyframes m-zoom-in {
      from { opacity: 0; transform: scale(.95) translateY(10px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-soft);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-serif);
      font-weight: 700;
      font-size: 1.1rem;
    }
    .modal-body { padding: 1.5rem; }
    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-soft);
      display: flex;
      justify-content: flex-end;
      gap: .5rem;
    }
  `;
  document.head.appendChild(style);
}
