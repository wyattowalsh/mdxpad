/**
 * Tree Filtering Utilities
 *
 * Provides utility functions for computing file tree node visibility
 * and auto-expand behavior based on filter match results.
 *
 * These utilities are used by the file explorer component to determine
 * which nodes to display and how to display them during filtering.
 *
 * Feature: 014-smart-filtering
 * @module renderer/lib/file-tree/filter-utils
 */

import type {
  FileTreeNode,
  FilterVisibility,
  MatchResultMap,
} from '../fuzzy-match/types';

// =============================================================================
// VISIBILITY COMPUTATION
// =============================================================================

/**
 * Compute visibility for a file tree node based on match results.
 *
 * Determines how a node should be rendered when filtering is active:
 * - If no filter is active, all nodes are visible
 * - Direct matches are fully visible with highlighting
 * - Ancestor nodes (in map but not direct match) are visible but without highlighting
 * - Nodes not in the match map are hidden
 *
 * @param node - The file tree node to compute visibility for
 * @param matchResults - Map of node IDs to their match results
 * @param isFilterActive - Whether a filter is currently active
 * @returns The visibility state for the node
 *
 * @example
 * ```ts
 * const matchResults = new Map([
 *   ['/project/src/Button.tsx', { nodeId: '...', isDirectMatch: true, ... }],
 *   ['/project/src', { nodeId: '...', isDirectMatch: false, ... }],
 * ]);
 *
 * // Direct match - fully visible
 * computeNodeVisibility(buttonNode, matchResults, true); // 'visible'
 *
 * // Ancestor of match - visible but without highlighting
 * computeNodeVisibility(srcFolderNode, matchResults, true); // 'ancestor-only'
 *
 * // No match - hidden
 * computeNodeVisibility(unrelatedNode, matchResults, true); // 'hidden'
 *
 * // No filter active - all visible
 * computeNodeVisibility(anyNode, matchResults, false); // 'visible'
 * ```
 */
export function computeNodeVisibility(
  node: FileTreeNode,
  matchResults: MatchResultMap,
  isFilterActive: boolean
): FilterVisibility {
  // No filter active = all nodes are visible
  if (!isFilterActive) {
    return 'visible';
  }

  const matchResult = matchResults.get(node.id);

  // Direct match - fully visible with highlighting
  if (matchResult?.isDirectMatch) {
    return 'visible';
  }

  // Ancestor of a match (has entry but not direct match) - visible without highlighting
  if (matchResult !== undefined && !matchResult.isDirectMatch) {
    return 'ancestor-only';
  }

  // No match - hidden from view
  return 'hidden';
}

// =============================================================================
// AUTO-EXPAND LOGIC
// =============================================================================

/**
 * Determine if a folder should auto-expand due to filter matches.
 *
 * Folders auto-expand when they are ancestors of matching nodes,
 * ensuring that matched files deep in the tree are visible without
 * requiring manual expansion.
 *
 * Only applies to folder nodes - files always return false.
 *
 * @param node - The folder node to check for auto-expand
 * @param matchResults - Map of node IDs to their match results
 * @returns Whether the folder should auto-expand (true if ancestor of a match)
 *
 * @example
 * ```ts
 * const matchResults = new Map([
 *   ['/project/src/Button.tsx', { nodeId: '...', isDirectMatch: true, ... }],
 *   ['/project/src', { nodeId: '...', isDirectMatch: false, ... }],
 *   ['/project', { nodeId: '...', isDirectMatch: false, ... }],
 * ]);
 *
 * // Folder is ancestor of match - should expand
 * shouldAutoExpand(srcFolderNode, matchResults); // true
 * shouldAutoExpand(projectFolderNode, matchResults); // true
 *
 * // Folder has direct match (is itself matched) - no auto-expand needed
 * // (would be visible anyway, expansion is user preference)
 * const directMatchFolder = { id: '/matched-folder', type: 'folder', ... };
 * const resultsWithDirectMatch = new Map([
 *   ['/matched-folder', { nodeId: '...', isDirectMatch: true, ... }],
 * ]);
 * shouldAutoExpand(directMatchFolder, resultsWithDirectMatch); // false
 *
 * // File nodes never auto-expand
 * shouldAutoExpand(fileNode, matchResults); // false
 *
 * // Folder not in match results - no expand
 * shouldAutoExpand(unrelatedFolder, matchResults); // false
 * ```
 */
export function shouldAutoExpand(
  node: FileTreeNode,
  matchResults: MatchResultMap
): boolean {
  // Only folders can be expanded
  if (node.type !== 'folder') {
    return false;
  }

  const matchResult = matchResults.get(node.id);

  // Expand if this folder is an ancestor of a match (in map but not direct match)
  return matchResult !== undefined && !matchResult.isDirectMatch;
}
