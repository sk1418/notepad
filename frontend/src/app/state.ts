import type { Note } from '../api';
import { NoteSocket } from '../ws';

// Shared mutable state. Kept in one object so modules can read/mutate `note`
// without stale-closure pitfalls.
export const state: { note: Note | null } = { note: null };

export const ws = new NoteSocket();

// Save-timer handle owned by editor.ts, but also touched by keyEditor when
// flushing before rename.
export let saveTimer: number | undefined;
export function setSaveTimer(t: number | undefined) { saveTimer = t; }
export function clearSaveTimer() {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = undefined;
}
