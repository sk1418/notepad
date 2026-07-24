import { icons } from './icons';
import { el, noteUrlFor, showError, toast } from './admin/dom';
import { apiDelete, apiLogout, fetchNotes, fetchStatus } from './admin/api';
import { hideLogin, initLoginModal, showLogin } from './admin/login';
import { initTable, renderTable, selectedKeys, setNotes } from './admin/table';
import { initContentModal } from './admin/contentModal';
import { initPwModal } from './admin/passwordModal';

// Admin page is always light mode
document.documentElement.setAttribute('data-theme', 'light');

// Icons
el.brandIcon.innerHTML = icons.notebook;
el.btnRefresh.innerHTML = icons.refresh;
el.btnDelete.innerHTML = icons.trash;
el.btnLogout.innerHTML = icons.logout;

async function loadNotes(): Promise<void> {
  const r = await fetchNotes();
  if (r.status === 401) { showLogin(); return; }
  if (!r.ok) { showError(`Failed to load notes (${r.status}).`); return; }
  setNotes(await r.json());
  renderTable();
}

async function doDelete(keys: string[]) {
  const r = await apiDelete(keys);
  if (r.status === 401) { showLogin(); return; }
  if (!r.ok) { toast(`Delete failed (${r.status})`); return; }
  const { deleted } = await r.json();
  toast(`Deleted ${deleted}`);
  await loadNotes();
}

async function deleteOne(key: string) {
  if (!confirm(`Delete note "${key}"? This cannot be undone.`)) return;
  await doDelete([key]);
}

// Modals
const contentModal = initContentModal(showLogin);
const pwModal = initPwModal({ onUnauthorized: showLogin, onSaved: loadNotes });

// Table
initTable({
  onView: (key) => contentModal.open(key),
  onOpen: (key) => window.open(noteUrlFor(key), '_blank', 'noopener'),
  onSetPw: (key) => pwModal.open(key),
  onDelete: (key) => deleteOne(key),
});

// Login
initLoginModal(loadNotes);

// Toolbar
el.btnRefresh.addEventListener('click', () => loadNotes());
el.btnLogout.addEventListener('click', async () => {
  await apiLogout();
  setNotes([]);
  renderTable();
  showLogin();
});
el.btnDelete.addEventListener('click', async () => {
  const keys = selectedKeys();
  if (keys.length === 0) return;
  if (!confirm(`Delete ${keys.length} note${keys.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
  await doDelete(keys);
});

// Mirror data-tooltip → aria-label
document.querySelectorAll<HTMLElement>('[data-tooltip]').forEach(n => {
  const t = n.dataset['tooltip'];
  if (t && !n.getAttribute('aria-label')) n.setAttribute('aria-label', t);
});

// Boot
(async () => {
  try {
    const j = await fetchStatus();
    if (!j.enabled) { showError('Admin is disabled. Set NOTEPAD_ADMIN_PW to enable.'); return; }
    if (!j.loggedIn) { showLogin(); return; }
    await loadNotes();
  } catch {
    showError('Could not reach the server.');
  }
})();

// suppress unused-import warning for closeModal side-effects
void hideLogin; void contentModal; void pwModal;
