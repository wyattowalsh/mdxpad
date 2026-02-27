/**
 * CSS Injector
 *
 * Injects custom CSS into the document via style elements.
 * Supports scoped injection (preview pane or full app).
 *
 * @module renderer/features/plugins/css-injector
 */

// ============================================================================
// Types
// ============================================================================

type CssScope = 'app' | 'preview';

interface InjectedStyle {
  id: string;
  element: HTMLStyleElement;
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
  // Remove existing if updating
  removeCss(id);

  const style = document.createElement('style');
  style.setAttribute('data-mdxpad-injected', id);
  style.setAttribute('data-mdxpad-scope', scope);

  if (scope === 'preview') {
    // Scope CSS to the preview container
    style.textContent = wrapWithScope(css, '[data-mdxpad-preview]');
  } else {
    style.textContent = css;
  }

  document.head.appendChild(style);
  injectedStyles.set(id, { id, element: style, scope });
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
  if (existing) {
    existing.element.remove();
    injectedStyles.delete(id);
  }
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
  return injectedStyles.get(id)?.element.textContent ?? undefined;
}

// ============================================================================
// Internals
// ============================================================================

/**
 * Wrap CSS rules with a scope selector.
 * Prepends the scope selector to each rule block.
 */
function wrapWithScope(css: string, scopeSelector: string): string {
  // Simple scope wrapping: wrap all content in a scope block
  return `${scopeSelector} { ${css} }`;
}
