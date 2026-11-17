/**
 * VersionRestoreDialog Component
 *
 * Confirmation dialog for restoring a previous version.
 * Shows a summary of changes and provides options for creating
 * a backup before restoring.
 *
 * @module renderer/components/history/VersionRestoreDialog
 */

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Button } from '@renderer/components/ui/button';
import type { VersionEntry } from '@shared/contracts/history-schemas';

// ============================================================================
// Types
// ============================================================================

export interface VersionRestoreDialogProps {
  readonly entry: VersionEntry;
  readonly addedLines: number;
  readonly removedLines: number;
  readonly isOpen: boolean;
  readonly isRestoring: boolean;
  readonly onRestore: (createBackup: boolean) => void;
  readonly onCancel: () => void;
  readonly className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function getSourceLabel(source: string): string {
  switch (source) {
    case 'autosave':
      return 'auto-save';
    case 'manual':
      return 'manual save';
    case 'git':
      return 'git commit';
    default:
      return source;
  }
}

function ChangesSummary({
  added,
  removed,
}: {
  readonly added: number;
  readonly removed: number;
}): React.JSX.Element {
  return (
    <div className="mb-4 flex gap-4 text-sm">
      {added > 0 && (
        <span className="text-green-600 dark:text-green-400">
          +{added} line{added !== 1 ? 's' : ''} will be restored
        </span>
      )}
      {removed > 0 && (
        <span className="text-red-600 dark:text-red-400">
          -{removed} line{removed !== 1 ? 's' : ''} will be removed
        </span>
      )}
    </div>
  );
}

function VersionDetails({ entry }: { readonly entry: VersionEntry }): React.JSX.Element {
  return (
    <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="mb-1 flex justify-between">
        <span className="text-muted-foreground">Source:</span>
        <span className="font-medium">{getSourceLabel(entry.source)}</span>
      </div>
      <div className="mb-1 flex justify-between">
        <span className="text-muted-foreground">Date:</span>
        <span className="font-medium">{formatDateTime(entry.timestamp)}</span>
      </div>
      {entry.label !== undefined && entry.label.length > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Label:</span>
          <span className="truncate font-medium">{entry.label}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

function DialogHeader(): React.JSX.Element {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <h2 id="restore-dialog-title" className="text-lg font-semibold">
          Restore Version
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This will overwrite your current content with the selected version.
        </p>
      </div>
    </div>
  );
}

function BackupCheckbox({
  checked,
  onChange,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
      <span>Create backup of current content before restoring</span>
    </label>
  );
}

/**
 * Confirmation dialog for restoring a previous version.
 */
export const VersionRestoreDialog = React.memo(function VersionRestoreDialog({
  entry,
  addedLines,
  removedLines,
  isOpen,
  isRestoring,
  onRestore,
  onCancel,
  className,
}: VersionRestoreDialogProps): React.JSX.Element | null {
  const [createBackup, setCreateBackup] = React.useState(true);

  const handleRestore = React.useCallback(() => {
    onRestore(createBackup);
  }, [createBackup, onRestore]);

  if (!isOpen) return null;

  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-center justify-center bg-black/50', className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="restore-dialog-title"
    >
      <div className="mx-4 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <DialogHeader />
        <VersionDetails entry={entry} />
        <ChangesSummary added={addedLines} removed={removedLines} />
        <BackupCheckbox checked={createBackup} onChange={setCreateBackup} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isRestoring}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRestore} disabled={isRestoring}>
            {isRestoring ? 'Restoring...' : 'Restore'}
          </Button>
        </div>
      </div>
    </div>
  );
});
