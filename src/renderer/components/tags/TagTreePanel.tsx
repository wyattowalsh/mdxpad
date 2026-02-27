/**
 * Tag Tree Panel Component
 *
 * Hierarchical display of tags with expand/collapse, click-to-filter,
 * and drag-to-reorganize capabilities.
 *
 * @module renderer/components/tags/TagTreePanel
 */

import * as React from 'react';
import { ChevronRight, ChevronDown, Tag as TagIcon } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useTagStore, selectTagTree, selectSelectedTags } from '../../stores/tag-store';
import type { TagTreeNode } from '../../stores/tag-store';
import { TagBadge } from './TagBadge';

// =============================================================================
// TYPES
// =============================================================================

export interface TagTreePanelProps {
  readonly className?: string;
  readonly onTagClick?: (tagId: string) => void;
}

interface TagNodeProps {
  readonly node: TagTreeNode;
  readonly depth: number;
  readonly expandedIds: ReadonlySet<string>;
  readonly selectedTagIds: readonly string[];
  readonly onToggle: (id: string) => void;
  readonly onSelect: (id: string) => void;
  readonly onDragStart: (id: string) => void;
  readonly onDrop: (targetId: string) => void;
}

// =============================================================================
// TAG NODE ROW
// =============================================================================

const ExpandToggle: React.FC<{
  readonly hasChildren: boolean;
  readonly isExpanded: boolean;
  readonly tagId: string;
  readonly onToggle: (id: string) => void;
}> = ({ hasChildren, isExpanded, tagId, onToggle }) => {
  if (!hasChildren) return <span className="h-4 w-4" />;
  return (
    <button
      type="button"
      className="flex h-4 w-4 items-center justify-center rounded hover:bg-accent"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(tagId);
      }}
      aria-label={isExpanded ? 'Collapse' : 'Expand'}
    >
      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
    </button>
  );
};
ExpandToggle.displayName = 'ExpandToggle';

function useDragHandlers(tagId: string, onDrop: (id: string) => void) {
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);
  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onDrop(tagId);
    },
    [tagId, onDrop]
  );
  return { handleDragOver, handleDrop };
}

const TagNodeChildren: React.FC<
  Omit<TagNodeProps, 'node'> & { readonly children: readonly TagTreeNode[] }
> = ({ children, depth, expandedIds, selectedTagIds, onToggle, onSelect, onDragStart, onDrop }) => (
  <div>
    {children.map((child) => (
      <TagNode
        key={child.tag.id}
        node={child}
        depth={depth + 1}
        expandedIds={expandedIds}
        selectedTagIds={selectedTagIds}
        onToggle={onToggle}
        onSelect={onSelect}
        onDragStart={onDragStart}
        onDrop={onDrop}
      />
    ))}
  </div>
);
TagNodeChildren.displayName = 'TagNodeChildren';

const TagNode: React.FC<TagNodeProps> = (props) => {
  const { node, depth, expandedIds, selectedTagIds, onToggle, onSelect, onDragStart, onDrop } =
    props;
  const isExpanded = expandedIds.has(node.tag.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedTagIds.includes(node.tag.id);
  const drag = useDragHandlers(node.tag.id, onDrop);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-sm px-1 py-0.5 text-sm hover:bg-accent cursor-pointer',
          isSelected && 'bg-accent/50'
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        draggable
        onDragStart={() => onDragStart(node.tag.id)}
        onDragOver={drag.handleDragOver}
        onDrop={drag.handleDrop}
      >
        <ExpandToggle
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          tagId={node.tag.id}
          onToggle={onToggle}
        />
        <button
          type="button"
          className="flex flex-1 items-center gap-1.5 text-left"
          onClick={() => onSelect(node.tag.id)}
        >
          <TagBadge name={node.tag.name} color={node.tag.color} />
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <TagNodeChildren {...props} children={node.children} depth={depth} />
      ) : null}
    </div>
  );
};
TagNode.displayName = 'TagNode';

// =============================================================================
// HOOKS
// =============================================================================

function useTagTreeState(onTagClick?: (tagId: string) => void) {
  const tagTree = useTagStore(selectTagTree);
  const selectedTagIds = useTagStore(selectSelectedTags);
  const toggleSelectedTag = useTagStore((s) => s.toggleSelectedTag);
  const setTagParent = useTagStore((s) => s.setTagParent);

  const [expandedIds, setExpandedIds] = React.useState<ReadonlySet<string>>(new Set());
  const [draggedId, setDraggedId] = React.useState<string | null>(null);

  const handleToggle = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelect = React.useCallback(
    (id: string) => {
      toggleSelectedTag(id);
      onTagClick?.(id);
    },
    [toggleSelectedTag, onTagClick]
  );

  const handleDragStart = React.useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDrop = React.useCallback(
    (targetId: string) => {
      if (draggedId && draggedId !== targetId) {
        setTagParent(draggedId, targetId);
      }
      setDraggedId(null);
    },
    [draggedId, setTagParent]
  );

  return {
    tagTree,
    selectedTagIds,
    expandedIds,
    handleToggle,
    handleSelect,
    handleDragStart,
    handleDrop,
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const EmptyState: React.FC<{ readonly className?: string | undefined }> = ({ className }) => (
  <div
    className={cn('flex flex-col items-center justify-center p-4 text-muted-foreground', className)}
  >
    <TagIcon className="mb-2 h-8 w-8" />
    <p className="text-sm">No tags yet</p>
    <p className="text-xs">Create tags using the tag picker</p>
  </div>
);
EmptyState.displayName = 'EmptyState';

export const TagTreePanel: React.FC<TagTreePanelProps> = ({ className, onTagClick }) => {
  const s = useTagTreeState(onTagClick);

  if (s.tagTree.length === 0) return <EmptyState className={className} />;

  return (
    <div className={cn('flex flex-col gap-0.5 p-2', className)}>
      <h3 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Tags
      </h3>
      {s.tagTree.map((node) => (
        <TagNode
          key={node.tag.id}
          node={node}
          depth={0}
          expandedIds={s.expandedIds}
          selectedTagIds={s.selectedTagIds}
          onToggle={s.handleToggle}
          onSelect={s.handleSelect}
          onDragStart={s.handleDragStart}
          onDrop={s.handleDrop}
        />
      ))}
    </div>
  );
};

TagTreePanel.displayName = 'TagTreePanel';
