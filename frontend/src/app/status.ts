import { el } from './dom';
import { state } from './state';
import type { WsState } from '../ws';

export function updateTitle() {
  const base = state.note?.noteKey ?? 'notepad';
  const lock = state.note?.hasPassword ? '🔒 ' : '';
  const off = el.status.textContent === 'offline' ? '⚠ ' : '';
  document.title = `${off}${lock}${base}`;
}

export type Status = WsState | 'saving' | 'saved' | '';

export function setStatus(s: Status) {
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

let toastTimer: number | undefined;
export function showToast(msg: string) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.toast.classList.add('hidden'), 1600);
}
