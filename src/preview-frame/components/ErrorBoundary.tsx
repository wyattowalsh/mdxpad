/**
 * Preview Error Boundary
 *
 * Catches runtime errors during MDX rendering and displays a fallback UI.
 * Reports errors via onError callback (parent sends RuntimeErrorSignal).
 * Supports keyboard navigation (Escape to dismiss/reset).
 * @module preview-frame/components/ErrorBoundary
 */

import { Component, createRef, type ErrorInfo, type ReactNode, type RefObject } from 'react';

export interface ErrorBoundaryProps {
  /** Child components to render */
  readonly children: ReactNode;
  /** Callback when error is caught */
  readonly onError?: (error: Error, componentStack: string) => void;
  /** Callback when user dismisses the error (e.g., via Escape key) */
  readonly onDismiss?: () => void;
  /** Custom fallback UI */
  readonly fallback?: ReactNode;
  /** When this key changes, reset error state (enables controlled recovery) */
  readonly resetKey?: string | number;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
  readonly componentStack: string | null;
  /** Tracks the last resetKey to detect changes */
  readonly lastResetKey: string | number | undefined;
}

/**
 * Error boundary for catching runtime errors in MDX content.
 * Reports errors via the onError callback.
 * Supports keyboard navigation with Escape key to dismiss.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private containerRef: RefObject<HTMLDivElement | null>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
      lastResetKey: props.resetKey,
    };
    this.containerRef = createRef<HTMLDivElement>();
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Handle keyboard events for accessibility.
   * Escape key dismisses/resets the error state.
   */
  private handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.props.onDismiss?.();
    }
  }

  /**
   * Reset error state when resetKey prop changes.
   * This enables controlled recovery from errors when new content is rendered.
   */
  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.lastResetKey) {
      return {
        hasError: false,
        error: null,
        componentStack: null,
        lastResetKey: props.resetKey,
      };
    }
    return null;
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const componentStack = errorInfo.componentStack ?? '';

    this.setState({ componentStack });

    // Call error callback - parent handles sending RuntimeErrorSignal
    this.props.onError?.(error, componentStack);

    // Log error for debugging
    console.error('MDX Runtime Error:', error);
    console.error('Component Stack:', componentStack);
  }

  /**
   * Focus the error container when an error occurs for keyboard accessibility.
   */
  componentDidUpdate(_prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState): void {
    if (this.state.hasError && !prevState.hasError && this.containerRef.current) {
      this.containerRef.current.focus();
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message ?? 'An unknown error occurred';

      // Default error UI with keyboard support
      return (
        <div
          ref={this.containerRef}
          className="preview-error"
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="error-boundary-title"
          aria-describedby="error-boundary-description"
          tabIndex={-1}
          onKeyDown={this.handleKeyDown}
        >
          <div className="preview-error-header">
            <span className="preview-error-icon" aria-hidden="true">
              &#9888;
            </span>
            <h3 id="error-boundary-title">Runtime Error</h3>
            {this.props.onDismiss && (
              <button
                type="button"
                className="preview-error-dismiss"
                onClick={this.props.onDismiss}
                aria-label="Dismiss error (Escape)"
              >
                <span aria-hidden="true">&#10005;</span>
              </button>
            )}
          </div>
          <p id="error-boundary-description" className="preview-error-message">
            {errorMessage}
          </p>
          {this.state.componentStack && (
            <details>
              <summary>Component Stack</summary>
              <pre className="preview-error-stack" aria-label="Error component stack trace">
                {this.state.componentStack}
              </pre>
            </details>
          )}
          {this.props.onDismiss && (
            <p className="preview-error-hint" aria-hidden="true">
              Press Escape to dismiss
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
