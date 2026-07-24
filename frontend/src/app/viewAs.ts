import { icons } from '../icons';
import { el } from './dom';
import { state } from './state';

let markdownReady: Promise<(src: string) => string> | null = null;
function loadMarkdown() {
  if (!markdownReady) {
    markdownReady = (async () => {
      const [{ marked }, { markedHighlight }, hljsMod, kotlinMod] = await Promise.all([
        import('marked'),
        import('marked-highlight'),
        import('highlight.js/lib/common'),
        import('highlight.js/lib/languages/kotlin'),
      ]);
      const hljs = hljsMod.default;
      if (!hljs.getLanguage('kotlin')) hljs.registerLanguage('kotlin', kotlinMod.default);
      marked.use(markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code: string, lang: string) {
          const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        },
      }));
      return (src: string) => marked.parse(src, { async: false }) as string;
    })();
  }
  return markdownReady;
}

function openBlob(content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function openViewRaw() {
  openBlob(el.editor.value, 'text/plain;charset=utf-8');
}

async function openViewMarkdown() {
  const parse = await loadMarkdown();
  const title = (state.note?.noteKey ?? 'note') + ' — markdown';
  const body = parse(el.editor.value);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:780px;margin:40px auto;padding:0 20px;color:#333}
  pre{background:#002b36;color:#93a1a1;padding:14px 16px;border-radius:6px;overflow:auto;font:14px/1.5 Menlo,Consolas,Monaco,monospace}
  pre code{background:transparent;color:inherit;padding:0;font-size:inherit}
  code{background:#f4f4f4;color:#c7254e;padding:2px 5px;border-radius:3px;font:0.9em Menlo,Consolas,Monaco,monospace}
  blockquote{border-left:4px solid #ddd;margin:0;padding:0 16px;color:#666}
  table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 10px}
  img{max-width:100%}
  h1,h2,h3{border-bottom:1px solid #eee;padding-bottom:.3em}
  a{color:#268bd2}
  /* highlight.js — Solarized Dark */
  .hljs-comment,.hljs-quote{color:#586e75;font-style:italic}
  .hljs-keyword,.hljs-selector-tag,.hljs-literal{color:#859900}
  .hljs-string,.hljs-doctag,.hljs-regexp,.hljs-addition{color:#2aa198}
  .hljs-number,.hljs-meta,.hljs-symbol,.hljs-bullet,.hljs-link{color:#cb4b16}
  .hljs-title,.hljs-section,.hljs-name,.hljs-selector-id,.hljs-selector-class{color:#268bd2}
  .hljs-attribute,.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-class .hljs-title,.hljs-type{color:#b58900}
  .hljs-built_in,.hljs-builtin-name,.hljs-tag{color:#dc322f}
  .hljs-deletion{color:#dc322f}
  .hljs-emphasis{font-style:italic}
  .hljs-strong{font-weight:bold}
</style></head><body>${body}</body></html>`;
  openBlob(html, 'text/html;charset=utf-8');
}

export function initViewMenu() {
  (el.popView.querySelector('summary') as HTMLElement).innerHTML = icons.external;
  el.viewMenu.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    const v = (b as HTMLButtonElement).dataset['view'];
    if (v === 'raw') openViewRaw();
    else if (v === 'md') openViewMarkdown();
    el.popView.open = false;
  });
}
