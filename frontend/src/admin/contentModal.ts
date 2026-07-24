import { icons } from '../icons';
import { el, noteUrlFor, toast } from './dom';
import { apiGetContent } from './api';

let activeKey: string | null = null;

export function initContentModal(onUnauthorized: () => void) {
  el.contentClose.innerHTML = icons.x;

  el.contentClose.addEventListener('click', close);
  el.contentBackdrop.addEventListener('click', (e) => {
    if (e.target === el.contentBackdrop) close();
  });
  el.contentOpen.addEventListener('click', () => {
    if (activeKey) window.open(noteUrlFor(activeKey), '_blank', 'noopener');
  });
  el.contentCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(el.contentBody.textContent || '');
      toast('Copied');
    } catch { toast('Copy failed'); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.contentBackdrop.classList.contains('hidden')) close();
  });

  return { open, close, isOpen: () => !el.contentBackdrop.classList.contains('hidden') };

  async function open(key: string) {
    activeKey = key;
    el.contentTitle.textContent = key;
    el.contentBody.textContent = 'Loading…';
    el.contentMeta.textContent = '';
    el.contentBackdrop.classList.remove('hidden');
    try {
      const r = await apiGetContent(key);
      if (r.status === 401) { close(); onUnauthorized(); return; }
      if (!r.ok) { el.contentBody.textContent = `Failed to load (${r.status})`; return; }
      const { content } = await r.json();
      el.contentBody.textContent = content || '';
      el.contentMeta.textContent = `${content.length} chars`;
    } catch {
      el.contentBody.textContent = 'Network error';
    }
  }

  function close() {
    el.contentBackdrop.classList.add('hidden');
    activeKey = null;
  }
}
