import { injectCss, removeCss } from './css-injector';

export type CustomCssScope = 'app' | 'preview';

export interface SavedCustomCss {
  readonly css: string;
  readonly scope: CustomCssScope;
}

export const CUSTOM_CSS_STORAGE_KEY = 'mdxpad:custom-css';
export const CUSTOM_CSS_ID = 'user-custom-css';

function isScope(value: unknown): value is CustomCssScope {
  return value === 'app' || value === 'preview';
}

export function parseSavedCustomCss(raw: string): SavedCustomCss {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'css' in parsed && 'scope' in parsed) {
      const record = parsed as { css: unknown; scope: unknown };
      if (typeof record.css === 'string' && isScope(record.scope)) {
        return { css: record.css, scope: record.scope };
      }
    }
  } catch {
    // Older saves stored the stylesheet text directly.
  }
  return { css: raw, scope: 'preview' };
}

export function readSavedCustomCss(): SavedCustomCss | null {
  const raw = localStorage.getItem(CUSTOM_CSS_STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  return parseSavedCustomCss(raw);
}

export function writeSavedCustomCss(css: string, scope: CustomCssScope): void {
  localStorage.setItem(CUSTOM_CSS_STORAGE_KEY, JSON.stringify({ css, scope }));
}

export function applySavedCustomCss(): void {
  const saved = readSavedCustomCss();
  if (saved && saved.css.trim().length > 0) {
    injectCss(CUSTOM_CSS_ID, saved.css, saved.scope);
    return;
  }
  removeCss(CUSTOM_CSS_ID);
}
