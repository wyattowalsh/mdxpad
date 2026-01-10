/**
 * Error Display Component
 *
 * Displays compilation errors with clickable line:column locations.
 * Shows error messages in an accessible format with visual indicators.
 * Supports keyboard navigation including Escape to dismiss.
 * Includes error categorization and recovery options.
 *
 * @module renderer/components/preview/ErrorDisplay
 */

import * as React from 'react';
import { memo, useEffect, useRef, useCallback, useMemo } from 'react';
import type { CompileError } from '@shared/types/preview';
import {
  type ErrorCategory,
  categorizeError,
  ERROR_CATEGORY_ICONS,
  ERROR_CATEGORY_SUGGESTIONS,
} from '@shared/types/errors';

export interface ErrorDisplayProps {
  /** Array of compilation errors to display */
  readonly errors: readonly CompileError[];
  /** Callback when user clicks on error location */
  readonly onErrorClick?: ((line: number, column?: number) => void) | undefined;
  /** Callback when user dismisses the error display (e.g., via Escape key) */
  readonly onDismiss?: (() => void) | undefined;
  /** Callback when user clicks retry */
  readonly onRetry?: (() => void) | undefined;
  /** CSS class for styling */
  readonly className?: string | undefined;
  /** Whether to show error category badge */
  readonly showCategory?: boolean | undefined;
  /** Whether to show suggestions */
  readonly showSuggestions?: boolean | undefined;
}

/**
 * Formats error location as "Line X, Column Y" or "Line X" if no column.
 */
function formatLocation(line: number, column?: number): string {
  if (column !== undefined) {
    return `Line ${line}, Column ${column}`;
  }
  return `Line ${line}`;
}

/**
 * Category label mapping.
 */
const CATEGORY_LABELS: Readonly<Record<ErrorCategory, string>> = {
  syntax: 'Syntax',
  runtime: 'Runtime',
  network: 'Network',
  timeout: 'Timeout',
  unknown: 'Error',
};

/**
 * Renders error category badge.
 */
function ErrorCategoryBadge({
  category,
}: {
  readonly category: ErrorCategory;
}): React.ReactElement {
  const icon = ERROR_CATEGORY_ICONS[category];
  const label = CATEGORY_LABELS[category];

  return (
    <span className={`preview-error-category preview-error-category-${category}`}>
      <span className="preview-error-category-icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
}

/**
 * Props for the ErrorItem component.
 */
interface ErrorItemProps {
  readonly error: CompileError;
  readonly onErrorClick?: ((line: number, column?: number) => void) | undefined;
  readonly showCategory?: boolean | undefined;
  readonly showSuggestion?: boolean | undefined;
}

/**
 * Renders a single error item with optional clickable location.
 * Uses forwardRef to allow focus management from parent.
 * Wrapped in React.memo to prevent re-renders when other errors in the list change.
 */
const ErrorItem = memo(
  React.forwardRef<HTMLButtonElement, ErrorItemProps>(
    function ErrorItem({ error, onErrorClick, showCategory = false, showSuggestion = false }, ref): React.ReactNode {
      const line = error.line;
      const column = error.column;

      // Determine error category
      const category = useMemo(() => categorizeError(error.message), [error.message]);

      // Memoize handlers to prevent recreation on every render
      const handleClick = useCallback(
        (event: React.MouseEvent): void => {
          if (line !== undefined) {
            event.preventDefault();
            onErrorClick?.(line, column);
          }
        },
        [line, column, onErrorClick]
      );

      const handleKeyDown = useCallback(
        (event: React.KeyboardEvent): void => {
          if (line !== undefined && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onErrorClick?.(line, column);
          }
        },
        [line, column, onErrorClick]
      );

      // Memoize formatted location string
      const locationText = useMemo(
        () => (line !== undefined ? formatLocation(line, column) : ''),
        [line, column]
      );

      const ariaLabel = useMemo(
        () => (line !== undefined ? `Go to ${locationText}` : ''),
        [line, locationText]
      );

      // Get suggestion for this error category
      const suggestion = useMemo(
        () => (showSuggestion ? ERROR_CATEGORY_SUGGESTIONS[category] : null),
        [category, showSuggestion]
      );

      return (
        <li className="preview-error-item" role="listitem">
          <div className="preview-error-item-header">
            {showCategory && <ErrorCategoryBadge category={category} />}
            <p className="preview-error-message">{error.message}</p>
          </div>
          {suggestion !== null && (
            <p className="preview-error-suggestion">{suggestion}</p>
          )}
          {line !== undefined && (
            <button
              ref={ref}
              type="button"
              className="preview-error-location"
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              aria-label={ariaLabel}
            >
              {locationText}
            </button>
          )}
        </li>
      );
    }
  )
);

/**
 * Error display component for showing compilation errors.
 * Per spec: clickable locations, accessible markup, error icon.
 * Supports keyboard navigation: Escape to dismiss, Tab to navigate.
 * Wrapped in React.memo to prevent unnecessary re-renders.
 */
export const ErrorDisplay = memo(function ErrorDisplay({
  errors,
  onErrorClick,
  onDismiss,
  onRetry,
  className = '',
  showCategory = false,
  showSuggestions = false,
}: ErrorDisplayProps): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstErrorRef = useRef<HTMLButtonElement>(null);

  // Handle keyboard events for the error container
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'Escape' && onDismiss) {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }
    },
    [onDismiss]
  );

  // Focus the first interactive element when errors appear
  useEffect(() => {
    if (errors.length > 0 && firstErrorRef.current) {
      // Use setTimeout to ensure the element is rendered
      const timer = setTimeout(() => {
        firstErrorRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [errors.length]);

  // Memoize title computation
  const title = useMemo(
    () =>
      errors.length === 1
        ? 'Compilation Error'
        : `${errors.length} Compilation Errors`,
    [errors.length]
  );

  // Memoize container class name
  const containerClassName = useMemo(
    () => `preview-error-container ${className}`.trim(),
    [className]
  );

  // Memoize description text
  const descriptionText = useMemo(
    () =>
      errors.length === 1
        ? 'One compilation error occurred. Press Escape to dismiss.'
        : `${errors.length} compilation errors occurred. Press Escape to dismiss.`,
    [errors.length]
  );

  if (errors.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="preview-error-title"
      aria-describedby="preview-error-description"
      aria-live="assertive"
      onKeyDown={handleKeyDown}
    >
      <div className="preview-error-header">
        <span className="preview-error-icon" aria-hidden="true">
          &#9888;
        </span>
        <h2 id="preview-error-title" className="preview-error-title">{title}</h2>
        {onDismiss && (
          <button
            type="button"
            className="preview-error-dismiss"
            onClick={onDismiss}
            aria-label="Dismiss errors (Escape)"
          >
            <span aria-hidden="true">&#10005;</span>
          </button>
        )}
      </div>
      <p id="preview-error-description" className="visually-hidden">
        {descriptionText}
      </p>
      <ul className="preview-error-list" role="list" aria-label="Error list">
        {errors.map((error, index) => (
          <ErrorItem
            key={index}
            error={error}
            onErrorClick={onErrorClick}
            showCategory={showCategory}
            showSuggestion={showSuggestions}
            ref={index === 0 && error.line !== undefined ? firstErrorRef : undefined}
          />
        ))}
      </ul>
      <div className="preview-error-footer">
        {onRetry !== undefined && (
          <button
            type="button"
            className="preview-error-action preview-error-action-retry"
            onClick={onRetry}
            aria-label="Retry compilation"
          >
            <span className="preview-error-action-icon" aria-hidden="true">
              &#8635;
            </span>
            Retry
          </button>
        )}
        {onDismiss !== undefined && (
          <p className="preview-error-hint" aria-hidden="true">
            Press Escape to dismiss
          </p>
        )}
      </div>
    </div>
  );
});

export default ErrorDisplay;
