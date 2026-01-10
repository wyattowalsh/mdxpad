/**
 * Preview Iframe Message Types
 *
 * Defines the postMessage interface between parent renderer and sandboxed preview iframe.
 * Communication is UNIDIRECTIONAL per FR-018.
 * @module shared/types/preview-iframe
 */

// ============================================================================
// Parent → Iframe Messages
// ============================================================================

/** All message types sent from parent to preview iframe */
export type ParentToIframeMessage = RenderCommand | ThemeCommand | ScrollCommand;

/** Command to render compiled MDX in the iframe */
export interface RenderCommand {
  readonly type: 'render';
  /** Compiled MDX JavaScript code */
  readonly code: string;
  /** Parsed frontmatter for component access */
  readonly frontmatter: Readonly<Record<string, unknown>>;
}

/** Command to update the preview theme */
export interface ThemeCommand {
  readonly type: 'theme';
  /** Theme value to apply */
  readonly value: 'light' | 'dark';
}

/** Command to synchronize scroll position */
export interface ScrollCommand {
  readonly type: 'scroll';
  /** Scroll position as ratio (0-1) */
  readonly ratio: number;
}

// ============================================================================
// Iframe → Parent Messages
// ============================================================================

/** All message types sent from iframe to parent (signals only, no data queries) */
export type IframeToParentMessage = ReadySignal | SizeSignal | RuntimeErrorSignal;

/** Signal sent when iframe is ready to receive render commands */
export interface ReadySignal {
  readonly type: 'ready';
}

/** Signal sent when rendered content height changes */
export interface SizeSignal {
  readonly type: 'size';
  /** Content height in pixels */
  readonly height: number;
}

/** Signal sent when a runtime error occurs during MDX rendering */
export interface RuntimeErrorSignal {
  readonly type: 'runtime-error';
  /** Error message */
  readonly message: string;
  /** React component stack trace (if available) */
  readonly componentStack?: string | undefined;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for parent-to-iframe messages.
 *
 * @param message - Unknown message to validate
 * @returns True if message is a valid ParentToIframeMessage
 */
export function isParentToIframeMessage(
  message: unknown
): message is ParentToIframeMessage {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as { type?: unknown };
  return msg.type === 'render' || msg.type === 'theme' || msg.type === 'scroll';
}

/**
 * Type guard for iframe-to-parent messages.
 *
 * @param message - Unknown message to validate
 * @returns True if message is a valid IframeToParentMessage
 */
export function isIframeToParentMessage(
  message: unknown
): message is IframeToParentMessage {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as { type?: unknown };
  return msg.type === 'ready' || msg.type === 'size' || msg.type === 'runtime-error';
}

// ============================================================================
// Individual Message Type Guards
// ============================================================================

/**
 * Type guard for RenderCommand messages.
 */
export function isRenderCommand(message: unknown): message is RenderCommand {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;
  return (
    msg.type === 'render' &&
    typeof msg.code === 'string' &&
    typeof msg.frontmatter === 'object' &&
    msg.frontmatter !== null
  );
}

/**
 * Type guard for ThemeCommand messages.
 */
export function isThemeCommand(message: unknown): message is ThemeCommand {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;
  return msg.type === 'theme' && (msg.value === 'light' || msg.value === 'dark');
}

/**
 * Type guard for ScrollCommand messages.
 */
export function isScrollCommand(message: unknown): message is ScrollCommand {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;
  return msg.type === 'scroll' && typeof msg.ratio === 'number';
}

/**
 * Type guard for ReadySignal messages.
 */
export function isReadySignal(message: unknown): message is ReadySignal {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;
  return msg.type === 'ready';
}

/**
 * Type guard for SizeSignal messages.
 */
export function isSizeSignal(message: unknown): message is SizeSignal {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;
  return msg.type === 'size' && typeof msg.height === 'number';
}

/**
 * Type guard for RuntimeErrorSignal messages.
 */
export function isRuntimeErrorSignal(message: unknown): message is RuntimeErrorSignal {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;
  return (
    msg.type === 'runtime-error' &&
    typeof msg.message === 'string' &&
    (msg.componentStack === undefined || typeof msg.componentStack === 'string')
  );
}

// ============================================================================
// Exhaustive Checking
// ============================================================================

/**
 * Helper for exhaustive discriminated union checking.
 * Use in switch/if-else default cases to ensure all union members are handled.
 *
 * @param value - Value that should be of type never (compile-time check)
 * @param message - Optional custom error message
 * @returns Never (always throws)
 * @throws TypeError if called with a non-never value (indicates unhandled case)
 */
export function assertNever(value: never, message?: string): never {
  throw new TypeError(
    message ?? `Unhandled discriminated union member: ${JSON.stringify(value)}`
  );
}

// ============================================================================
// Security Constants
// ============================================================================

/** Required sandbox attribute for preview iframe (per FR-002) */
export const IFRAME_SANDBOX = 'allow-scripts' as const;

/** Content Security Policy for preview iframe (per FR-017, Constitution III.5) */
export const IFRAME_CSP = "default-src 'none'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'none'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'self';" as const;

/** Iframe title for accessibility */
export const IFRAME_TITLE = 'MDX Preview' as const;
