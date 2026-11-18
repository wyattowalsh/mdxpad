/**
 * TabItem Component
 *
 * Individual tab in the tab bar. Displays filename with dirty indicator,
 * close button on hover, and supports drag handle via @dnd-kit.
 *
 * @module renderer/components/tabs/TabItem
 */

import { memo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export interface TabItemProps {
  readonly id: string;
  readonly fileName: string;
  readonly isDirty: boolean;
  readonly fileMissing?: boolean;
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly onClose: () => void;
  readonly onKeyDown?: (e: React.KeyboardEvent) => void;
  readonly onMouseDown?: (e: React.MouseEvent) => void;
  readonly onContextMenu?: (e: React.MouseEvent) => void;
}

function TabItemComponent({
  id,
  fileName,
  isDirty,
  fileMissing = false,
  isActive,
  onClick,
  onClose,
  onKeyDown,
  onMouseDown,
  onContextMenu,
}: TabItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle-click to close
      if (e.button === 1) {
        e.preventDefault();
        onClose();
        return;
      }
      onMouseDown?.(e);
    },
    [onClose, onMouseDown]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 px-3 py-1 text-sm cursor-pointer',
        'border-r border-border',
        'transition-colors duration-100',
        isActive
          ? 'bg-background text-foreground border-b-transparent'
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/60',
        isDragging && 'opacity-50 z-50'
      )}
      {...attributes}
      {...listeners}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      data-testid={`tab-item-${id}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
    >
      <span className="truncate max-w-[120px] select-none">{fileName}</span>
      {fileMissing && (
        <span
          className="text-[10px] text-destructive whitespace-nowrap"
          aria-label="File deleted"
          data-testid="missing-indicator"
        >
          Deleted
        </span>
      )}
      {isDirty && !fileMissing && (
        <span
          className="w-2 h-2 rounded-full bg-foreground/60 flex-shrink-0"
          aria-label="Unsaved changes"
          data-testid="dirty-indicator"
        />
      )}
      <button
        type="button"
        className={cn(
          'ml-1 p-0.5 rounded-sm flex-shrink-0',
          'opacity-0 group-hover:opacity-100 focus:opacity-100',
          'hover:bg-foreground/10 transition-opacity'
        )}
        aria-label={`Close ${fileName}`}
        onClick={handleClose}
        data-testid={`tab-close-${id}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export const TabItem = memo(TabItemComponent);
TabItem.displayName = 'TabItem';
