/**
 * Outline Panel Component Contract
 *
 * Feature: 007-mdx-content-outline
 * Purpose: Define props and interfaces for outline UI components
 */

import type { OutlineItem, OutlineSection, OutlineSectionId } from './outline-store';

// ============================================================================
// Panel Props
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

// ============================================================================
// Empty State Props
// ============================================================================

/**
 * Props for empty state component.
 */
export interface OutlineEmptyStateProps {
  /** Optional custom message */
  readonly message?: string;
}

/**
 * Default empty state message.
 */
export const DEFAULT_EMPTY_MESSAGE =
  'No outline available. Add headings, components, or frontmatter to see the document structure.';

// ============================================================================
// Error State Props
// ============================================================================

/**
 * Props for error state component.
 */
export interface OutlineErrorStateProps {
  /** Error message to display */
  readonly error: string;

  /** Whether a previous valid outline is being shown */
  readonly showingStale?: boolean;
}

// ============================================================================
// Header Props
// ============================================================================

/**
 * Props for panel header component.
 */
export interface OutlinePanelHeaderProps {
  /** Callback when close button is clicked */
  readonly onClose: () => void;
}

// ============================================================================
// Frontmatter Section Props
// ============================================================================

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

// ============================================================================
// Component Section Props
// ============================================================================

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
// Accessibility
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

// ============================================================================
// Layout Constants
// ============================================================================

/** Minimum panel width in pixels */
export const MIN_PANEL_WIDTH = 150;

/** Default panel width in pixels */
export const DEFAULT_PANEL_WIDTH = 250;

/** Indentation per nesting level in pixels */
export const INDENT_PER_LEVEL = 16;

/** Window width threshold for auto-hide (with preview visible) */
export const AUTO_HIDE_THRESHOLD_WITH_PREVIEW = 600;

/** Window width threshold for auto-hide (preview hidden) */
export const AUTO_HIDE_THRESHOLD_NO_PREVIEW = 400;
