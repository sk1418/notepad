import { icons } from '../icons';
import { KeyTakenError, RateLimitedError, setNoteKey } from '../api';
import { el, KEY_PATTERN } from './dom';
import { state, ws, clearSaveTimer } from './state';
import { setStatus, updateTitle } from './status';
import { renameNoteSettings } from './settings';

export function initKeyEditor() {
  el.btnEditKey.innerHTML = icons.pencil;
  el.btnEditKey.addEventListener('click', () => {
    el.key.focus();
    el.key.select();
  });

  el.key.addEventListener('change', async () => {
    const next = el.key.value.trim();
    if (!state.note || !next || next === state.note.noteKey) {
      if (state.note) el.key.value = state.note.noteKey;
      return;
    }
    if (!KEY_PATTERN.test(next)) {
      alert('Invalid key. Allowed: letters, digits, . _ - (max 64).');
      el.key.value = state.note.noteKey;
      return;
    }
    // Flush any pending edit to old key first
    clearSaveTimer();
    if (ws.send(el.editor.value)) setStatus('saved');
    try {
      await setNoteKey(next);
      const oldKey = state.note.noteKey;
      state.note.noteKey = next;
      renameNoteSettings(oldKey, next);
      history.replaceState(null, '', '/' + next);
      updateTitle();
      ws.connect(next);
    } catch (err) {
      if (err instanceof KeyTakenError) alert('That key is already taken.');
      else if (err instanceof RateLimitedError) alert('Too many requests. Wait a few seconds.');
      else alert('Could not rename.');
      el.key.value = state.note.noteKey;
    }
  });
}
