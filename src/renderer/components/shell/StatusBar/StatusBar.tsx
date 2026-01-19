/**
 * StatusBar Component
 *
 * Main container for the application status bar.
 * Fixed to the bottom of the window, displays:
 * - Left: FileInfo (filename + dirty indicator)
 * - Center: CursorPosition (line:col)
 * - Right: ErrorCount (error badge with popover)
 *
 * @module renderer/components/shell/StatusBar/StatusBar
 */

import { memo } from 'react';
import { cn } from '@shared/lib/utils';
import { FileInfo } from './FileInfo';
import { CursorPosition } from './CursorPosition';
import { ErrorCount } from './ErrorCount';
import { AutosaveIndicator } from '../../autosave-indicator';
import type { StatusBarProps } from './types';

/**
 * StatusBar is the main application status bar component.
 * Displays file info, cursor position, and error count in a fixed bottom bar.
 *
 * @example
 * ```tsx
 * <StatusBar
 *   fileName="document.mdx"
 *   isDirty={true}
 *   line={42}
 *   column={15}
 *   errors={compilationErrors}
 *   onErrorClick={(error) => goToLine(error.line, error.column)}
 * />
 * ```
 */
function StatusBarComponent({
  fileName,
  isDirty,
  isOrphan = false,
  line,
  column,
  errors,
  onErrorClick,
  autosave,
}: StatusBarProps) {
  return (
    <div
      className={cn(
        'h-6 px-3 flex items-center justify-between',
        'border-t border-border',
        'bg-muted/50',
        'select-none'
      )}
      role="status"
      aria-label="Status bar"
      data-testid="status-bar"
    >
      {/* Left: File Info */}
      <div className="flex-1 flex items-center justify-start min-w-0">
        <FileInfo fileName={fileName} isDirty={isDirty} isOrphan={isOrphan} />
      </div>

      {/* Center: Cursor Position */}
      <div className="flex items-center justify-center px-4">
        <CursorPosition line={line} column={column} />
      </div>

      {/* Right: Autosave Indicator + Error Count */}
      <div className="flex-1 flex items-center justify-end gap-3">
        {autosave && (
          <AutosaveIndicator
            isSaving={autosave.isSaving}
            lastSaveAt={autosave.lastSaveAt}
            lastSaveResult={autosave.lastSaveResult}
            lastError={autosave.lastError}
            consecutiveFailures={autosave.consecutiveFailures}
            onRetry={autosave.onRetry}
            onDisable={autosave.onDisable}
          />
        )}
        <ErrorCount errors={errors} onErrorClick={onErrorClick} />
      </div>
    </div>
  );
}

export const StatusBar = memo(StatusBarComponent);
StatusBar.displayName = 'StatusBar';
