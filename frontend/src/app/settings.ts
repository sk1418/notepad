import { state } from './state';

export const FONT_KEY = 'notepad.font';
export const SIZE_KEY = 'notepad.fontSize';
export const THEME_KEY = 'notepad.theme';
export const LINENR_KEY = 'notepad.lineNumbers';
export const WRAP_KEY = 'notepad.wrap';

const NOTE_SETTINGS_CAP = 200;
const NOTE_SETTINGS_INDEX = 'notepad.noteIndex';

export type NoteSettings = {
  font?: string;
  size?: string;
  theme?: 'light' | 'dark';
  lineNumbers?: 'on' | 'off';
  wrap?: 'on' | 'off';
};

const noteSettingsKey = (k: string) => `notepad.note.${k}`;

export function readNoteSettings(k: string): NoteSettings {
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

// suppressSave gates writes during initial applyNoteSettings so we don't
// re-persist what we just loaded.
export let suppressSave = false;
export function withSuppressed(fn: () => void) {
  suppressSave = true;
  try { fn(); } finally { suppressSave = false; }
}

export function saveNoteSettings() {
  if (suppressSave || !state.note) return;
  const s: NoteSettings = {
    font: localStorage.getItem(FONT_KEY) ?? undefined,
    size: localStorage.getItem(SIZE_KEY) ?? undefined,
    theme: (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null) ?? undefined,
    lineNumbers: (localStorage.getItem(LINENR_KEY) as 'on' | 'off' | null) ?? undefined,
    wrap: (localStorage.getItem(WRAP_KEY) as 'on' | 'off' | null) ?? undefined,
  };
  localStorage.setItem(noteSettingsKey(state.note.noteKey), JSON.stringify(s));
  touchIndex(state.note.noteKey);
}

export function renameNoteSettings(oldKey: string, newKey: string) {
  const v = localStorage.getItem(noteSettingsKey(oldKey));
  if (v == null) return;
  localStorage.setItem(noteSettingsKey(newKey), v);
  localStorage.removeItem(noteSettingsKey(oldKey));
  const idx = readIndex().filter(x => x !== oldKey);
  idx.push(newKey);
  localStorage.setItem(NOTE_SETTINGS_INDEX, JSON.stringify(idx));
}
