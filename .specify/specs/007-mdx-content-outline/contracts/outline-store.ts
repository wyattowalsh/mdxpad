/**
 * Outline Store Contract
 *
 * Feature: 007-mdx-content-outline
 * Purpose: Define the Zustand store interface for outline state management
 */

import type { StoreApi } from 'zustand';

// ============================================================================
// Core Types
// ============================================================================

/** Valid heading levels (0 = non-heading) */
export type HeadingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Section identifiers */
export type OutlineSectionId = 'headings' | 'components' | 'frontmatter';

/** Outline item types */
export type OutlineItemType = 'heading' | 'component' | 'frontmatter';

// ============================================================================
// Entities
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

// ============================================================================
// Store State
// ============================================================================

/**
 * Complete outline state.
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
}

// ============================================================================
// Store Actions
// ============================================================================

/**
 * Outline store actions.
 */
export interface OutlineStoreActions {
  /**
   * Update outline from parsed AST data.
   * Called when preview store receives new compilation result.
   */
  readonly updateFromAST: (ast: OutlineAST) => void;

  /**
   * Mark outline as parsing (compilation in progress).
   */
  readonly setIsParsing: (isParsing: boolean) => void;

  /**
   * Set parse error state.
   */
  readonly setParseError: (error: string | null) => void;

  /**
   * Toggle collapse state for a section.
   */
  readonly toggleSectionCollapse: (sectionId: OutlineSectionId) => void;

  /**
   * Toggle collapse state for a heading item (nested collapse).
   */
  readonly toggleItemCollapse: (itemId: string) => void;

  /**
   * Reset outline to initial empty state.
   */
  readonly reset: () => void;
}

// ============================================================================
// Combined Store Type
// ============================================================================

export type OutlineStore = OutlineStoreState & OutlineStoreActions;
export type OutlineStoreApi = StoreApi<OutlineStore>;

// ============================================================================
// AST Input Types (from preview store)
// ============================================================================

/**
 * Lightweight AST data extracted during MDX compilation.
 */
export interface OutlineAST {
  /** All headings in document order */
  readonly headings: readonly HeadingNode[];

  /** All JSX components in document order */
  readonly components: readonly ComponentNode[];

  /** Parsed frontmatter data */
  readonly frontmatter: FrontmatterData | null;
}

export interface HeadingNode {
  /** Heading level 1-6 */
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6;

  /** Heading text content */
  readonly text: string;

  /** Source position */
  readonly position: SourcePosition;
}

export interface ComponentNode {
  /** Component name */
  readonly name: string;

  /** Source position */
  readonly position: SourcePosition;
}

export interface FrontmatterData {
  /** Raw frontmatter object */
  readonly data: Record<string, unknown>;

  /** Line where frontmatter ends */
  readonly endLine: number;
}

export interface SourcePosition {
  /** Line number (1-indexed) */
  readonly line: number;

  /** Column number (1-indexed) */
  readonly column: number;
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector functions for optimized re-renders.
 */
export const selectSections = (state: OutlineStore): readonly OutlineSection[] =>
  state.sections;

export const selectHeadingsSection = (state: OutlineStore): OutlineSection =>
  state.sections.find((s) => s.id === 'headings')!;

export const selectComponentsSection = (state: OutlineStore): OutlineSection =>
  state.sections.find((s) => s.id === 'components')!;

export const selectFrontmatterSection = (state: OutlineStore): OutlineSection =>
  state.sections.find((s) => s.id === 'frontmatter')!;

export const selectIsParsing = (state: OutlineStore): boolean =>
  state.isParsing;

export const selectParseError = (state: OutlineStore): string | null =>
  state.parseError;

export const selectLastUpdated = (state: OutlineStore): number =>
  state.lastUpdated;

export const selectHasContent = (state: OutlineStore): boolean =>
  state.sections.some((s) => !s.isEmpty);

// ============================================================================
// Initial State
// ============================================================================

export const INITIAL_OUTLINE_STATE: OutlineStoreState = {
  sections: [
    { id: 'frontmatter', label: 'Frontmatter', items: [], isCollapsed: false, isEmpty: true },
    { id: 'headings', label: 'Headings', items: [], isCollapsed: false, isEmpty: true },
    { id: 'components', label: 'Components', items: [], isCollapsed: false, isEmpty: true },
  ],
  lastUpdated: 0,
  parseError: null,
  isParsing: false,
};

// ============================================================================
// Constants
// ============================================================================

/** Built-in MDX components recognized for visual distinction */
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

/** Default frontmatter fields shown without expansion */
export const DEFAULT_FRONTMATTER_FIELDS = ['title', 'date', 'author', 'tags'];

/** Maximum label length before truncation */
export const MAX_LABEL_LENGTH = 40;

/** Debounce delay for outline updates (ms) */
export const OUTLINE_UPDATE_DEBOUNCE_MS = 300;
