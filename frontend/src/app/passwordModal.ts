import { icons } from '../icons';
import { InvalidPasswordError, RateLimitedError, setPassword, unlock } from '../api';
import { el } from './dom';
import { state } from './state';
import { updateTitle } from './status';

export type ModalMode = 'set' | 'unlock';
let modalMode: ModalMode = 'set';
let modalDismissable = true;

export function updatePwdIndicator() {
  const on = !!state.note?.hasPassword;
  el.btnPwd.classList.toggle('active', on);
  el.btnPwd.dataset['tooltip'] = on ? 'Change password' : 'Password protect';
}

function toggleEye(btn: HTMLButtonElement, input: HTMLInputElement) {
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.classList.toggle('active', show);
  btn.innerHTML = show ? icons.eyeOff : icons.eye;
  btn.dataset['tooltip'] = show ? 'Hide password' : 'Show password';
  btn.setAttribute('aria-label', btn.dataset['tooltip']!);
  input.focus();
}

function showModalError(msg: string) {
  el.modalError.textContent = msg;
  el.modalError.classList.remove('hidden');
}

export function openModal(mode: ModalMode, opts: { dismissable?: boolean } = {}) {
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
  const changing = mode === 'set' && !!state.note?.hasPassword;
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

export function closeModal() {
  el.backdrop.classList.add('hidden');
}

export function initPasswordModal(opts: {
  onUnlocked: (unlocked: import('../api').Note) => void;
}) {
  el.btnPwd.innerHTML = icons.lock;
  el.modalEye.innerHTML = icons.eye;
  el.modalEyeCurrent.innerHTML = icons.eye;

  el.btnPwd.addEventListener('click', () => openModal('set'));
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
  // Focus trap
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
      const changing = !!state.note?.hasPassword;
      if (!changing && !pwd) return;
      const current = changing ? el.modalCurrent.value : undefined;
      if (changing && !current) { showModalError('Enter current password.'); return; }
      try {
        await setPassword(pwd, current);
        if (state.note) state.note.hasPassword = pwd.length > 0;
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
      if (!pwd || !state.note) return;
      try {
        const unlocked = await unlock(state.note.noteKey, pwd);
        state.note = unlocked;
        opts.onUnlocked(unlocked);
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
}
