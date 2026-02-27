/**
 * Tab Store
 *
 * Zustand store with Immer middleware for tabbed editing state management.
 * Tracks open tabs, active tab, and tab ordering.
 *
 * @module renderer/stores/tab-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { uid } from '@shared/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface Tab {
  readonly id: string;
  readonly filePath: string | null;
  readonly fileName: string;
  readonly isDirty: boolean;
  readonly content: string;
}

export interface TabState {
  readonly tabs: Tab[];
  readonly activeTabId: string | null;
}

export interface TabStoreActions {
  addTab: (tab: Omit<Tab, 'id'>) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  updateTab: (id: string, updates: Partial<Omit<Tab, 'id'>>) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  reset: () => void;
}

export type TabStore = TabState & TabStoreActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

const INITIAL_TAB_STATE: TabState = {
  tabs: [],
  activeTabId: null,
};

// =============================================================================
// STORE
// =============================================================================

export const useTabStore = create<TabStore>()(
  immer((set) => {
    let lastCreatedId = '';

    return {
      ...INITIAL_TAB_STATE,

      addTab: (tab) => {
        const id = uid();
        lastCreatedId = id;
        set((draft) => {
          draft.tabs.push({ ...tab, id });
          draft.activeTabId = id;
        });
        return lastCreatedId;
      },

      removeTab: (id) =>
        set((draft) => {
          const index = draft.tabs.findIndex((t) => t.id === id);
          if (index === -1) return;

          draft.tabs.splice(index, 1);

          if (draft.activeTabId === id) {
            if (draft.tabs.length === 0) {
              draft.activeTabId = null;
            } else {
              const newIndex = Math.min(index, draft.tabs.length - 1);
              const newActiveTab = draft.tabs[newIndex];
              draft.activeTabId = newActiveTab ? newActiveTab.id : null;
            }
          }
        }),

      setActiveTab: (id) =>
        set((draft) => {
          const exists = draft.tabs.some((t) => t.id === id);
          if (exists) {
            draft.activeTabId = id;
          }
        }),

      reorderTabs: (fromIndex, toIndex) =>
        set((draft) => {
          if (
            fromIndex < 0 ||
            fromIndex >= draft.tabs.length ||
            toIndex < 0 ||
            toIndex >= draft.tabs.length ||
            fromIndex === toIndex
          ) {
            return;
          }
          const [moved] = draft.tabs.splice(fromIndex, 1);
          if (moved) {
            draft.tabs.splice(toIndex, 0, moved);
          }
        }),

      updateTab: (id, updates) =>
        set((draft) => {
          const tab = draft.tabs.find((t) => t.id === id);
          if (!tab) return;
          if (updates.filePath !== undefined)
            (tab as { filePath: string | null }).filePath = updates.filePath;
          if (updates.fileName !== undefined)
            (tab as { fileName: string }).fileName = updates.fileName;
          if (updates.isDirty !== undefined)
            (tab as { isDirty: boolean }).isDirty = updates.isDirty;
          if (updates.content !== undefined) (tab as { content: string }).content = updates.content;
        }),

      closeOtherTabs: (id) =>
        set((draft) => {
          const kept = draft.tabs.find((t) => t.id === id);
          if (!kept) return;
          draft.tabs = [kept];
          draft.activeTabId = id;
        }),

      closeTabsToRight: (id) =>
        set((draft) => {
          const index = draft.tabs.findIndex((t) => t.id === id);
          if (index === -1) return;
          draft.tabs.splice(index + 1);

          if (draft.activeTabId !== null) {
            const activeStillExists = draft.tabs.some((t) => t.id === draft.activeTabId);
            if (!activeStillExists) {
              draft.activeTabId = id;
            }
          }
        }),

      reset: () =>
        set((draft) => {
          draft.tabs = [];
          draft.activeTabId = null;
        }),
    };
  })
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectTabs = (state: TabStore): Tab[] => state.tabs;

export const selectActiveTabId = (state: TabStore): string | null => state.activeTabId;

export const selectActiveTab = (state: TabStore): Tab | undefined =>
  state.tabs.find((t) => t.id === state.activeTabId);

export const selectTabCount = (state: TabStore): number => state.tabs.length;

export const selectTabById =
  (id: string) =>
  (state: TabStore): Tab | undefined =>
    state.tabs.find((t) => t.id === id);
