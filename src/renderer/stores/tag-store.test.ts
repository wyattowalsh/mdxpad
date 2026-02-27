/**
 * Tests for Tag Store.
 *
 * Tests tag CRUD, hierarchy, file assignment, and selectors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useTagStore,
  selectAllTags,
  selectSelectedTags,
  selectTagTree,
  selectTagsByFile,
  selectFilesWithTag,
  selectTagById,
} from './tag-store';
import type { TagState } from './tag-store';

// =============================================================================
// SETUP
// =============================================================================

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      Reflect.deleteProperty(store, key);
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const INITIAL: TagState = {
  tags: [],
  selectedTags: [],
  fileTagMap: {},
};

describe('useTagStore', () => {
  beforeEach(() => {
    useTagStore.setState(INITIAL);
    localStorageMock.clear();
  });

  describe('initial state', () => {
    it('should start with empty tags', () => {
      const state = useTagStore.getState();
      expect(state.tags).toEqual([]);
      expect(state.selectedTags).toEqual([]);
      expect(state.fileTagMap).toEqual({});
    });
  });

  describe('addTag', () => {
    it('should add a tag with default color', () => {
      const id = useTagStore.getState().addTag('TypeScript');
      const state = useTagStore.getState();
      expect(state.tags).toHaveLength(1);
      expect(state.tags[0]?.name).toBe('TypeScript');
      expect(state.tags[0]?.color).toBe('#6366f1');
      expect(state.tags[0]?.parentId).toBeNull();
      expect(state.tags[0]?.id).toBe(id);
    });

    it('should add a tag with custom color', () => {
      useTagStore.getState().addTag('React', '#61dafb');
      const state = useTagStore.getState();
      expect(state.tags[0]?.color).toBe('#61dafb');
    });

    it('should add a tag with parentId', () => {
      const parentId = useTagStore.getState().addTag('Frontend');
      useTagStore.getState().addTag('React', undefined, parentId);
      const state = useTagStore.getState();
      expect(state.tags).toHaveLength(2);
      expect(state.tags[1]?.parentId).toBe(parentId);
    });
  });

  describe('removeTag', () => {
    it('should remove a tag by id', () => {
      const id = useTagStore.getState().addTag('ToRemove');
      expect(useTagStore.getState().tags).toHaveLength(1);
      useTagStore.getState().removeTag(id);
      expect(useTagStore.getState().tags).toHaveLength(0);
    });

    it('should remove child tags when parent is removed', () => {
      const parentId = useTagStore.getState().addTag('Parent');
      useTagStore.getState().addTag('Child', undefined, parentId);
      expect(useTagStore.getState().tags).toHaveLength(2);
      useTagStore.getState().removeTag(parentId);
      expect(useTagStore.getState().tags).toHaveLength(0);
    });

    it('should clean up selectedTags when tag is removed', () => {
      const id = useTagStore.getState().addTag('Selected');
      useTagStore.getState().toggleSelectedTag(id);
      expect(useTagStore.getState().selectedTags).toContain(id);
      useTagStore.getState().removeTag(id);
      expect(useTagStore.getState().selectedTags).not.toContain(id);
    });

    it('should clean up fileTagMap when tag is removed', () => {
      const id = useTagStore.getState().addTag('FileTag');
      useTagStore.getState().assignTagToFile('/test.mdx', id);
      useTagStore.getState().removeTag(id);
      const fileTags = useTagStore.getState().fileTagMap['/test.mdx'];
      expect(fileTags).toEqual([]);
    });
  });

  describe('renameTag', () => {
    it('should rename an existing tag', () => {
      const id = useTagStore.getState().addTag('Old Name');
      useTagStore.getState().renameTag(id, 'New Name');
      expect(useTagStore.getState().tags[0]?.name).toBe('New Name');
    });
  });

  describe('setTagColor', () => {
    it('should update tag color', () => {
      const id = useTagStore.getState().addTag('Colored');
      useTagStore.getState().setTagColor(id, '#ff0000');
      expect(useTagStore.getState().tags[0]?.color).toBe('#ff0000');
    });
  });

  describe('toggleSelectedTag', () => {
    it('should select a tag', () => {
      const id = useTagStore.getState().addTag('Select');
      useTagStore.getState().toggleSelectedTag(id);
      expect(useTagStore.getState().selectedTags).toContain(id);
    });

    it('should deselect a selected tag', () => {
      const id = useTagStore.getState().addTag('Toggle');
      useTagStore.getState().toggleSelectedTag(id);
      useTagStore.getState().toggleSelectedTag(id);
      expect(useTagStore.getState().selectedTags).not.toContain(id);
    });
  });

  describe('assignTagToFile / removeTagFromFile', () => {
    it('should assign a tag to a file', () => {
      const id = useTagStore.getState().addTag('Assigned');
      useTagStore.getState().assignTagToFile('/doc.mdx', id);
      expect(useTagStore.getState().fileTagMap['/doc.mdx']).toContain(id);
    });

    it('should not duplicate tag on same file', () => {
      const id = useTagStore.getState().addTag('NoDup');
      useTagStore.getState().assignTagToFile('/doc.mdx', id);
      useTagStore.getState().assignTagToFile('/doc.mdx', id);
      expect(useTagStore.getState().fileTagMap['/doc.mdx']).toHaveLength(1);
    });

    it('should remove a tag from a file', () => {
      const id = useTagStore.getState().addTag('Remove');
      useTagStore.getState().assignTagToFile('/doc.mdx', id);
      useTagStore.getState().removeTagFromFile('/doc.mdx', id);
      expect(useTagStore.getState().fileTagMap['/doc.mdx']).not.toContain(id);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      useTagStore.getState().addTag('WillBeReset');
      useTagStore.getState().reset();
      expect(useTagStore.getState().tags).toEqual([]);
      expect(useTagStore.getState().selectedTags).toEqual([]);
      expect(useTagStore.getState().fileTagMap).toEqual({});
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useTagStore.setState(INITIAL);
    localStorageMock.clear();
  });

  it('selectAllTags returns all tags', () => {
    useTagStore.getState().addTag('A');
    useTagStore.getState().addTag('B');
    expect(selectAllTags(useTagStore.getState())).toHaveLength(2);
  });

  it('selectSelectedTags returns selected tag ids', () => {
    const id = useTagStore.getState().addTag('Sel');
    useTagStore.getState().toggleSelectedTag(id);
    expect(selectSelectedTags(useTagStore.getState())).toEqual([id]);
  });

  it('selectTagTree builds hierarchical tree', () => {
    const parentId = useTagStore.getState().addTag('Parent');
    useTagStore.getState().addTag('Child', undefined, parentId);

    const tree = selectTagTree(useTagStore.getState());
    expect(tree).toHaveLength(1);
    expect(tree[0]?.tag.name).toBe('Parent');
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.tag.name).toBe('Child');
  });

  it('selectTagsByFile returns tags for a specific file', () => {
    const id = useTagStore.getState().addTag('FileTag');
    useTagStore.getState().assignTagToFile('/test.mdx', id);

    const tags = selectTagsByFile('/test.mdx')(useTagStore.getState());
    expect(tags).toHaveLength(1);
    expect(tags[0]?.id).toBe(id);
  });

  it('selectFilesWithTag returns file paths with a given tag', () => {
    const id = useTagStore.getState().addTag('SharedTag');
    useTagStore.getState().assignTagToFile('/a.mdx', id);
    useTagStore.getState().assignTagToFile('/b.mdx', id);

    const files = selectFilesWithTag(id)(useTagStore.getState());
    expect(files).toHaveLength(2);
    expect(files).toContain('/a.mdx');
    expect(files).toContain('/b.mdx');
  });

  it('selectTagById returns a tag by its id', () => {
    const id = useTagStore.getState().addTag('ById');
    const tag = selectTagById(id)(useTagStore.getState());
    expect(tag?.name).toBe('ById');
  });
});
