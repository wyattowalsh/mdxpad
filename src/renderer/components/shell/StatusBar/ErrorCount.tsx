/**
 * ErrorCount Component
 *
 * Displays a count of compilation errors with a clickable badge.
 * When clicked, shows a popover with error details.
 * Each error in the popover is clickable to navigate to its location.
 * Popover dismisses on click outside or Escape key.
 *
 * @module renderer/components/shell/StatusBar/ErrorCount
 */

import { memo, useCallback } from 'react';
import { cn } from '@shared/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import type { ErrorCountProps, CompilationError } from './types';

/**
 * Format error location as "Ln X, Col Y".
 */
function formatLocation(error: CompilationError): string {
  return `Ln ${error.line}, Col ${error.column}`;
}

/**
 * Error list item component.
 * Renders a single error with message and clickable location.
 */
interface ErrorListItemProps {
  readonly error: CompilationError;
  readonly onClick: () => void;
}

function ErrorListItem({ error, onClick }: ErrorListItemProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <li className="py-1.5 border-b border-border last:border-b-0">
      <button
        type="button"
        className="w-full text-left hover:bg-accent rounded px-2 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
        onClick={onClick}
        onKeyDown={handleKeyDown}
        data-testid="error-item"
      >
        <div className="text-sm text-foreground line-clamp-2">{error.message}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{formatLocation(error)}</div>
      </button>
    </li>
  );
}

/**
 * ErrorCount displays the number of compilation errors.
 * Shows a popover with error details when clicked.
 *
 * @example
 * ```tsx
 * <ErrorCount
 *   errors={[{ message: 'Syntax error', line: 5, column: 10 }]}
 *   onErrorClick={(error) => goToLine(error.line, error.column)}
 * />
 * ```
 */
function ErrorCountComponent({ errors, onErrorClick }: ErrorCountProps) {
  const errorCount = errors.length;

  // Don't render if no errors
  if (errorCount === 0) {
    return (
      <div
        className="text-sm text-muted-foreground whitespace-nowrap"
        data-testid="error-count"
      >
        No errors
      </div>
    );
  }

  const errorLabel = errorCount === 1 ? '1 error' : `${errorCount} errors`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium',
            'bg-destructive text-destructive-foreground',
            'hover:bg-destructive/90 transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-ring'
          )}
          aria-label={`${errorLabel}. Click to view details.`}
          data-testid="error-count"
        >
          <span aria-hidden="true" className="text-xs">
            &#9888;
          </span>
          {errorLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-2 max-h-[300px] overflow-y-auto"
        align="end"
        side="top"
        sideOffset={8}
        data-testid="error-popover"
      >
        <div className="font-medium text-sm mb-2 px-2">
          Compilation {errorLabel}
        </div>
        <ul className="list-none p-0 m-0" role="list" aria-label="Error list">
          {errors.map((error, index) => (
            <ErrorListItem
              key={`${error.line}-${error.column}-${index}`}
              error={error}
              onClick={() => onErrorClick(error)}
            />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export const ErrorCount = memo(ErrorCountComponent);
ErrorCount.displayName = 'ErrorCount';
