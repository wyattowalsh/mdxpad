/**
 * Preview Pane Container Component
 *
 * Main preview component that orchestrates MDX compilation and rendering.
 * Manages the preview lifecycle including loading states, error display,
 * and successful renders with scroll synchronization.
 *
 * ## Architecture
 *
 * ```
 * PreviewPane
 *   ├── usePreview hook (compilation + state management)
 *   ├── PerformanceWarning (optional, for large docs > 50k chars)
 *   ├── LoadingIndicator (during compilation, 100ms delay)
 *   ├── ErrorDisplay (on compile errors, dismissible)
 *   └── PreviewFrame (sandboxed iframe for rendering)
 * ```
 *
 * ## Features
 *
 * - **Debounced Compilation**: 300ms debounce to reduce CPU usage
 * - **Error Recovery**: Shows last successful render behind error overlay
 * - **Performance Warning**: Alerts for documents > 50,000 characters
 * - **Scroll Sync**: Synchronizes scroll position with editor (0-1 ratio)
 * - **Theme Support**: Light/dark theme propagation to iframe
 *
 * ## Accessibility
 *
 * - Skip link to jump to main content
 * - aria-live regions for dynamic content updates
 * - Focus management when preview updates
 * - Keyboard navigation support
 * - Screen reader status announcements
 *
 * @example
 * ```tsx
 * <PreviewPane
 *   source={mdxSource}
 *   scrollRatio={0.5}
 *   theme="dark"
 *   onErrorClick={(line, col) => editor.goTo(line, col)}
 * />
 * ```
 *
 * @module renderer/components/preview/PreviewPane
 * @see {@link PreviewFrame} - Sandboxed iframe for MDX rendering
 * @see {@link ErrorDisplay} - Error display with clickable locations
 * @see {@link LoadingIndicator} - Loading spinner with flicker prevention
 * @see {@link usePreview} - Hook for compilation state management
 */

import * as React from 'react';
import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { usePreview } from '@renderer/hooks/usePreview';
import { useErrorReporting } from '@renderer/hooks/useErrorReporting';
import { ErrorDisplay } from './ErrorDisplay';
import { LoadingIndicator } from './LoadingIndicator';
import { PreviewFrame } from './PreviewFrame';
import { PreviewErrorBoundary } from './PreviewErrorBoundary';
import type { CategorizedError } from '@shared/types/errors';
import type { ScrollReportSignal } from '@shared/types/preview-iframe';

// ============================================================================
// Constants
// ============================================================================

/** Performance warning threshold in characters (FR-023) */
const PERFORMANCE_THRESHOLD = 50_000;

/** Divisor to convert characters to thousands for display */
const CHARS_TO_THOUSANDS_DIVISOR = 1000;

// ============================================================================
// Types
// ============================================================================

/** Props for the performance warning component */
interface PerformanceWarningProps {
  /** Source length in characters */
  readonly sourceLength: number;
  /** Callback to dismiss the warning */
  readonly onDismiss: () => void;
}

/**
 * Props for the PreviewPane component.
 *
 * @example
 * ```tsx
 * const props: PreviewPaneProps = {
 *   source: '# Hello World\n\nThis is MDX content.',
 *   scrollRatio: 0.5,
 *   theme: 'dark',
 *   onErrorClick: (line, column) => {
 *     editor.setCursor({ line: line - 1, ch: column ?? 0 });
 *   },
 * };
 * ```
 */
export interface PreviewPaneProps {
  /**
   * MDX source text to compile and render.
   *
   * The source is compiled via a Web Worker with a 300ms debounce.
   * Documents larger than 500,000 characters will be rejected.
   *
   * @example '# Hello World\n\n<Callout>Note</Callout>'
   */
  readonly source: string;

  /**
   * Editor scroll position as a ratio (0-1) for synchronization.
   *
   * - `0` = top of document
   * - `1` = bottom of document
   * - `0.5` = middle of document
   *
   * The preview iframe will scroll to match this position.
   * Smooth scrolling is used unless user prefers reduced motion.
   */
  readonly scrollRatio?: number | undefined;

  /**
   * Theme for preview rendering.
   *
   * Sets the `data-theme` attribute on the iframe's document element.
   * CSS custom properties in the iframe respond to theme changes.
   */
  readonly theme?: 'light' | 'dark' | undefined;

  /**
   * Callback when user clicks an error location.
   *
   * Use this to navigate the editor to the error position.
   * Line numbers are 1-based. Column may be undefined for some errors.
   *
   * @param line - 1-based line number of the error
   * @param column - 1-based column number (may be undefined)
   *
   * @example
   * ```tsx
   * onErrorClick={(line, column) => {
   *   editor.setCursor({ line: line - 1, ch: column ? column - 1 : 0 });
   *   editor.focus();
   * }}
   * ```
   */
  readonly onErrorClick?: ((line: number, column?: number) => void) | undefined;

  /**
   * CSS class for additional styling.
   *
   * Applied to the root `.preview-pane` element.
   */
  readonly className?: string | undefined;

  /**
   * Callback when user scrolls in the preview iframe.
   * Used for preview-to-editor scroll synchronization.
   *
   * Feature: 008-bidirectional-sync
   *
   * @param report - Scroll position data including ratio, scrollTop, and dimensions
   */
  readonly onScrollReport?: ((report: Omit<ScrollReportSignal, 'type'>) => void) | undefined;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Performance warning banner for large documents.
 * Memoized to prevent re-renders when other preview state changes.
 */
const PerformanceWarning = memo(function PerformanceWarning({
  sourceLength,
  onDismiss,
}: PerformanceWarningProps): React.ReactNode {
  // Memoize the formatted size string
  const sizeDisplay = useMemo(
    () => `${Math.round(sourceLength / CHARS_TO_THOUSANDS_DIVISOR)}k`,
    [sourceLength]
  );

  return (
    <div className="preview-performance-warning" role="alert">
      <span className="preview-performance-warning-icon" aria-hidden="true">
        &#9888;
      </span>
      <span className="preview-performance-warning-message">
        Large document ({sizeDisplay} chars) may affect preview performance
      </span>
      <button
        type="button"
        className="preview-performance-warning-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss performance warning"
      >
        &#10005;
      </button>
    </div>
  );
});

/**
 * Empty state component shown when no content is available.
 * Provides helpful guidance to the user.
 */
const EmptyState = memo(function EmptyState(): React.ReactNode {
  return (
    <div className="preview-empty" role="status">
      <svg
        className="preview-empty-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
      <h3 className="preview-empty-title">No preview available</h3>
      <p className="preview-empty-message">
        Start typing MDX content in the editor to see a live preview here.
      </p>
    </div>
  );
});

/**
 * Success indicator that briefly flashes when compilation succeeds.
 * Provides visual feedback without being intrusive.
 */
const SuccessIndicator = memo(function SuccessIndicator({
  show,
}: {
  readonly show: boolean;
}): React.ReactNode {
  if (!show) return null;

  return (
    <div className="preview-success-indicator" aria-hidden="true">
      <svg
        className="preview-success-indicator-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span>Updated</span>
    </div>
  );
});

// ============================================================================
// Component
// ============================================================================

/** Static warning message - extracted to prevent re-creation */
const StaticSecurityWarning = memo(function StaticSecurityWarning(): React.ReactNode {
  return (
    <div className="preview-warning" role="status" aria-live="polite">
      Preview executes code from your MDX
    </div>
  );
});

/**
 * Main preview container that orchestrates MDX compilation and rendering.
 *
 * Features:
 * - Debounced MDX compilation via usePreview hook
 * - Loading indicator during compilation (with flicker prevention)
 * - Error display with clickable locations
 * - Error recovery: shows last successful render behind errors
 * - Scroll synchronization and theme support
 * - Skip link for keyboard navigation
 * - aria-live regions for screen reader announcements
 * - Empty state messaging for better UX
 * - Success flash indicator on compilation
 *
 * Performance optimizations:
 * - React.memo to prevent unnecessary re-renders from parent
 * - useMemo for derived values and class names
 * - useCallback for stable callback references
 * - Memoized sub-components (PerformanceWarning, StaticSecurityWarning, etc.)
 */
export const PreviewPane = memo(function PreviewPane({
  source,
  scrollRatio,
  theme,
  onErrorClick,
  onScrollReport,
  className = '',
}: PreviewPaneProps): React.ReactNode {
  const { state, lastSuccessfulRender } = usePreview(source);
  const { reportError } = useErrorReporting({ logToConsole: true });
  const [isWarningDismissed, setIsWarningDismissed] = useState(false);
  const [isErrorDismissed, setIsErrorDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [runtimeError, setRuntimeError] = useState<CategorizedError | null>(null);
  const [errorBoundaryKey, setErrorBoundaryKey] = useState(0);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef<string>(state.status);

  const handleWarningDismiss = useCallback((): void => {
    setIsWarningDismissed(true);
  }, []);

  const handleErrorDismiss = useCallback((): void => {
    setIsErrorDismissed(true);
  }, []);

  // Handle runtime errors from error boundary
  const handleRuntimeError = useCallback(
    (error: CategorizedError): void => {
      setRuntimeError(error);
      reportError(error.originalError ?? error.message, { component: 'PreviewPane' });
    },
    [reportError]
  );

  // Handle retry: reset error boundary and clear runtime error
  const handleRetry = useCallback((): void => {
    setRuntimeError(null);
    setErrorBoundaryKey((prev) => prev + 1);
  }, []);

  // Handle reset: clear all error states
  const handleReset = useCallback((): void => {
    setRuntimeError(null);
    setIsErrorDismissed(false);
    setErrorBoundaryKey((prev) => prev + 1);
  }, []);

  // Reset error dismissed state when new errors occur
  // Show success indicator briefly when compilation succeeds
  useEffect(() => {
    if (state.status === 'error' && previousStatusRef.current !== 'error') {
      setIsErrorDismissed(false);
    }

    // Show success flash when transitioning from compiling to success
    if (state.status === 'success' && previousStatusRef.current === 'compiling') {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 1500);
      return () => clearTimeout(timer);
    }

    previousStatusRef.current = state.status;
    return undefined;
  }, [state.status]);

  // Handle skip link click
  const handleSkipToContent = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>): void => {
      event.preventDefault();
      previewContentRef.current?.focus();
    },
    []
  );

  const showWarning = source.length > PERFORMANCE_THRESHOLD && !isWarningDismissed;
  const isCompiling = state.status === 'compiling';
  const isError = state.status === 'error';
  const errors = isError && !isErrorDismissed ? state.errors : [];
  const renderableContent =
    state.status === 'success' ? state.result : lastSuccessfulRender;
  const isEmptySource = source.trim() === '';
  const showEmptyState = isEmptySource && !renderableContent && !isCompiling;

  // Generate status message for screen readers
  const statusMessage = isCompiling
    ? 'Compiling MDX...'
    : isError && errors.length > 0
      ? `${errors.length} compilation error${errors.length === 1 ? '' : 's'} occurred`
      : state.status === 'success'
        ? 'Preview updated successfully'
        : '';

  return (
    <div
      className={`preview-pane ${className}`.trim()}
      role="region"
      aria-label="MDX Preview"
    >
      {/* Skip link for keyboard users */}
      <a
        href="#preview-content"
        className="preview-skip-link"
        onClick={handleSkipToContent}
      >
        Skip to preview content
      </a>

      {/* Security warning */}
      <div className="preview-warning" role="status" aria-live="polite">
        Preview executes code from your MDX
      </div>

      {/* Performance warning */}
      {showWarning && (
        <PerformanceWarning
          sourceLength={source.length}
          onDismiss={handleWarningDismiss}
        />
      )}

      {/* Status announcements for screen readers */}
      <div
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusMessage}
      </div>

      {/* Loading indicator */}
      <LoadingIndicator isLoading={isCompiling} />

      {/* Error display with keyboard dismiss support and retry */}
      {isError && errors.length > 0 && (
        <ErrorDisplay
          errors={errors}
          onErrorClick={onErrorClick}
          onDismiss={handleErrorDismiss}
          onRetry={handleRetry}
          showCategory={true}
          showSuggestions={true}
        />
      )}

      {/* Main preview content */}
      <div
        ref={previewContentRef}
        id="preview-content"
        className="preview-content"
        tabIndex={-1}
        aria-label="Rendered MDX content"
      >
        {/* Success indicator */}
        <SuccessIndicator show={showSuccess} />

        {/* Empty state */}
        {showEmptyState && <EmptyState />}

        {/* Preview frame wrapped in error boundary */}
        {renderableContent && (
          <PreviewErrorBoundary
            key={errorBoundaryKey}
            onError={handleRuntimeError}
            onRetry={handleRetry}
            onReset={handleReset}
            componentName="PreviewFrame"
          >
            <PreviewFrame
              code={renderableContent.code}
              frontmatter={renderableContent.frontmatter}
              scrollRatio={scrollRatio}
              theme={theme}
              onScrollReport={onScrollReport}
            />
          </PreviewErrorBoundary>
        )}
      </div>
    </div>
  );
});

export default PreviewPane;
