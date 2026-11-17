type PreviewCssListener = (css: string) => void;

let previewCss = '';
const listeners = new Set<PreviewCssListener>();

export function getPreviewCss(): string {
  return previewCss;
}

export function setPreviewCss(css: string): void {
  previewCss = css;
  for (const listener of listeners) {
    listener(css);
  }
}

export function subscribePreviewCss(listener: PreviewCssListener): () => void {
  listeners.add(listener);
  listener(previewCss);
  return () => {
    listeners.delete(listener);
  };
}
