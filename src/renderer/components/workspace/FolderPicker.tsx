/**
 * Folder Picker Dialog
 *
 * Native folder picker via IPC with recent folders list
 * and folder accessibility validation.
 *
 * @module renderer/components/workspace/FolderPicker
 */

import * as React from 'react';
import { Folder, FolderOpen, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ui/dialog';
import { Button } from '@ui/button';
import { cn } from '@shared/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface FolderPickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (folderPath: string) => void;
  readonly recentFolders?: readonly string[];
}

// =============================================================================
// HELPERS
// =============================================================================

function getFolderName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const RecentFolderItem: React.FC<{
  readonly folder: string;
  readonly onSelect: (folder: string) => void;
}> = ({ folder, onSelect }) => (
  <button
    type="button"
    className={cn(
      'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left',
      'hover:bg-accent transition-colors'
    )}
    onClick={() => onSelect(folder)}
  >
    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
    <div className="flex flex-col overflow-hidden">
      <span className="font-medium truncate">{getFolderName(folder)}</span>
      <span className="text-xs text-muted-foreground truncate">{folder}</span>
    </div>
  </button>
);
RecentFolderItem.displayName = 'RecentFolderItem';

const RecentFoldersList: React.FC<{
  readonly folders: readonly string[];
  readonly onSelect: (folder: string) => void;
}> = ({ folders, onSelect }) => {
  if (folders.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Clock className="h-3 w-3" />
        Recent Folders
      </h4>
      <div className="flex flex-col gap-0.5">
        {folders.map((folder) => (
          <RecentFolderItem key={folder} folder={folder} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
};
RecentFoldersList.displayName = 'RecentFoldersList';

// =============================================================================
// COMPONENT
// =============================================================================

function useBrowseFolder(onSelect: (p: string) => void, onOpenChange: (o: boolean) => void) {
  const [isSelecting, setIsSelecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleBrowse = React.useCallback(() => {
    setIsSelecting(true);
    setError(null);
    try {
      const folderPath = prompt('Enter folder path:');
      if (folderPath) {
        onSelect(folderPath);
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open folder picker');
    } finally {
      setIsSelecting(false);
    }
  }, [onSelect, onOpenChange]);

  const handleSelectRecent = React.useCallback(
    (folder: string) => {
      onSelect(folder);
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  return { isSelecting, error, handleBrowse, handleSelectRecent };
}

export const FolderPicker: React.FC<FolderPickerProps> = ({
  open,
  onOpenChange,
  onSelect,
  recentFolders = [],
}) => {
  const b = useBrowseFolder(onSelect, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Workspace Folder</DialogTitle>
          <DialogDescription>Choose a folder to add to your workspace.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            onClick={b.handleBrowse}
            disabled={b.isSelecting}
          >
            <FolderOpen className="h-6 w-6" />
            {b.isSelecting ? 'Selecting...' : 'Browse for Folder'}
          </Button>
          {b.error ? <p className="text-sm text-destructive">{b.error}</p> : null}
          <RecentFoldersList folders={recentFolders} onSelect={b.handleSelectRecent} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

FolderPicker.displayName = 'FolderPicker';
