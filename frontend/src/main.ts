import { generateShare, InvalidPasswordError, KeyTakenError, loadOrCreate, loadShare, RateLimitedError, setNoteKey, setPassword, unlock, type Note } from './api';
import { NoteSocket, type WsState } from './ws';
import { icons } from './icons';

let markdownReady: Promise<(src: string) => string> | null = null;
function loadMarkdown() {
  if (!markdownReady) {
    markdownReady = (async () => {
      const [{ marked }, { markedHighlight }, hljsMod, kotlinMod] = await Promise.all([
        import('marked'),
        import('marked-highlight'),
        import('highlight.js/lib/common'),
        import('highlight.js/lib/languages/kotlin'),
      ]);
      const hljs = hljsMod.default;
      if (!hljs.getLanguage('kotlin')) hljs.registerLanguage('kotlin', kotlinMod.default);
      marked.use(markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code: string, lang: string) {
          const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        },
      }));
      return (src: string) => marked.parse(src, { async: false }) as string;
    })();
  }
  return markdownReady;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const el = {
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

const FONTS: Record<string, string> = {
  mono: "'Menlo', 'Consolas', 'Monaco', monospace",
  sfmono: "'SF Mono', 'SFMono-Regular', ui-monospace, monospace",
  jetbrains: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
  firacode: "'Fira Code', Menlo, Consolas, monospace",
  cascadia: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
  courier: "'Courier New', Courier, monospace",
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  arial: "Arial, sans-serif",
  verdana: "Verdana, Geneva, sans-serif",
  tahoma: "Tahoma, Geneva, sans-serif",
  trebuchet: "'Trebuchet MS', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  times: "'Times New Roman', Times, serif",
  garamond: "Garamond, 'EB Garamond', Georgia, serif",
  palatino: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
};

const KEY_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;
const NOTE_SETTINGS_CAP = 200;
const NOTE_SETTINGS_INDEX = 'notepad.noteIndex';

let note: Note | null = null;
const FONT_KEY = 'notepad.font';
const SIZE_KEY = 'notepad.fontSize';
const THEME_KEY = 'notepad.theme';
const LINENR_KEY = 'notepad.lineNumbers';
const WRAP_KEY = 'notepad.wrap';

type NoteSettings = { font?: string; size?: string; theme?: 'light'|'dark'; lineNumbers?: 'on'|'off'; wrap?: 'on'|'off' };
const noteSettingsKey = (k: string) => `notepad.note.${k}`;
function readNoteSettings(k: string): NoteSettings {
  try { return JSON.parse(localStorage.getItem(noteSettingsKey(k)) ?? '{}'); } catch { return {}; }
}
function readIndex(): string[] {
  try { return JSON.parse(localStorage.getItem(NOTE_SETTINGS_INDEX) ?? '[]'); } catch { return []; }
}
function touchIndex(k: string) {
  const idx = readIndex().filter(x => x !== k);
  idx.push(k);
  while (idx.length > NOTE_SETTINGS_CAP) {
    const evict = idx.shift()!;
    localStorage.removeItem(noteSettingsKey(evict));
  }
  localStorage.setItem(NOTE_SETTINGS_INDEX, JSON.stringify(idx));
}
let suppressSave = false;
function saveNoteSettings() {
  if (suppressSave || !note) return;
  const s: NoteSettings = {
    font: localStorage.getItem(FONT_KEY) ?? undefined,
    size: localStorage.getItem(SIZE_KEY) ?? undefined,
    theme: (localStorage.getItem(THEME_KEY) as 'light'|'dark'|null) ?? undefined,
    lineNumbers: (localStorage.getItem(LINENR_KEY) as 'on'|'off'|null) ?? undefined,
    wrap: (localStorage.getItem(WRAP_KEY) as 'on'|'off'|null) ?? undefined,
  };
  localStorage.setItem(noteSettingsKey(note.noteKey), JSON.stringify(s));
  touchIndex(note.noteKey);
}
function renameNoteSettings(oldKey: string, newKey: string) {
  const v = localStorage.getItem(noteSettingsKey(oldKey));
  if (v == null) return;
  localStorage.setItem(noteSettingsKey(newKey), v);
  localStorage.removeItem(noteSettingsKey(oldKey));
  const idx = readIndex().filter(x => x !== oldKey);
  idx.push(newKey);
  localStorage.setItem(NOTE_SETTINGS_INDEX, JSON.stringify(idx));
}
function applyNoteSettings(k: string) {
  const s = readNoteSettings(k);
  suppressSave = true;
  try {
    if (s.font) applyFont(s.font);
    if (s.size) applySize(s.size);
    if (s.theme) applyTheme(s.theme);
    if (s.lineNumbers) applyLineNumbers(s.lineNumbers === 'on');
    if (s.wrap) applyWrap(s.wrap === 'on');
  } finally { suppressSave = false; }
}

const editorWrap = () => el.editor.parentElement as HTMLElement;

function markActive(container: HTMLElement, attr: string, value: string) {
  container.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', (b as HTMLButtonElement).dataset[attr] === value);
  });
}

function applyFont(name: string) {
  const stack = FONTS[name] ?? FONTS['mono'];
  editorWrap().style.setProperty('--editor-font', stack);
  localStorage.setItem(FONT_KEY, name);
  markActive(el.fontMenu, 'font', name);
  saveNoteSettings();
  requestAnimationFrame(() => renderGutter());
}

// Preview each font-menu entry in its own typeface
el.fontMenu.querySelectorAll<HTMLButtonElement>('button[data-font]').forEach((b) => {
  const key = b.dataset['font'];
  if (key && FONTS[key]) b.style.fontFamily = FONTS[key];
});

function applySize(px: string) {
  editorWrap().style.setProperty('--editor-size', `${px}px`);
  localStorage.setItem(SIZE_KEY, px);
  markActive(el.sizeMenu, 'size', px);
  saveNoteSettings();
  requestAnimationFrame(() => renderGutter());
}

// Icon setup
el.btnPwd.innerHTML = icons.lock;
el.btnShare.innerHTML = icons.link;
el.modalEye.innerHTML = icons.eye;
el.modalEyeCurrent.innerHTML = icons.eye;
el.btnEditKey.innerHTML = icons.pencil;
(el.popView.querySelector('summary') as HTMLElement).innerHTML = icons.external;
(document.querySelector('.brand-icon') as HTMLElement).innerHTML = icons.notebook;
el.btnEditKey.addEventListener('click', () => {
  el.key.focus();
  el.key.select();
});

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  el.btnTheme.innerHTML = theme === 'dark' ? icons.sun : icons.moon;
  el.btnTheme.dataset['tooltip'] = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  saveNoteSettings();
}

function applyLineNumbers(on: boolean) {
  el.gutter.style.display = on ? '' : 'none';
  localStorage.setItem(LINENR_KEY, on ? 'on' : 'off');
  el.btnLineNr.classList.toggle('active', on);
  el.btnLineNr.dataset['tooltip'] = on ? 'Hide line numbers' : 'Show line numbers';
  saveNoteSettings();
}

// Init from storage
applyFont(localStorage.getItem(FONT_KEY) ?? 'mono');
applySize(localStorage.getItem(SIZE_KEY) ?? '15');
applyTheme((localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null) ?? 'light');
el.btnLineNr.innerHTML = icons.lineNr;
applyLineNumbers((localStorage.getItem(LINENR_KEY) ?? 'on') === 'on');
el.btnLineNr.addEventListener('click', () => {
  applyLineNumbers(el.gutter.style.display === 'none');
});

function applyWrap(on: boolean) {
  el.editor.wrap = on ? 'soft' : 'off';
  el.editor.style.whiteSpace = on ? 'pre-wrap' : 'pre';
  localStorage.setItem(WRAP_KEY, on ? 'on' : 'off');
  el.btnWrap.classList.toggle('active', on);
  el.btnWrap.dataset['tooltip'] = on ? 'Unwrap lines' : 'Wrap long lines';
  saveNoteSettings();
  renderGutter();
}
el.btnWrap.innerHTML = icons.wrap;
applyWrap((localStorage.getItem(WRAP_KEY) ?? 'off') === 'on');
el.btnWrap.addEventListener('click', () => {
  applyWrap(el.editor.wrap !== 'soft');
});

// Popover menu clicks
el.fontMenu.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  const v = (b as HTMLButtonElement).dataset['font'];
  if (v) applyFont(v);
  el.popFont.open = false;
});
el.sizeMenu.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  const v = (b as HTMLButtonElement).dataset['size'];
  if (v) applySize(v);
  el.popSize.open = false;
});
el.viewMenu.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  const v = (b as HTMLButtonElement).dataset['view'];
  if (v === 'raw') openViewRaw();
  else if (v === 'md') openViewMarkdown();
  el.popView.open = false;
});
el.btnTheme.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

// Close popovers on outside click
document.addEventListener('click', (e) => {
  const t = e.target as Node;
  if (!el.popFont.contains(t)) el.popFont.open = false;
  if (!el.popSize.contains(t)) el.popSize.open = false;
  if (!el.popView.contains(t)) el.popView.open = false;
});

// Mirror data-tooltip → aria-label for all icon buttons (a11y)
function syncAriaLabels(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-tooltip]').forEach(n => {
    const t = n.dataset['tooltip'];
    if (t && !n.getAttribute('aria-label')) n.setAttribute('aria-label', t);
  });
}
syncAriaLabels();

el.host.textContent = location.host;

const ws = new NoteSocket();
let saveTimer: number | undefined;

function setStatus(s: WsState | 'saving' | 'saved' | '') {
  el.status.className = `status status-${s || 'idle'}`;
  el.status.textContent =
    s === 'saving' ? 'saving…' :
    s === 'saved' ? 'saved' :
    s === 'closed' ? 'offline' :
    s === 'connecting' ? 'connecting…' :
    s === 'unauthorized' ? 'session expired' :
    '';
  updateTitle();
}

ws.onState = (s) => {
  if (s === 'closed') setStatus('closed');
  else if (s === 'unauthorized') setStatus('unauthorized');
  else if (s === 'open' && (el.status.textContent === 'offline' || el.status.textContent === 'session expired')) setStatus('');
};

function updateTitle() {
  const base = note?.noteKey ?? 'notepad';
  const lock = note?.hasPassword ? '🔒 ' : '';
  const off = el.status.textContent === 'offline' ? '⚠ ' : '';
  document.title = `${off}${lock}${base}`;
}

// Cmd/Ctrl-S → force flush
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    clearTimeout(saveTimer);
    persist();
  }
});

function updateStats() {
  const t = el.editor.value;
  el.chars.textContent = String(t.length);
  const trimmed = t.trim();
  el.words.textContent = String(trimmed ? trimmed.split(/\s+/).length : 0);
  const lineCount = t ? t.split('\n').length : 1;
  el.lines.textContent = String(t ? lineCount : 0);
  renderGutter();
}

function renderGutter() {
  const lines = el.editor.value.split('\n');
  const n = Math.max(1, lines.length);
  const wrap = el.editor.wrap === 'soft';
  const cs = getComputedStyle(el.editor);
  const contentW = el.editor.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  el.measure.style.font = cs.font;
  el.measure.style.letterSpacing = cs.letterSpacing;
  el.measure.style.tabSize = cs.tabSize;
  el.measure.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
  el.measure.style.width = wrap ? contentW + 'px' : 'auto';
  let html = '';
  for (let i = 0; i < n; i++) {
    el.measure.textContent = lines[i] || ' ';
    html += `<div style="height:${el.measure.offsetHeight}px">${i + 1}</div>`;
  }
  el.gutterInner.innerHTML = html;
  el.gutter.style.minWidth = String(n).length + 1 + 'ch';
}

window.addEventListener('resize', () => {
  if (el.editor.wrap === 'soft') renderGutter();
});

el.editor.addEventListener('scroll', () => {
  el.gutterInner.style.transform = `translateY(${-el.editor.scrollTop}px)`;
});

let lastUpdatedIso: string | null = null;

function pad(n: number, w = 2) { return String(n).padStart(w, '0'); }

function fmtAbs(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtRel(then: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
  if (s < 60) return `${s} sec${s === 1 ? '' : 's'} ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function renderUpdated() {
  if (!lastUpdatedIso) { el.updated.textContent = '—'; return; }
  const d = new Date(lastUpdatedIso);
  el.updated.textContent = `${fmtRel(d)} (${fmtAbs(d)})`;
}

function setUpdated(iso: string | null) {
  lastUpdatedIso = iso;
  renderUpdated();
}

setInterval(renderUpdated, 5000);

function persist() {
  const text = el.editor.value;
  if (ws.send(text)) {
    setStatus('saved');
    if (note) {
      note.lastUpdateTs = new Date().toISOString();
      setUpdated(note.lastUpdateTs);
    }
  } else {
    setStatus('closed');
  }
}

let statsRaf = 0;
function scheduleStats() {
  if (statsRaf) return;
  statsRaf = requestAnimationFrame(() => { statsRaf = 0; updateStats(); });
}

el.editor.addEventListener('input', () => {
  scheduleStats();
  setStatus('saving');
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persist, 400);
});

el.key.addEventListener('change', async () => {
  const next = el.key.value.trim();
  if (!note || !next || next === note.noteKey) {
    if (note) el.key.value = note.noteKey;
    return;
  }
  if (!KEY_PATTERN.test(next)) {
    alert('Invalid key. Allowed: letters, digits, . _ - (max 32).');
    el.key.value = note.noteKey;
    return;
  }
  // Flush any pending edit to old key first
  clearTimeout(saveTimer);
  if (ws.send(el.editor.value)) setStatus('saved');
  try {
    await setNoteKey(next);
    const oldKey = note.noteKey;
    note.noteKey = next;
    renameNoteSettings(oldKey, next);
    history.replaceState(null, '', '/' + next);
    updateTitle();
    ws.connect(next);
  } catch (err) {
    if (err instanceof KeyTakenError) alert('That key is already taken.');
    else if (err instanceof RateLimitedError) alert('Too many requests. Wait a few seconds.');
    else alert('Could not rename.');
    el.key.value = note.noteKey;
  }
});

// Password modal (two modes: 'set' | 'unlock')
type ModalMode = 'set' | 'unlock';
let modalMode: ModalMode = 'set';
let modalDismissable = true;

function openModal(mode: ModalMode, opts: { dismissable?: boolean } = {}) {
  modalMode = mode;
  modalDismissable = opts.dismissable ?? true;
  el.modalInput.value = '';
  el.modalInput.type = 'password';
  el.modalCurrent.value = '';
  el.modalCurrent.type = 'password';
  el.modalEye.classList.remove('active');
  el.modalEye.innerHTML = icons.eye;
  el.modalEye.dataset['tooltip'] = 'Show password';
  el.modalEyeCurrent.classList.remove('active');
  el.modalEyeCurrent.innerHTML = icons.eye;
  el.modalEyeCurrent.dataset['tooltip'] = 'Show password';
  el.modalError.classList.add('hidden');
  el.modalError.textContent = '';
  const changing = mode === 'set' && !!note?.hasPassword;
  el.modalCurrentWrap.classList.toggle('hidden', !changing);
  if (mode === 'set') {
    el.modalTitle.textContent = changing ? 'Change password' : 'Set password';
    el.modalHint.textContent = changing
      ? 'Enter current password, then the new one. Leave new empty to remove.'
      : 'Protect this note with a password.';
    el.modalSave.textContent = changing ? 'Change' : 'Save';
    el.modalInput.placeholder = changing ? 'new password (empty = remove)' : 'password';
    el.modalCancel.style.display = '';
  } else {
    el.modalTitle.textContent = 'Enter password';
    el.modalHint.textContent = 'This note is protected. Enter password to view.';
    el.modalSave.textContent = 'Unlock';
    el.modalInput.placeholder = 'password';
    el.modalCancel.style.display = modalDismissable ? '' : 'none';
  }
  el.backdrop.classList.remove('hidden');
  setTimeout(() => (changing ? el.modalCurrent : el.modalInput).focus(), 0);
}
function closeModal() {
  el.backdrop.classList.add('hidden');
}
function showModalError(msg: string) {
  el.modalError.textContent = msg;
  el.modalError.classList.remove('hidden');
}

el.btnPwd.addEventListener('click', () => openModal('set'));
function toggleEye(btn: HTMLButtonElement, input: HTMLInputElement) {
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.classList.toggle('active', show);
  btn.innerHTML = show ? icons.eyeOff : icons.eye;
  btn.dataset['tooltip'] = show ? 'Hide password' : 'Show password';
  btn.setAttribute('aria-label', btn.dataset['tooltip']!);
  input.focus();
}
el.modalEye.addEventListener('click', () => toggleEye(el.modalEye, el.modalInput));
el.modalEyeCurrent.addEventListener('click', () => toggleEye(el.modalEyeCurrent, el.modalCurrent));
el.modalCancel.addEventListener('click', () => { if (modalDismissable) closeModal(); });
el.backdrop.addEventListener('click', (e) => {
  if (e.target === el.backdrop && modalDismissable) closeModal();
});
el.modalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el.modalSave.click();
  if (e.key === 'Escape' && modalDismissable) closeModal();
});
el.modalCurrent.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el.modalInput.focus();
  if (e.key === 'Escape' && modalDismissable) closeModal();
});
// Focus trap for modal
el.backdrop.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || el.backdrop.classList.contains('hidden')) return;
  const focusables = el.backdrop.querySelectorAll<HTMLElement>(
    'input:not([disabled]), button:not([disabled])'
  );
  const visible = Array.from(focusables).filter(n =>
    !n.closest('.input-wrap')?.classList.contains('hidden') &&
    (n.offsetParent !== null || n === el.modalSave)
  );
  if (visible.length === 0) return;
  const first = visible[0], last = visible[visible.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

el.modalSave.addEventListener('click', async () => {
  const pwd = el.modalInput.value;
  if (modalMode === 'set') {
    const changing = !!note?.hasPassword;
    if (!changing && !pwd) return;
    const current = changing ? el.modalCurrent.value : undefined;
    if (changing && !current) { showModalError('Enter current password.'); return; }
    try {
      await setPassword(pwd, current);
      if (note) note.hasPassword = pwd.length > 0;
      updatePwdIndicator();
      updateTitle();
      closeModal();
    } catch (err) {
      const msg = err instanceof InvalidPasswordError ? 'Wrong current password.'
        : err instanceof RateLimitedError ? 'Too many requests. Wait a few seconds.'
        : 'Could not set password.';
      showModalError(msg);
    }
  } else {
    if (!pwd) return;
    if (!note) return;
    try {
      const unlocked = await unlock(note.noteKey, pwd);
      note = unlocked;
      applyLoadedNote(note);
      updatePwdIndicator();
      updateTitle();
      closeModal();
    } catch (err) {
      const msg = err instanceof InvalidPasswordError ? 'Wrong password.'
        : err instanceof RateLimitedError ? 'Too fast — wait a few seconds.'
        : 'Could not unlock.';
      showModalError(msg);
      el.modalInput.select();
    }
  }
});

function updatePwdIndicator() {
  const on = !!note?.hasPassword;
  el.btnPwd.classList.toggle('active', on);
  el.btnPwd.dataset['tooltip'] = on ? 'Change password' : 'Password protect';
}

// View as
function openBlob(content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function openViewRaw() {
  openBlob(el.editor.value, 'text/plain;charset=utf-8');
}

async function openViewMarkdown() {
  const parse = await loadMarkdown();
  const title = (note?.noteKey ?? 'note') + ' — markdown';
  const body = parse(el.editor.value);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:780px;margin:40px auto;padding:0 20px;color:#333}
  pre{background:#002b36;color:#93a1a1;padding:14px 16px;border-radius:6px;overflow:auto;font:14px/1.5 Menlo,Consolas,Monaco,monospace}
  pre code{background:transparent;color:inherit;padding:0;font-size:inherit}
  code{background:#f4f4f4;color:#c7254e;padding:2px 5px;border-radius:3px;font:0.9em Menlo,Consolas,Monaco,monospace}
  blockquote{border-left:4px solid #ddd;margin:0;padding:0 16px;color:#666}
  table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 10px}
  img{max-width:100%}
  h1,h2,h3{border-bottom:1px solid #eee;padding-bottom:.3em}
  a{color:#268bd2}
  /* highlight.js — Solarized Dark */
  .hljs-comment,.hljs-quote{color:#586e75;font-style:italic}
  .hljs-keyword,.hljs-selector-tag,.hljs-literal{color:#859900}
  .hljs-string,.hljs-doctag,.hljs-regexp,.hljs-addition{color:#2aa198}
  .hljs-number,.hljs-meta,.hljs-symbol,.hljs-bullet,.hljs-link{color:#cb4b16}
  .hljs-title,.hljs-section,.hljs-name,.hljs-selector-id,.hljs-selector-class{color:#268bd2}
  .hljs-attribute,.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-class .hljs-title,.hljs-type{color:#b58900}
  .hljs-built_in,.hljs-builtin-name,.hljs-tag{color:#dc322f}
  .hljs-deletion{color:#dc322f}
  .hljs-emphasis{font-style:italic}
  .hljs-strong{font-weight:bold}
</style></head><body>${body}</body></html>`;
  openBlob(html, 'text/html;charset=utf-8');
}

// Share
let toastTimer: number | undefined;
function showToast(msg: string) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.toast.classList.add('hidden'), 1600);
}

el.btnShare.addEventListener('click', async () => {
  if (!note) return;
  try {
    if (!note.readOnlyUrl) note.readOnlyUrl = await generateShare();
    const url = `${location.origin}/share/${note.readOnlyUrl}`;
    await navigator.clipboard.writeText(url);
    showToast('link copied');
  } catch {
    showToast('share failed');
  }
});

function applyLoadedNote(n: Note) {
  el.key.value = n.noteKey;
  el.editor.value = n.content;
  el.editor.readOnly = n.locked;
  el.editor.placeholder = n.locked ? '🔒 locked — enter password' : 'Start typing…';
  applyNoteSettings(n.noteKey);
  setUpdated(n.lastUpdateTs);
  updateStats();
  updatePwdIndicator();
  updateTitle();
  if (n.locked) {
    ws.close();
    setStatus('');
  } else {
    ws.connect(n.noteKey);
  }
}

async function bootShare(roUrl: string) {
  document.body.classList.add('share-mode');
  try {
    const n = await loadShare(roUrl);
    note = n;
    el.key.value = n.noteKey;
    el.key.readOnly = true;
    el.editor.value = n.content;
    el.editor.readOnly = true;
    el.editor.placeholder = '';
    applyNoteSettings(n.noteKey);
    setUpdated(n.lastUpdateTs);
    updateStats();
    setStatus('');
  } catch {
    el.editor.value = 'Share link not found.';
    el.editor.readOnly = true;
    setStatus('closed');
  }
}

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

async function boot() {
  const path = location.pathname;
  const shareMatch = path.match(/^\/share\/([^/]+)$/);
  if (shareMatch) {
    await bootShare(safeDecode(shareMatch[1]));
    return;
  }
  const rawKey = safeDecode(path.replace(/^\//, '')) || undefined;
  const urlKey = rawKey && KEY_PATTERN.test(rawKey) ? rawKey : undefined;
  try {
    note = await loadOrCreate(urlKey);
  } catch (err) {
    console.error(err);
    setStatus('closed');
    return;
  }
  if (note.noteKey !== urlKey) {
    history.replaceState(null, '', '/' + note.noteKey);
  }
  applyLoadedNote(note);
  if (note.locked) openModal('unlock', { dismissable: false });
}

boot();
