/**
 * Outline Type Definitions
 *
 * Shared types for the MDX Content Outline feature.
 * Defines types for AST extraction, store state, and navigation.
 *
 * @module shared/types/outline
 */

import type { StoreApi } from 'zustand';

// ============================================================================
// Core Types (T001)
// ============================================================================

/**
 * Valid heading levels (0 = non-heading).
 */
export type HeadingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Section identifiers for outline panel grouping.
 */
export type OutlineSectionId = 'headings' | 'components' | 'frontmatter';

/**
 * Outline item type discriminant.
 */
export type OutlineItemType = 'heading' | 'component' | 'frontmatter';

/**
 * Source position in MDX document.
 * Line and column are 1-indexed.
 */
export interface SourcePosition {
  /** Line number (1-indexed) */
  readonly line: number;
  /** Column number (1-indexed) */
  readonly column: number;
}

/**
 * Heading node extracted from MDX AST.
 */
export interface HeadingNode {
  /** Heading level 1-6 */
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6;
  /** Heading text content */
  readonly text: string;
  /** Source position */
  readonly position: SourcePosition;
}

/**
 * Component node extracted from MDX AST.
 */
export interface ComponentNode {
  /** Component name */
  readonly name: string;
  /** Source position */
  readonly position: SourcePosition;
}

/**
 * Frontmatter data extracted from MDX.
 */
export interface FrontmatterData {
  /** Raw frontmatter object */
  readonly data: Record<string, unknown>;
  /** Line where frontmatter ends */
  readonly endLine: number;
}

/**
 * Lightweight AST data extracted during MDX compilation.
 * Piggybacked on CompileSuccess to avoid duplicate parsing.
 */
export interface OutlineAST {
  /** All headings in document order */
  readonly headings: readonly HeadingNode[];
  /** All JSX components in document order */
  readonly components: readonly ComponentNode[];
  /** Parsed frontmatter data */
  readonly frontmatter: FrontmatterData | null;
}

// ============================================================================
// Store Types (T002)
// ============================================================================

/**
 * A single navigable item in the document outline.
 */
export interface OutlineItem {
  /** Unique identifier within the outline */
  readonly id: string;
  /** Type of outline item */
  readonly type: OutlineItemType;
  /** Display text for the tree node */
  readonly label: string;
  /** Heading level (1-6) for headings, 0 for other types */
  readonly level: HeadingLevel;
  /** Source line number (1-indexed) */
  readonly line: number;
  /** Source column number (1-indexed) */
  readonly column: number;
  /** Nested children (for hierarchical headings) */
  readonly children: readonly OutlineItem[];
}

/**
 * A collapsible section in the outline panel.
 */
export interface OutlineSection {
  /** Section identifier */
  readonly id: OutlineSectionId;
  /** Display name for section header */
  readonly label: string;
  /** Items within this section */
  readonly items: readonly OutlineItem[];
  /** Whether section is collapsed in UI */
  readonly isCollapsed: boolean;
  /** Whether section has any items */
  readonly isEmpty: boolean;
}

/**
 * Complete outline state managed by the outline store.
 */
export interface OutlineStoreState {
  /** All outline sections (fixed order: frontmatter, headings, components) */
  readonly sections: readonly OutlineSection[];
  /** Last successful parse timestamp */
  readonly lastUpdated: number;
  /** Error message if parsing failed */
  readonly parseError: string | null;
  /** Whether currently parsing */
  readonly isParsing: boolean;
  /** Set of collapsed item IDs (for heading hierarchy) */
  readonly collapsedItemIds: ReadonlySet<string>;
}

/**
 * Outline store actions.
 */
export interface OutlineStoreActions {
  /**
   * Update outline from parsed AST data.
   * Called when preview store receives new compilation result.
   *
   * @param ast - The lightweight AST data extracted from MDX compilation
   * @returns void
   */
  readonly updateFromAST: (ast: OutlineAST) => void;

  /**
   * Mark outline as parsing (compilation in progress).
   *
   * @param isParsing - Whether parsing is currently in progress
   * @returns void
   */
  readonly setIsParsing: (isParsing: boolean) => void;

  /**
   * Set parse error state.
   *
   * @param error - Error message string, or null to clear error state
   * @returns void
   */
  readonly setParseError: (error: string | null) => void;

  /**
   * Toggle collapse state for a section.
   *
   * @param sectionId - The section to toggle ('headings' | 'components' | 'frontmatter')
   * @returns void
   */
  readonly toggleSectionCollapse: (sectionId: OutlineSectionId) => void;

  /**
   * Toggle collapse state for a heading item (nested collapse).
   *
   * @param itemId - The heading item ID to toggle
   * @returns void
   */
  readonly toggleItemCollapse: (itemId: string) => void;

  /**
   * Reset outline to initial empty state.
   *
   * @returns void
   */
  readonly reset: () => void;
}

/**
 * Combined outline store type.
 */
export type OutlineStore = OutlineStoreState & OutlineStoreActions;

/**
 * Outline store API type for external access.
 */
export type OutlineStoreApi = StoreApi<OutlineStore>;

// ============================================================================
// Navigation Types (T003)
// ============================================================================

/**
 * Location to navigate to in the editor.
 */
export interface OutlineLocation {
  /** Line number (1-indexed) */
  readonly line: number;
  /** Column number (1-indexed), defaults to 1 if not provided */
  readonly column?: number;
}

/**
 * Options for the useOutlineNavigation hook.
 */
export interface UseOutlineNavigationOptions {
  /** Ref to the CodeMirror EditorView */
  readonly editorRef: React.RefObject<EditorView | null>;
  /** Duration of line highlight in ms (default: 500) */
  readonly highlightDuration?: number;
}

/**
 * Result returned by the useOutlineNavigation hook.
 */
export interface UseOutlineNavigationResult {
  /**
   * Navigate to a specific location in the editor.
   * Positions cursor, scrolls to center, and briefly highlights the line.
   */
  readonly navigateToItem: (location: OutlineLocation) => void;
  /**
   * Whether navigation is currently in progress (for UI feedback).
   */
  readonly isNavigating: boolean;
}

/**
 * State effect value for triggering line highlight.
 * Used internally by the navigation hook.
 */
export interface HighlightEffectValue {
  /** Line number to highlight (1-indexed) */
  readonly line: number;
  /** Duration in ms */
  readonly duration: number;
}

// ============================================================================
// Panel Types
// ============================================================================

/**
 * Props for the main OutlinePanel component.
 */
export interface OutlinePanelProps {
  /** Callback when panel close button is clicked */
  readonly onClose?: () => void;
  /** Optional CSS class name */
  readonly className?: string;
}

/**
 * Props for individual section components.
 */
export interface OutlineSectionProps {
  /** Section data */
  readonly section: OutlineSection;
  /** Callback when section header collapse toggle is clicked */
  readonly onToggleCollapse: (sectionId: OutlineSectionId) => void;
  /** Callback when an item is clicked for navigation */
  readonly onItemClick: (item: OutlineItem) => void;
  /** Callback when a nested heading collapse toggle is clicked */
  readonly onItemToggleCollapse?: (itemId: string) => void;
}

/**
 * Props for outline tree item components.
 */
export interface OutlineItemProps {
  /** Item data */
  readonly item: OutlineItem;
  /** Nesting depth for indentation */
  readonly depth: number;
  /** Callback when item is clicked */
  readonly onClick: (item: OutlineItem) => void;
  /** Callback when collapse toggle is clicked (headings only) */
  readonly onToggleCollapse?: (itemId: string) => void;
  /** Whether children are currently collapsed */
  readonly isCollapsed?: boolean;
}

/**
 * Props for empty state component.
 */
export interface OutlineEmptyStateProps {
  /** Optional custom message */
  readonly message?: string;
}

/**
 * Props for error state component.
 */
export interface OutlineErrorStateProps {
  /** Error message to display */
  readonly error: string;
  /** Whether a previous valid outline is being shown */
  readonly showingStale?: boolean;
}

/**
 * Props for panel header component.
 */
export interface OutlinePanelHeaderProps {
  /** Callback when close button is clicked */
  readonly onClose: () => void;
  /**
   * Whether the outline data may be stale due to parse errors.
   * When true, displays warning indicator in panel header.
   */
  readonly isStale?: boolean;
  /**
   * Error message to display on hover when isStale is true.
   * Default: "Outline may be outdated due to parse error"
   */
  readonly staleMessage?: string;
}

/**
 * Props for frontmatter display component.
 */
export interface FrontmatterSectionProps {
  /** Frontmatter fields to display */
  readonly fields: readonly FrontmatterField[];
  /** Whether "Show all" is expanded */
  readonly isExpanded: boolean;
  /** Callback to toggle expansion */
  readonly onToggleExpand: () => void;
  /** Callback when frontmatter is clicked for navigation */
  readonly onNavigate: () => void;
  /** Additional fields (shown when expanded) */
  readonly additionalFields?: readonly FrontmatterField[];
}

/**
 * Single frontmatter field display.
 */
export interface FrontmatterField {
  /** Field name */
  readonly key: string;
  /** Field value (stringified) */
  readonly value: string;
}

/**
 * Props for component group in outline.
 */
export interface ComponentGroupProps {
  /** Component name */
  readonly name: string;
  /** Whether this is a built-in component */
  readonly isBuiltIn: boolean;
  /** All instances of this component */
  readonly instances: readonly ComponentInstance[];
  /** Whether group is expanded */
  readonly isExpanded: boolean;
  /** Callback to toggle expansion */
  readonly onToggleExpand: () => void;
  /** Callback when instance is clicked */
  readonly onInstanceClick: (instance: ComponentInstance) => void;
}

/**
 * Single component instance.
 */
export interface ComponentInstance {
  /** Line number */
  readonly line: number;
  /** Column number */
  readonly column: number;
  /** Optional context preview */
  readonly context?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * ARIA roles for outline tree structure.
 */
export const ARIA_ROLES = {
  tree: 'tree',
  treeitem: 'treeitem',
  group: 'group',
} as const;

/**
 * Keyboard navigation keys.
 */
export const NAV_KEYS = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  enter: 'Enter',
  space: ' ',
  home: 'Home',
  end: 'End',
} as const;

/**
 * Built-in MDX components recognized for visual distinction.
 */
export const BUILTIN_COMPONENTS = new Set([
  'Callout',
  'Note',
  'Warning',
  'Tip',
  'CodeBlock',
  'Tabs',
  'Tab',
  'Card',
  'Image',
  'Link',
]);

/**
 * Default frontmatter fields shown without expansion.
 */
export const DEFAULT_FRONTMATTER_FIELDS = ['title', 'date', 'author', 'tags'];

/**
 * Maximum label length before truncation.
 */
export const MAX_LABEL_LENGTH = 40;

/**
 * Debounce delay for outline updates (ms).
 * This does NOT affect keystroke latency - only AST extraction scheduling.
 * Keystroke-to-render remains <16ms per Constitution Article V.
 */
export const OUTLINE_UPDATE_DEBOUNCE_MS = 300;

/**
 * Default highlight duration in milliseconds.
 */
export const DEFAULT_HIGHLIGHT_DURATION_MS = 500;

/**
 * CSS class applied to highlighted lines.
 */
export const HIGHLIGHT_LINE_CLASS = 'cm-outline-highlight';

/**
 * Minimum panel width in pixels.
 */
export const MIN_PANEL_WIDTH = 150;

/**
 * Default panel width in pixels.
 */
export const DEFAULT_PANEL_WIDTH = 250;

/**
 * Indentation per nesting level in pixels.
 */
export const INDENT_PER_LEVEL = 16;

/**
 * Window width threshold for auto-hide (with preview visible).
 */
export const AUTO_HIDE_THRESHOLD_WITH_PREVIEW = 600;

/**
 * Window width threshold for auto-hide (preview hidden).
 */
export const AUTO_HIDE_THRESHOLD_NO_PREVIEW = 400;

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector for all sections.
 *
 * @param state - Outline store state
 * @returns All outline sections
 */
export const selectSections = (state: OutlineStore): readonly OutlineSection[] =>
  state.sections;

/**
 * Selector for headings section.
 *
 * @param state - Outline store state
 * @returns Headings section (never undefined due to fixed structure)
 */
export const selectHeadingsSection = (state: OutlineStore): OutlineSection =>
  state.sections.find((s) => s.id === 'headings')!;

/**
 * Selector for components section.
 *
 * @param state - Outline store state
 * @returns Components section (never undefined due to fixed structure)
 */
export const selectComponentsSection = (state: OutlineStore): OutlineSection =>
  state.sections.find((s) => s.id === 'components')!;

/**
 * Selector for frontmatter section.
 *
 * @param state - Outline store state
 * @returns Frontmatter section (never undefined due to fixed structure)
 */
export const selectFrontmatterSection = (state: OutlineStore): OutlineSection =>
  state.sections.find((s) => s.id === 'frontmatter')!;

/**
 * Selector for parsing state.
 *
 * @param state - Outline store state
 * @returns Whether currently parsing
 */
export const selectIsParsing = (state: OutlineStore): boolean =>
  state.isParsing;

/**
 * Selector for parse error.
 *
 * @param state - Outline store state
 * @returns Error message or null
 */
export const selectParseError = (state: OutlineStore): string | null =>
  state.parseError;

/**
 * Selector for last updated timestamp.
 *
 * @param state - Outline store state
 * @returns Unix timestamp in ms
 */
export const selectLastUpdated = (state: OutlineStore): number =>
  state.lastUpdated;

/**
 * Selector for whether outline has any content.
 *
 * @param state - Outline store state
 * @returns True if any section has items
 */
export const selectHasContent = (state: OutlineStore): boolean =>
  state.sections.some((s) => !s.isEmpty);

/**
 * Selector for collapsed item IDs.
 *
 * @param state - Outline store state
 * @returns Set of collapsed item IDs
 */
export const selectCollapsedItemIds = (state: OutlineStore): ReadonlySet<string> =>
  state.collapsedItemIds;

/**
 * Check if a specific item is collapsed.
 *
 * @param itemId - The item ID to check
 * @returns Selector function
 */
export const selectIsItemCollapsed = (itemId: string) => (state: OutlineStore): boolean =>
  state.collapsedItemIds.has(itemId);

// ============================================================================
// Initial State
// ============================================================================

/**
 * Initial state for the outline store.
 */
export const INITIAL_OUTLINE_STATE: OutlineStoreState = {
  sections: [
    { id: 'frontmatter', label: 'Frontmatter', items: [], isCollapsed: false, isEmpty: true },
    { id: 'headings', label: 'Headings', items: [], isCollapsed: false, isEmpty: true },
    { id: 'components', label: 'Components', items: [], isCollapsed: false, isEmpty: true },
  ],
  lastUpdated: 0,
  parseError: null,
  isParsing: false,
  collapsedItemIds: new Set<string>(),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate label text at word boundary.
 *
 * @param text - Text to truncate
 * @returns Truncated text with ellipsis if needed
 */
export function truncateLabel(text: string): string {
  if (text.length <= MAX_LABEL_LENGTH) return text;

  const limit = MAX_LABEL_LENGTH - 3; // Reserve space for "..."
  const lastSpace = text.lastIndexOf(' ', limit);

  // Break at word boundary if within 5 chars of limit
  if (lastSpace > limit - 5) {
    return text.slice(0, lastSpace) + '...';
  }

  return text.slice(0, limit) + '...';
}

/**
 * Generate unique ID for outline items.
 *
 * @param type - Item type
 * @param line - Line number
 * @param column - Column number
 * @param name - Optional name (for components)
 * @returns Unique item ID
 */
export function generateItemId(
  type: OutlineItemType,
  line: number,
  column: number,
  name?: string
): string {
  switch (type) {
    case 'heading':
      return `h-${line}-${column}`;
    case 'component':
      return `c-${name ?? 'unknown'}-${line}`;
    case 'frontmatter':
      return `fm-${name ?? 'root'}`;
    default:
      return `item-${line}-${column}`;
  }
}

// ============================================================================
// Frontmatter Field Extraction
// ============================================================================

/**
 * Result of extracting frontmatter fields.
 */
export interface ExtractedFrontmatterFields {
  /** Priority fields (title, date, author, tags) */
  readonly priorityFields: readonly FrontmatterField[];
  /** Additional fields (sorted alphabetically) */
  readonly additionalFields: readonly FrontmatterField[];
}

/**
 * Format a frontmatter value for display.
 *
 * @param value - The frontmatter value
 * @returns Formatted string representation
 */
function formatFrontmatterDisplayValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length <= 3) return value.join(', ');
    return `${value.slice(0, 3).join(', ')}... (+${value.length - 3})`;
  }
  if (typeof value === 'object' && value !== null) {
    return '{...}';
  }
  if (typeof value === 'string' && value.length > 50) {
    return value.slice(0, 47) + '...';
  }
  if (value === null || value === undefined) {
    return '—';
  }
  return String(value);
}

/**
 * Extract and prioritize frontmatter fields for display.
 *
 * @param data - Raw frontmatter data object
 * @returns Priority fields and additional fields
 */
export function extractFrontmatterFields(
  data: Record<string, unknown>
): ExtractedFrontmatterFields {
  const priorityFields: FrontmatterField[] = [];
  const additionalFields: FrontmatterField[] = [];

  const prioritySet = new Set(DEFAULT_FRONTMATTER_FIELDS);

  for (const key of Object.keys(data)) {
    const field: FrontmatterField = {
      key,
      value: formatFrontmatterDisplayValue(data[key]),
    };

    if (prioritySet.has(key.toLowerCase())) {
      priorityFields.push(field);
    } else {
      additionalFields.push(field);
    }
  }

  // Sort priority fields by DEFAULT_FRONTMATTER_FIELDS order
  priorityFields.sort((a, b) => {
    const aIndex = DEFAULT_FRONTMATTER_FIELDS.indexOf(a.key.toLowerCase());
    const bIndex = DEFAULT_FRONTMATTER_FIELDS.indexOf(b.key.toLowerCase());
    return aIndex - bIndex;
  });

  // Sort additional fields alphabetically
  additionalFields.sort((a, b) => a.key.localeCompare(b.key));

  return { priorityFields, additionalFields };
}

// ============================================================================
// Component Grouping
// ============================================================================

/**
 * Grouped component data for display in outline.
 */
export interface GroupedComponent {
  /** Component name */
  readonly name: string;
  /** Whether this is a built-in component */
  readonly isBuiltIn: boolean;
  /** All instances of this component */
  readonly instances: readonly ComponentInstance[];
}

/**
 * Group component outline items by name.
 *
 * @param componentItems - Array of component outline items
 * @returns Array of grouped components sorted by name
 */
export function groupComponentsByName(
  componentItems: readonly OutlineItem[]
): GroupedComponent[] {
  const groups = new Map<string, ComponentInstance[]>();

  for (const item of componentItems) {
    if (item.type !== 'component') continue;

    const existing = groups.get(item.label);
    const instance: ComponentInstance = {
      line: item.line,
      column: item.column,
    };

    if (existing) {
      existing.push(instance);
    } else {
      groups.set(item.label, [instance]);
    }
  }

  // Convert to array and sort by name
  return Array.from(groups.entries())
    .map(([name, instances]) => ({
      name,
      isBuiltIn: BUILTIN_COMPONENTS.has(name),
      instances,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// Heading Hierarchy
// ============================================================================

/**
 * Build hierarchical heading tree from flat list.
 * H1 is root, H2 is child of H1, H3 is child of H2, etc.
 *
 * @param flatHeadings - Flat array of heading outline items
 * @returns Hierarchical array with nested children
 */
export function buildHeadingHierarchy(
  flatHeadings: readonly OutlineItem[]
): OutlineItem[] {
  if (flatHeadings.length === 0) return [];

  // Result array for top-level items
  const result: OutlineItem[] = [];

  // Stack to track parent context at each level
  // Index 0 = level 1 parent, Index 1 = level 2 parent, etc.
  const parentStack: (OutlineItem & { children: OutlineItem[] })[] = [];

  for (const heading of flatHeadings) {
    // Create mutable copy with writable children array
    const item: OutlineItem & { children: OutlineItem[] } = {
      ...heading,
      children: [],
    };

    const level = heading.level;

    if (level === 0 || level === 1) {
      // H1 or level 0 goes to root
      result.push(item);
      // Reset stack - this H1 is now the context
      parentStack.length = 0;
      parentStack[0] = item;
    } else {
      // Find appropriate parent (one level up)
      const parentLevel = level - 2; // level 2 -> index 0, level 3 -> index 1, etc.

      // Pop stack back to find valid parent
      while (parentStack.length > level - 1) {
        parentStack.pop();
      }

      const parent = parentStack[parentLevel];
      if (parent) {
        // Add as child of parent
        parent.children.push(item);
      } else {
        // No valid parent, add to root
        result.push(item);
      }

      // This item becomes the potential parent for deeper levels
      parentStack[level - 1] = item;
    }
  }

  return result;
}

// Type augmentation for React ref types
import type { RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
