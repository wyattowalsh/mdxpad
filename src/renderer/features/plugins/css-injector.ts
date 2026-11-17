/**
 * CSS Injector
 *
 * Injects custom CSS into the document via style elements.
 * Preview CSS is delivered to the preview document, because the
 * rendered page lives in a frame the app stylesheet cannot reach.
 *
 * @module renderer/features/plugins/css-injector
 */

import { setPreviewCss } from './preview-css';

// ============================================================================
// Types
// ============================================================================

type CssScope = 'app' | 'preview';

interface InjectedStyle {
  id: string;
  element: HTMLStyleElement | null;
  css: string;
  scope: CssScope;
}

// ============================================================================
// State
// ============================================================================

const injectedStyles = new Map<string, InjectedStyle>();

// ============================================================================
// Public API
// ============================================================================

/**
 * Inject custom CSS into the document.
 *
 * @param id - Unique identifier for this style injection
 * @param css - CSS string to inject
 * @param scope - Where to apply: 'app' (full application) or 'preview' (preview pane only)
 */
export function injectCss(id: string, css: string, scope: CssScope = 'app'): void {
  removeCss(id);

  if (scope === 'preview') {
    setPreviewCss(css);
    injectedStyles.set(id, { id, element: null, css, scope });
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-mdxpad-injected', id);
  style.setAttribute('data-mdxpad-scope', scope);
  style.textContent = css;
  document.head.appendChild(style);
  injectedStyles.set(id, { id, element: style, css, scope });
}

/**
 * Update an existing injected CSS. Creates it if it doesn't exist.
 */
export function updateCss(id: string, css: string, scope: CssScope = 'app'): void {
  injectCss(id, css, scope);
}

/**
 * Remove an injected CSS by its ID.
 */
export function removeCss(id: string): void {
  const existing = injectedStyles.get(id);
  if (!existing) {
    return;
  }
  existing.element?.remove();
  if (existing.scope === 'preview') {
    setPreviewCss('');
  }
  injectedStyles.delete(id);
}

/**
 * Remove all injected CSS.
 */
export function removeAllCss(): void {
  for (const [id] of injectedStyles) {
    removeCss(id);
  }
}

/**
 * Get all currently injected style IDs.
 */
export function getInjectedIds(): string[] {
  return Array.from(injectedStyles.keys());
}

/**
 * Get the CSS content for an injected style.
 */
export function getInjectedCss(id: string): string | undefined {
  return injectedStyles.get(id)?.css;
}
