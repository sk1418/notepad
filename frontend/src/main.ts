import { icons } from './icons';
import { loadOrCreate, loadShare, type Note } from './api';
import { el, KEY_PATTERN, syncAriaLabels } from './app/dom';
import { state, ws, clearSaveTimer, setSaveTimer } from './app/state';
import {
  applyNoteSettings, initEditorUI, scheduleStats, setUpdated, updateStats,
} from './app/editor';
import { setStatus, updateTitle } from './app/status';
import { initPasswordModal, openModal, updatePwdIndicator } from './app/passwordModal';
import { initViewMenu } from './app/viewAs';
import { initShare } from './app/share';
import { initKeyEditor } from './app/keyEditor';

declare const __APP_VERSION__: string;

// ---------- Static UI setup ----------
(document.querySelector('.brand-icon') as HTMLElement).innerHTML = icons.notebook;
{
  const gh = document.getElementById('btn-github');
  if (gh) gh.innerHTML = icons.github;
  const ver = document.getElementById('app-version');
  if (ver) ver.textContent = `v${__APP_VERSION__}`;
}
el.host.textContent = location.host;

// ---------- Feature init ----------
initEditorUI();
initPasswordModal({ onUnlocked: (u) => applyLoadedNote(u) });
initViewMenu();
initShare();
initKeyEditor();
syncAriaLabels();

// ---------- WS wiring ----------
ws.onState = (s) => {
  if (s === 'closed') setStatus('closed');
  else if (s === 'unauthorized') setStatus('unauthorized');
  else if (s === 'open' && (el.status.textContent === 'offline' || el.status.textContent === 'session expired')) {
    setStatus('');
  }
};

function persist() {
  const text = el.editor.value;
  if (ws.send(text)) {
    setStatus('saved');
    if (state.note) {
      state.note.lastUpdateTs = new Date().toISOString();
      setUpdated(state.note.lastUpdateTs);
    }
  } else {
    setStatus('closed');
  }
}

// ---------- Editor input ----------
el.editor.addEventListener('input', () => {
  scheduleStats();
  setStatus('saving');
  clearSaveTimer();
  setSaveTimer(window.setTimeout(persist, 400));
});

// Cmd/Ctrl-S → force flush
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    clearSaveTimer();
    persist();
  }
});

// ---------- Boot / note loading ----------
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
    state.note = n;
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
    await bootShare(safeDecode(shareMatch[1]!));
    return;
  }
  const rawKey = safeDecode(path.replace(/^\//, '')) || undefined;
  const urlKey = rawKey && KEY_PATTERN.test(rawKey) ? rawKey : undefined;
  try {
    state.note = await loadOrCreate(urlKey);
  } catch (err) {
    console.error(err);
    setStatus('closed');
    return;
  }
  if (state.note.noteKey !== urlKey) {
    history.replaceState(null, '', '/' + state.note.noteKey);
  }
  applyLoadedNote(state.note);
  if (state.note.locked) openModal('unlock', { dismissable: false });
}

boot();

// Suppress unused-import warning for side-effect-only helpers used elsewhere
void openModal;
