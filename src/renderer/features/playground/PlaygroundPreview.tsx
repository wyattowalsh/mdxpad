/**
 * Playground Preview Component
 *
 * Renders the playground component code in an error-boundary-wrapped
 * preview area. Supports live reload and displays errors gracefully.
 *
 * @module renderer/features/playground/PlaygroundPreview
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { buildPlaygroundPreview } from './playground-preview-tree';

// =============================================================================
// Types
// =============================================================================

export interface PlaygroundPreviewProps {
  /** JSX code string to render */
  readonly code: string;
  /** Props object to pass to the component */
  readonly props: Record<string, unknown> | null;
  /** Callback when rendering starts */
  readonly onRenderStart?: () => void;
  /** Callback when rendering completes or errors */
  readonly onRenderEnd?: (error: string | null) => void;
}

interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
  readonly onError?: (error: string) => void;
  readonly resetKey: string;
}

interface ErrorBoundaryState {
  error: string | null;
}

// =============================================================================
// Error Boundary
// =============================================================================

/**
 * Error boundary that catches render errors in the preview.
 */
class PreviewErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  override componentDidCatch(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.props.onError?.(message);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="rounded border border-red-500/30 bg-red-500/5 p-3 font-mono text-xs text-red-400">
          <div className="mb-1 font-semibold">Render Error</div>
          <div className="whitespace-pre-wrap">{this.state.error}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

// =============================================================================
// Preview Component
// =============================================================================

/**
 * Renders an allowlisted HTML fragment. Attributes are ignored, and other tags fail closed.
 */
export const PlaygroundPreview: React.FC<PlaygroundPreviewProps> = ({
  code,
  props,
  onRenderStart,
  onRenderEnd,
}) => {
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => buildPlaygroundPreview(code), [code]);
  const resetKey = useMemo(() => `${code}-${JSON.stringify(props)}`, [code, props]);
  const propsText = props && Object.keys(props).length > 0 ? JSON.stringify(props, null, 2) : null;

  const report = useCallback(() => {
    onRenderStart?.();
    if (preview.ok) {
      setError(null);
      onRenderEnd?.(null);
      return;
    }
    setError(preview.error);
    onRenderEnd?.(preview.error);
  }, [onRenderEnd, onRenderStart, preview]);

  useEffect(() => {
    report();
  }, [report]);

  const handleBoundaryError = useCallback(
    (errMsg: string) => {
      setError(errMsg);
      onRenderEnd?.(errMsg);
    },
    [onRenderEnd]
  );

  return (
    <PreviewErrorBoundary resetKey={resetKey} onError={handleBoundaryError}>
      <div
        className="playground-preview min-h-[100px] rounded border border-zinc-700 bg-white p-2 text-zinc-900"
        data-testid="playground-preview"
      >
        {preview.ok ? preview.element : null}
        {error ? <div className="whitespace-pre-wrap text-xs text-red-600">{error}</div> : null}
        {propsText ? (
          <pre className="mt-2 text-[11px] text-zinc-500">Props: {propsText}</pre>
        ) : null}
      </div>
    </PreviewErrorBoundary>
  );
};

PlaygroundPreview.displayName = 'PlaygroundPreview';
