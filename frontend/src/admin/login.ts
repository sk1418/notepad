import { icons } from '../icons';
import { el } from './dom';
import { apiLogin } from './api';

function showLoginError(m: string) {
  el.loginError.textContent = m;
  el.loginError.classList.remove('hidden');
}

export function showLogin() {
  el.loginBackdrop.classList.remove('hidden');
  el.loginInput.value = '';
  el.loginError.classList.add('hidden');
  setTimeout(() => el.loginInput.focus(), 0);
}

export function hideLogin() {
  el.loginBackdrop.classList.add('hidden');
}

async function attempt(pw: string): Promise<boolean> {
  const r = await apiLogin(pw);
  if (r.status === 503) { showLoginError('Admin is disabled (NOTEPAD_ADMIN_PW not set).'); return false; }
  if (r.status === 401) { showLoginError('Wrong password.'); return false; }
  if (r.status === 429) { showLoginError('Too many attempts. Wait a few seconds.'); return false; }
  if (!r.ok) { showLoginError(`Login failed (${r.status}).`); return false; }
  return true;
}

export function initLoginModal(onSuccess: () => Promise<void> | void) {
  el.loginEye.innerHTML = icons.eye;

  el.loginSubmit.addEventListener('click', async () => {
    const pw = el.loginInput.value;
    if (!pw) return;
    if (await attempt(pw)) { hideLogin(); await onSuccess(); }
  });
  el.loginInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el.loginSubmit.click();
  });
  el.loginEye.addEventListener('click', () => togglePw(el.loginInput, el.loginEye));
}

export function togglePw(input: HTMLInputElement, btn: HTMLButtonElement) {
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = show ? icons.eyeOff : icons.eye;
  input.focus();
}
