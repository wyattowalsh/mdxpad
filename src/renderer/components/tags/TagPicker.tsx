/**
 * Tag Picker Component
 *
 * Autocomplete input for selecting/creating tags with color picking.
 * Shows existing tags as badges.
 *
 * @module renderer/components/tags/TagPicker
 */

import * as React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useTagStore, selectAllTags } from '../../stores/tag-store';
import type { Tag } from '../../stores/tag-store';
import { TagBadge } from './TagBadge';

// =============================================================================
// CONSTANTS
// =============================================================================

const TAG_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6b7280',
] as const;

// =============================================================================
// TYPES
// =============================================================================

export interface TagPickerProps {
  readonly filePath: string;
  readonly className?: string;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const ColorPicker: React.FC<{
  readonly selectedColor: string;
  readonly onSelect: (color: string) => void;
}> = ({ selectedColor, onSelect }) => (
  <div className="flex gap-1 px-2 py-1">
    {TAG_COLORS.map((color) => (
      <button
        key={color}
        type="button"
        className={cn(
          'h-4 w-4 rounded-full border-2 transition-transform',
          selectedColor === color
            ? 'scale-110 border-foreground'
            : 'border-transparent hover:scale-105'
        )}
        style={{ backgroundColor: color }}
        onClick={() => onSelect(color)}
        onMouseDown={(e) => e.preventDefault()}
        aria-label={`Select color ${color}`}
      />
    ))}
  </div>
);
ColorPicker.displayName = 'ColorPicker';

const TagDropdownItem: React.FC<{
  readonly tag: Tag;
  readonly onSelect: (tag: Tag) => void;
}> = ({ tag, onSelect }) => (
  <button
    type="button"
    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
    onMouseDown={(e) => e.preventDefault()}
    onClick={() => onSelect(tag)}
  >
    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
    {tag.name}
  </button>
);
TagDropdownItem.displayName = 'TagDropdownItem';

const TagDropdown: React.FC<{
  readonly filteredTags: readonly Tag[];
  readonly allTags: readonly Tag[];
  readonly query: string;
  readonly selectedColor: string;
  readonly onSelect: (tag: Tag) => void;
  readonly onCreate: () => void;
  readonly onColorSelect: (color: string) => void;
}> = ({ filteredTags, allTags, query, selectedColor, onSelect, onCreate, onColorSelect }) => {
  const trimmedQuery = query.trim();
  const isNewTag =
    trimmedQuery && !allTags.some((t) => t.name.toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
      {filteredTags.slice(0, 8).map((tag) => (
        <TagDropdownItem key={tag.id} tag={tag} onSelect={onSelect} />
      ))}
      {isNewTag ? (
        <div className="border-t pt-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCreate}
          >
            <Plus className="h-3 w-3" />
            Create &ldquo;{trimmedQuery}&rdquo;
          </button>
          <ColorPicker selectedColor={selectedColor} onSelect={onColorSelect} />
        </div>
      ) : null}
    </div>
  );
};
TagDropdown.displayName = 'TagDropdown';

// =============================================================================
// HOOKS
// =============================================================================

function useTagData(filePath: string) {
  const allTags = useTagStore(selectAllTags);
  const fileTagMap = useTagStore((s) => s.fileTagMap);
  const assignedTagIds = React.useMemo(() => fileTagMap[filePath] ?? [], [fileTagMap, filePath]);
  const assignedTags = React.useMemo(
    () => allTags.filter((t) => assignedTagIds.includes(t.id)),
    [allTags, assignedTagIds]
  );
  return { allTags, assignedTagIds, assignedTags };
}

function useTagPickerActions(
  filePath: string,
  allTags: readonly Tag[],
  assignedTagIds: readonly string[]
) {
  const addTag = useTagStore((s) => s.addTag);
  const assignTagToFile = useTagStore((s) => s.assignTagToFile);
  const removeTagFromFile = useTagStore((s) => s.removeTagFromFile);
  const [query, setQuery] = React.useState('');
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [selectedColor, setSelectedColor] = React.useState<string>(TAG_COLORS[0]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filteredTags = React.useMemo(() => {
    if (!query.trim()) return allTags.filter((t) => !assignedTagIds.includes(t.id));
    const lq = query.toLowerCase();
    return allTags.filter(
      (t) => t.name.toLowerCase().includes(lq) && !assignedTagIds.includes(t.id)
    );
  }, [allTags, query, assignedTagIds]);

  const handleSelectTag = React.useCallback(
    (tag: Tag) => {
      assignTagToFile(filePath, tag.id);
      setQuery('');
      setShowDropdown(false);
      inputRef.current?.focus();
    },
    [filePath, assignTagToFile]
  );

  const handleCreateTag = React.useCallback(() => {
    const name = query.trim();
    if (!name) return;
    assignTagToFile(filePath, addTag(name, selectedColor));
    setQuery('');
    setShowDropdown(false);
    inputRef.current?.focus();
  }, [query, selectedColor, addTag, assignTagToFile, filePath]);

  const handleRemoveTag = React.useCallback(
    (tagId: string) => {
      removeTagFromFile(filePath, tagId);
    },
    [filePath, removeTagFromFile]
  );

  return {
    query,
    setQuery,
    showDropdown,
    setShowDropdown,
    selectedColor,
    setSelectedColor,
    inputRef,
    filteredTags,
    handleSelectTag,
    handleCreateTag,
    handleRemoveTag,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

const AssignedTagList: React.FC<{
  readonly tags: readonly Tag[];
  readonly onRemove: (id: string) => void;
}> = ({ tags, onRemove }) => (
  <div className="flex flex-wrap gap-1">
    {tags.map((tag) => (
      <TagBadge key={tag.id} name={tag.name} color={tag.color} onRemove={() => onRemove(tag.id)} />
    ))}
  </div>
);
AssignedTagList.displayName = 'AssignedTagList';

export const TagPicker: React.FC<TagPickerProps> = ({ filePath, className }) => {
  const data = useTagData(filePath);
  const actions = useTagPickerActions(filePath, data.allTags, data.assignedTagIds);

  const handleInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = actions.filteredTags[0];
        if (actions.filteredTags.length > 0 && first) {
          actions.handleSelectTag(first);
        } else if (actions.query.trim()) {
          actions.handleCreateTag();
        }
      } else if (e.key === 'Escape') {
        actions.setShowDropdown(false);
      }
    },
    [actions]
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <AssignedTagList tags={data.assignedTags} onRemove={actions.handleRemoveTag} />
      <div className="relative">
        <input
          ref={actions.inputRef}
          type="text"
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Add tag..."
          value={actions.query}
          onChange={(e) => {
            actions.setQuery(e.target.value);
            actions.setShowDropdown(true);
          }}
          onFocus={() => actions.setShowDropdown(true)}
          onBlur={() => setTimeout(() => actions.setShowDropdown(false), 200)}
          onKeyDown={handleInputKeyDown}
        />
        {actions.showDropdown && (actions.query.trim() || actions.filteredTags.length > 0) ? (
          <TagDropdown
            filteredTags={actions.filteredTags}
            allTags={data.allTags}
            query={actions.query}
            selectedColor={actions.selectedColor}
            onSelect={actions.handleSelectTag}
            onCreate={actions.handleCreateTag}
            onColorSelect={actions.setSelectedColor}
          />
        ) : null}
      </div>
    </div>
  );
};

TagPicker.displayName = 'TagPicker';
