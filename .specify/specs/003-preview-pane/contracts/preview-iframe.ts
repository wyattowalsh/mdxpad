/**
 * Preview Iframe Contract
 *
 * Defines the postMessage interface between the parent renderer and the
 * sandboxed preview iframe. Communication is UNIDIRECTIONAL:
 *
 * - Parent → Iframe: Render commands, theme changes, scroll sync
 * - Iframe → Parent: Ready signal, size updates, runtime errors
 *
 * NO data queries from iframe to parent (per FR-018).
 *
 * @module contracts/preview-iframe
 */

// ============================================================================
// Parent → Iframe Messages
// ============================================================================

/**
 * All message types sent from parent to preview iframe.
 * Discriminated union on `type` field.
 */
export type ParentToIframeMessage =
  | RenderCommand
  | ThemeCommand
  | ScrollCommand;

/**
 * Command to render compiled MDX in the iframe.
 *
 * @example
 * ```typescript
 * iframe.contentWindow?.postMessage({
 *   type: 'render',
 *   code: compiledJavaScript,
 *   frontmatter: { title: 'My Doc' },
 * }, '*');
 * ```
 */
export interface RenderCommand {
  readonly type: 'render';

  /**
   * Compiled MDX JavaScript code.
   * Will be evaluated via `new Function()` in the iframe.
   */
  readonly code: string;

  /**
   * Parsed frontmatter for component access.
   */
  readonly frontmatter: Record<string, unknown>;
}

/**
 * Command to update the preview theme.
 * Does NOT require re-compilation (per SC-007).
 */
export interface ThemeCommand {
  readonly type: 'theme';

  /** Theme value to apply */
  readonly value: 'light' | 'dark';
}

/**
 * Command to synchronize scroll position.
 * Iframe scrolls to proportional position.
 */
export interface ScrollCommand {
  readonly type: 'scroll';

  /**
   * Scroll position as ratio (0-1).
   * 0 = top, 1 = bottom.
   */
  readonly ratio: number;
}

// ============================================================================
// Iframe → Parent Messages
// ============================================================================

/**
 * All message types sent from iframe to parent.
 * Discriminated union on `type` field.
 *
 * IMPORTANT: These are SIGNALS only, not data queries.
 * The iframe MUST NOT request data from the parent.
 */
export type IframeToParentMessage =
  | ReadySignal
  | SizeSignal
  | RuntimeErrorSignal;

/**
 * Signal sent when iframe is ready to receive render commands.
 * Parent should wait for this before sending first render.
 */
export interface ReadySignal {
  readonly type: 'ready';
}

/**
 * Signal sent when rendered content height changes.
 * Parent can use this to adjust iframe height (optional).
 */
export interface SizeSignal {
  readonly type: 'size';

  /** Content height in pixels */
  readonly height: number;
}

/**
 * Signal sent when a runtime error occurs during MDX rendering.
 * This is for errors that occur AFTER successful compilation
 * (e.g., component throws during render).
 */
export interface RuntimeErrorSignal {
  readonly type: 'runtime-error';

  /** Error message */
  readonly message: string;

  /** React component stack trace (if available) */
  readonly componentStack?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for parent-to-iframe messages.
 */
export function isParentToIframeMessage(
  message: unknown
): message is ParentToIframeMessage {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;
  return msg.type === 'render' || msg.type === 'theme' || msg.type === 'scroll';
}

/**
 * Type guard for iframe-to-parent messages.
 */
export function isIframeToParentMessage(
  message: unknown
): message is IframeToParentMessage {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;
  return (
    msg.type === 'ready' ||
    msg.type === 'size' ||
    msg.type === 'runtime-error'
  );
}

/**
 * Type guard for render command.
 */
export function isRenderCommand(
  message: ParentToIframeMessage
): message is RenderCommand {
  return message.type === 'render';
}

/**
 * Type guard for theme command.
 */
export function isThemeCommand(
  message: ParentToIframeMessage
): message is ThemeCommand {
  return message.type === 'theme';
}

/**
 * Type guard for scroll command.
 */
export function isScrollCommand(
  message: ParentToIframeMessage
): message is ScrollCommand {
  return message.type === 'scroll';
}

/**
 * Type guard for runtime error signal.
 */
export function isRuntimeErrorSignal(
  message: IframeToParentMessage
): message is RuntimeErrorSignal {
  return message.type === 'runtime-error';
}

// ============================================================================
// Security Constants
// ============================================================================

/**
 * Required sandbox attribute for preview iframe.
 * Per FR-002: only allow-scripts, no same-origin.
 */
export const IFRAME_SANDBOX = 'allow-scripts';

/**
 * Content Security Policy for preview iframe.
 * Per FR-017.
 */
export const IFRAME_CSP =
  "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data: https:; connect-src 'none';";

/**
 * Iframe title for accessibility.
 */
export const IFRAME_TITLE = 'MDX Preview';
