import { sanitizePreviewStyleSheet } from './preview-href';

const PREVIEW_STYLE_ID = 'mdxpad-preview-css';

/** Apply user CSS inside the preview document. textContent avoids HTML parsing. */
export function applyPreviewCss(css: string): void {
  const existing = document.getElementById(PREVIEW_STYLE_ID);
  if (css.trim().length === 0) {
    existing?.remove();
    return;
  }
  const style = existing instanceof HTMLStyleElement ? existing : document.createElement('style');
  style.id = PREVIEW_STYLE_ID;
  style.textContent = sanitizePreviewStyleSheet(css);
  if (!existing) {
    document.head.appendChild(style);
  }
}
