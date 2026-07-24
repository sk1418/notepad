// Editor visuals: gutter, stats, font/size/theme/wrap/line-numbers, updated timestamp.
import { icons } from '../icons';
import { el, editorWrap } from './dom';
import {
  FONT_KEY, LINENR_KEY, SIZE_KEY, THEME_KEY, WRAP_KEY,
  readNoteSettings, saveNoteSettings, withSuppressed,
} from './settings';

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

function markActive(container: HTMLElement, attr: string, value: string) {
  container.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', (b as HTMLButtonElement).dataset[attr] === value);
  });
}

// ---------- gutter ----------
export function renderGutter() {
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

// ---------- appliers ----------
export function applyFont(name: string) {
  const stack = FONTS[name] ?? FONTS['mono'];
  editorWrap().style.setProperty('--editor-font', stack);
  localStorage.setItem(FONT_KEY, name);
  markActive(el.fontMenu, 'font', name);
  saveNoteSettings();
  requestAnimationFrame(() => renderGutter());
}

export function applySize(px: string) {
  editorWrap().style.setProperty('--editor-size', `${px}px`);
  localStorage.setItem(SIZE_KEY, px);
  markActive(el.sizeMenu, 'size', px);
  saveNoteSettings();
  requestAnimationFrame(() => renderGutter());
}

export function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  el.btnTheme.innerHTML = theme === 'dark' ? icons.sun : icons.moon;
  el.btnTheme.dataset['tooltip'] = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  saveNoteSettings();
}

export function applyLineNumbers(on: boolean) {
  el.gutter.style.display = on ? '' : 'none';
  localStorage.setItem(LINENR_KEY, on ? 'on' : 'off');
  el.btnLineNr.classList.toggle('active', on);
  el.btnLineNr.dataset['tooltip'] = on ? 'Hide line numbers' : 'Show line numbers';
  saveNoteSettings();
}

export function applyWrap(on: boolean) {
  el.editor.wrap = on ? 'soft' : 'off';
  el.editor.style.whiteSpace = on ? 'pre-wrap' : 'pre';
  localStorage.setItem(WRAP_KEY, on ? 'on' : 'off');
  el.btnWrap.classList.toggle('active', on);
  el.btnWrap.dataset['tooltip'] = on ? 'Unwrap lines' : 'Wrap long lines';
  saveNoteSettings();
  renderGutter();
}

export function applyNoteSettings(k: string) {
  const s = readNoteSettings(k);
  withSuppressed(() => {
    if (s.font) applyFont(s.font);
    if (s.size) applySize(s.size);
    if (s.theme) applyTheme(s.theme);
    if (s.lineNumbers) applyLineNumbers(s.lineNumbers === 'on');
    if (s.wrap) applyWrap(s.wrap === 'on');
  });
}

// ---------- stats + updated timestamp ----------
export function updateStats() {
  const t = el.editor.value;
  el.chars.textContent = String(t.length);
  const trimmed = t.trim();
  el.words.textContent = String(trimmed ? trimmed.split(/\s+/).length : 0);
  const lineCount = t ? t.split('\n').length : 1;
  el.lines.textContent = String(t ? lineCount : 0);
  renderGutter();
}

let statsRaf = 0;
export function scheduleStats() {
  if (statsRaf) return;
  statsRaf = requestAnimationFrame(() => { statsRaf = 0; updateStats(); });
}

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
export function renderUpdated() {
  if (!lastUpdatedIso) { el.updated.textContent = '—'; return; }
  const d = new Date(lastUpdatedIso);
  el.updated.textContent = `${fmtRel(d)} (${fmtAbs(d)})`;
}
export function setUpdated(iso: string | null) {
  lastUpdatedIso = iso;
  renderUpdated();
}

// ---------- wiring ----------
export function initEditorUI() {
  // Menu previews
  el.fontMenu.querySelectorAll<HTMLButtonElement>('button[data-font]').forEach((b) => {
    const key = b.dataset['font'];
    if (key && FONTS[key]) b.style.fontFamily = FONTS[key];
  });

  // Menu clicks
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
  el.btnTheme.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
  el.btnLineNr.innerHTML = icons.lineNr;
  el.btnLineNr.addEventListener('click', () => {
    applyLineNumbers(el.gutter.style.display === 'none');
  });
  el.btnWrap.innerHTML = icons.wrap;
  el.btnWrap.addEventListener('click', () => {
    applyWrap(el.editor.wrap !== 'soft');
  });

  // Close popovers on outside click
  document.addEventListener('click', (e) => {
    const t = e.target as Node;
    if (!el.popFont.contains(t)) el.popFont.open = false;
    if (!el.popSize.contains(t)) el.popSize.open = false;
    if (!el.popView.contains(t)) el.popView.open = false;
  });

  // Editor scroll + resize
  window.addEventListener('resize', () => {
    if (el.editor.wrap === 'soft') renderGutter();
  });
  el.editor.addEventListener('scroll', () => {
    el.gutterInner.style.transform = `translateY(${-el.editor.scrollTop}px)`;
  });

  // Init from global storage
  applyFont(localStorage.getItem(FONT_KEY) ?? 'mono');
  applySize(localStorage.getItem(SIZE_KEY) ?? '15');
  applyTheme((localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null) ?? 'light');
  applyLineNumbers((localStorage.getItem(LINENR_KEY) ?? 'on') === 'on');
  applyWrap((localStorage.getItem(WRAP_KEY) ?? 'off') === 'on');

  // Ticking relative updated timestamp
  setInterval(renderUpdated, 5000);
}
