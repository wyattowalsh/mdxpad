/**
 * Error Reporting Hook
 *
 * Provides error logging, reporting, and analytics for the preview system.
 * Supports custom error handlers and centralized error management.
 *
 * @module renderer/hooks/useErrorReporting
 */

import { useCallback, useRef } from 'react';
import type {
  CategorizedError,
  ErrorReport,
  ErrorContext,
} from '@shared/types/errors';
import { createCategorizedError } from '@shared/types/errors';

// ============================================================================
// Types
// ============================================================================

/** Error handler callback type */
export type ErrorHandler = (error: CategorizedError) => void;

/** Error reporter configuration */
export interface ErrorReporterConfig {
  /** Whether to log errors to console */
  readonly logToConsole?: boolean;
  /** Whether to include stack traces in logs */
  readonly includeStackTrace?: boolean;
  /** Custom error handlers */
  readonly handlers?: readonly ErrorHandler[];
  /** Maximum errors to keep in history */
  readonly maxHistorySize?: number;
}

/** Result from useErrorReporting hook */
export interface UseErrorReportingResult {
  /** Report a new error */
  readonly reportError: (
    error: Error | string,
    context?: Partial<ErrorContext>
  ) => CategorizedError;
  /** Get recent error history */
  readonly getErrorHistory: () => readonly CategorizedError[];
  /** Clear error history */
  readonly clearHistory: () => void;
  /** Register an error handler */
  readonly addHandler: (handler: ErrorHandler) => () => void;
  /** Remove an error handler */
  readonly removeHandler: (handler: ErrorHandler) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_HISTORY = 50;
const DEFAULT_CONFIG: Required<ErrorReporterConfig> = {
  logToConsole: true,
  includeStackTrace: true,
  handlers: [],
  maxHistorySize: DEFAULT_MAX_HISTORY,
};

// ============================================================================
// Global Error Registry (singleton for app-wide error tracking)
// ============================================================================

/** Global error history for app-wide access */
let globalErrorHistory: CategorizedError[] = [];

/** Global error handlers */
let globalHandlers: Set<ErrorHandler> = new Set();

/**
 * Reset global state (for testing)
 */
export function _resetGlobalErrorState(): void {
  globalErrorHistory = [];
  globalHandlers = new Set();
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for error reporting and logging.
 *
 * Features:
 * - Centralized error handling
 * - Error categorization
 * - Error history tracking
 * - Custom handler support
 * - Console logging with formatting
 *
 * @example
 * ```tsx
 * const { reportError, getErrorHistory } = useErrorReporting({
 *   logToConsole: true,
 *   handlers: [(error) => analytics.track('error', error)],
 * });
 *
 * try {
 *   // ... code that might throw
 * } catch (error) {
 *   reportError(error, { component: 'PreviewPane' });
 * }
 * ```
 */
export function useErrorReporting(
  config: ErrorReporterConfig = {}
): UseErrorReportingResult {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const handlersRef = useRef<Set<ErrorHandler>>(new Set(mergedConfig.handlers));

  /**
   * Logs error to console with formatting
   */
  const logError = useCallback(
    (error: CategorizedError): void => {
      if (!mergedConfig.logToConsole) return;

      const prefix = `[${error.category.toUpperCase()}]`;
      const timestamp = new Date(error.timestamp).toISOString();

      console.group(`${prefix} ${error.message}`);
      console.log('Timestamp:', timestamp);
      console.log('Category:', error.category);
      console.log('Severity:', error.severity);
      console.log('Recoverable:', error.recoverable);

      if (error.location !== undefined) {
        console.log('Location:', error.location);
      }

      if (error.suggestion !== undefined) {
        console.log('Suggestion:', error.suggestion);
      }

      if (mergedConfig.includeStackTrace && error.details !== undefined) {
        console.log('Details:', error.details);
      }

      console.groupEnd();
    },
    [mergedConfig.logToConsole, mergedConfig.includeStackTrace]
  );

  /**
   * Notifies all registered handlers
   */
  const notifyHandlers = useCallback((error: CategorizedError): void => {
    // Notify local handlers
    for (const handler of handlersRef.current) {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('[ErrorReporting] Handler threw error:', handlerError);
      }
    }

    // Notify global handlers
    for (const handler of globalHandlers) {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('[ErrorReporting] Global handler threw error:', handlerError);
      }
    }
  }, []);

  /**
   * Reports an error
   */
  const reportError = useCallback(
    (error: Error | string, context?: Partial<ErrorContext>): CategorizedError => {
      const categorizedError = createCategorizedError(error);

      // Add to history (with size limit)
      globalErrorHistory.unshift(categorizedError);
      if (globalErrorHistory.length > mergedConfig.maxHistorySize) {
        globalErrorHistory = globalErrorHistory.slice(0, mergedConfig.maxHistorySize);
      }

      // Log to console
      logError(categorizedError);

      // Notify handlers
      notifyHandlers(categorizedError);

      return categorizedError;
    },
    [logError, notifyHandlers, mergedConfig.maxHistorySize]
  );

  /**
   * Gets error history
   */
  const getErrorHistory = useCallback((): readonly CategorizedError[] => {
    return globalErrorHistory;
  }, []);

  /**
   * Clears error history
   */
  const clearHistory = useCallback((): void => {
    globalErrorHistory = [];
  }, []);

  /**
   * Adds an error handler and returns cleanup function
   */
  const addHandler = useCallback((handler: ErrorHandler): (() => void) => {
    handlersRef.current.add(handler);
    globalHandlers.add(handler);

    return () => {
      handlersRef.current.delete(handler);
      globalHandlers.delete(handler);
    };
  }, []);

  /**
   * Removes an error handler
   */
  const removeHandler = useCallback((handler: ErrorHandler): void => {
    handlersRef.current.delete(handler);
    globalHandlers.delete(handler);
  }, []);

  return {
    reportError,
    getErrorHistory,
    clearHistory,
    addHandler,
    removeHandler,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates an error report for external logging services.
 */
export function createErrorReport(
  error: CategorizedError,
  context: ErrorContext
): ErrorReport {
  return {
    error,
    context,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    timestamp: Date.now(),
  };
}

/**
 * Formats an error for display in logs.
 */
export function formatErrorForLog(error: CategorizedError): string {
  const parts = [
    `[${error.category.toUpperCase()}]`,
    error.message,
  ];

  if (error.location?.line !== undefined) {
    parts.push(`at line ${error.location.line}`);
    if (error.location.column !== undefined) {
      parts.push(`column ${error.location.column}`);
    }
  }

  return parts.join(' ');
}

export default useErrorReporting;
