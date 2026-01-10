/**
 * Tests for preview-frame ErrorBoundary component.
 * Validates error catching, fallback rendering, and callback behavior.
 */

import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary';

/**
 * Helper component that throws an error on demand.
 */
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error');
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error during tests to avoid noise
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('normal rendering', () => {
    it('renders children when no error', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('child')).toBeDefined();
      expect(screen.getByText('Child content')).toBeDefined();
    });
  });

  describe('error catching', () => {
    it('catches and displays runtime errors', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should display error UI instead of the throwing component
      expect(screen.queryByText('No error')).toBeNull();
      expect(screen.getByText('Runtime Error')).toBeDefined();
    });

    it('onError callback is called with error and componentStack', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(String)
      );

      // Verify the error message
      const firstCall = onError.mock.calls[0];
      expect(firstCall).toBeDefined();
      const [error] = firstCall as [Error, string];
      expect(error.message).toBe('Test error');
    });
  });

  describe('fallback UI', () => {
    it('default fallback UI has role="alertdialog"', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      const alertElement = screen.getByRole('alertdialog');
      expect(alertElement).toBeDefined();
    });

    it('custom fallback prop is used when provided', () => {
      const customFallback = <div data-testid="custom-fallback">Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeDefined();
      expect(screen.getByText('Custom error UI')).toBeDefined();
      // Default error UI should not be present
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('resetKey behavior', () => {
    it('resetKey prop resets error state when changed', () => {
      const { rerender } = render(
        <ErrorBoundary resetKey="key1">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Initially in error state
      expect(screen.getByText('Runtime Error')).toBeDefined();

      // Change resetKey and provide non-throwing component
      rerender(
        <ErrorBoundary resetKey="key2">
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      // Should now render children
      expect(screen.queryByText('Runtime Error')).toBeNull();
      expect(screen.getByText('No error')).toBeDefined();
    });

    it('does not reset error state when resetKey stays the same', () => {
      const { rerender } = render(
        <ErrorBoundary resetKey="key1">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Initially in error state
      expect(screen.getByText('Runtime Error')).toBeDefined();

      // Rerender with same resetKey (even though child wouldn't throw now)
      rerender(
        <ErrorBoundary resetKey="key1">
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      // Should still show error UI because resetKey didn't change
      expect(screen.getByText('Runtime Error')).toBeDefined();
    });
  });

  describe('error display', () => {
    it('error message is displayed', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Test error')).toBeDefined();
    });

    it('component stack is shown in details element', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Find the details/summary element
      const summaryElement = screen.getByText('Component Stack');
      expect(summaryElement).toBeDefined();
      expect(summaryElement.tagName.toLowerCase()).toBe('summary');

      // The details element should contain a pre element with the stack
      const detailsElement = summaryElement.parentElement;
      expect(detailsElement?.tagName.toLowerCase()).toBe('details');
      const preElement = detailsElement?.querySelector('pre');
      expect(preElement).not.toBeNull();
    });

    it('handles null error message gracefully', () => {
      // Create a component that throws an error with null message
      function ThrowNullMessageError(): ReactNode {
        const error = new Error();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).message = null;
        throw error;
      }

      render(
        <ErrorBoundary>
          <ThrowNullMessageError />
        </ErrorBoundary>
      );

      // Should display the fallback message
      expect(screen.getByText('An unknown error occurred')).toBeDefined();
    });
  });

  describe('getDerivedStateFromError', () => {
    it('getDerivedStateFromError sets hasError', () => {
      // We can verify this behavior by checking that the error boundary
      // correctly transitions to error state when an error is thrown
      const { container } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // The presence of the error UI confirms getDerivedStateFromError worked
      const errorDiv = container.querySelector('.preview-error');
      expect(errorDiv).not.toBeNull();
      expect(screen.getByText('Runtime Error')).toBeDefined();
    });

    it('captures the error object in state', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // The error message being displayed proves the error was captured
      const errorMessage = screen.getByText('Test error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.classList.contains('preview-error-message')).toBe(true);
    });
  });

  describe('console logging', () => {
    it('logs error and component stack to console', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // console.error should have been called with the error details
      expect(console.error).toHaveBeenCalledWith(
        'MDX Runtime Error:',
        expect.any(Error)
      );
      expect(console.error).toHaveBeenCalledWith(
        'Component Stack:',
        expect.any(String)
      );
    });
  });
});
