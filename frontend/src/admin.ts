import { icons } from './icons';

interface NoteSummary {
  id: number;
  noteKey: string;
  preview: string;
  contentLength: number;
  password: string | null;
  readOnlyUrl: string | null;
  lastUpdateTs: string;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const el = {
  brandIcon: document.querySelector('.brand-icon') as HTMLElement,
  loginBackdrop: $('login-backdrop'),
  loginInput: $<HTMLInputElement>('login-input'),
  loginEye: $<HTMLButtonElement>('login-eye'),
  loginSubmit: $<HTMLButtonElement>('login-submit'),
  loginError: $('login-error'),
  table: $<HTMLTableElement>('admin-table'),
  tbody: $<HTMLTableSectionElement>('admin-tbody'),
  checkAll: $<HTMLInputElement>('check-all'),
  empty: $('admin-empty'),
  errorBox: $('admin-error'),
  btnRefresh: $<HTMLButtonElement>('btn-refresh'),
  btnDelete: $<HTMLButtonElement>('btn-delete'),
  btnLogout: $<HTMLButtonElement>('btn-logout'),
  toast: $('toast'),

  contentBackdrop: $('content-backdrop'),
  contentTitle: $('content-title'),
  contentMeta: $('content-meta'),
  contentBody: $<HTMLPreElement>('content-body'),
  contentClose: $<HTMLButtonElement>('content-close'),
  contentOpen: $<HTMLButtonElement>('content-open'),
  contentCopy: $<HTMLButtonElement>('content-copy'),

  pwBackdrop: $('pw-backdrop'),
  pwTitle: $('pw-title'),
  pwHint: $('pw-hint'),
  pwInput: $<HTMLInputElement>('pw-input'),
  pwEye: $<HTMLButtonElement>('pw-eye'),
  pwSubmit: $<HTMLButtonElement>('pw-submit'),
  pwCancel: $<HTMLButtonElement>('pw-cancel'),
  pwClose: $<HTMLButtonElement>('pw-close'),
  pwError: $('pw-error'),
};

el.brandIcon.innerHTML = icons.notebook;
el.loginEye.innerHTML = icons.eye;
el.pwEye.innerHTML = icons.eye;
el.contentClose.innerHTML = icons.x;
el.pwClose.innerHTML = icons.x;
el.btnRefresh.innerHTML = icons.refresh;
el.btnDelete.innerHTML = icons.trash;
el.btnLogout.innerHTML = icons.logout;

// Admin page is always light mode
document.documentElement.setAttribute('data-theme', 'light');

let notes: NoteSummary[] = [];
let activePwKey: string | null = null;
let activeContentKey: string | null = null;
type SortKey = 'size' | 'updated';
type SortDir = 'asc' | 'desc';
let sortBy: SortKey = 'updated';
let sortDir: SortDir = 'desc';

function showError(msg: string) {
  el.errorBox.textContent = msg;
  el.errorBox.classList.remove('hidden');
  el.table.classList.add('hidden');
  el.empty.classList.add('hidden');
}

let toastTimer: number | undefined;
function toast(msg: string) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.toast.classList.add('hidden'), 1800);
}

function fmtTs(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
}

function noteUrlFor(key: string): string {
  return `${location.origin}/${encodeURIComponent(key)}`;
}

function sortedNotes(): NoteSummary[] {
  const arr = notes.slice();
  const cmp = sortBy === 'size'
    ? (a: NoteSummary, b: NoteSummary) => a.contentLength - b.contentLength
    : (a: NoteSummary, b: NoteSummary) => Date.parse(a.lastUpdateTs) - Date.parse(b.lastUpdateTs);
  arr.sort((a, b) => sortDir === 'asc' ? cmp(a, b) : cmp(b, a));
  return arr;
}

function updateSortIndicators() {
  document.querySelectorAll<HTMLElement>('th.sortable').forEach(th => {
    const key = th.dataset['sort'] as SortKey;
    const ind = th.querySelector<HTMLElement>('.sort-ind');
    if (key === sortBy) {
      th.classList.add('sort-active');
      if (ind) ind.textContent = sortDir === 'asc' ? '▲' : '▼';
    } else {
      th.classList.remove('sort-active');
      if (ind) ind.textContent = '';
    }
  });
}

document.querySelectorAll<HTMLElement>('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset['sort'] as SortKey;
    if (sortBy === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortBy = key; sortDir = key === 'updated' ? 'desc' : 'asc'; }
    renderTable();
  });
});

function renderTable() {
  if (notes.length === 0) {
    el.table.classList.add('hidden');
    el.empty.classList.remove('hidden');
    el.errorBox.classList.add('hidden');
    updateBulkState();
    updateSortIndicators();
    return;
  }
  el.errorBox.classList.add('hidden');
  el.empty.classList.add('hidden');
  el.table.classList.remove('hidden');
  const rows = sortedNotes().map(n => {
    const flags = [
      n.password ? '<span class="badge pw" title="Password-protected">pw</span>' : '',
      n.readOnlyUrl ? '<span class="badge share" title="Read-only share link exists">share</span>' : '',
    ].join('');
    const pwCell = n.password
      ? `<code class="pw-val" title="Cleartext password">${escapeHtml(n.password)}</code>`
      : '<span class="muted">—</span>';
    const shareCell = n.readOnlyUrl
      ? `<a class="note-link" href="/share/${encodeURIComponent(n.readOnlyUrl)}" target="_blank" rel="noopener noreferrer">/share/${escapeHtml(n.readOnlyUrl)}</a>`
      : '<span class="muted">—</span>';
    return `<tr data-key="${escapeHtml(n.noteKey)}">
      <td class="col-check"><input type="checkbox" class="row-check" aria-label="Select ${escapeHtml(n.noteKey)}"></td>
      <td class="col-key">
        <button type="button" class="link-btn key-view" title="View content">${escapeHtml(n.noteKey)}</button>
        <span class="flags">${flags}</span>
      </td>
      <td class="col-size">${fmtSize(n.contentLength)}</td>
      <td class="col-pw">${pwCell}</td>
      <td class="col-share">${shareCell}</td>
      <td class="col-time">${fmtTs(n.lastUpdateTs)}</td>
      <td class="col-actions">
        <div class="row-actions">
          <button type="button" class="icon-btn small act-open" title="Open in new tab" aria-label="Open">${icons.external}</button>
          <button type="button" class="icon-btn small act-pw" title="Set / change password" aria-label="Set password">${icons.lock}</button>
          <button type="button" class="icon-btn small danger act-del" title="Delete note" aria-label="Delete">${icons.trash}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  el.tbody.innerHTML = rows;
  el.checkAll.checked = false;
  updateBulkState();
  updateSortIndicators();
}

function selectedKeys(): string[] {
  return Array.from(el.tbody.querySelectorAll<HTMLInputElement>('.row-check:checked'))
    .map(c => c.closest('tr')?.dataset['key'])
    .filter((k): k is string => !!k);
}

function updateBulkState() {
  const count = selectedKeys().length;
  el.btnDelete.disabled = count === 0;
  el.btnDelete.setAttribute('data-count', count > 0 ? String(count) : '');
  el.btnDelete.setAttribute('data-tooltip', count > 0 ? `Delete ${count} selected` : 'Delete selected');
  Array.from(el.tbody.querySelectorAll('tr')).forEach(tr => {
    const cb = tr.querySelector<HTMLInputElement>('.row-check');
    tr.classList.toggle('selected', !!cb?.checked);
  });
}

el.tbody.addEventListener('change', (e) => {
  if ((e.target as HTMLElement).classList.contains('row-check')) updateBulkState();
});
el.checkAll.addEventListener('change', () => {
  el.tbody.querySelectorAll<HTMLInputElement>('.row-check').forEach(c => { c.checked = el.checkAll.checked; });
  updateBulkState();
});

el.tbody.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const tr = target.closest('tr');
  const key = tr?.dataset['key'];
  if (!key) return;
  if (target.closest('.key-view')) { openContentModal(key); return; }
  if (target.closest('.act-open')) { window.open(noteUrlFor(key), '_blank', 'noopener'); return; }
  if (target.closest('.act-pw')) { openPwModal(key); return; }
  if (target.closest('.act-del')) { deleteOne(key); return; }
});

async function loadNotes(): Promise<void> {
  const r = await fetch('/admin/notes');
  if (r.status === 401) { showLogin(); return; }
  if (!r.ok) { showError(`Failed to load notes (${r.status}).`); return; }
  notes = await r.json();
  renderTable();
}

async function login(pw: string): Promise<boolean> {
  const r = await fetch('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw }),
  });
  if (r.status === 503) { showLoginError('Admin is disabled (NOTEPAD_ADMIN_PW not set).'); return false; }
  if (r.status === 401) { showLoginError('Wrong password.'); return false; }
  if (r.status === 429) { showLoginError('Too many attempts. Wait a few seconds.'); return false; }
  if (!r.ok) { showLoginError(`Login failed (${r.status}).`); return false; }
  return true;
}

function showLogin() {
  el.loginBackdrop.classList.remove('hidden');
  el.loginInput.value = '';
  el.loginError.classList.add('hidden');
  setTimeout(() => el.loginInput.focus(), 0);
}
function hideLogin() { el.loginBackdrop.classList.add('hidden'); }
function showLoginError(m: string) { el.loginError.textContent = m; el.loginError.classList.remove('hidden'); }

el.loginSubmit.addEventListener('click', async () => {
  const pw = el.loginInput.value;
  if (!pw) return;
  const ok = await login(pw);
  if (ok) { hideLogin(); await loadNotes(); }
});
el.loginInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.loginSubmit.click(); });
el.loginEye.addEventListener('click', () => togglePw(el.loginInput, el.loginEye));
el.pwEye.addEventListener('click', () => togglePw(el.pwInput, el.pwEye));

function togglePw(input: HTMLInputElement, btn: HTMLButtonElement) {
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = show ? icons.eyeOff : icons.eye;
  input.focus();
}

el.btnRefresh.addEventListener('click', () => loadNotes());

el.btnLogout.addEventListener('click', async () => {
  await fetch('/admin/logout', { method: 'POST' });
  notes = [];
  renderTable();
  showLogin();
});

el.btnDelete.addEventListener('click', async () => {
  const keys = selectedKeys();
  if (keys.length === 0) return;
  if (!confirm(`Delete ${keys.length} note${keys.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
  await doDelete(keys);
});

async function deleteOne(key: string) {
  if (!confirm(`Delete note "${key}"? This cannot be undone.`)) return;
  await doDelete([key]);
}

async function doDelete(keys: string[]) {
  const r = await fetch('/admin/notes/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
  if (r.status === 401) { showLogin(); return; }
  if (!r.ok) { toast(`Delete failed (${r.status})`); return; }
  const { deleted } = await r.json();
  toast(`Deleted ${deleted}`);
  await loadNotes();
}

// ---- Content modal ----
async function openContentModal(key: string) {
  activeContentKey = key;
  el.contentTitle.textContent = key;
  el.contentBody.textContent = 'Loading…';
  el.contentMeta.textContent = '';
  el.contentBackdrop.classList.remove('hidden');
  try {
    const r = await fetch(`/admin/notes/${encodeURIComponent(key)}/content`);
    if (r.status === 401) { closeContentModal(); showLogin(); return; }
    if (!r.ok) { el.contentBody.textContent = `Failed to load (${r.status})`; return; }
    const { content } = await r.json();
    el.contentBody.textContent = content || '';
    el.contentMeta.textContent = `${content.length} chars`;
  } catch (e) {
    el.contentBody.textContent = 'Network error';
  }
}
function closeContentModal() {
  el.contentBackdrop.classList.add('hidden');
  activeContentKey = null;
}
el.contentClose.addEventListener('click', closeContentModal);
el.contentBackdrop.addEventListener('click', (e) => {
  if (e.target === el.contentBackdrop) closeContentModal();
});
el.contentOpen.addEventListener('click', () => {
  if (activeContentKey) window.open(noteUrlFor(activeContentKey), '_blank', 'noopener');
});
el.contentCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el.contentBody.textContent || '');
    toast('Copied');
  } catch { toast('Copy failed'); }
});

// ---- Password modal ----
function openPwModal(key: string) {
  activePwKey = key;
  const n = notes.find(x => x.noteKey === key);
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
function closePwModal() {
  el.pwBackdrop.classList.add('hidden');
  activePwKey = null;
}
el.pwCancel.addEventListener('click', closePwModal);
el.pwClose.addEventListener('click', closePwModal);
el.pwBackdrop.addEventListener('click', (e) => {
  if (e.target === el.pwBackdrop) closePwModal();
});
el.pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.pwSubmit.click(); });
el.pwSubmit.addEventListener('click', async () => {
  if (!activePwKey) return;
  const key = activePwKey;
  const pw = el.pwInput.value;
  const removing = pw.length === 0;
  if (removing && !confirm(`Remove password protection on "${key}"?`)) return;
  const r = await fetch(`/admin/notes/${encodeURIComponent(key)}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw }),
  });
  if (r.status === 401) { closePwModal(); showLogin(); return; }
  if (!r.ok) {
    el.pwError.textContent = `Failed (${r.status})`;
    el.pwError.classList.remove('hidden');
    return;
  }
  closePwModal();
  toast(removing ? 'Password removed' : 'Password saved');
  await loadNotes();
});

// Esc closes any open modal
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!el.contentBackdrop.classList.contains('hidden')) closeContentModal();
  else if (!el.pwBackdrop.classList.contains('hidden')) closePwModal();
});

// Mirror data-tooltip → aria-label
document.querySelectorAll<HTMLElement>('[data-tooltip]').forEach(n => {
  const t = n.dataset['tooltip'];
  if (t && !n.getAttribute('aria-label')) n.setAttribute('aria-label', t);
});

// Boot: probe status
(async () => {
  try {
    const r = await fetch('/admin/status');
    const j = await r.json();
    if (!j.enabled) { showError('Admin is disabled. Set NOTEPAD_ADMIN_PW to enable.'); return; }
    if (!j.loggedIn) { showLogin(); return; }
    await loadNotes();
  } catch (e) {
    showError('Could not reach the server.');
  }
})();
