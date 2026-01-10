/**
 * Preview Frame Component
 *
 * Renders a sandboxed iframe for secure MDX preview rendering.
 * Handles postMessage communication with the iframe for render commands and signals.
 *
 * ## Architecture
 *
 * ```
 * PreviewFrame (parent)                    Sandboxed Iframe
 * ┌─────────────────────┐                  ┌─────────────────────┐
 * │                     │   RenderCommand  │                     │
 * │  useIframeSender    │ ───────────────▶ │  handleMessage()    │
 * │                     │   ThemeCommand   │                     │
 * │  - sendRender()     │ ───────────────▶ │  - renderContent()  │
 * │  - sendTheme()      │   ScrollCommand  │  - applyTheme()     │
 * │  - sendScroll()     │ ───────────────▶ │  - scrollToRatio()  │
 * │                     │                  │                     │
 * │  useIframeMessage   │   ReadySignal    │  sendReadySignal()  │
 * │  Handler()          │ ◀─────────────── │                     │
 * │                     │   SizeSignal     │  ResizeObserver     │
 * │  - onReady          │ ◀─────────────── │                     │
 * │  - onSizeChange     │   ErrorSignal    │  ErrorBoundary      │
 * │  - onRuntimeError   │ ◀─────────────── │                     │
 * └─────────────────────┘                  └─────────────────────┘
 * ```
 *
 * ## Security
 *
 * The iframe runs with strict sandboxing:
 * - `sandbox="allow-scripts"` - Only allows JavaScript execution
 * - No access to parent DOM, cookies, or storage
 * - Strict CSP prevents network requests and external resources
 *
 * ## Message Flow
 *
 * 1. Iframe loads and sends `ready` signal
 * 2. Parent sends current `code`, `theme`, and `scrollRatio`
 * 3. On prop changes, parent sends updated commands
 * 4. Iframe responds with `size` signals on content change
 * 5. Runtime errors are caught and sent as `runtime-error` signals
 *
 * @example
 * ```tsx
 * <PreviewFrame
 *   code={compiledMdx}
 *   frontmatter={{ title: 'My Doc' }}
 *   theme="dark"
 *   scrollRatio={0.5}
 *   onReady={() => console.log('Ready!')}
 *   onRuntimeError={(msg) => console.error(msg)}
 * />
 * ```
 *
 * @module renderer/components/preview/PreviewFrame
 * @see {@link PreviewPane} - Parent container component
 * @see {@link IFRAME_SANDBOX} - Sandbox attribute value
 * @see {@link IFRAME_CSP} - Content Security Policy
 */

import * as React from 'react';
import { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  IFRAME_SANDBOX,
  IFRAME_TITLE,
  assertNever,
  type RenderCommand,
  type ThemeCommand,
  type ScrollCommand,
  type IframeToParentMessage,
} from '@shared/types/preview-iframe';
import {
  createSecureMessageHandler,
  validateIframeToParentMessage,
  createRateLimiter,
  type RateLimiter,
} from '@shared/security';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the PreviewFrame component.
 *
 * @example
 * ```tsx
 * <PreviewFrame
 *   code={compiledMdxCode}
 *   frontmatter={{ title: 'My Document', author: 'Jane Doe' }}
 *   theme="dark"
 *   scrollRatio={0.5}
 *   onReady={() => setLoading(false)}
 *   onSizeChange={(height) => setContentHeight(height)}
 *   onRuntimeError={(msg, stack) => console.error(msg, stack)}
 * />
 * ```
 */
export interface PreviewFrameProps {
  /**
   * Compiled MDX JavaScript code to render.
   *
   * This should be the output from the MDX compiler (function body format).
   * The code is evaluated inside the sandboxed iframe using `new Function()`.
   *
   * Pass `undefined` to clear the preview (no content rendered).
   */
  readonly code?: string | undefined;

  /**
   * Parsed frontmatter from the MDX document.
   *
   * Available to components via the `frontmatter` prop.
   * Common fields: `title`, `description`, `author`, `date`, etc.
   *
   * @example { title: 'My Post', tags: ['react', 'mdx'] }
   */
  readonly frontmatter?: Record<string, unknown> | undefined;

  /**
   * Scroll position as a ratio (0-1) for synchronization.
   *
   * - `0` = top of document
   * - `1` = bottom of document
   *
   * Updates are throttled via `requestAnimationFrame`.
   * Respects user's `prefers-reduced-motion` preference.
   */
  readonly scrollRatio?: number | undefined;

  /**
   * Theme for preview rendering.
   *
   * Sets the `data-theme` attribute on the iframe's document root.
   * CSS custom properties respond to theme changes.
   */
  readonly theme?: 'light' | 'dark' | undefined;

  /**
   * Callback when iframe is ready to receive commands.
   *
   * Called after the iframe sends its `ready` signal (typically < 100ms).
   * Safe to render content after this callback fires.
   */
  readonly onReady?: (() => void) | undefined;

  /**
   * Callback when rendered content height changes.
   *
   * Triggered by ResizeObserver inside the iframe.
   * Use this to adjust parent container height if needed.
   *
   * @param height - Content height in pixels
   */
  readonly onSizeChange?: ((height: number) => void) | undefined;

  /**
   * Callback when a runtime error occurs during MDX rendering.
   *
   * Errors are caught by the ErrorBoundary inside the iframe.
   * Includes React component stack when available.
   *
   * @param message - Error message
   * @param componentStack - React component stack trace (may be undefined)
   *
   * @example
   * ```tsx
   * onRuntimeError={(message, componentStack) => {
   *   errorReporter.capture(new Error(message), { componentStack });
   * }}
   * ```
   */
  readonly onRuntimeError?: ((message: string, componentStack?: string) => void) | undefined;

  /**
   * CSS class for additional styling.
   *
   * Applied to the iframe element.
   */
  readonly className?: string | undefined;
}

// ============================================================================
// Constants
// ============================================================================

const READY_TIMEOUT_MS = 5000;
const PREVIEW_FRAME_SRC = new URL('../../preview-frame/index.html', import.meta.url).href;

// ============================================================================
// Hooks
// ============================================================================

/** Hook for sending messages to the iframe */
function useIframeSender(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  isReadyRef: React.RefObject<boolean>
) {
  const sendMessage = useCallback(
    (message: RenderCommand | ThemeCommand | ScrollCommand): void => {
      if (iframeRef.current?.contentWindow && isReadyRef.current) {
        iframeRef.current.contentWindow.postMessage(message, '*');
      }
    },
    [iframeRef, isReadyRef]
  );

  return {
    sendRender: useCallback(
      (code: string, frontmatter: Record<string, unknown>) =>
        sendMessage({ type: 'render', code, frontmatter }),
      [sendMessage]
    ),
    sendTheme: useCallback(
      (value: 'light' | 'dark') => sendMessage({ type: 'theme', value }),
      [sendMessage]
    ),
    sendScroll: useCallback(
      (ratio: number) => sendMessage({ type: 'scroll', ratio }),
      [sendMessage]
    ),
  };
}

/** Handle ready message from iframe */
function handleReadyMessage(
  readyTimeoutRef: React.RefObject<number | null>,
  isReadyRef: React.RefObject<boolean>,
  callbacks: { onReady?: (() => void) | undefined },
  sender: ReturnType<typeof useIframeSender>,
  refs: { code?: string | undefined; frontmatter?: Record<string, unknown> | undefined; theme?: string | undefined; scrollRatio?: number | undefined }
): void {
  if (readyTimeoutRef.current !== null) {
    clearTimeout(readyTimeoutRef.current);
    (readyTimeoutRef as { current: number | null }).current = null;
  }
  (isReadyRef as { current: boolean }).current = true;
  callbacks.onReady?.();

  if (refs.code !== undefined) sender.sendRender(refs.code, refs.frontmatter ?? {});
  if (refs.theme !== undefined) sender.sendTheme(refs.theme as 'light' | 'dark');
  if (refs.scrollRatio !== undefined) sender.sendScroll(refs.scrollRatio);
}

/** Refs for callback and value synchronization */
interface PreviewRefs {
  onReady: React.RefObject<(() => void) | undefined>;
  onSizeChange: React.RefObject<((height: number) => void) | undefined>;
  onRuntimeError: React.RefObject<((msg: string, stack?: string) => void) | undefined>;
  code: React.RefObject<string | undefined>;
  frontmatter: React.RefObject<Record<string, unknown> | undefined>;
  theme: React.RefObject<'light' | 'dark' | undefined>;
  scrollRatio: React.RefObject<number | undefined>;
}

/** Hook for managing all preview refs */
function usePreviewRefs(props: PreviewFrameProps): PreviewRefs {
  const onReadyRef = useRef(props.onReady);
  const onSizeChangeRef = useRef(props.onSizeChange);
  const onRuntimeErrorRef = useRef(props.onRuntimeError);
  const codeRef = useRef(props.code);
  const frontmatterRef = useRef(props.frontmatter);
  const scrollRatioRef = useRef(props.scrollRatio);
  const themeRef = useRef(props.theme);

  onReadyRef.current = props.onReady;
  onSizeChangeRef.current = props.onSizeChange;
  onRuntimeErrorRef.current = props.onRuntimeError;
  codeRef.current = props.code;
  frontmatterRef.current = props.frontmatter;
  scrollRatioRef.current = props.scrollRatio;
  themeRef.current = props.theme;

  return { onReady: onReadyRef, onSizeChange: onSizeChangeRef, onRuntimeError: onRuntimeErrorRef,
    code: codeRef, frontmatter: frontmatterRef, theme: themeRef, scrollRatio: scrollRatioRef };
}

/**
 * Hook for handling iframe messages with security hardening.
 *
 * Security features:
 * - Origin validation (rejects messages from untrusted origins)
 * - Rate limiting (prevents message flooding)
 * - Zod-based message validation (strict type checking)
 * - Source verification (only accepts messages from our iframe)
 */
function useIframeMessageHandler(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  isReadyRef: React.RefObject<boolean>,
  readyTimeoutRef: React.RefObject<number | null>,
  sender: ReturnType<typeof useIframeSender>,
  refs: PreviewRefs,
  rateLimiter: RateLimiter
): void {
  useEffect(() => {
    // Create secure handler with origin validation and rate limiting
    const secureHandler = createSecureMessageHandler(
      {
        isDev: import.meta.env.DEV,
        currentOrigin: window.location.origin,
        rateLimiter,
        onOriginRejected: (result) => {
          console.warn('[PreviewFrame] Rejected message from untrusted origin:', result.origin, result.reason);
        },
        onRateLimitExceeded: () => {
          console.warn('[PreviewFrame] Rate limit exceeded for iframe messages');
        },
        onValidationFailed: (error, details) => {
          console.warn('[PreviewFrame] Message validation failed:', error, details);
        },
      },
      validateIframeToParentMessage,
      (msg: IframeToParentMessage, event: MessageEvent) => {
        // Additional check: verify source is our iframe
        if (!iframeRef.current?.contentWindow || event.source !== iframeRef.current.contentWindow) {
          return;
        }

        // Handle validated message with exhaustive switch
        switch (msg.type) {
          case 'ready':
            handleReadyMessage(readyTimeoutRef, isReadyRef, { onReady: refs.onReady.current }, sender, {
              code: refs.code.current, frontmatter: refs.frontmatter.current,
              theme: refs.theme.current, scrollRatio: refs.scrollRatio.current,
            });
            break;
          case 'size':
            refs.onSizeChange.current?.(msg.height);
            break;
          case 'runtime-error':
            // Message and componentStack are already sanitized by validateIframeToParentMessage
            refs.onRuntimeError.current?.(msg.message, msg.componentStack);
            break;
          default:
            assertNever(msg, 'Unhandled iframe-to-parent message type');
        }
      }
    );

    window.addEventListener('message', secureHandler);
    return () => window.removeEventListener('message', secureHandler);
  }, [iframeRef, isReadyRef, readyTimeoutRef, sender, refs, rateLimiter]);
}

// ============================================================================
// Component
// ============================================================================

/** Hook for iframe load/error handlers */
function useIframeHandlers(
  isReadyRef: React.RefObject<boolean>,
  readyTimeoutRef: React.RefObject<number | null>,
  onRuntimeErrorRef: React.RefObject<((msg: string, stack?: string) => void) | undefined>
) {
  const handleLoad = useCallback((): void => {
    (isReadyRef as { current: boolean }).current = false;
    if (readyTimeoutRef.current !== null) clearTimeout(readyTimeoutRef.current);
    (readyTimeoutRef as { current: number | null }).current = window.setTimeout(() => {
      if (!isReadyRef.current) onRuntimeErrorRef.current?.('Preview iframe failed to initialize within 5 seconds');
    }, READY_TIMEOUT_MS);
  }, [isReadyRef, readyTimeoutRef, onRuntimeErrorRef]);

  const handleError = useCallback((): void => {
    onRuntimeErrorRef.current?.('Preview iframe failed to load');
  }, [onRuntimeErrorRef]);

  return { handleLoad, handleError };
}

/** Hook for syncing prop changes to iframe */
function usePropSync(
  props: Pick<PreviewFrameProps, 'code' | 'frontmatter' | 'theme' | 'scrollRatio'>,
  isReadyRef: React.RefObject<boolean>,
  sender: ReturnType<typeof useIframeSender>
): void {
  const { code, frontmatter, theme, scrollRatio } = props;

  useEffect(() => {
    if (isReadyRef.current && code !== undefined) sender.sendRender(code, frontmatter ?? {});
  }, [code, frontmatter, sender, isReadyRef]);

  useEffect(() => {
    if (isReadyRef.current && theme !== undefined) sender.sendTheme(theme);
  }, [theme, sender, isReadyRef]);

  useEffect(() => {
    if (scrollRatio === undefined || !isReadyRef.current) return;
    const id = requestAnimationFrame(() => sender.sendScroll(scrollRatio));
    return () => cancelAnimationFrame(id);
  }, [scrollRatio, sender, isReadyRef]);
}

/**
 * Sandboxed iframe component for MDX preview rendering.
 *
 * Security features:
 * - Sandboxed iframe with minimal permissions (allow-scripts only)
 * - Strict origin validation for postMessage
 * - Rate limiting to prevent message flooding
 * - Zod-based message validation
 * - Content sanitization for error messages
 */
export function PreviewFrame(props: PreviewFrameProps): React.ReactNode {
  const { code, frontmatter, scrollRatio, theme, className = '' } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isReadyRef = useRef(false);
  const readyTimeoutRef = useRef<number | null>(null);

  // Create rate limiter once per component instance
  // Using useMemo to ensure stable reference across renders
  const rateLimiter = useMemo(() => createRateLimiter(), []);

  const refs = usePreviewRefs(props);
  const sender = useIframeSender(iframeRef, isReadyRef);

  useIframeMessageHandler(iframeRef, isReadyRef, readyTimeoutRef, sender, refs, rateLimiter);
  usePropSync({ code, frontmatter, theme, scrollRatio }, isReadyRef, sender);

  useEffect(() => () => { if (readyTimeoutRef.current !== null) clearTimeout(readyTimeoutRef.current); }, []);

  const { handleLoad, handleError } = useIframeHandlers(isReadyRef, readyTimeoutRef, refs.onRuntimeError);

  return (
    <iframe
      ref={iframeRef}
      src={PREVIEW_FRAME_SRC}
      sandbox={IFRAME_SANDBOX}
      title={IFRAME_TITLE}
      aria-label="Rendered MDX content preview"
      aria-describedby="preview-frame-description"
      className={`preview-frame ${className}`.trim()}
      onLoad={handleLoad}
      onError={handleError}
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
}

export default PreviewFrame;
