import { generateShare } from '../api';
import { icons } from '../icons';
import { el } from './dom';
import { state } from './state';
import { showToast } from './status';

export function initShare() {
  el.btnShare.innerHTML = icons.link;
  el.btnShare.addEventListener('click', async () => {
    if (!state.note) return;
    try {
      if (!state.note.readOnlyUrl) state.note.readOnlyUrl = await generateShare();
      const url = `${location.origin}/share/${state.note.readOnlyUrl}`;
      await navigator.clipboard.writeText(url);
      showToast('link copied');
    } catch {
      showToast('share failed');
    }
  });
}
