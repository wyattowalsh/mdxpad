/**
 * Outline Store
 *
 * Manages the document outline panel state, including sections for
 * headings, components, and frontmatter. Transforms AST data into
 * navigable outline items with collapse state management.
 *
 * @module renderer/stores/outline-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet, castDraft } from 'immer';

// Enable Immer's MapSet plugin for Set support in collapsedItemIds
enableMapSet();
import type {
  OutlineStore,
  OutlineStoreState,
  OutlineSection,
  OutlineSectionId,
  OutlineItem,
  OutlineAST,
  HeadingNode,
  ComponentNode,
  FrontmatterData,
} from '@shared/types/outline';
import {
  INITIAL_OUTLINE_STATE,
  truncateLabel,
} from '@shared/types/outline';

// ============================================================================
// AST to OutlineItem Transformers
// ============================================================================

/**
 * Transform heading nodes into outline items with hierarchical structure.
 * Headings maintain their depth levels for visual hierarchy.
 *
 * @param headings - Array of heading nodes from AST
 * @returns Array of outline items
 */
function transformHeadings(headings: readonly HeadingNode[]): OutlineItem[] {
  return headings.map((heading) => ({
    id: `h-${heading.position.line}-${heading.position.column}`,
    type: 'heading' as const,
    label: truncateLabel(heading.text),
    level: heading.depth,
    line: heading.position.line,
    column: heading.position.column,
    children: [], // Flat list for now; hierarchical nesting is handled in UI
  }));
}

/**
 * Transform component nodes into outline items.
 *
 * @param components - Array of component nodes from AST
 * @returns Array of outline items
 */
function transformComponents(components: readonly ComponentNode[]): OutlineItem[] {
  return components.map((component) => ({
    id: `c-${component.name}-${component.position.line}`,
    type: 'component' as const,
    label: component.name,
    level: 0,
    line: component.position.line,
    column: component.position.column,
    children: [],
  }));
}

/**
 * Transform frontmatter data into outline items.
 *
 * @param frontmatter - Frontmatter data from AST
 * @returns Array of outline items representing frontmatter fields
 */
function transformFrontmatter(frontmatter: FrontmatterData | null): OutlineItem[] {
  if (!frontmatter) return [];

  const items: OutlineItem[] = [];
  const { data, endLine } = frontmatter;

  // Create a single item for the frontmatter section that navigates to line 1
  // Individual field items can be added if needed in the future
  Object.entries(data).forEach(([key, value], index) => {
    const displayValue = formatFrontmatterValue(value);
    items.push({
      id: `fm-${key}`,
      type: 'frontmatter' as const,
      label: `${key}: ${displayValue}`,
      level: 0,
      line: 1, // Frontmatter is always at the start
      column: 1,
      children: [],
    });
  });

  return items;
}

/**
 * Format a frontmatter value for display.
 *
 * @param value - The frontmatter value
 * @returns Formatted string representation
 */
function formatFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === 'object' && value !== null) {
    return '{...}';
  }
  if (typeof value === 'string' && value.length > 30) {
    return value.slice(0, 27) + '...';
  }
  return String(value);
}

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Outline store hook.
 * Manages document outline state with AST transformation and collapse handling.
 *
 * @example
 * ```tsx
 * const { sections, updateFromAST, toggleSectionCollapse } = useOutlineStore();
 *
 * // Update from compilation result
 * useEffect(() => {
 *   const outline = selectOutlineAST(previewState);
 *   if (outline) updateFromAST(outline);
 * }, [previewState]);
 *
 * // Toggle section collapse
 * <button onClick={() => toggleSectionCollapse('headings')}>Toggle</button>
 * ```
 */
export const useOutlineStore = create<OutlineStore>()(
  immer((set, get) => ({
    ...INITIAL_OUTLINE_STATE,

    updateFromAST: (ast: OutlineAST) =>
      set((draft) => {
        // Transform AST to outline items
        const headingItems = transformHeadings(ast.headings);
        const componentItems = transformComponents(ast.components);
        const frontmatterItems = transformFrontmatter(ast.frontmatter);

        // Update sections while preserving collapse state
        // Use castDraft for readonly OutlineSection[] compatibility with Immer
        draft.sections = castDraft(
          draft.sections.map((section) => {
            switch (section.id) {
              case 'headings':
                return {
                  ...section,
                  items: headingItems,
                  isEmpty: headingItems.length === 0,
                };
              case 'components':
                return {
                  ...section,
                  items: componentItems,
                  isEmpty: componentItems.length === 0,
                };
              case 'frontmatter':
                return {
                  ...section,
                  items: frontmatterItems,
                  isEmpty: frontmatterItems.length === 0,
                };
              default:
                return section;
            }
          })
        );

        draft.lastUpdated = Date.now();
        draft.parseError = null;
        draft.isParsing = false;
      }),

    setIsParsing: (isParsing: boolean) =>
      set((draft) => {
        draft.isParsing = isParsing;
      }),

    setParseError: (error: string | null) =>
      set((draft) => {
        draft.parseError = error;
        draft.isParsing = false;
      }),

    toggleSectionCollapse: (sectionId: OutlineSectionId) =>
      set((draft) => {
        const section = draft.sections.find((s) => s.id === sectionId);
        if (section) {
          (section as { isCollapsed: boolean }).isCollapsed = !section.isCollapsed;
        }
      }),

    toggleItemCollapse: (itemId: string) =>
      set((draft) => {
        // Toggle item collapse state by adding/removing from the set
        const currentSet = draft.collapsedItemIds as Set<string>;
        if (currentSet.has(itemId)) {
          currentSet.delete(itemId);
        } else {
          currentSet.add(itemId);
        }
      }),

    reset: () =>
      set((draft) => {
        // Use castDraft for readonly OutlineSection[] compatibility with Immer
        draft.sections = castDraft(INITIAL_OUTLINE_STATE.sections);
        draft.lastUpdated = 0;
        draft.parseError = null;
        draft.isParsing = false;
        (draft.collapsedItemIds as Set<string>).clear();
      }),
  }))
);

// ============================================================================
// Selectors (re-exported from types for convenience)
// ============================================================================

export {
  selectSections,
  selectHeadingsSection,
  selectComponentsSection,
  selectFrontmatterSection,
  selectIsParsing,
  selectParseError,
  selectLastUpdated,
  selectHasContent,
  selectCollapsedItemIds,
  selectIsItemCollapsed,
} from '@shared/types/outline';
