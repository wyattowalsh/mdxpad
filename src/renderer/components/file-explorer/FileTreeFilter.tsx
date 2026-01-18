/**
 * FileTreeFilter Component
 *
 * Filter input component for the file tree explorer.
 * Provides fuzzy search functionality with debounced input.
 *
 * Features:
 * - Text input with placeholder "Filter files..."
 * - 50ms debounced onChange per FR-010
 * - Clear button (X icon) when query non-empty
 * - Escape key handling (clear first, then blur)
 * - Integration with file explorer store
 *
 * @module renderer/components/file-explorer/FileTreeFilter
 * Feature: 014-smart-filtering
 */

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { X, Search } from 'lucide-react';

import {
  useFileExplorerStore,
  selectFilterQuery,
  selectIsFiltering,
  selectMatchCount,
  selectIsFilterActive,
  MAX_FILTER_QUERY_LENGTH,
  FILTER_EMPTY_STATE_MESSAGE,
} from '@renderer/stores/file-explorer-store';
import { cn } from '@shared/lib/utils';

// =============================================================================
// FILTER EVENT HELPERS
// =============================================================================

/**
 * Custom event names for filter actions.
 * Used for decoupled communication between command handlers and UI components.
 */
const FILTER_EVENTS = {
  focus: 'mdxpad:filter:focus',
  clear: 'mdxpad:filter:clear',
} as const;

/**
 * Add event listener for filter focus event.
 * Returns cleanup function for easy use in useEffect.
 */
function onFilterFocus(handler: () => void): () => void {
  window.addEventListener(FILTER_EVENTS.focus, handler);
  return () => window.removeEventListener(FILTER_EVENTS.focus, handler);
}

/**
 * Add event listener for filter clear event.
 * Returns cleanup function for easy use in useEffect.
 */
function onFilterClear(handler: () => void): () => void {
  window.addEventListener(FILTER_EVENTS.clear, handler);
  return () => window.removeEventListener(FILTER_EVENTS.clear, handler);
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for FileTreeFilter component.
 */
export interface FileTreeFilterProps {
  /**
   * Optional CSS class name for the filter container.
   */
  readonly className?: string;

  /**
   * Optional callback when filter is focused via keyboard shortcut.
   */
  readonly onFocus?: () => void;

  /**
   * Optional callback when filter input is blurred.
   */
  readonly onBlur?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Filter input for the file tree explorer.
 *
 * Provides a search input that filters the file tree using fzf-style
 * fuzzy matching. The filter query is debounced and managed through
 * the file explorer store.
 *
 * @param props - Component props
 * @returns JSX element
 *
 * @example
 * ```tsx
 * <FileTreeFilter className="mb-2" />
 * ```
 */
function FileTreeFilterComponent(props: FileTreeFilterProps): React.JSX.Element {
  const { className, onFocus, onBlur } = props;

  // Store state
  const query = useFileExplorerStore(selectFilterQuery);
  const isFiltering = useFileExplorerStore(selectIsFiltering);
  const isFilterActive = useFileExplorerStore(selectIsFilterActive);
  const matchCount = useFileExplorerStore(selectMatchCount);

  // Store actions
  const setFilterQuery = useFileExplorerStore((s) => s.setFilterQuery);
  const clearFilter = useFileExplorerStore((s) => s.clearFilter);

  // Input ref for programmatic focus
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle input change - truncation handled by store
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Truncate at MAX_FILTER_QUERY_LENGTH (256 chars)
      const truncatedValue = value.slice(0, MAX_FILTER_QUERY_LENGTH);
      setFilterQuery(truncatedValue);
    },
    [setFilterQuery]
  );

  // Handle clear button click
  const handleClear = useCallback(() => {
    clearFilter();
    inputRef.current?.focus();
  }, [clearFilter]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();

        // First Escape: clear query if non-empty
        // Second Escape: blur input
        if (query.trim().length > 0) {
          clearFilter();
        } else {
          inputRef.current?.blur();
        }
      }
    },
    [query, clearFilter]
  );

  // Handle input focus
  const handleFocus = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  // Handle input blur
  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // Listen for filter focus events (from Mod+P shortcut)
  useEffect(() => {
    return onFilterFocus(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  // Listen for filter clear events
  useEffect(() => {
    return onFilterClear(() => {
      clearFilter();
    });
  }, [clearFilter]);

  // Determine status text
  const statusText = isFiltering
    ? 'Filtering...'
    : isFilterActive
      ? matchCount === 0
        ? FILTER_EMPTY_STATE_MESSAGE
        : `${matchCount} match${matchCount === 1 ? '' : 'es'}`
      : null;

  return (
    <div className={cn('relative flex flex-col gap-1', className)}>
      {/* Filter input container */}
      <div className="relative flex items-center">
        {/* Search icon */}
        <Search
          className="absolute left-2 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Filter files..."
          aria-label="Filter file tree"
          aria-describedby={statusText ? 'filter-status' : undefined}
          className={cn(
            'flex h-8 w-full rounded-md border border-input bg-transparent',
            'pl-8 pr-8 py-1 text-sm shadow-sm transition-colors',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          maxLength={MAX_FILTER_QUERY_LENGTH}
        />

        {/* Clear button - shown when query is non-empty */}
        {query.length > 0 && !isFiltering && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              'absolute right-1 p-1 rounded-sm',
              'hover:bg-muted transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            )}
            aria-label="Clear filter"
          >
            <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>
        )}

        {/* Loading indicator */}
        {isFiltering && (
          <span
            className="absolute right-1 p-1"
            aria-hidden="true"
          >
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </span>
        )}
      </div>

      {/* Status text */}
      {statusText && (
        <span
          id="filter-status"
          className="text-xs text-muted-foreground px-1"
          aria-live="polite"
          aria-atomic="true"
        >
          {statusText}
        </span>
      )}
    </div>
  );
}

/**
 * Memoized FileTreeFilter component.
 */
export const FileTreeFilter = memo(FileTreeFilterComponent);
FileTreeFilter.displayName = 'FileTreeFilter';

export default FileTreeFilter;
