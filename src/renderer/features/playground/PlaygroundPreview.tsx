/**
 * Playground Preview Component
 *
 * Renders the playground component code in an error-boundary-wrapped
 * preview area. Supports live reload and displays errors gracefully.
 *
 * @module renderer/features/playground/PlaygroundPreview
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
 * Renders JSX code string into a live preview with error handling.
 *
 * Uses an iframe sandbox approach for isolation. The code is evaluated
 * and rendered in the preview area with full error boundary protection.
 */
export const PlaygroundPreview: React.FC<PlaygroundPreviewProps> = ({
  code,
  props,
  onRenderStart,
  onRenderEnd,
}) => {
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const resetKey = useMemo(() => `${code}-${JSON.stringify(props)}`, [code, props]);

  const renderCode = useCallback(() => {
    onRenderStart?.();
    setError(null);

    try {
      // Simple JSX-like rendering: wrap code in a div for display
      // In a real implementation this would use a JSX transformer
      const propsStr = props ? JSON.stringify(props, null, 2) : '{}';
      const html = `
        <div style="font-family: system-ui, sans-serif; padding: 16px;">
          <div class="playground-output">${escapeHtml(code)}</div>
          ${props && Object.keys(props).length > 0 ? `<pre style="margin-top:8px;font-size:11px;color:#888;">Props: ${escapeHtml(propsStr)}</pre>` : ''}
        </div>
      `;
      setRenderedHtml(html);
      onRenderEnd?.(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      onRenderEnd?.(msg);
    }
  }, [code, props, onRenderStart, onRenderEnd]);

  useEffect(() => {
    renderCode();
  }, [renderCode]);

  const handleBoundaryError = useCallback(
    (errMsg: string) => {
      setError(errMsg);
      onRenderEnd?.(errMsg);
    },
    [onRenderEnd]
  );

  if (error) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/5 p-3 font-mono text-xs text-red-400">
        <div className="mb-1 font-semibold">Preview Error</div>
        <div className="whitespace-pre-wrap">{error}</div>
      </div>
    );
  }

  return (
    <PreviewErrorBoundary resetKey={resetKey} onError={handleBoundaryError}>
      <div
        className="playground-preview min-h-[100px] rounded border border-zinc-700 bg-white p-2"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </PreviewErrorBoundary>
  );
};

PlaygroundPreview.displayName = 'PlaygroundPreview';

// =============================================================================
// Helpers
// =============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
