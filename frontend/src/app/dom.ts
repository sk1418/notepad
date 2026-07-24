// DOM refs + shared constants for main app
const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

export const el = {
  host: $('host'),
  key: $<HTMLInputElement>('key-input'),
  editor: $<HTMLTextAreaElement>('editor'),
  gutter: $('gutter'),
  gutterInner: $('gutter-inner'),
  measure: $('measure'),
  chars: $('chars'),
  words: $('words'),
  lines: $('lines'),
  updated: $('updated'),
  status: $('status'),
  btnPwd: $<HTMLButtonElement>('btn-password'),
  btnShare: $<HTMLButtonElement>('btn-share'),
  backdrop: $('modal-backdrop'),
  modalTitle: $('modal-title'),
  modalHint: $('modal-hint'),
  modalInput: $<HTMLInputElement>('modal-input'),
  modalCurrentWrap: $('modal-current-wrap'),
  modalCurrent: $<HTMLInputElement>('modal-current'),
  modalEyeCurrent: $<HTMLButtonElement>('modal-eye-current'),
  modalCancel: $<HTMLButtonElement>('modal-cancel'),
  modalSave: $<HTMLButtonElement>('modal-save'),
  modalError: $('modal-error'),
  modalEye: $<HTMLButtonElement>('modal-eye'),
  popFont: $<HTMLDetailsElement>('pop-font'),
  fontMenu: $('font-menu'),
  popSize: $<HTMLDetailsElement>('pop-size'),
  sizeMenu: $('size-menu'),
  btnTheme: $<HTMLButtonElement>('btn-theme'),
  btnLineNr: $<HTMLButtonElement>('btn-linenr'),
  btnWrap: $<HTMLButtonElement>('btn-wrap'),
  btnEditKey: $<HTMLButtonElement>('btn-edit-key'),
  popView: $<HTMLDetailsElement>('pop-view'),
  viewMenu: $('view-menu'),
  toast: $('toast'),
};

export const KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export const editorWrap = () => el.editor.parentElement as HTMLElement;

// Mirror data-tooltip → aria-label for a11y
export function syncAriaLabels(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-tooltip]').forEach(n => {
    const t = n.dataset['tooltip'];
    if (t && !n.getAttribute('aria-label')) n.setAttribute('aria-label', t);
  });
}
