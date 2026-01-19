/**
 * ConflictDialog Component
 *
 * Modal dialog for resolving file conflicts during recovery.
 * Displays when a source file was modified externally after the
 * recovery content was saved.
 *
 * Features:
 * - Side-by-side diff view showing recovery vs disk content
 * - Three resolution options: keep recovery, keep disk, or save as new file
 * - Timestamps for both versions to help users make informed decisions
 * - Full keyboard navigation support (Tab, Enter, Escape)
 * - Accessible ARIA attributes for screen readers
 *
 * Per FR-016: Detect when source file was modified externally and present
 * a conflict resolution dialog with diff view, allowing user to choose:
 * keep recovery version, keep disk version, or save as new file.
 *
 * @module renderer/components/conflict-dialog
 */

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileText, Clock, Save, HardDrive, FilePlus } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import type { FileConflict, ConflictResolution, DocumentId } from '@shared/contracts/autosave-schemas';
import type { ConflictResolveResponse } from '@shared/contracts/autosave-ipc';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the ConflictDialog component.
 */
export interface ConflictDialogProps {
  /** Whether the dialog is currently open */
  readonly isOpen: boolean;
  /** Conflict information to display, or null when no conflict */
  readonly conflict: FileConflict | null;
  /** Callback when user makes a resolution decision */
  readonly onResolve: (resolution: ConflictResolution) => void;
  /** Callback when user cancels without making a decision */
  readonly onCancel: () => void;
}

/**
 * Resolution choice for internal state tracking.
 */
type ResolutionChoice = 'recovery' | 'disk' | 'save-as';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum number of lines to show in diff preview before truncation */
const MAX_PREVIEW_LINES = 500;

/** Line numbers to show context around differences */
const DIFF_CONTEXT_LINES = 3;

// =============================================================================
// IPC STUB
// =============================================================================

/**
 * Resolve a file conflict via IPC.
 *
 * @param resolution - The conflict resolution decision
 * @returns Promise resolving to the IPC response
 *
 * @remarks
 * TODO: Replace with actual IPC call when preload is updated.
 * This stub allows the component to be developed and tested before
 * the main process handlers are fully implemented.
 */
const resolveConflict = async (resolution: ConflictResolution): Promise<ConflictResolveResponse> => {
  // TODO: Replace with actual IPC call
  console.debug('[ConflictDialog] Resolving conflict:', resolution);
  throw new Error('Conflict resolve API not available - preload needs update');
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format a Unix timestamp as a human-readable date/time string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date/time string with relative day if applicable
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return `Today at ${date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Split content into lines for diff display.
 *
 * @param content - Content string to split
 * @returns Array of lines
 */
function splitLines(content: string): string[] {
  return content.split('\n');
}

/**
 * Compute a simple line-by-line diff between two content strings.
 * Marks lines as added, removed, or unchanged.
 *
 * @param recoveryContent - Content from recovery file
 * @param diskContent - Content from disk file
 * @returns Object with categorized lines for both sides
 *
 * @remarks
 * This is a simple implementation. Per FR-016, if a proper diff library
 * like diff-match-patch is available, it should be used for better results.
 * Falls back to showing both versions without highlighting if computation fails.
 */
function computeSimpleDiff(
  recoveryContent: string,
  diskContent: string
): {
  recoveryLines: Array<{ text: string; type: 'added' | 'removed' | 'unchanged' }>;
  diskLines: Array<{ text: string; type: 'added' | 'removed' | 'unchanged' }>;
} {
  const recoveryArr = splitLines(recoveryContent);
  const diskArr = splitLines(diskContent);

  // Simple line-based comparison
  // For identical lines at same index: unchanged
  // For different lines: mark as changed
  const maxLen = Math.max(recoveryArr.length, diskArr.length);

  const recoveryLines: Array<{ text: string; type: 'added' | 'removed' | 'unchanged' }> = [];
  const diskLines: Array<{ text: string; type: 'added' | 'removed' | 'unchanged' }> = [];

  for (let i = 0; i < maxLen; i++) {
    const recoveryLine = recoveryArr[i];
    const diskLine = diskArr[i];

    if (recoveryLine === diskLine) {
      // Lines match
      if (recoveryLine !== undefined) {
        recoveryLines.push({ text: recoveryLine, type: 'unchanged' });
      }
      if (diskLine !== undefined) {
        diskLines.push({ text: diskLine, type: 'unchanged' });
      }
    } else {
      // Lines differ
      if (recoveryLine !== undefined) {
        recoveryLines.push({ text: recoveryLine, type: 'added' });
      }
      if (diskLine !== undefined) {
        diskLines.push({ text: diskLine, type: 'removed' });
      }
    }
  }

  return { recoveryLines, diskLines };
}

/**
 * Get the file name from a file path.
 *
 * @param filePath - Full file path
 * @returns Just the file name portion
 */
function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Props for the DiffPane component.
 */
interface DiffPaneProps {
  /** Title for this pane (e.g., "Recovery Version") */
  readonly title: string;
  /** Timestamp for this version */
  readonly timestamp: number;
  /** Lines to display with their diff type */
  readonly lines: ReadonlyArray<{ text: string; type: 'added' | 'removed' | 'unchanged' }>;
  /** CSS class for the background highlight color */
  readonly highlightClass: string;
  /** Icon to display in the header */
  readonly icon: React.ReactNode;
}

/**
 * Single pane of the diff view showing one version's content.
 */
const DiffPane = memo(function DiffPaneComponent({
  title,
  timestamp,
  lines,
  highlightClass,
  icon,
}: DiffPaneProps): React.JSX.Element {
  const truncatedLines = lines.slice(0, MAX_PREVIEW_LINES);
  const isTruncated = lines.length > MAX_PREVIEW_LINES;

  return (
    <div className="flex-1 min-w-0 flex flex-col border rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{title}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>{formatTimestamp(timestamp)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 h-64">
        <pre className="text-xs font-mono p-2 whitespace-pre-wrap break-words">
          {truncatedLines.map((line, index) => (
            <div
              key={index}
              className={cn(
                'px-1 -mx-1 rounded-sm',
                line.type === 'added' && highlightClass,
                line.type === 'removed' && 'bg-red-500/10 text-red-600 dark:text-red-400'
              )}
            >
              <span className="select-none text-muted-foreground/50 mr-2 inline-block w-8 text-right">
                {index + 1}
              </span>
              {line.text || '\u00A0'}
            </div>
          ))}
          {isTruncated && (
            <div className="text-muted-foreground italic mt-2">
              ... {lines.length - MAX_PREVIEW_LINES} more lines truncated
            </div>
          )}
        </pre>
      </ScrollArea>
    </div>
  );
});

DiffPane.displayName = 'DiffPane';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Conflict resolution dialog for file recovery conflicts.
 *
 * Displays when the source file on disk has been modified since the
 * recovery content was autosaved. Shows a side-by-side diff view and
 * allows the user to choose which version to keep or save as a new file.
 *
 * @example
 * ```tsx
 * <ConflictDialog
 *   isOpen={showConflictDialog}
 *   conflict={fileConflict}
 *   onResolve={(resolution) => {
 *     handleConflictResolution(resolution);
 *   }}
 *   onCancel={() => setShowConflictDialog(false)}
 * />
 * ```
 */
function ConflictDialogComponent({
  isOpen,
  conflict,
  onResolve,
  onCancel,
}: ConflictDialogProps): React.JSX.Element {
  // Track which button is focused for keyboard navigation
  const recoveryButtonRef = useRef<HTMLButtonElement>(null);
  const diskButtonRef = useRef<HTMLButtonElement>(null);
  const saveAsButtonRef = useRef<HTMLButtonElement>(null);

  // Track loading state during resolution
  const [isResolving, setIsResolving] = useState(false);

  // Compute diff only when conflict changes
  const diffResult = useMemo(() => {
    if (!conflict) {
      return null;
    }
    try {
      return computeSimpleDiff(conflict.recoveryContent, conflict.diskContent);
    } catch (error) {
      console.warn('[ConflictDialog] Diff computation failed:', error);
      // Per FR-016: If diff computation fails, show both versions without highlighting
      return {
        recoveryLines: splitLines(conflict.recoveryContent).map((text) => ({
          text,
          type: 'unchanged' as const,
        })),
        diskLines: splitLines(conflict.diskContent).map((text) => ({
          text,
          type: 'unchanged' as const,
        })),
      };
    }
  }, [conflict]);

  /**
   * Handle resolution choice selection.
   *
   * @param choice - The resolution choice made by the user
   */
  const handleResolve = useCallback(
    async (choice: ResolutionChoice) => {
      if (!conflict) {
        return;
      }

      setIsResolving(true);

      try {
        let resolution: ConflictResolution;

        if (choice === 'recovery') {
          resolution = {
            choice: 'recovery',
            documentId: conflict.documentId,
          };
        } else if (choice === 'disk') {
          resolution = {
            choice: 'disk',
            documentId: conflict.documentId,
          };
        } else {
          // For save-as, we need to get a new file path
          // This would typically open a save dialog
          // For now, we'll let the parent component handle the dialog
          resolution = {
            choice: 'save-as',
            documentId: conflict.documentId,
            // newPath will be provided by the parent after showing save dialog
            newPath: '', // Placeholder - parent handles the actual path selection
          };
        }

        onResolve(resolution);
      } finally {
        setIsResolving(false);
      }
    },
    [conflict, onResolve]
  );

  /**
   * Handle "Keep Recovery" button click.
   */
  const handleKeepRecovery = useCallback(() => {
    handleResolve('recovery');
  }, [handleResolve]);

  /**
   * Handle "Keep Disk" button click.
   */
  const handleKeepDisk = useCallback(() => {
    handleResolve('disk');
  }, [handleResolve]);

  /**
   * Handle "Save As..." button click.
   */
  const handleSaveAs = useCallback(() => {
    handleResolve('save-as');
  }, [handleResolve]);

  /**
   * Handle dialog close (X button or backdrop click).
   */
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isResolving) {
        onCancel();
      }
    },
    [isResolving, onCancel]
  );

  /**
   * Handle keyboard navigation.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !isResolving) {
        e.preventDefault();
        onCancel();
      }
    },
    [isResolving, onCancel]
  );

  // Don't render anything if no conflict
  if (!conflict) {
    return <></>;
  }

  const fileName = getFileName(conflict.filePath);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[85vh] flex flex-col"
        onKeyDown={handleKeyDown}
        data-testid="conflict-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" aria-hidden="true" />
            File Conflict Detected
          </DialogTitle>
          <DialogDescription>
            The file <span className="font-medium text-foreground">{fileName}</span> on disk
            has been modified since your last save. Choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        {/* File path info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
          <FileText className="w-4 h-4" aria-hidden="true" />
          <span className="truncate" title={conflict.filePath}>
            {conflict.filePath}
          </span>
        </div>

        {/* Diff view */}
        {diffResult && (
          <div
            className="flex gap-4 flex-1 min-h-0 my-4"
            role="group"
            aria-label="File version comparison"
          >
            {/* Recovery version (left) */}
            <DiffPane
              title="Recovery Version"
              timestamp={conflict.recoveryTimestamp}
              lines={diffResult.recoveryLines}
              highlightClass="bg-green-500/10 text-green-600 dark:text-green-400"
              icon={<Save className="w-4 h-4 text-green-500" aria-hidden="true" />}
            />

            {/* Disk version (right) */}
            <DiffPane
              title="Disk Version"
              timestamp={conflict.diskModifiedAt}
              lines={diffResult.diskLines}
              highlightClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              icon={<HardDrive className="w-4 h-4 text-blue-500" aria-hidden="true" />}
            />
          </div>
        )}

        {/* Footer with action buttons */}
        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          {/* Cancel button (left side) */}
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isResolving}
            className="mr-auto"
            data-testid="conflict-cancel-button"
          >
            Cancel
          </Button>

          {/* Resolution buttons (right side) */}
          <Button
            ref={diskButtonRef}
            variant="outline"
            onClick={handleKeepDisk}
            disabled={isResolving}
            data-testid="conflict-keep-disk-button"
          >
            <HardDrive className="w-4 h-4 mr-1" aria-hidden="true" />
            Keep Disk
          </Button>

          <Button
            ref={saveAsButtonRef}
            variant="outline"
            onClick={handleSaveAs}
            disabled={isResolving}
            data-testid="conflict-save-as-button"
          >
            <FilePlus className="w-4 h-4 mr-1" aria-hidden="true" />
            Save As...
          </Button>

          <Button
            ref={recoveryButtonRef}
            variant="default"
            onClick={handleKeepRecovery}
            disabled={isResolving}
            data-testid="conflict-keep-recovery-button"
          >
            <Save className="w-4 h-4 mr-1" aria-hidden="true" />
            Keep Recovery
          </Button>
        </DialogFooter>

        {/* Keyboard hints for screen readers */}
        <div className="sr-only" aria-live="polite">
          Use Tab to navigate between buttons. Press Enter to activate the focused button.
          Press Escape to cancel without making a decision.
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Memoized ConflictDialog component.
 */
export const ConflictDialog = memo(ConflictDialogComponent);
ConflictDialog.displayName = 'ConflictDialog';

export default ConflictDialog;
