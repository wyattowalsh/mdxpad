/**
 * Tab Store Tests
 *
 * Tests for tab state management: add, remove, reorder, close,
 * active tab management.
 *
 * @module renderer/stores/tab-store.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from './tab-store';

function resetStore() {
  useTabStore.getState().reset();
}

function addTestTab(
  overrides: Partial<{
    filePath: string | null;
    fileName: string;
    isDirty: boolean;
    content: string;
  }> = {}
) {
  return useTabStore.getState().addTab({
    filePath: overrides.filePath ?? '/test/file.mdx',
    fileName: overrides.fileName ?? 'file.mdx',
    isDirty: overrides.isDirty ?? false,
    content: overrides.content ?? '',
    savedContent: overrides.content ?? '',
  });
}

describe('useTabStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addTab', () => {
    it('should add a tab and set it as active', () => {
      const id = addTestTab({ fileName: 'test.mdx' });

      const state = useTabStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0]?.fileName).toBe('test.mdx');
      expect(state.activeTabId).toBe(id);
    });

    it('should return a unique id for each tab', () => {
      const id1 = addTestTab({ fileName: 'a.mdx' });
      const id2 = addTestTab({ fileName: 'b.mdx' });

      expect(id1).not.toBe(id2);
      expect(useTabStore.getState().tabs).toHaveLength(2);
    });

    it('should set new tab as active', () => {
      addTestTab({ fileName: 'a.mdx' });
      const id2 = addTestTab({ fileName: 'b.mdx' });

      expect(useTabStore.getState().activeTabId).toBe(id2);
    });
  });

  describe('removeTab', () => {
    it('should remove a tab by id', () => {
      const id = addTestTab();
      useTabStore.getState().removeTab(id);

      expect(useTabStore.getState().tabs).toHaveLength(0);
      expect(useTabStore.getState().activeTabId).toBeNull();
    });

    it('should activate the previous tab when removing the active tab', () => {
      const id1 = addTestTab({ fileName: 'a.mdx' });
      const id2 = addTestTab({ fileName: 'b.mdx' });

      // id2 is active, remove it
      useTabStore.getState().removeTab(id2);

      expect(useTabStore.getState().activeTabId).toBe(id1);
    });

    it('should activate the next tab when removing the first tab', () => {
      const id1 = addTestTab({ fileName: 'a.mdx' });
      const id2 = addTestTab({ fileName: 'b.mdx' });

      // Set first tab as active and remove it
      useTabStore.getState().setActiveTab(id1);
      useTabStore.getState().removeTab(id1);

      expect(useTabStore.getState().activeTabId).toBe(id2);
    });

    it('should not change active tab when removing a non-active tab', () => {
      const id1 = addTestTab({ fileName: 'a.mdx' });
      const id2 = addTestTab({ fileName: 'b.mdx' });

      // id2 is active, remove id1
      useTabStore.getState().removeTab(id1);

      expect(useTabStore.getState().activeTabId).toBe(id2);
    });

    it('should do nothing when removing a non-existent tab', () => {
      addTestTab();
      useTabStore.getState().removeTab('nonexistent');

      expect(useTabStore.getState().tabs).toHaveLength(1);
    });
  });

  describe('setActiveTab', () => {
    it('should set the active tab', () => {
      const id1 = addTestTab({ fileName: 'a.mdx' });
      addTestTab({ fileName: 'b.mdx' });

      useTabStore.getState().setActiveTab(id1);
      expect(useTabStore.getState().activeTabId).toBe(id1);
    });

    it('should not change active tab if id does not exist', () => {
      const id1 = addTestTab();

      useTabStore.getState().setActiveTab('nonexistent');
      expect(useTabStore.getState().activeTabId).toBe(id1);
    });
  });

  describe('reorderTabs', () => {
    it('should reorder tabs from one index to another', () => {
      addTestTab({ fileName: 'a.mdx' });
      addTestTab({ fileName: 'b.mdx' });
      addTestTab({ fileName: 'c.mdx' });

      useTabStore.getState().reorderTabs(0, 2);

      const names = useTabStore.getState().tabs.map((t) => t.fileName);
      expect(names).toEqual(['b.mdx', 'c.mdx', 'a.mdx']);
    });

    it('should do nothing for out-of-bounds indices', () => {
      addTestTab({ fileName: 'a.mdx' });

      useTabStore.getState().reorderTabs(-1, 0);
      useTabStore.getState().reorderTabs(0, 5);

      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('should do nothing when from equals to', () => {
      addTestTab({ fileName: 'a.mdx' });
      addTestTab({ fileName: 'b.mdx' });

      useTabStore.getState().reorderTabs(0, 0);

      const names = useTabStore.getState().tabs.map((t) => t.fileName);
      expect(names).toEqual(['a.mdx', 'b.mdx']);
    });
  });

  describe('updateTab', () => {
    it('should update tab properties', () => {
      const id = addTestTab({ fileName: 'old.mdx', isDirty: false });

      useTabStore.getState().updateTab(id, { fileName: 'new.mdx', isDirty: true });

      const tab = useTabStore.getState().tabs.find((t) => t.id === id);
      expect(tab?.fileName).toBe('new.mdx');
      expect(tab?.isDirty).toBe(true);
    });

    it('should do nothing for non-existent tab', () => {
      addTestTab();

      useTabStore.getState().updateTab('nonexistent', { fileName: 'x.mdx' });
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('should support partial updates', () => {
      const id = addTestTab({ fileName: 'test.mdx', content: 'original' });

      useTabStore.getState().updateTab(id, { content: 'updated' });

      const tab = useTabStore.getState().tabs.find((t) => t.id === id);
      expect(tab?.content).toBe('updated');
      expect(tab?.fileName).toBe('test.mdx');
    });
  });

  describe('closeOtherTabs', () => {
    it('should close all tabs except the specified one', () => {
      addTestTab({ fileName: 'a.mdx' });
      const id2 = addTestTab({ fileName: 'b.mdx' });
      addTestTab({ fileName: 'c.mdx' });

      useTabStore.getState().closeOtherTabs(id2);

      expect(useTabStore.getState().tabs).toHaveLength(1);
      expect(useTabStore.getState().tabs[0]?.fileName).toBe('b.mdx');
      expect(useTabStore.getState().activeTabId).toBe(id2);
    });

    it('should do nothing if the tab id does not exist', () => {
      addTestTab();
      addTestTab();

      useTabStore.getState().closeOtherTabs('nonexistent');
      expect(useTabStore.getState().tabs).toHaveLength(2);
    });
  });

  describe('closeTabsToRight', () => {
    it('should close all tabs to the right of the specified tab', () => {
      addTestTab({ fileName: 'a.mdx' });
      const id2 = addTestTab({ fileName: 'b.mdx' });
      addTestTab({ fileName: 'c.mdx' });
      addTestTab({ fileName: 'd.mdx' });

      useTabStore.getState().closeTabsToRight(id2);

      const names = useTabStore.getState().tabs.map((t) => t.fileName);
      expect(names).toEqual(['a.mdx', 'b.mdx']);
    });

    it('should update active tab if it was closed', () => {
      const id1 = addTestTab({ fileName: 'a.mdx' });
      addTestTab({ fileName: 'b.mdx' });
      // b.mdx is active (last added)

      useTabStore.getState().closeTabsToRight(id1);

      expect(useTabStore.getState().activeTabId).toBe(id1);
    });

    it('should do nothing for the last tab', () => {
      addTestTab({ fileName: 'a.mdx' });
      const id2 = addTestTab({ fileName: 'b.mdx' });

      useTabStore.getState().closeTabsToRight(id2);

      expect(useTabStore.getState().tabs).toHaveLength(2);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      addTestTab();
      addTestTab();

      useTabStore.getState().reset();

      expect(useTabStore.getState().tabs).toHaveLength(0);
      expect(useTabStore.getState().activeTabId).toBeNull();
    });
  });
});
