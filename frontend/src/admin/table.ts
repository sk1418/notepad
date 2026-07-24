import { icons } from '../icons';
import { el, escapeHtml, type NoteSummary } from './dom';

type SortKey = 'size' | 'updated';
type SortDir = 'asc' | 'desc';

let notes: NoteSummary[] = [];
let sortBy: SortKey = 'updated';
let sortDir: SortDir = 'desc';

export function setNotes(n: NoteSummary[]) { notes = n; }
export function getNotes(): NoteSummary[] { return notes; }
export function findNote(key: string): NoteSummary | undefined {
  return notes.find(n => n.noteKey === key);
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

function sorted(): NoteSummary[] {
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

export function selectedKeys(): string[] {
  return Array.from(el.tbody.querySelectorAll<HTMLInputElement>('.row-check:checked'))
    .map(c => c.closest('tr')?.dataset['key'])
    .filter((k): k is string => !!k);
}

export function updateBulkState() {
  const count = selectedKeys().length;
  el.btnDelete.disabled = count === 0;
  el.btnDelete.setAttribute('data-count', count > 0 ? String(count) : '');
  el.btnDelete.setAttribute('data-tooltip', count > 0 ? `Delete ${count} selected` : 'Delete selected');
  Array.from(el.tbody.querySelectorAll('tr')).forEach(tr => {
    const cb = tr.querySelector<HTMLInputElement>('.row-check');
    tr.classList.toggle('selected', !!cb?.checked);
  });
}

export function renderTable() {
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
  const rows = sorted().map(n => {
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

export interface RowHandlers {
  onView(key: string): void;
  onOpen(key: string): void;
  onSetPw(key: string): void;
  onDelete(key: string): void;
}

export function initTable(handlers: RowHandlers) {
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
    if (target.closest('.key-view')) { handlers.onView(key); return; }
    if (target.closest('.act-open')) { handlers.onOpen(key); return; }
    if (target.closest('.act-pw')) { handlers.onSetPw(key); return; }
    if (target.closest('.act-del')) { handlers.onDelete(key); return; }
  });
  document.querySelectorAll<HTMLElement>('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset['sort'] as SortKey;
      if (sortBy === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortBy = key; sortDir = key === 'updated' ? 'desc' : 'asc'; }
      renderTable();
    });
  });
}
