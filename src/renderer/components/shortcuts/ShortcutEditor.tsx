/**
 * Shortcut Editor Component
 *
 * Full keyboard shortcut editor listing all shortcuts by category.
 * Supports rebinding, reset-to-default, and conflict detection.
 *
 * @module renderer/components/shortcuts/ShortcutEditor
 */

import * as React from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import {
  useKeybindingStore,
  selectAllBindings,
  selectCategories,
  selectBindingsByCategory,
  selectIsModified,
  normalizeKeybinding,
} from '../../stores/keybinding-store';
import type { Modifier, Keybinding, KeybindingConflict } from '../../stores/keybinding-store';
import { ShortcutRow } from './ShortcutRow';
import { ConflictResolver } from './ConflictResolver';
import type { ConflictInfo } from './ConflictResolver';
import { Button } from '@ui/button';

// =============================================================================
// TYPES
// =============================================================================

export interface ShortcutEditorProps {
  readonly className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

function useConflictDetection(allBindings: readonly Keybinding[]) {
  const detectConflicts = useKeybindingStore((s) => s.detectConflicts);
  const [conflicts, setConflicts] = React.useState<readonly KeybindingConflict[]>([]);

  React.useEffect(() => {
    setConflicts(detectConflicts());
  }, [allBindings, detectConflicts]);

  const conflictingCommandIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const c of conflicts) {
      for (const id of c.commandIds) {
        ids.add(id);
      }
    }
    return ids;
  }, [conflicts]);

  return conflictingCommandIds;
}

function useRebindHandler(
  allBindings: readonly Keybinding[],
  setBinding: (id: string, key: string, mods: readonly Modifier[]) => void,
  setPendingConflict: (c: ConflictInfo | null) => void
) {
  return React.useCallback(
    (commandId: string, key: string, modifiers: readonly Modifier[]) => {
      const normalized = normalizeKeybinding(key, modifiers);
      const existing = allBindings.find(
        (b) => normalizeKeybinding(b.key, b.modifiers) === normalized && b.commandId !== commandId
      );
      if (existing) {
        setPendingConflict({
          newCommandId: commandId,
          newCommandLabel: allBindings.find((b) => b.commandId === commandId)?.label ?? commandId,
          conflictingCommandId: existing.commandId,
          conflictingCommandLabel: existing.label,
          key,
          modifiers,
        });
        return;
      }
      setBinding(commandId, key, modifiers);
    },
    [allBindings, setBinding, setPendingConflict]
  );
}

const SearchResults: React.FC<{
  readonly bindings: readonly Keybinding[];
  readonly conflictingCommandIds: ReadonlySet<string>;
  readonly onRebind: (commandId: string, key: string, modifiers: readonly Modifier[]) => void;
  readonly onReset: (commandId: string) => void;
}> = ({ bindings, conflictingCommandIds, onRebind, onReset }) => (
  <div className="flex flex-col gap-1">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Search Results
    </h3>
    {bindings.map((binding) => (
      <ShortcutRowWithStore
        key={binding.commandId}
        binding={binding}
        conflictingCommandIds={conflictingCommandIds}
        onRebind={onRebind}
        onReset={onReset}
      />
    ))}
    {bindings.length === 0 ? (
      <p className="py-2 text-sm text-muted-foreground">No matching shortcuts</p>
    ) : null}
  </div>
);
SearchResults.displayName = 'SearchResults';

export const ShortcutEditor: React.FC<ShortcutEditorProps> = ({ className }) => {
  const allBindings = useKeybindingStore(selectAllBindings);
  const categories = useKeybindingStore(selectCategories);
  const setBinding = useKeybindingStore((s) => s.setBinding);
  const resetBinding = useKeybindingStore((s) => s.resetBinding);
  const resetAll = useKeybindingStore((s) => s.resetAll);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [pendingConflict, setPendingConflict] = React.useState<ConflictInfo | null>(null);

  const conflictingCommandIds = useConflictDetection(allBindings);
  const handleRebind = useRebindHandler(allBindings, setBinding, setPendingConflict);

  const handleResolveConflict = React.useCallback(() => {
    if (!pendingConflict) return;
    setBinding(pendingConflict.conflictingCommandId, '', []);
    setBinding(pendingConflict.newCommandId, pendingConflict.key, pendingConflict.modifiers);
    setPendingConflict(null);
  }, [pendingConflict, setBinding]);

  const filteredBindings = React.useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return allBindings.filter(
      (b) =>
        b.label.toLowerCase().includes(q) ||
        b.commandId.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [allBindings, searchQuery]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
        <Button variant="outline" size="sm" onClick={resetAll}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset All
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Search shortcuts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-4">
        {filteredBindings ? (
          <SearchResults
            bindings={filteredBindings}
            conflictingCommandIds={conflictingCommandIds}
            onRebind={handleRebind}
            onReset={resetBinding}
          />
        ) : (
          categories.map((cat) => (
            <CategorySection
              key={cat}
              category={cat}
              conflictingCommandIds={conflictingCommandIds}
              onRebind={handleRebind}
              onReset={resetBinding}
            />
          ))
        )}
      </div>
      <ConflictResolver
        conflict={pendingConflict}
        onReplace={handleResolveConflict}
        onCancel={() => setPendingConflict(null)}
      />
    </div>
  );
};

ShortcutEditor.displayName = 'ShortcutEditor';

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface CategorySectionProps {
  readonly category: string;
  readonly conflictingCommandIds: ReadonlySet<string>;
  readonly onRebind: (commandId: string, key: string, modifiers: readonly Modifier[]) => void;
  readonly onReset: (commandId: string) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  conflictingCommandIds,
  onRebind,
  onReset,
}) => {
  const bindings = useKeybindingStore(selectBindingsByCategory(category));

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {category}
      </h3>
      {bindings.map((binding) => (
        <ShortcutRowWithStore
          key={binding.commandId}
          binding={binding}
          conflictingCommandIds={conflictingCommandIds}
          onRebind={onRebind}
          onReset={onReset}
        />
      ))}
    </div>
  );
};

CategorySection.displayName = 'CategorySection';

interface ShortcutRowWithStoreProps {
  readonly binding: Keybinding;
  readonly conflictingCommandIds: ReadonlySet<string>;
  readonly onRebind: (commandId: string, key: string, modifiers: readonly Modifier[]) => void;
  readonly onReset: (commandId: string) => void;
}

const ShortcutRowWithStore: React.FC<ShortcutRowWithStoreProps> = ({
  binding,
  conflictingCommandIds,
  onRebind,
  onReset,
}) => {
  const isModified = useKeybindingStore(selectIsModified(binding.commandId));

  return (
    <ShortcutRow
      binding={binding}
      isModified={isModified}
      hasConflict={conflictingCommandIds.has(binding.commandId)}
      onRebind={onRebind}
      onReset={onReset}
    />
  );
};

ShortcutRowWithStore.displayName = 'ShortcutRowWithStore';
