/**
 * Toast notification system — minimal, dependency-free.
 */
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let container: HTMLElement | null = null;
const toasts: ToastItem[] = [];
let nextId = 1;

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

function iconFor(type: ToastType): string {
  return {
    success: 'bi-check-circle-fill',
    error: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill',
  }[type];
}

function colorFor(type: ToastType): string {
  return {
    success: 'var(--success)',
    error: 'var(--danger)',
    warning: 'var(--warning)',
    info: 'var(--info)',
  }[type];
}

function render(): void {
  const el = ensureContainer();
  el.innerHTML = '';
  for (const t of toasts) {
    const div = document.createElement('div');
    div.className = `toast ${t.type}`;
    div.innerHTML = `<i class="bi ${iconFor(t.type)}" style="color:${colorFor(t.type)}"></i><span>${t.message}</span>`;
    el.appendChild(div);
  }
}

export function toast(message: string, type: ToastType = 'info', duration = 4000): void {
  const id = nextId++;
  toasts.push({ id, type, message });
  render();
  setTimeout(() => {
    const idx = toasts.findIndex(t => t.id === id);
    if (idx >= 0) {
      toasts.splice(idx, 1);
      render();
    }
  }, duration);
}

export const toastSuccess = (m: string) => toast(m, 'success');
export const toastError = (m: string) => toast(m, 'error');
export const toastWarning = (m: string) => toast(m, 'warning');
export const toastInfo = (m: string) => toast(m, 'info');
