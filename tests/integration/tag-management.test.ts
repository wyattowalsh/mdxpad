/**
 * Tag Store State Transition & Selector Tests
 *
 * Tests tag CRUD, file assignment, search by tag, nested taxonomy,
 * parent-child relationships, tag selection/filtering, and localStorage
 * persistence.
 *
 * NOTE: Scope clarification — despite the `tests/integration/` path, these are
 * unit-level tests exercising the Zustand tag-store in isolation with a mocked
 * localStorage. All operations are performed directly on the store API without
 * any real filesystem, IPC communication, or UI rendering. True integration
 * tests would assign tags through the UI, verify persistence via the main
 * process (electron-store or filesystem), and confirm that tag-based file
 * filtering updates the sidebar and search results end-to-end.
 *
 * @module tests/integration/tag-management.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// localStorage mock (node environment)
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Import after mocks
import {
  useTagStore,
  selectAllTags,
  selectSelectedTags,
  selectTagTree,
  selectTagsByFile,
  selectFilesWithTag,
  selectTagById,
} from '@renderer/stores/tag-store';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tag Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    act(() => {
      useTagStore.getState().reset();
    });
  });

  describe('create tag -> assign to file -> search by tag -> remove', () => {
    it('should complete full tag lifecycle', () => {
      const store = useTagStore.getState();

      // Step 1: Create a tag
      let tagId: string;
      act(() => {
        tagId = store.addTag('documentation', '#3b82f6');
      });

      let state = useTagStore.getState();
      expect(selectAllTags(state)).toHaveLength(1);
      expect(selectTagById(tagId!)(state)?.name).toBe('documentation');
      expect(selectTagById(tagId!)(state)?.color).toBe('#3b82f6');

      // Step 2: Assign tag to a file
      act(() => {
        useTagStore.getState().assignTagToFile('/docs/readme.mdx', tagId!);
      });

      state = useTagStore.getState();
      const fileTags = selectTagsByFile('/docs/readme.mdx')(state);
      expect(fileTags).toHaveLength(1);
      expect(fileTags[0]?.name).toBe('documentation');

      // Step 3: Search files by tag
      const files = selectFilesWithTag(tagId!)(state);
      expect(files).toContain('/docs/readme.mdx');

      // Step 4: Remove tag from file
      act(() => {
        useTagStore.getState().removeTagFromFile('/docs/readme.mdx', tagId!);
      });

      state = useTagStore.getState();
      expect(selectTagsByFile('/docs/readme.mdx')(state)).toHaveLength(0);

      // Step 5: Remove tag entirely
      act(() => {
        useTagStore.getState().removeTag(tagId!);
      });

      state = useTagStore.getState();
      expect(selectAllTags(state)).toHaveLength(0);
    });
  });

  describe('multiple tags and files', () => {
    it('should support multiple tags on a single file', () => {
      let tag1: string, tag2: string, tag3: string;

      act(() => {
        tag1 = useTagStore.getState().addTag('react', '#61dafb');
        tag2 = useTagStore.getState().addTag('typescript', '#3178c6');
        tag3 = useTagStore.getState().addTag('tutorial', '#10b981');
      });

      act(() => {
        useTagStore.getState().assignTagToFile('/guides/react-ts.mdx', tag1!);
        useTagStore.getState().assignTagToFile('/guides/react-ts.mdx', tag2!);
        useTagStore.getState().assignTagToFile('/guides/react-ts.mdx', tag3!);
      });

      const state = useTagStore.getState();
      const tags = selectTagsByFile('/guides/react-ts.mdx')(state);
      expect(tags).toHaveLength(3);
      expect(tags.map((t) => t.name)).toContain('react');
      expect(tags.map((t) => t.name)).toContain('typescript');
      expect(tags.map((t) => t.name)).toContain('tutorial');
    });

    it('should support same tag on multiple files', () => {
      let tagId: string;

      act(() => {
        tagId = useTagStore.getState().addTag('draft', '#f59e0b');
      });

      act(() => {
        useTagStore.getState().assignTagToFile('/posts/a.mdx', tagId!);
        useTagStore.getState().assignTagToFile('/posts/b.mdx', tagId!);
        useTagStore.getState().assignTagToFile('/posts/c.mdx', tagId!);
      });

      const state = useTagStore.getState();
      const files = selectFilesWithTag(tagId!)(state);
      expect(files).toHaveLength(3);
      expect(files).toContain('/posts/a.mdx');
      expect(files).toContain('/posts/b.mdx');
      expect(files).toContain('/posts/c.mdx');
    });

    it('should not duplicate tag assignment', () => {
      let tagId: string;

      act(() => {
        tagId = useTagStore.getState().addTag('important');
      });

      act(() => {
        useTagStore.getState().assignTagToFile('/file.mdx', tagId!);
        useTagStore.getState().assignTagToFile('/file.mdx', tagId!); // duplicate
      });

      const state = useTagStore.getState();
      const tags = selectTagsByFile('/file.mdx')(state);
      expect(tags).toHaveLength(1);
    });
  });

  describe('nested taxonomy (parent-child relationships)', () => {
    it('should build a tag tree with parent-child hierarchy', () => {
      let parentId: string, child1Id: string, child2Id: string;

      act(() => {
        parentId = useTagStore.getState().addTag('programming');
        child1Id = useTagStore.getState().addTag('javascript', undefined, parentId!);
        child2Id = useTagStore.getState().addTag('python', undefined, parentId!);
      });

      const state = useTagStore.getState();
      const tree = selectTagTree(state);

      // Root level should have one parent node
      const parentNode = tree.find((n) => n.tag.id === parentId!);
      expect(parentNode).toBeDefined();
      expect(parentNode?.children).toHaveLength(2);
      expect(parentNode?.children.map((c) => c.tag.name)).toContain('javascript');
      expect(parentNode?.children.map((c) => c.tag.name)).toContain('python');
    });

    it('should support deeply nested tags', () => {
      let rootId: string, midId: string, leafId: string;

      act(() => {
        rootId = useTagStore.getState().addTag('root');
        midId = useTagStore.getState().addTag('mid', undefined, rootId!);
        leafId = useTagStore.getState().addTag('leaf', undefined, midId!);
      });

      const state = useTagStore.getState();
      const tree = selectTagTree(state);

      const rootNode = tree.find((n) => n.tag.id === rootId!);
      expect(rootNode?.children).toHaveLength(1);
      expect(rootNode?.children[0]?.tag.name).toBe('mid');
      expect(rootNode?.children[0]?.children).toHaveLength(1);
      expect(rootNode?.children[0]?.children[0]?.tag.name).toBe('leaf');
    });

    it('should remove descendants when parent is removed', () => {
      let parentId: string, childId: string;

      act(() => {
        parentId = useTagStore.getState().addTag('parent');
        childId = useTagStore.getState().addTag('child', undefined, parentId!);
      });

      // Assign child tag to a file
      act(() => {
        useTagStore.getState().assignTagToFile('/file.mdx', childId!);
      });

      // Remove parent should cascade
      act(() => {
        useTagStore.getState().removeTag(parentId!);
      });

      const state = useTagStore.getState();
      expect(selectAllTags(state)).toHaveLength(0);
      expect(selectTagsByFile('/file.mdx')(state)).toHaveLength(0);
    });

    it('should reparent a tag', () => {
      let parent1Id: string, parent2Id: string, childId: string;

      act(() => {
        parent1Id = useTagStore.getState().addTag('category-a');
        parent2Id = useTagStore.getState().addTag('category-b');
        childId = useTagStore.getState().addTag('item', undefined, parent1Id!);
      });

      // Move child from parent1 to parent2
      act(() => {
        useTagStore.getState().setTagParent(childId!, parent2Id!);
      });

      const state = useTagStore.getState();
      const tree = selectTagTree(state);

      const parent1Node = tree.find((n) => n.tag.id === parent1Id!);
      const parent2Node = tree.find((n) => n.tag.id === parent2Id!);

      expect(parent1Node?.children).toHaveLength(0);
      expect(parent2Node?.children).toHaveLength(1);
      expect(parent2Node?.children[0]?.tag.name).toBe('item');
    });
  });

  describe('tag selection', () => {
    it('should toggle selected tags for filtering', () => {
      let tag1Id: string, tag2Id: string;

      act(() => {
        tag1Id = useTagStore.getState().addTag('featured');
        tag2Id = useTagStore.getState().addTag('archived');
      });

      // Select tag1
      act(() => {
        useTagStore.getState().toggleSelectedTag(tag1Id!);
      });

      let state = useTagStore.getState();
      expect(selectSelectedTags(state)).toContain(tag1Id!);
      expect(selectSelectedTags(state)).not.toContain(tag2Id!);

      // Toggle tag1 off
      act(() => {
        useTagStore.getState().toggleSelectedTag(tag1Id!);
      });

      state = useTagStore.getState();
      expect(selectSelectedTags(state)).not.toContain(tag1Id!);
    });

    it('should clear all selected tags', () => {
      let tag1Id: string, tag2Id: string;

      act(() => {
        tag1Id = useTagStore.getState().addTag('a');
        tag2Id = useTagStore.getState().addTag('b');
      });

      act(() => {
        useTagStore.getState().toggleSelectedTag(tag1Id!);
        useTagStore.getState().toggleSelectedTag(tag2Id!);
      });

      expect(selectSelectedTags(useTagStore.getState())).toHaveLength(2);

      act(() => {
        useTagStore.getState().clearSelectedTags();
      });

      expect(selectSelectedTags(useTagStore.getState())).toHaveLength(0);
    });

    it('should remove selected tags when tag is deleted', () => {
      let tagId: string;

      act(() => {
        tagId = useTagStore.getState().addTag('temp');
      });

      act(() => {
        useTagStore.getState().toggleSelectedTag(tagId!);
      });

      expect(selectSelectedTags(useTagStore.getState())).toContain(tagId!);

      act(() => {
        useTagStore.getState().removeTag(tagId!);
      });

      expect(selectSelectedTags(useTagStore.getState())).not.toContain(tagId!);
    });
  });

  describe('tag modification', () => {
    it('should rename a tag', () => {
      let tagId: string;

      act(() => {
        tagId = useTagStore.getState().addTag('old-name');
      });

      act(() => {
        useTagStore.getState().renameTag(tagId!, 'new-name');
      });

      const state = useTagStore.getState();
      expect(selectTagById(tagId!)(state)?.name).toBe('new-name');
    });

    it('should change tag color', () => {
      let tagId: string;

      act(() => {
        tagId = useTagStore.getState().addTag('colorful', '#ff0000');
      });

      act(() => {
        useTagStore.getState().setTagColor(tagId!, '#00ff00');
      });

      const state = useTagStore.getState();
      expect(selectTagById(tagId!)(state)?.color).toBe('#00ff00');
    });

    it('should use default color when none specified', () => {
      let tagId: string;

      act(() => {
        tagId = useTagStore.getState().addTag('no-color');
      });

      const state = useTagStore.getState();
      expect(selectTagById(tagId!)(state)?.color).toBe('#6366f1');
    });
  });

  describe('persistence', () => {
    it('should persist tags to localStorage', () => {
      act(() => {
        useTagStore.getState().addTag('persisted');
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const calls = localStorageMock.setItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]).toBe('mdxpad:tag-store');

      const stored = JSON.parse(lastCall?.[1] ?? '{}');
      expect(stored.tags).toHaveLength(1);
      expect(stored.tags[0].name).toBe('persisted');
    });
  });
});
