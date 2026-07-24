import { icons } from '../icons';
import { el, toast } from './dom';
import { togglePw } from './login';
import { apiSetPassword } from './api';
import { findNote } from './table';

let activeKey: string | null = null;

export function initPwModal(opts: {
  onUnauthorized: () => void;
  onSaved: () => Promise<void> | void;
}) {
  el.pwEye.innerHTML = icons.eye;
  el.pwClose.innerHTML = icons.x;

  el.pwCancel.addEventListener('click', close);
  el.pwClose.addEventListener('click', close);
  el.pwBackdrop.addEventListener('click', (e) => {
    if (e.target === el.pwBackdrop) close();
  });
  el.pwEye.addEventListener('click', () => togglePw(el.pwInput, el.pwEye));
  el.pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.pwSubmit.click(); });

  el.pwSubmit.addEventListener('click', async () => {
    if (!activeKey) return;
    const key = activeKey;
    const pw = el.pwInput.value;
    const removing = pw.length === 0;
    if (removing && !confirm(`Remove password protection on "${key}"?`)) return;
    const r = await apiSetPassword(key, pw);
    if (r.status === 401) { close(); opts.onUnauthorized(); return; }
    if (!r.ok) {
      el.pwError.textContent = `Failed (${r.status})`;
      el.pwError.classList.remove('hidden');
      return;
    }
    close();
    toast(removing ? 'Password removed' : 'Password saved');
    await opts.onSaved();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.pwBackdrop.classList.contains('hidden')) close();
  });

  return { open, close, isOpen: () => !el.pwBackdrop.classList.contains('hidden') };

  function open(key: string) {
    activeKey = key;
    const n = findNote(key);
    el.pwTitle.textContent = n?.password ? `Change password — ${key}` : `Set password — ${key}`;
    el.pwHint.textContent = n?.password
      ? 'Enter new password, or leave empty to remove.'
      : 'Enter password to protect this note.';
    el.pwInput.value = '';
    el.pwInput.type = 'password';
    el.pwEye.innerHTML = icons.eye;
    el.pwError.classList.add('hidden');
    el.pwBackdrop.classList.remove('hidden');
    setTimeout(() => el.pwInput.focus(), 0);
  }

  function close() {
    el.pwBackdrop.classList.add('hidden');
    activeKey = null;
  }
}
