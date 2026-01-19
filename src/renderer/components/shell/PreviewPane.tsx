/**
 * Shell PreviewPane Component
 *
 * Wrapper component that integrates the preview system with the application shell.
 * Connects to the document store for content and provides preview rendering
 * with compilation timeout handling per FR-037a.
 *
 * @module renderer/components/shell/PreviewPane
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { PreviewPane as BasePreviewPane } from '../preview/PreviewPane';
import { useDocumentStore, selectContent } from '@renderer/stores/document-store';
import { usePreviewStore } from '@renderer/stores/preview-store';
import type { CompilationError } from './StatusBar/types';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Preview compilation timeout in milliseconds per FR-037a.
 * 3 seconds = 6x the 500ms normal target compilation time.
 */
const COMPILATION_TIMEOUT_MS = 3000;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the shell PreviewPane component.
 */
export interface ShellPreviewPaneProps {
  /** Optional className for styling */
  readonly className?: string;
  /** Theme mode for the preview */
  readonly theme?: 'light' | 'dark';
  /** Callback when user clicks an error location */
  readonly onErrorClick?: (line: number, column?: number) => void;
  /** Callback when compilation errors change (for StatusBar) */
  readonly onErrorsChange?: (errors: readonly CompilationError[]) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Shell PreviewPane that connects to the document store and handles
 * compilation timeout per FR-037a (3 seconds).
 *
 * This component:
 * 1. Gets content from the document store
 * 2. Enforces 3-second compilation timeout
 * 3. Reports errors to parent for StatusBar display
 * 4. Delegates actual rendering to BasePreviewPane
 *
 * @example
 * ```tsx
 * <ShellPreviewPane
 *   theme="dark"
 *   onErrorClick={(line, col) => editor.goTo(line, col)}
 *   onErrorsChange={(errors) => setStatusBarErrors(errors)}
 * />
 * ```
 */
function ShellPreviewPaneComponent({
  className,
  theme,
  onErrorClick,
  onErrorsChange,
}: ShellPreviewPaneProps): React.JSX.Element {
  // Get content from document store
  const content = useDocumentStore(selectContent);

  // Track compilation timeout state
  const [isTimedOut, setIsTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef<string>(content);

  // Get preview state to monitor compilation status
  const previewStatus = usePreviewStore((s) => s.state.status);

  // Handle compilation timeout per FR-037a
  useEffect(() => {
    // Content changed - reset timeout state and start timer
    if (content !== lastContentRef.current) {
      lastContentRef.current = content;
      setIsTimedOut(false);

      // Clear any existing timeout
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Start new timeout timer
      timeoutRef.current = setTimeout(() => {
        // Only timeout if still compiling
        if (usePreviewStore.getState().state.status === 'compiling') {
          setIsTimedOut(true);
          // Report timeout error
          onErrorsChange?.([
            {
              message: 'Preview compilation timed out after 3 seconds',
              line: 1,
              column: 1,
            },
          ]);
        }
        timeoutRef.current = null;
      }, COMPILATION_TIMEOUT_MS);
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [content, onErrorsChange]);

  // Clear timeout when compilation completes
  useEffect(() => {
    if (previewStatus === 'success' || previewStatus === 'error') {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Clear timeout state on success
      if (previewStatus === 'success') {
        setIsTimedOut(false);
      }
    }
  }, [previewStatus]);

  // Report errors to parent for StatusBar
  const previewState = usePreviewStore((s) => s.state);
  useEffect(() => {
    if (previewState.status === 'error') {
      const errors: CompilationError[] = previewState.errors.map((e) => ({
        message: e.message,
        line: e.line ?? 1,
        column: e.column ?? 1,
      }));
      onErrorsChange?.(errors);
    } else if (previewState.status === 'success' && !isTimedOut) {
      onErrorsChange?.([]);
    }
  }, [previewState, isTimedOut, onErrorsChange]);

  // Handle error click to navigate in editor
  const handleErrorClick = useCallback(
    (line: number, column?: number) => {
      onErrorClick?.(line, column);
    },
    [onErrorClick]
  );

  // Build className conditionally to satisfy exactOptionalPropertyTypes
  const previewProps: Omit<React.ComponentProps<typeof BasePreviewPane>, 'source' | 'onErrorClick'> & { source: string; onErrorClick: (line: number, column?: number) => void } = {
    source: content,
    theme: theme ?? 'light',
    onErrorClick: handleErrorClick,
    ...(className !== undefined && { className }),
  };

  return <BasePreviewPane {...previewProps} />;
}

/**
 * Memoized shell PreviewPane component.
 * Prevents unnecessary re-renders when parent components update.
 */
export const ShellPreviewPane = memo(ShellPreviewPaneComponent);
ShellPreviewPane.displayName = 'ShellPreviewPane';

// Also export as PreviewPane for shell usage
export { ShellPreviewPane as PreviewPane };

export default ShellPreviewPane;
