/**
 * Tag Store
 *
 * Zustand store with Immer middleware for tag management.
 * Supports nested taxonomy (parent/child tags), per-file tag assignment,
 * and persistence to localStorage.
 *
 * @module renderer/stores/tag-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Draft } from 'immer';
import { uid } from '@shared/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A tag with optional color and hierarchy (parentId for nesting).
 */
export interface Tag {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly parentId: string | null;
}

/**
 * A tree node representation of a tag with its children.
 */
export interface TagTreeNode {
  readonly tag: Tag;
  readonly children: readonly TagTreeNode[];
}

/**
 * Mapping from file path to assigned tag IDs.
 */
export type FileTagMap = Record<string, readonly string[]>;

// =============================================================================
// STATE INTERFACE
// =============================================================================

export interface TagState {
  readonly tags: readonly Tag[];
  readonly selectedTags: readonly string[];
  readonly fileTagMap: FileTagMap;
}

// =============================================================================
// ACTIONS INTERFACE
// =============================================================================

export interface TagStoreActions {
  readonly addTag: (name: string, color?: string, parentId?: string | null) => string;
  readonly removeTag: (id: string) => void;
  readonly renameTag: (id: string, name: string) => void;
  readonly setTagColor: (id: string, color: string) => void;
  readonly setTagParent: (id: string, parentId: string | null) => void;
  readonly toggleSelectedTag: (id: string) => void;
  readonly clearSelectedTags: () => void;
  readonly assignTagToFile: (filePath: string, tagId: string) => void;
  readonly removeTagFromFile: (filePath: string, tagId: string) => void;
  readonly reset: () => void;
}

export type TagStore = TagState & TagStoreActions;

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'mdxpad:tag-store';

const DEFAULT_TAG_COLOR = '#6366f1';

// =============================================================================
// INITIAL STATE
// =============================================================================

const INITIAL_TAG_STATE: TagState = {
  tags: [],
  selectedTags: [],
  fileTagMap: {},
};

// =============================================================================
// PERSISTENCE HELPERS
// =============================================================================

function loadFromStorage(): Partial<TagState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Partial<TagState>;
      }
    }
  } catch {
    // Silently fail on localStorage errors
  }
  return {};
}

function persistToStorage(state: TagState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tags: state.tags,
        selectedTags: state.selectedTags,
        fileTagMap: state.fileTagMap,
      })
    );
  } catch {
    // Silently fail on localStorage errors
  }
}

// =============================================================================
// ACTION HELPERS
// =============================================================================

type TagSetter = (fn: (draft: Draft<TagState>) => void) => void;
type TagGetter = () => TagState;

function createTagCrudActions(set: TagSetter, get: TagGetter) {
  return {
    addTag: (name: string, color?: string, parentId?: string | null): string => {
      const id = uid();
      set((draft) => {
        draft.tags.push({
          id,
          name,
          color: color ?? DEFAULT_TAG_COLOR,
          parentId: parentId ?? null,
        });
      });
      persistToStorage(get());
      return id;
    },
    removeTag: (id: string): void => {
      set((draft) => {
        const idsToRemove = collectDescendantIds(draft.tags, id);
        idsToRemove.push(id);
        draft.tags = draft.tags.filter((t) => !idsToRemove.includes(t.id));
        draft.selectedTags = draft.selectedTags.filter((tid) => !idsToRemove.includes(tid));
        for (const fp of Object.keys(draft.fileTagMap)) {
          const existing = draft.fileTagMap[fp];
          if (existing) {
            draft.fileTagMap[fp] = existing.filter((tid) => !idsToRemove.includes(tid));
          }
        }
      });
      persistToStorage(get());
    },
    renameTag: (id: string, name: string): void => {
      set((draft) => {
        const tag = draft.tags.find((t) => t.id === id);
        if (tag) {
          tag.name = name;
        }
      });
      persistToStorage(get());
    },
    setTagColor: (id: string, color: string): void => {
      set((draft) => {
        const tag = draft.tags.find((t) => t.id === id);
        if (tag) {
          tag.color = color;
        }
      });
      persistToStorage(get());
    },
    setTagParent: (id: string, parentId: string | null): void => {
      set((draft) => {
        const tag = draft.tags.find((t) => t.id === id);
        if (tag) {
          tag.parentId = parentId;
        }
      });
      persistToStorage(get());
    },
  };
}

function createTagSelectionActions(set: TagSetter, get: TagGetter) {
  return {
    toggleSelectedTag: (id: string): void => {
      set((draft) => {
        const idx = draft.selectedTags.indexOf(id);
        if (idx >= 0) {
          draft.selectedTags.splice(idx, 1);
        } else {
          draft.selectedTags.push(id);
        }
      });
      persistToStorage(get());
    },
    clearSelectedTags: (): void => {
      set((draft) => {
        draft.selectedTags = [];
      });
      persistToStorage(get());
    },
    assignTagToFile: (filePath: string, tagId: string): void => {
      set((draft) => {
        const existing = draft.fileTagMap[filePath];
        if (!existing) {
          draft.fileTagMap[filePath] = [tagId];
        } else if (!existing.includes(tagId)) {
          existing.push(tagId);
        }
      });
      persistToStorage(get());
    },
    removeTagFromFile: (filePath: string, tagId: string): void => {
      set((draft) => {
        const existing = draft.fileTagMap[filePath];
        if (existing) {
          draft.fileTagMap[filePath] = existing.filter((t) => t !== tagId);
        }
      });
      persistToStorage(get());
    },
    reset: (): void => {
      set(() => ({ ...INITIAL_TAG_STATE }));
      persistToStorage(INITIAL_TAG_STATE);
    },
  };
}

// =============================================================================
// STORE CREATION
// =============================================================================

export const useTagStore = create<TagStore>()(
  immer((set, get) => {
    const persisted = loadFromStorage();
    return {
      ...INITIAL_TAG_STATE,
      ...persisted,
      ...createTagCrudActions(set, get),
      ...createTagSelectionActions(set, get),
    };
  })
);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Recursively collect all descendant tag IDs for a given parent.
 */
function collectDescendantIds(tags: readonly Tag[], parentId: string): string[] {
  const children = tags.filter((t) => t.parentId === parentId);
  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    ids.push(...collectDescendantIds(tags, child.id));
  }
  return ids;
}

// =============================================================================
// SELECTORS
// =============================================================================

export const selectAllTags = (state: TagStore): readonly Tag[] => state.tags;

export const selectSelectedTags = (state: TagStore): readonly string[] => state.selectedTags;

export const selectTagTree = (state: TagStore): readonly TagTreeNode[] => {
  return buildTagTree(state.tags, null);
};

export const selectTagsByFile =
  (filePath: string) =>
  (state: TagStore): readonly Tag[] => {
    const tagIds = state.fileTagMap[filePath] ?? [];
    return state.tags.filter((t) => tagIds.includes(t.id));
  };

export const selectFilesWithTag =
  (tagId: string) =>
  (state: TagStore): readonly string[] => {
    return Object.entries(state.fileTagMap)
      .filter(([, ids]) => ids.includes(tagId))
      .map(([filePath]) => filePath);
  };

export const selectTagById =
  (tagId: string) =>
  (state: TagStore): Tag | undefined => {
    return state.tags.find((t) => t.id === tagId);
  };

/**
 * Build a hierarchical tag tree from flat tag list.
 */
function buildTagTree(tags: readonly Tag[], parentId: string | null): TagTreeNode[] {
  return tags
    .filter((t) => t.parentId === parentId)
    .map((tag) => ({
      tag,
      children: buildTagTree(tags, tag.id),
    }));
}
