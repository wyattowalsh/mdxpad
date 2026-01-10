/**
 * Error Types and Categorization
 *
 * Defines error categories, types, and utilities for error handling
 * across the preview system.
 *
 * @module shared/types/errors
 */

/**
 * Error categories for the preview system.
 * Used to determine appropriate UI treatment and recovery options.
 */
export type ErrorCategory = 'syntax' | 'runtime' | 'network' | 'timeout' | 'unknown';

/**
 * Error severity levels.
 * Determines visual treatment and whether errors block rendering.
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Structured error with categorization and metadata.
 */
export interface CategorizedError {
  /** Unique identifier for the error instance */
  readonly id: string;
  /** Error category for UI treatment */
  readonly category: ErrorCategory;
  /** Severity level */
  readonly severity: ErrorSeverity;
  /** User-friendly error message */
  readonly message: string;
  /** Technical details for debugging (shown in expandable section) */
  readonly details?: string | undefined;
  /** Source location if available */
  readonly location?: ErrorLocation | undefined;
  /** Whether this error is recoverable with a retry */
  readonly recoverable: boolean;
  /** Suggested action for the user */
  readonly suggestion?: string | undefined;
  /** Timestamp of error occurrence */
  readonly timestamp: number;
  /** Original error for logging */
  readonly originalError?: Error | undefined;
}

/**
 * Source location information for errors.
 */
export interface ErrorLocation {
  readonly line?: number;
  readonly column?: number;
  readonly source?: string;
}

/**
 * Error recovery action types.
 */
export type ErrorRecoveryAction = 'retry' | 'reset' | 'dismiss' | 'edit';

/**
 * Error reporting payload for logging/analytics.
 */
export interface ErrorReport {
  readonly error: CategorizedError;
  readonly context: ErrorContext;
  readonly userAgent: string;
  readonly timestamp: number;
}

/**
 * Context information for error reporting.
 */
export interface ErrorContext {
  /** Component or module where error occurred */
  readonly component: string;
  /** Source content length (for performance correlation) */
  readonly sourceLength?: number;
  /** Whether preview was in loading state */
  readonly wasLoading?: boolean;
  /** Any additional context */
  readonly metadata?: Record<string, unknown>;
}

/**
 * User-friendly messages for each error category.
 */
export const ERROR_CATEGORY_MESSAGES: Readonly<Record<ErrorCategory, string>> = {
  syntax: 'There is a syntax error in your MDX',
  runtime: 'An error occurred while rendering',
  network: 'Failed to load a resource',
  timeout: 'The preview took too long to respond',
  unknown: 'An unexpected error occurred',
};

/**
 * Suggested actions for each error category.
 */
export const ERROR_CATEGORY_SUGGESTIONS: Readonly<Record<ErrorCategory, string>> = {
  syntax: 'Check the highlighted line for missing brackets, quotes, or invalid syntax.',
  runtime: 'Review your component code for undefined variables or invalid operations.',
  network: 'Check your network connection and try again.',
  timeout: 'Try simplifying your content or refreshing the preview.',
  unknown: 'Try refreshing the preview. If the issue persists, restart the application.',
};

/**
 * Error category icons (Unicode).
 */
export const ERROR_CATEGORY_ICONS: Readonly<Record<ErrorCategory, string>> = {
  syntax: '\u270F\uFE0F',   // Pencil (edit-related)
  runtime: '\u26A0\uFE0F', // Warning
  network: '\uD83C\uDF10', // Globe
  timeout: '\u23F1\uFE0F', // Stopwatch
  unknown: '\u2753',       // Question mark
};

/**
 * Generates a unique error ID.
 */
export function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Categorizes an error based on its message and type.
 */
export function categorizeError(error: Error | string): ErrorCategory {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();

  // Syntax errors
  if (
    lowerMessage.includes('syntax') ||
    lowerMessage.includes('unexpected token') ||
    lowerMessage.includes('unexpected identifier') ||
    lowerMessage.includes('missing') ||
    lowerMessage.includes('unterminated') ||
    lowerMessage.includes('parse error') ||
    lowerMessage.includes('expected')
  ) {
    return 'syntax';
  }

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('cors') ||
    lowerMessage.includes('failed to load') ||
    lowerMessage.includes('connection')
  ) {
    return 'network';
  }

  // Timeout errors
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('took too long')
  ) {
    return 'timeout';
  }

  // Runtime errors (type errors, reference errors, etc.)
  if (
    lowerMessage.includes('undefined') ||
    lowerMessage.includes('null') ||
    lowerMessage.includes('is not a function') ||
    lowerMessage.includes('is not defined') ||
    lowerMessage.includes('cannot read') ||
    lowerMessage.includes('cannot set') ||
    lowerMessage.includes('type error') ||
    lowerMessage.includes('reference error') ||
    error instanceof TypeError ||
    error instanceof ReferenceError
  ) {
    return 'runtime';
  }

  return 'unknown';
}

/**
 * Creates a user-friendly error message based on the original error.
 */
export function createUserFriendlyMessage(
  error: Error | string,
  category: ErrorCategory
): string {
  const originalMessage = typeof error === 'string' ? error : error.message;

  // Start with the category-specific prefix
  const prefix = ERROR_CATEGORY_MESSAGES[category];

  // For syntax errors, try to make the message more readable
  if (category === 'syntax') {
    // Clean up common MDX/JSX syntax error formats
    const cleanedMessage = originalMessage
      .replace(/^.*?:\s*/, '') // Remove "Error:" prefix
      .replace(/\(\d+:\d+\)/, '') // Remove line:col in message
      .trim();
    return `${prefix}: ${cleanedMessage}`;
  }

  // For runtime errors, simplify technical messages
  if (category === 'runtime') {
    if (originalMessage.includes('is not defined')) {
      const match = originalMessage.match(/(\w+) is not defined/);
      if (match !== null && match[1] !== undefined) {
        return `${prefix}: "${match[1]}" is not defined. Make sure it is imported or declared.`;
      }
    }
    if (originalMessage.includes('is not a function')) {
      const match = originalMessage.match(/(\w+) is not a function/);
      if (match !== null && match[1] !== undefined) {
        return `${prefix}: "${match[1]}" cannot be called as a function.`;
      }
    }
  }

  // Default: return prefix with original message
  return `${prefix}: ${originalMessage}`;
}

/**
 * Creates a categorized error from a raw error or message.
 */
export function createCategorizedError(
  error: Error | string,
  location?: ErrorLocation,
  overrides?: Partial<CategorizedError>
): CategorizedError {
  const category = overrides?.category ?? categorizeError(error);
  const originalError = typeof error === 'string' ? new Error(error) : error;

  return {
    id: generateErrorId(),
    category,
    severity: 'error',
    message: createUserFriendlyMessage(error, category),
    details: originalError.stack,
    location,
    recoverable: category !== 'syntax', // Syntax errors require code changes
    suggestion: ERROR_CATEGORY_SUGGESTIONS[category],
    timestamp: Date.now(),
    originalError,
    ...overrides,
  };
}

/**
 * Determines if an error should allow retry.
 */
export function isRetryable(error: CategorizedError): boolean {
  return error.recoverable && (error.category === 'network' || error.category === 'timeout');
}

/**
 * Determines if an error can be recovered by resetting state.
 */
export function isResettable(error: CategorizedError): boolean {
  return error.category === 'runtime' || error.category === 'unknown';
}
