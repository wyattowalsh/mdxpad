/**
 * Filter Types
 *
 * Type definitions for the Smart Filtering feature.
 * Provides core types for filter queries, match results,
 * and file tree node visibility during filtering.
 *
 * Feature: 014-smart-filtering
 * @module renderer/lib/fuzzy-match/types
 */

// =============================================================================
// FILTER QUERY TYPES
// =============================================================================

/**
 * Filter query state.
 *
 * Represents the current filter input value and its active state.
 * The `isActive` property is computed from `value` and indicates
 * whether the filter is currently being applied to the file tree.
 *
 * @example
 * ```ts
 * const query: FilterQuery = {
 *   value: 'component',
 *   isActive: true,
 * };
 * ```
 */
export interface FilterQuery {
  /** The raw filter text entered by the user */
  readonly value: string;
  /** Whether the filter is actively being applied (non-empty value) */
  readonly isActive: boolean;
}

/**
 * Initial filter query state.
 *
 * Used to initialize the filter store and reset filter state.
 * Represents an empty, inactive filter.
 */
export const INITIAL_FILTER_QUERY: FilterQuery = {
  value: '',
  isActive: false,
} as const;

// =============================================================================
// MATCH RESULT TYPES
// =============================================================================

/**
 * Match positions from fzf library.
 *
 * A ReadonlySet of character indices (0-based) that matched the query.
 * These positions are used to highlight matched characters in the UI.
 *
 * @example
 * ```ts
 * // For query "cmp" matching "MyComponent":
 * // Positions would be: {2, 3, 4} for "Com" or similar
 * const positions: MatchPositions = new Set([2, 3, 4]);
 * ```
 */
export type MatchPositions = ReadonlySet<number>;

/**
 * Result of matching a single file/folder against the filter query.
 *
 * Contains all information needed to render a matched item, including
 * the match score for sorting and positions for highlight rendering.
 *
 * @example
 * ```ts
 * const result: MatchResult = {
 *   nodeId: '/project/src/components/Button.tsx',
 *   score: 42,
 *   positions: new Set([0, 1, 6]),
 *   isDirectMatch: true,
 * };
 * ```
 */
export interface MatchResult {
  /** Unique identifier for the file tree node (path-based) */
  readonly nodeId: string;
  /** The match score from fzf (higher = better match) */
  readonly score: number;
  /** Character positions that matched the query (0-based indices) */
  readonly positions: MatchPositions;
  /**
   * Whether this is a direct match (vs ancestor of a match).
   * Direct matches receive highlight rendering; ancestors do not.
   */
  readonly isDirectMatch: boolean;
}

/**
 * Map of node IDs to their match results.
 *
 * Only contains entries for nodes that matched directly or are
 * ancestors of matching nodes. Nodes not in this map should be
 * hidden when filtering is active.
 *
 * @example
 * ```ts
 * const results: MatchResultMap = new Map([
 *   ['/project/src/Button.tsx', { nodeId: '...', score: 42, positions: new Set([0]), isDirectMatch: true }],
 *   ['/project/src', { nodeId: '...', score: 0, positions: new Set(), isDirectMatch: false }],
 * ]);
 * ```
 */
export type MatchResultMap = ReadonlyMap<string, MatchResult>;

// =============================================================================
// VISIBILITY TYPES
// =============================================================================

/**
 * Visibility state for a file tree node under filtering.
 *
 * Determines how a node should be rendered when a filter is active:
 * - `'visible'`: Node matches directly or filter is inactive - render normally with highlights
 * - `'hidden'`: Node does not match and has no matching descendants - do not render
 * - `'ancestor-only'`: Node is visible only because it contains matching descendants -
 *   render without highlights (dimmed/muted style)
 *
 * @example
 * ```ts
 * function getNodeOpacity(visibility: FilterVisibility): number {
 *   switch (visibility) {
 *     case 'visible': return 1.0;
 *     case 'ancestor-only': return 0.6;
 *     case 'hidden': return 0;
 *   }
 * }
 * ```
 */
export type FilterVisibility = 'visible' | 'hidden' | 'ancestor-only';

// =============================================================================
// FILE TREE NODE TYPES
// =============================================================================

/**
 * Node type discriminant for file tree nodes.
 *
 * Used to distinguish between files and folders in the file tree,
 * affecting icon rendering, expandability, and filtering behavior.
 */
export type FileTreeNodeType = 'file' | 'folder';

/**
 * File tree node representing a file or folder.
 *
 * This is the base structure for file tree nodes before filter
 * metadata is applied. Nodes form a tree structure via parentId
 * and childIds references.
 *
 * @example
 * ```ts
 * const node: FileTreeNode = {
 *   id: '/project/src/components',
 *   name: 'components',
 *   type: 'folder',
 *   path: '/project/src/components',
 *   parentId: '/project/src',
 *   childIds: ['/project/src/components/Button.tsx'],
 *   depth: 2,
 * };
 * ```
 */
export interface FileTreeNode {
  /** Unique identifier (normalized absolute path) */
  readonly id: string;
  /** Display name (filename or folder name) */
  readonly name: string;
  /** Node type discriminant */
  readonly type: FileTreeNodeType;
  /** Full path to file/folder */
  readonly path: string;
  /** Parent node ID (null for root-level nodes) */
  readonly parentId: string | null;
  /** Child node IDs (empty array for files) */
  readonly childIds: readonly string[];
  /** Depth level in tree (0 for root-level children) */
  readonly depth: number;
}

/**
 * Enhanced file tree node with filter metadata.
 *
 * Extends FileTreeNode with visibility state, match results, and
 * auto-expand hints. Used during rendering to determine how to
 * display nodes when filtering is active.
 *
 * @example
 * ```ts
 * const filteredNode: FilteredFileTreeNode = {
 *   ...baseNode,
 *   visibility: 'visible',
 *   matchResult: {
 *     nodeId: baseNode.id,
 *     score: 42,
 *     positions: new Set([0, 1, 2]),
 *     isDirectMatch: true,
 *   },
 *   shouldAutoExpand: false,
 * };
 * ```
 */
export interface FilteredFileTreeNode extends FileTreeNode {
  /** Visibility state under current filter */
  readonly visibility: FilterVisibility;
  /** Match result if this node matched directly, null otherwise */
  readonly matchResult: MatchResult | null;
  /** Whether this folder should be auto-expanded due to filter matches */
  readonly shouldAutoExpand: boolean;
}
