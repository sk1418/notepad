export interface NoteSummary {
  id: number;
  noteKey: string;
  preview: string;
  contentLength: number;
  password: string | null;
  readOnlyUrl: string | null;
  lastUpdateTs: string;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

export const el = {
  brandIcon: document.querySelector('.brand-icon') as HTMLElement,
  loginBackdrop: $('login-backdrop'),
  loginInput: $<HTMLInputElement>('login-input'),
  loginEye: $<HTMLButtonElement>('login-eye'),
  loginSubmit: $<HTMLButtonElement>('login-submit'),
  loginError: $('login-error'),
  table: $<HTMLTableElement>('admin-table'),
  tbody: $<HTMLTableSectionElement>('admin-tbody'),
  checkAll: $<HTMLInputElement>('check-all'),
  empty: $('admin-empty'),
  errorBox: $('admin-error'),
  btnRefresh: $<HTMLButtonElement>('btn-refresh'),
  btnDelete: $<HTMLButtonElement>('btn-delete'),
  btnLogout: $<HTMLButtonElement>('btn-logout'),
  toast: $('toast'),

  contentBackdrop: $('content-backdrop'),
  contentTitle: $('content-title'),
  contentMeta: $('content-meta'),
  contentBody: $<HTMLPreElement>('content-body'),
  contentClose: $<HTMLButtonElement>('content-close'),
  contentOpen: $<HTMLButtonElement>('content-open'),
  contentCopy: $<HTMLButtonElement>('content-copy'),

  pwBackdrop: $('pw-backdrop'),
  pwTitle: $('pw-title'),
  pwHint: $('pw-hint'),
  pwInput: $<HTMLInputElement>('pw-input'),
  pwEye: $<HTMLButtonElement>('pw-eye'),
  pwSubmit: $<HTMLButtonElement>('pw-submit'),
  pwCancel: $<HTMLButtonElement>('pw-cancel'),
  pwClose: $<HTMLButtonElement>('pw-close'),
  pwError: $('pw-error'),
};

let toastTimer: number | undefined;
export function toast(msg: string) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.toast.classList.add('hidden'), 1800);
}

export function showError(msg: string) {
  el.errorBox.textContent = msg;
  el.errorBox.classList.remove('hidden');
  el.table.classList.add('hidden');
  el.empty.classList.add('hidden');
}

export function noteUrlFor(key: string): string {
  return `${location.origin}/${encodeURIComponent(key)}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]!,
  );
}
