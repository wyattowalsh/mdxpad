/**
 * Preview Error Boundary Component
 *
 * React Error Boundary for the preview system with recovery options.
 * Provides Retry and Reset buttons for recoverable errors.
 * Includes error categorization and user-friendly messaging.
 *
 * @module renderer/components/preview/PreviewErrorBoundary
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  type CategorizedError,
  type ErrorCategory,
  categorizeError,
  createCategorizedError,
  isRetryable,
  isResettable,
  ERROR_CATEGORY_ICONS,
} from '@shared/types/errors';

// ============================================================================
// Types
// ============================================================================

export interface PreviewErrorBoundaryProps {
  /** Child components to render */
  readonly children: ReactNode;
  /** Callback when error is caught */
  readonly onError?: (error: CategorizedError) => void;
  /** Callback for retry action */
  readonly onRetry?: () => void;
  /** Callback for reset action */
  readonly onReset?: () => void;
  /** Custom fallback UI (overrides default) */
  readonly fallback?: ReactNode;
  /** When this key changes, reset error state */
  readonly resetKey?: string | number;
  /** Component name for error context */
  readonly componentName?: string;
}

interface PreviewErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: CategorizedError | null;
  readonly lastResetKey: string | number | undefined;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Error boundary with recovery options for the preview system.
 *
 * Features:
 * - Error categorization (syntax, runtime, network, timeout, unknown)
 * - User-friendly error messages with suggestions
 * - Retry button for transient errors
 * - Reset button for state-related errors
 * - Graceful degradation with fallback UI
 */
export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  constructor(props: PreviewErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      lastResetKey: props.resetKey,
    };
  }

  /**
   * Reset error state when resetKey prop changes.
   */
  static getDerivedStateFromProps(
    props: PreviewErrorBoundaryProps,
    state: PreviewErrorBoundaryState
  ): Partial<PreviewErrorBoundaryState> | null {
    if (props.resetKey !== state.lastResetKey) {
      return {
        hasError: false,
        error: null,
        lastResetKey: props.resetKey,
      };
    }
    return null;
  }

  static getDerivedStateFromError(error: Error): Partial<PreviewErrorBoundaryState> {
    const categorizedError = createCategorizedError(error);
    return {
      hasError: true,
      error: categorizedError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const componentStack = errorInfo.componentStack ?? '';

    // Create categorized error with full context
    const categorizedError = createCategorizedError(error, undefined, {
      details: `${error.stack ?? ''}\n\nComponent Stack:${componentStack}`,
    });

    // Update state with full error info
    this.setState({ error: categorizedError });

    // Call error callback
    this.props.onError?.(categorizedError);

    // Log for debugging
    console.error('[PreviewErrorBoundary] Error caught:', error);
    console.error('[PreviewErrorBoundary] Component Stack:', componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  private renderErrorActions(): ReactNode {
    const { error } = this.state;
    const { onRetry, onReset } = this.props;

    if (error === null) {
      return null;
    }

    const showRetry = isRetryable(error) && onRetry !== undefined;
    const showReset = isResettable(error) && onReset !== undefined;

    if (!showRetry && !showReset) {
      return null;
    }

    return (
      <div className="preview-error-actions">
        {showRetry && (
          <button
            type="button"
            className="preview-error-action preview-error-action-retry"
            onClick={this.handleRetry}
            aria-label="Retry rendering"
          >
            <span className="preview-error-action-icon" aria-hidden="true">
              &#8635;
            </span>
            Retry
          </button>
        )}
        {showReset && (
          <button
            type="button"
            className="preview-error-action preview-error-action-reset"
            onClick={this.handleReset}
            aria-label="Reset preview"
          >
            <span className="preview-error-action-icon" aria-hidden="true">
              &#8634;
            </span>
            Reset
          </button>
        )}
      </div>
    );
  }

  private renderCategoryBadge(category: ErrorCategory): ReactNode {
    const icon = ERROR_CATEGORY_ICONS[category];
    const labels: Record<ErrorCategory, string> = {
      syntax: 'Syntax Error',
      runtime: 'Runtime Error',
      network: 'Network Error',
      timeout: 'Timeout',
      unknown: 'Error',
    };

    return (
      <span className={`preview-error-category preview-error-category-${category}`}>
        <span className="preview-error-category-icon" aria-hidden="true">
          {icon}
        </span>
        {labels[category]}
      </span>
    );
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Use custom fallback if provided
    if (this.props.fallback !== undefined) {
      return this.props.fallback;
    }

    const { error } = this.state;

    if (error === null) {
      return (
        <div className="preview-error-boundary" role="alert">
          <h3>An unknown error occurred</h3>
        </div>
      );
    }

    return (
      <div className="preview-error-boundary" role="alert" aria-live="assertive">
        <div className="preview-error-boundary-header">
          {this.renderCategoryBadge(error.category)}
        </div>

        <div className="preview-error-boundary-content">
          <p className="preview-error-boundary-message">{error.message}</p>

          {error.suggestion !== undefined && (
            <p className="preview-error-boundary-suggestion">
              <strong>Suggestion:</strong> {error.suggestion}
            </p>
          )}

          {error.location?.line !== undefined && (
            <p className="preview-error-boundary-location">
              Location: Line {error.location.line}
              {error.location.column !== undefined && `, Column ${error.location.column}`}
            </p>
          )}
        </div>

        {this.renderErrorActions()}

        {error.details !== undefined && (
          <details className="preview-error-boundary-details">
            <summary>Technical Details</summary>
            <pre className="preview-error-boundary-stack">{error.details}</pre>
          </details>
        )}
      </div>
    );
  }
}

export default PreviewErrorBoundary;
