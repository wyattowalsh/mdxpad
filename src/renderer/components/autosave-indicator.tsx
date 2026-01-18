/**
 * AutosaveIndicator Component
 *
 * Displays autosave status with visual feedback for saving, saved, and failed states.
 * Shows a 16x16px icon-only muted indicator in the status bar.
 * After 3 consecutive failures, displays a toast with retry and disable options.
 *
 * @module renderer/components/autosave-indicator
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from './ui/tooltip';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the AutosaveIndicator component.
 */
export interface AutosaveIndicatorProps {
  /** Whether a save is in progress */
  isSaving: boolean;
  /** Timestamp of last successful save (null if never saved) */
  lastSaveAt: number | null;
  /** Last save result */
  lastSaveResult: 'success' | 'error' | null;
  /** Error message from last failed save */
  lastError: string | null;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Callback to retry save immediately */
  onRetry: () => void;
  /** Callback to disable autosave */
  onDisable: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Number of consecutive failures before showing toast */
const FAILURE_THRESHOLD = 3;

/** Auto-dismiss delay for toast in milliseconds */
const TOAST_DISMISS_DELAY = 8000;

/** Duration to show success indicator before fading */
const SUCCESS_FADE_DELAY = 3000;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format timestamp as relative time (e.g., "2m ago").
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted relative time string
 */
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Truncate error message for display.
 *
 * @param error - Error message
 * @param maxLength - Maximum length before truncation
 * @returns Truncated error message
 */
function truncateError(error: string, maxLength = 50): string {
  if (error.length <= maxLength) return error;
  return `${error.slice(0, maxLength)}...`;
}

// =============================================================================
// ICON COMPONENTS
// =============================================================================

/**
 * Cloud icon for idle state.
 */
function CloudIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

/**
 * Animated spinner icon for saving state.
 */
function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('animate-spin', className)}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/**
 * Checkmark circle icon for success state.
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/**
 * Warning triangle icon for error state.
 */
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// =============================================================================
// TOAST COMPONENT
// =============================================================================

interface FailureToastProps {
  error: string | null;
  onRetry: () => void;
  onDisable: () => void;
  onDismiss: () => void;
}

/**
 * Toast component for displaying failure notification.
 * Auto-dismisses after 8 seconds, pauses on hover.
 */
function FailureToast({ error, onRetry, onDisable, onDismiss }: FailureToastProps) {
  const [isPaused, setIsPaused] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingTimeRef = useRef(TOAST_DISMISS_DELAY);
  const startTimeRef = useRef(Date.now());

  // Handle auto-dismiss timer
  useEffect(() => {
    if (isPaused) {
      // Clear timer and save remaining time
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      remainingTimeRef.current -= Date.now() - startTimeRef.current;
    } else {
      // Start or resume timer
      startTimeRef.current = Date.now();
      dismissTimerRef.current = setTimeout(onDismiss, remainingTimeRef.current);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [isPaused, onDismiss]);

  const handleMouseEnter = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPaused(false);
  }, []);

  const handleRetry = useCallback(() => {
    onRetry();
    onDismiss();
  }, [onRetry, onDismiss]);

  const handleDisable = useCallback(() => {
    onDisable();
    onDismiss();
  }, [onDisable, onDismiss]);

  return (
    <div
      className={cn(
        'absolute bottom-full right-0 mb-2',
        'w-64 p-3 rounded-md shadow-lg',
        'bg-popover border border-border',
        'text-popover-foreground',
        'animate-in fade-in-0 slide-in-from-bottom-2',
        'z-50'
      )}
      role="alert"
      aria-live="assertive"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="autosave-failure-toast"
    >
      <div className="flex items-start gap-2">
        <WarningIcon className="text-yellow-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Autosave failed</p>
          {error && (
            <p className="text-xs text-muted-foreground mt-1 break-words">
              {truncateError(error)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          className={cn(
            'flex-1 px-3 py-1.5 text-xs font-medium rounded',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
          )}
          onClick={handleRetry}
          data-testid="autosave-retry-button"
        >
          Retry Now
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 px-3 py-1.5 text-xs font-medium rounded',
            'bg-transparent text-muted-foreground',
            'hover:bg-accent hover:text-accent-foreground transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
          )}
          onClick={handleDisable}
          data-testid="autosave-disable-button"
        >
          Disable Autosave
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * AutosaveIndicator displays autosave status with visual feedback.
 *
 * Visual states:
 * - idle: Subtle cloud icon (when lastSaveResult is null)
 * - saving: Animated spinner icon, muted color
 * - saved: Checkmark icon, muted green, briefly shows then fades
 * - failed: Warning icon, muted yellow/orange
 *
 * After 3 consecutive failures, shows a toast with retry/disable options.
 *
 * @example
 * ```tsx
 * <AutosaveIndicator
 *   isSaving={false}
 *   lastSaveAt={Date.now() - 120000}
 *   lastSaveResult="success"
 *   lastError={null}
 *   consecutiveFailures={0}
 *   onRetry={() => triggerSave()}
 *   onDisable={() => setAutosaveEnabled(false)}
 * />
 * ```
 */
function AutosaveIndicatorComponent({
  isSaving,
  lastSaveAt,
  lastSaveResult,
  lastError,
  consecutiveFailures,
  onRetry,
  onDisable,
}: AutosaveIndicatorProps) {
  const [showSuccessFade, setShowSuccessFade] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const prevConsecutiveFailuresRef = useRef(consecutiveFailures);

  // Track success state for fade animation
  useEffect(() => {
    if (lastSaveResult === 'success') {
      setShowSuccessFade(true);
      const timer = setTimeout(() => {
        setShowSuccessFade(false);
      }, SUCCESS_FADE_DELAY);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastSaveResult, lastSaveAt]);

  // Show toast when reaching failure threshold
  useEffect(() => {
    if (
      consecutiveFailures >= FAILURE_THRESHOLD &&
      prevConsecutiveFailuresRef.current < FAILURE_THRESHOLD
    ) {
      setShowToast(true);
    }
    prevConsecutiveFailuresRef.current = consecutiveFailures;
  }, [consecutiveFailures]);

  // Reset toast when failures are cleared
  useEffect(() => {
    if (consecutiveFailures === 0) {
      setShowToast(false);
    }
  }, [consecutiveFailures]);

  const handleDismissToast = useCallback(() => {
    setShowToast(false);
  }, []);

  // Determine current visual state
  const getState = (): 'idle' | 'saving' | 'saved' | 'failed' => {
    if (isSaving) return 'saving';
    if (lastSaveResult === 'error') return 'failed';
    if (lastSaveResult === 'success') return 'saved';
    return 'idle';
  };

  const state = getState();

  // Generate tooltip content
  const getTooltipContent = (): string => {
    switch (state) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return lastSaveAt ? `Saved ${formatRelativeTime(lastSaveAt)}` : 'Saved';
      case 'failed':
        return lastError ? `Save failed: ${truncateError(lastError, 40)}` : 'Save failed';
      case 'idle':
      default:
        return 'Autosave enabled';
    }
  };

  // Render appropriate icon based on state
  const renderIcon = () => {
    switch (state) {
      case 'saving':
        return <SpinnerIcon className="text-muted-foreground" />;
      case 'saved':
        return (
          <CheckIcon
            className={cn(
              'text-green-500/70',
              showSuccessFade ? 'opacity-100' : 'opacity-50',
              'transition-opacity duration-500'
            )}
          />
        );
      case 'failed':
        return <WarningIcon className="text-yellow-500/80" />;
      case 'idle':
      default:
        return <CloudIcon className="text-muted-foreground/50" />;
    }
  };

  return (
    <TooltipProvider>
      <div className="relative" data-testid="autosave-indicator">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center justify-center',
                'w-4 h-4',
                'cursor-default'
              )}
              role="status"
              aria-label={getTooltipContent()}
            >
              {renderIcon()}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            <span className="text-xs">{getTooltipContent()}</span>
          </TooltipContent>
        </Tooltip>

        {showToast && consecutiveFailures >= FAILURE_THRESHOLD && (
          <FailureToast
            error={lastError}
            onRetry={onRetry}
            onDisable={onDisable}
            onDismiss={handleDismissToast}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

export const AutosaveIndicator = memo(AutosaveIndicatorComponent);
AutosaveIndicator.displayName = 'AutosaveIndicator';

export default AutosaveIndicator;
