/**
 * Template Store
 *
 * Zustand store with Immer middleware for template state management.
 * Manages template list, selection, filtering, and IPC operations.
 * Uses Fuse.js for performant fuzzy search (< 200ms per SC-004).
 *
 * @module renderer/stores/template-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import Fuse, { type IFuseOptions } from 'fuse.js';
import type {
  Template,
  TemplateMetadata,
  TemplateCategory,
  TemplateVariable,
} from '@shared/contracts/template-schemas';

// =============================================================================
// FUSE.JS CONFIGURATION
// =============================================================================

/**
 * Fuse.js configuration for template search.
 * Configured per SC-004 requirements for < 200ms search performance.
 *
 * Key weights:
 * - name: 0.4 (highest priority - users typically search by template name)
 * - description: 0.3 (second priority - describes the template purpose)
 * - tags: 0.2 (third priority - keywords for categorization)
 * - author: 0.1 (lowest priority - occasionally useful for filtering)
 */
const FUSE_OPTIONS: IFuseOptions<TemplateMetadata> = {
  keys: [
    { name: 'name', weight: 0.4 },
    { name: 'description', weight: 0.3 },
    { name: 'tags', weight: 0.2 },
    { name: 'author', weight: 0.1 },
  ],
  threshold: 0.4, // Allow fuzzy matches (0 = exact, 1 = match anything)
  includeScore: true,
  // Performance optimizations
  ignoreLocation: true, // Don't penalize matches that appear later in string
  minMatchCharLength: 2, // Require at least 2 characters to match
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data required to save a template.
 * Matches the shape expected by window.mdxpad.template.save()
 */
export interface TemplateSaveData {
  id?: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags?: string[];
  variables?: TemplateVariable[];
  content: string;
}

/**
 * Template store state interface.
 */
export interface TemplateState {
  /** List of all available template metadata */
  templates: TemplateMetadata[];
  /** Fuse.js search index (rebuilt when templates change) */
  _fuseIndex: Fuse<TemplateMetadata> | null;
  /** Currently selected template ID */
  selectedId: string | null;
  /** Full template data for the selected template */
  selectedTemplate: Template | null;
  /** Current search query for filtering */
  searchQuery: string;
  /** Current category filter */
  categoryFilter: TemplateCategory | null;
  /** Whether templates are being loaded */
  isLoading: boolean;
  /** Error message if an operation failed */
  error: string | null;
}

/**
 * Template store actions interface.
 */
export interface TemplateStoreActions {
  /** Load all templates from IPC */
  loadTemplates: () => Promise<void>;
  /** Select a template by ID and load its full content */
  selectTemplate: (id: string) => Promise<void>;
  /** Clear the current selection */
  clearSelection: () => void;
  /** Update search query filter */
  setSearchQuery: (query: string) => void;
  /** Update category filter */
  setCategoryFilter: (category: TemplateCategory | null) => void;
  /** Save a new or updated template via IPC */
  saveTemplate: (template: TemplateSaveData, replace?: boolean) => Promise<void>;
  /** Delete a template via IPC */
  deleteTemplate: (id: string) => Promise<void>;
  /** Import a template from a file path via IPC */
  importTemplate: (path: string, replace?: boolean) => Promise<void>;
  /** Export a template to a file path via IPC */
  exportTemplate: (id: string, path: string) => Promise<void>;
  /** Reset the store to initial state */
  reset: () => void;
}

/**
 * Combined template store type.
 */
export type TemplateStore = TemplateState & TemplateStoreActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Initial state for the template store.
 */
const INITIAL_TEMPLATE_STATE: TemplateState = {
  templates: [],
  _fuseIndex: null,
  selectedId: null,
  selectedTemplate: null,
  searchQuery: '',
  categoryFilter: null,
  isLoading: false,
  error: null,
};

/**
 * Creates a new Fuse.js search index from template metadata.
 * Called when templates are loaded or modified.
 *
 * @param templates - Array of template metadata to index
 * @returns Fuse search index
 */
function createFuseIndex(templates: TemplateMetadata[]): Fuse<TemplateMetadata> {
  return new Fuse(templates, FUSE_OPTIONS);
}

// =============================================================================
// STORE CREATION
// =============================================================================

/**
 * Template store hook.
 * Manages template browsing, selection, and CRUD operations.
 *
 * @example
 * ```tsx
 * const {
 *   templates,
 *   selectedTemplate,
 *   isLoading,
 *   loadTemplates,
 *   selectTemplate,
 *   setSearchQuery,
 * } = useTemplateStore();
 *
 * // Load templates on mount
 * useEffect(() => {
 *   loadTemplates();
 * }, [loadTemplates]);
 *
 * // Select a template
 * await selectTemplate('blog-post');
 *
 * // Filter by search
 * setSearchQuery('blog');
 * ```
 */
export const useTemplateStore = create<TemplateStore>()(
  immer((set, get) => ({
    ...INITIAL_TEMPLATE_STATE,

    loadTemplates: async () => {
      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const result = await window.mdxpad.template.list();

        if (result.success) {
          // Create Fuse index outside of immer draft (Fuse instances aren't draft-safe)
          const fuseIndex = createFuseIndex(result.data);
          set((draft) => {
            draft.templates = result.data;
            draft._fuseIndex = fuseIndex;
            draft.isLoading = false;
          });
        } else {
          set((draft) => {
            draft.error = result.error;
            draft.isLoading = false;
          });
        }
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to load templates';
          draft.isLoading = false;
        });
      }
    },

    selectTemplate: async (id: string) => {
      set((draft) => {
        draft.selectedId = id;
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const result = await window.mdxpad.template.get(id);

        if (result.success) {
          set((draft) => {
            draft.selectedTemplate = result.data;
            draft.isLoading = false;
          });
        } else {
          set((draft) => {
            draft.error = result.error;
            draft.selectedTemplate = null;
            draft.isLoading = false;
          });
        }
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to load template';
          draft.selectedTemplate = null;
          draft.isLoading = false;
        });
      }
    },

    clearSelection: () =>
      set((draft) => {
        draft.selectedId = null;
        draft.selectedTemplate = null;
      }),

    setSearchQuery: (query: string) =>
      set((draft) => {
        draft.searchQuery = query;
      }),

    setCategoryFilter: (category: TemplateCategory | null) =>
      set((draft) => {
        draft.categoryFilter = category;
      }),

    saveTemplate: async (template: TemplateSaveData, replace = false) => {
      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const result = await window.mdxpad.template.save(template, replace);

        if (result.success) {
          // Reload templates to get updated list
          const listResult = await window.mdxpad.template.list();
          if (listResult.success) {
            // Create Fuse index outside of immer draft
            const fuseIndex = createFuseIndex(listResult.data);
            set((draft) => {
              draft.templates = listResult.data;
              draft._fuseIndex = fuseIndex;
              draft.isLoading = false;
            });
          } else {
            set((draft) => {
              draft.isLoading = false;
            });
          }
        } else {
          set((draft) => {
            draft.error = result.error;
            draft.isLoading = false;
          });
        }
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to save template';
          draft.isLoading = false;
        });
      }
    },

    deleteTemplate: async (id: string) => {
      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const result = await window.mdxpad.template.delete(id);

        if (result.success) {
          // Get current templates and remove the deleted one
          const currentTemplates = get().templates;
          const updatedTemplates = currentTemplates.filter((t) => t.id !== id);
          // Create new Fuse index outside of immer draft
          const fuseIndex = createFuseIndex(updatedTemplates);

          set((draft) => {
            // Remove from local list
            draft.templates = updatedTemplates;
            draft._fuseIndex = fuseIndex;
            // Clear selection if deleted template was selected
            if (draft.selectedId === id) {
              draft.selectedId = null;
              draft.selectedTemplate = null;
            }
            draft.isLoading = false;
          });
        } else {
          set((draft) => {
            draft.error = result.error;
            draft.isLoading = false;
          });
        }
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to delete template';
          draft.isLoading = false;
        });
      }
    },

    importTemplate: async (path: string, replace = false) => {
      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const result = await window.mdxpad.template.import(path, replace);

        if (result.success) {
          // Reload templates to get updated list
          const listResult = await window.mdxpad.template.list();
          if (listResult.success) {
            // Create Fuse index outside of immer draft
            const fuseIndex = createFuseIndex(listResult.data);
            set((draft) => {
              draft.templates = listResult.data;
              draft._fuseIndex = fuseIndex;
              draft.isLoading = false;
            });
          } else {
            set((draft) => {
              draft.isLoading = false;
            });
          }
        } else {
          set((draft) => {
            draft.error = result.error;
            draft.isLoading = false;
          });
        }
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to import template';
          draft.isLoading = false;
        });
      }
    },

    exportTemplate: async (id: string, path: string) => {
      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const result = await window.mdxpad.template.export(id, path);

        if (result.success) {
          set((draft) => {
            draft.isLoading = false;
          });
        } else {
          set((draft) => {
            draft.error = result.error;
            draft.isLoading = false;
          });
        }
      } catch (err) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to export template';
          draft.isLoading = false;
        });
      }
    },

    reset: () =>
      set((draft) => {
        draft.templates = [];
        draft._fuseIndex = null;
        draft.selectedId = null;
        draft.selectedTemplate = null;
        draft.searchQuery = '';
        draft.categoryFilter = null;
        draft.isLoading = false;
        draft.error = null;
      }),
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Selector for templates array.
 *
 * @param state - Template store state
 * @returns All templates
 */
export const selectTemplates = (state: TemplateStore): TemplateMetadata[] =>
  state.templates;

/**
 * Selector for selected template ID.
 *
 * @param state - Template store state
 * @returns Selected template ID or null
 */
export const selectSelectedId = (state: TemplateStore): string | null =>
  state.selectedId;

/**
 * Selector for selected template data.
 *
 * @param state - Template store state
 * @returns Full selected template or null
 */
export const selectSelectedTemplate = (state: TemplateStore): Template | null =>
  state.selectedTemplate;

/**
 * Selector for search query.
 *
 * @param state - Template store state
 * @returns Current search query
 */
export const selectSearchQuery = (state: TemplateStore): string =>
  state.searchQuery;

/**
 * Selector for category filter.
 *
 * @param state - Template store state
 * @returns Current category filter or null
 */
export const selectCategoryFilter = (state: TemplateStore): TemplateCategory | null =>
  state.categoryFilter;

/**
 * Selector for loading state.
 *
 * @param state - Template store state
 * @returns Whether an operation is in progress
 */
export const selectIsLoading = (state: TemplateStore): boolean =>
  state.isLoading;

/**
 * Selector for error state.
 *
 * @param state - Template store state
 * @returns Error message or null
 */
export const selectError = (state: TemplateStore): string | null =>
  state.error;

/**
 * Computed selector for filtered templates.
 * Uses Fuse.js for fuzzy search with configurable weights.
 * Performance target: < 200ms search (per SC-004).
 *
 * Search priority (by weight):
 * 1. name (0.4) - highest priority
 * 2. description (0.3)
 * 3. tags (0.2)
 * 4. author (0.1) - lowest priority
 *
 * @param state - Template store state
 * @returns Filtered templates array
 */
export const selectFilteredTemplates = (state: TemplateStore): TemplateMetadata[] => {
  const { templates, _fuseIndex, searchQuery, categoryFilter } = state;
  const query = searchQuery.trim();

  let filtered: TemplateMetadata[];

  // If no search query, start with all templates
  // If search query exists, use Fuse.js fuzzy search
  if (!query) {
    filtered = templates;
  } else if (_fuseIndex) {
    // Use Fuse.js for fuzzy search
    const fuseResults = _fuseIndex.search(query);
    filtered = fuseResults.map((result) => result.item);
  } else {
    // Fallback to simple substring matching if Fuse index not built yet
    // (This should rarely happen - only on first render before loadTemplates completes)
    const lowerQuery = query.toLowerCase();
    filtered = templates.filter((t) => {
      if (t.name.toLowerCase().includes(lowerQuery)) return true;
      if (t.description.toLowerCase().includes(lowerQuery)) return true;
      if (t.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))) return true;
      if (t.author?.toLowerCase().includes(lowerQuery)) return true;
      return false;
    });
  }

  // Apply category filter after search
  if (categoryFilter !== null) {
    filtered = filtered.filter((t) => t.category === categoryFilter);
  }

  return filtered;
};

/**
 * Selector for checking if any templates exist.
 *
 * @param state - Template store state
 * @returns Whether any templates are loaded
 */
export const selectHasTemplates = (state: TemplateStore): boolean =>
  state.templates.length > 0;

/**
 * Selector for built-in templates.
 *
 * @param state - Template store state
 * @returns Only built-in templates
 */
export const selectBuiltInTemplates = (state: TemplateStore): TemplateMetadata[] =>
  state.templates.filter((t) => t.isBuiltIn);

/**
 * Selector for custom templates.
 *
 * @param state - Template store state
 * @returns Only custom (user-created) templates
 */
export const selectCustomTemplates = (state: TemplateStore): TemplateMetadata[] =>
  state.templates.filter((t) => !t.isBuiltIn);
