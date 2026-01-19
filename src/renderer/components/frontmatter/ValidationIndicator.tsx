/**
 * ValidationIndicator Component
 *
 * Displays validation errors and warnings below form fields.
 * Supports multiple errors with tooltip for truncated messages.
 *
 * @module renderer/components/frontmatter/ValidationIndicator
 */

import { memo } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@renderer/components/ui/tooltip';
import type { ValidationResult, ValidationError, ValidationWarning } from '@shared/types/frontmatter';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Maximum characters to display before truncating error message.
 */
const MAX_MESSAGE_LENGTH = 80;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for ValidationIndicator component.
 */
export interface ValidationIndicatorProps {
  /** Validation result to display */
  readonly validation: ValidationResult;

  /** Optional className for container styling */
  readonly className?: string;

  /** Whether to show only the first error (default: false) */
  readonly showOnlyFirst?: boolean;

  /** Whether to hide warnings (default: false) */
  readonly hideWarnings?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Truncates a message if it exceeds max length.
 *
 * @param message - Message to truncate
 * @param maxLength - Maximum length
 * @returns Truncated message
 */
function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message;
  }
  return `${message.slice(0, maxLength - 3)}...`;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Renders a single error message with optional tooltip.
 */
const ErrorMessage = memo(function ErrorMessage(props: {
  error: ValidationError;
  index: number;
}): React.JSX.Element {
  const { error, index } = props;
  const needsTooltip = error.message.length > MAX_MESSAGE_LENGTH;
  const displayMessage = truncateMessage(error.message, MAX_MESSAGE_LENGTH);

  const errorContent = (
    <div className="flex items-start gap-1.5 text-destructive">
      <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
      <span className="text-xs">{displayMessage}</span>
    </div>
  );

  if (needsTooltip) {
    return (
      <TooltipProvider key={`error-${index}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{errorContent}</div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">{error.message}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div key={`error-${index}`} role="alert">
      {errorContent}
    </div>
  );
});

/**
 * Renders a single warning message with optional tooltip.
 */
const WarningMessage = memo(function WarningMessage(props: {
  warning: ValidationWarning;
  index: number;
}): React.JSX.Element {
  const { warning, index } = props;
  const needsTooltip = warning.message.length > MAX_MESSAGE_LENGTH;
  const displayMessage = truncateMessage(warning.message, MAX_MESSAGE_LENGTH);

  const warningContent = (
    <div className="flex items-start gap-1.5 text-amber-600 dark:text-amber-500">
      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
      <span className="text-xs">{displayMessage}</span>
    </div>
  );

  if (needsTooltip) {
    return (
      <TooltipProvider key={`warning-${index}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{warningContent}</div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">{warning.message}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div key={`warning-${index}`} role="status">
      {warningContent}
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Displays validation errors and warnings.
 *
 * @param props - Component props
 * @returns JSX element or null if no errors/warnings
 */
function ValidationIndicatorComponent(
  props: ValidationIndicatorProps
): React.JSX.Element | null {
  const {
    validation,
    className = '',
    showOnlyFirst = false,
    hideWarnings = false,
  } = props;

  // Nothing to display if valid and no warnings
  if (validation.valid && (hideWarnings || validation.warnings.length === 0)) {
    return null;
  }

  const errors = showOnlyFirst
    ? validation.errors.slice(0, 1)
    : validation.errors;

  const warnings = hideWarnings
    ? []
    : showOnlyFirst
      ? validation.warnings.slice(0, 1)
      : validation.warnings;

  return (
    <div className={`space-y-1 ${className}`}>
      {errors.map((error, index) => (
        <ErrorMessage key={`error-${index}`} error={error} index={index} />
      ))}
      {warnings.map((warning, index) => (
        <WarningMessage key={`warning-${index}`} warning={warning} index={index} />
      ))}
    </div>
  );
}

export const ValidationIndicator = memo(ValidationIndicatorComponent);
ValidationIndicator.displayName = 'ValidationIndicator';

// =============================================================================
// ADDITIONAL COMPONENTS
// =============================================================================

/**
 * Props for ValidationBadge component.
 */
export interface ValidationBadgeProps {
  /** Number of errors */
  readonly errorCount: number;

  /** Number of warnings (optional) */
  readonly warningCount?: number;

  /** Optional className for styling */
  readonly className?: string;
}

/**
 * Small badge showing validation error/warning counts.
 * Useful for tab headers or panel toggles.
 *
 * @param props - Component props
 * @returns JSX element or null if no errors/warnings
 */
function ValidationBadgeComponent(
  props: ValidationBadgeProps
): React.JSX.Element | null {
  const { errorCount, warningCount = 0, className = '' } = props;

  if (errorCount === 0 && warningCount === 0) {
    return null;
  }

  if (errorCount > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground ${className}`}
              aria-label={`${errorCount} validation ${errorCount === 1 ? 'error' : 'errors'}`}
            >
              {errorCount}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">
              {errorCount} validation {errorCount === 1 ? 'error' : 'errors'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Only warnings
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-medium text-white ${className}`}
            aria-label={`${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`}
          >
            {warningCount}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const ValidationBadge = memo(ValidationBadgeComponent);
ValidationBadge.displayName = 'ValidationBadge';

/**
 * Props for ValidationSummary component.
 */
export interface ValidationSummaryProps {
  /** Array of validation results */
  readonly validations: ValidationResult[];

  /** Optional className for styling */
  readonly className?: string;
}

/**
 * Summary component showing total validation status.
 *
 * @param props - Component props
 * @returns JSX element
 */
function ValidationSummaryComponent(
  props: ValidationSummaryProps
): React.JSX.Element | null {
  const { validations, className = '' } = props;

  const errorCount = validations.reduce(
    (sum, v) => sum + v.errors.length,
    0
  );
  const warningCount = validations.reduce(
    (sum, v) => sum + v.warnings.length,
    0
  );

  if (errorCount === 0 && warningCount === 0) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${className}`}
      role="status"
      aria-live="polite"
    >
      {errorCount > 0 && (
        <div className="flex items-center gap-1.5 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </span>
        </div>
      )}
      {warningCount > 0 && (
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
          </span>
        </div>
      )}
      {errorCount === 0 && warningCount === 0 && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>All fields valid</span>
        </div>
      )}
    </div>
  );
}

export const ValidationSummary = memo(ValidationSummaryComponent);
ValidationSummary.displayName = 'ValidationSummary';
