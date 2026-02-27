/**
 * Multi-Root Panel Component
 *
 * Multi-folder workspace panel for adding/removing workspace folders,
 * reordering, and per-folder settings.
 *
 * @module renderer/components/workspace/MultiRootPanel
 */

import * as React from 'react';
import {
  FolderPlus,
  X,
  GripVertical,
  Settings2,
  ChevronRight,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Button } from '@ui/button';
import { FolderPicker } from './FolderPicker';

// =============================================================================
// TYPES
// =============================================================================

export interface WorkspaceFolder {
  readonly path: string;
  readonly name: string;
  readonly excludePatterns: readonly string[];
}

export interface MultiRootPanelProps {
  readonly folders: readonly WorkspaceFolder[];
  readonly onAddFolder: (path: string) => void;
  readonly onRemoveFolder: (path: string) => void;
  readonly onReorderFolders: (folders: readonly WorkspaceFolder[]) => void;
  readonly onUpdateFolder: (path: string, updates: Partial<WorkspaceFolder>) => void;
  readonly className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getFolderName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

// =============================================================================
// HOOKS
// =============================================================================

function useDragReorder(
  folders: readonly WorkspaceFolder[],
  onReorderFolders: (f: readonly WorkspaceFolder[]) => void
) {
  const [draggedIdx, setDraggedIdx] = React.useState<number | null>(null);

  const handleDragStart = React.useCallback((_e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = React.useCallback(
    (_e: React.DragEvent, targetIdx: number) => {
      if (draggedIdx === null || draggedIdx === targetIdx) return;
      const items = [...folders];
      const dragged = items[draggedIdx];
      if (!dragged) return;
      items.splice(draggedIdx, 1);
      items.splice(targetIdx, 0, dragged);
      onReorderFolders(items);
      setDraggedIdx(null);
    },
    [draggedIdx, folders, onReorderFolders]
  );

  return { draggedIdx, handleDragStart, handleDragOver, handleDrop };
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const FolderSettings: React.FC<{
  readonly folder: WorkspaceFolder;
  readonly onUpdate: (path: string, updates: Partial<WorkspaceFolder>) => void;
}> = ({ folder, onUpdate }) => {
  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const patterns = e.target.value
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      onUpdate(folder.path, { excludePatterns: patterns });
    },
    [folder.path, onUpdate]
  );

  return (
    <div className="ml-6 mb-1 rounded-md border bg-muted/30 p-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Exclude patterns (comma-separated)</span>
        <input
          type="text"
          className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="node_modules, .git, dist"
          defaultValue={folder.excludePatterns.join(', ')}
          onBlur={handleBlur}
        />
      </label>
      <p className="mt-1 text-xs text-muted-foreground">{folder.path}</p>
    </div>
  );
};
FolderSettings.displayName = 'FolderSettings';

interface FolderRowProps {
  readonly folder: WorkspaceFolder;
  readonly idx: number;
  readonly isExpanded: boolean;
  readonly showSettings: boolean;
  readonly isDragged: boolean;
  readonly onToggleExpand: (path: string) => void;
  readonly onToggleSettings: (path: string) => void;
  readonly onRemove: (path: string) => void;
  readonly onUpdate: (path: string, updates: Partial<WorkspaceFolder>) => void;
  readonly onDragStart: (e: React.DragEvent, idx: number) => void;
  readonly onDragOver: (e: React.DragEvent) => void;
  readonly onDrop: (e: React.DragEvent, idx: number) => void;
}

const FolderRowToolbar: React.FC<{
  readonly folder: WorkspaceFolder;
  readonly isExpanded: boolean;
  readonly onToggleExpand: (p: string) => void;
  readonly onToggleSettings: (p: string) => void;
  readonly onRemove: (p: string) => void;
}> = ({ folder, isExpanded, onToggleExpand, onToggleSettings, onRemove }) => (
  <div className="flex items-center gap-1 px-1 py-1 text-sm">
    <GripVertical className="h-3.5 w-3.5 cursor-grab text-muted-foreground" />
    <button
      type="button"
      className="flex items-center gap-1"
      onClick={() => onToggleExpand(folder.path)}
    >
      {isExpanded ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
    </button>
    <span className="flex-1 truncate font-medium">{folder.name || getFolderName(folder.path)}</span>
    <button
      type="button"
      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={() => onToggleSettings(folder.path)}
      aria-label={`Settings for ${folder.name}`}
    >
      <Settings2 className="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      onClick={() => onRemove(folder.path)}
      aria-label={`Remove ${folder.name}`}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  </div>
);
FolderRowToolbar.displayName = 'FolderRowToolbar';

const FolderRow: React.FC<FolderRowProps> = ({
  folder,
  idx,
  isExpanded,
  showSettings,
  isDragged,
  onToggleExpand,
  onToggleSettings,
  onRemove,
  onUpdate,
  onDragStart,
  onDragOver,
  onDrop,
}) => (
  <div
    draggable
    onDragStart={(e) => onDragStart(e, idx)}
    onDragOver={onDragOver}
    onDrop={(e) => onDrop(e, idx)}
    className={cn('rounded-md border border-transparent', isDragged && 'opacity-50')}
  >
    <FolderRowToolbar
      folder={folder}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onToggleSettings={onToggleSettings}
      onRemove={onRemove}
    />
    {showSettings ? <FolderSettings folder={folder} onUpdate={onUpdate} /> : null}
  </div>
);
FolderRow.displayName = 'FolderRow';

const EmptyWorkspace: React.FC<{ readonly onAdd: () => void }> = ({ onAdd }) => (
  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
    <FileText className="h-8 w-8" />
    <p className="text-sm">No workspace folders</p>
    <Button variant="outline" size="sm" onClick={onAdd}>
      <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
      Add Folder
    </Button>
  </div>
);
EmptyWorkspace.displayName = 'EmptyWorkspace';

// =============================================================================
// COMPONENT
// =============================================================================

function useToggleSet() {
  const [set, setSet] = React.useState<ReadonlySet<string>>(new Set());
  const toggle = React.useCallback((id: string) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  return { set, toggle };
}

const FolderList: React.FC<{
  readonly folders: readonly WorkspaceFolder[];
  readonly expandedFolders: ReadonlySet<string>;
  readonly showSettingsFor: string | null;
  readonly drag: ReturnType<typeof useDragReorder>;
  readonly onToggleExpand: (p: string) => void;
  readonly onToggleSettings: (p: string) => void;
  readonly onRemove: (p: string) => void;
  readonly onUpdate: (p: string, u: Partial<WorkspaceFolder>) => void;
}> = ({
  folders,
  expandedFolders,
  showSettingsFor,
  drag,
  onToggleExpand,
  onToggleSettings,
  onRemove,
  onUpdate,
}) => (
  <div className="flex flex-col gap-0.5">
    {folders.map((folder, idx) => (
      <FolderRow
        key={folder.path}
        folder={folder}
        idx={idx}
        isExpanded={expandedFolders.has(folder.path)}
        showSettings={showSettingsFor === folder.path}
        isDragged={drag.draggedIdx === idx}
        onToggleExpand={onToggleExpand}
        onToggleSettings={onToggleSettings}
        onRemove={onRemove}
        onUpdate={onUpdate}
        onDragStart={drag.handleDragStart}
        onDragOver={drag.handleDragOver}
        onDrop={drag.handleDrop}
      />
    ))}
  </div>
);
FolderList.displayName = 'FolderList';

export const MultiRootPanel: React.FC<MultiRootPanelProps> = ({
  folders,
  onAddFolder,
  onRemoveFolder,
  onReorderFolders,
  onUpdateFolder,
  className,
}) => {
  const [showFolderPicker, setShowFolderPicker] = React.useState(false);
  const expanded = useToggleSet();
  const [showSettingsFor, setShowSettingsFor] = React.useState<string | null>(null);
  const drag = useDragReorder(folders, onReorderFolders);
  const toggleSettings = React.useCallback((p: string) => {
    setShowSettingsFor((prev) => (prev === p ? null : p));
  }, []);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace Folders
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setShowFolderPicker(true)}
          aria-label="Add workspace folder"
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>
      {folders.length === 0 ? (
        <EmptyWorkspace onAdd={() => setShowFolderPicker(true)} />
      ) : (
        <FolderList
          folders={folders}
          expandedFolders={expanded.set}
          showSettingsFor={showSettingsFor}
          drag={drag}
          onToggleExpand={expanded.toggle}
          onToggleSettings={toggleSettings}
          onRemove={onRemoveFolder}
          onUpdate={onUpdateFolder}
        />
      )}
      <FolderPicker
        open={showFolderPicker}
        onOpenChange={setShowFolderPicker}
        onSelect={onAddFolder}
      />
    </div>
  );
};

MultiRootPanel.displayName = 'MultiRootPanel';
