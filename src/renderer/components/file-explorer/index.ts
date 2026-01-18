/**
 * File Explorer Components
 *
 * Barrel export for file explorer components including
 * the filter input and match highlighting.
 *
 * @module renderer/components/file-explorer
 * Feature: 014-smart-filtering
 */

export { FileTreeFilter, type FileTreeFilterProps } from './FileTreeFilter';
export {
  FilterHighlight,
  type FilterHighlightProps,
  type TextSegment,
  positionsToSegments,
} from './FilterHighlight';
