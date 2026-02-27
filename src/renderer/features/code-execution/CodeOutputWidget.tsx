/**
 * Code Output Widget
 *
 * React component that displays the output of executed code,
 * including console logs, return values, and error messages.
 *
 * @module renderer/features/code-execution/CodeOutputWidget
 */

import React from 'react';

// =============================================================================
// Types
// =============================================================================

export interface CodeOutputProps {
  /** Whether the execution succeeded */
  readonly success: boolean;
  /** Captured console.log output lines */
  readonly logs: readonly string[];
  /** Return value of the executed code */
  readonly returnValue: string | null;
  /** Error message if execution failed */
  readonly error: string | null;
  /** Execution duration in milliseconds */
  readonly durationMs: number;
  /** Whether code is currently running */
  readonly isRunning: boolean;
  /** Callback to dismiss the output */
  readonly onDismiss?: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Displays code execution output with logs, return value, and error state.
 */
export const CodeOutputWidget: React.FC<CodeOutputProps> = ({
  success,
  logs,
  returnValue,
  error,
  durationMs,
  isRunning,
  onDismiss,
}) => {
  if (isRunning) {
    return (
      <div className="border-l-2 border-blue-500 bg-blue-500/5 px-3 py-2 font-mono text-xs">
        <span className="text-blue-400">Running...</span>
      </div>
    );
  }

  const hasLogs = logs.length > 0;
  const hasReturn = returnValue !== null;
  const hasError = error !== null;

  if (!hasLogs && !hasReturn && !hasError) {
    return (
      <div className="border-l-2 border-zinc-600 bg-zinc-800/50 px-3 py-2 font-mono text-xs">
        <span className="text-zinc-500">No output ({durationMs.toFixed(0)}ms)</span>
      </div>
    );
  }

  return (
    <div
      className={`border-l-2 px-3 py-2 font-mono text-xs ${
        success ? 'border-green-500 bg-green-500/5' : 'border-red-500 bg-red-500/5'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[10px] ${success ? 'text-green-500' : 'text-red-500'}`}>
          {success ? 'Output' : 'Error'} ({durationMs.toFixed(0)}ms)
        </span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-zinc-500 hover:text-zinc-300"
            aria-label="Dismiss output"
          >
            x
          </button>
        )}
      </div>

      {hasLogs && (
        <div className="mt-1 space-y-0.5">
          {logs.map((line, i) => (
            <div key={`log-${i}`} className="whitespace-pre-wrap text-zinc-300">
              {line}
            </div>
          ))}
        </div>
      )}

      {hasReturn && (
        <div className="mt-1 whitespace-pre-wrap text-emerald-400">
          {'=> '}
          {returnValue}
        </div>
      )}

      {hasError && <div className="mt-1 whitespace-pre-wrap text-red-400">{error}</div>}
    </div>
  );
};

CodeOutputWidget.displayName = 'CodeOutputWidget';
