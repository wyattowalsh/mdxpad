/**
 * CommandPalette component.
 * Main command palette overlay with search and command execution.
 *
 * @module renderer/components/CommandPalette/CommandPalette
 */

import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import type { UseCommandPaletteReturn } from '../../hooks/useCommandPalette';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { SearchInput } from './SearchInput';
import { CommandList } from './CommandList';
import type { CommandContext } from '@shared/types/commands';

// =============================================================================
// TYPES
// =============================================================================

export interface CommandPaletteProps {
  /** Function to build command context from current app state */
  readonly getContext: () => CommandContext;
  /** Command palette state and actions from useCommandPalette hook */
  readonly palette: UseCommandPaletteReturn;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const LISTBOX_ID = 'command-palette-list';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Command palette overlay component.
 * Provides searchable command list with keyboard navigation.
 *
 * @example
 * ```tsx
 * <CommandPalette
 *   getContext={() => buildCommandContext(editor, api, document, notify)}
 * />
 * ```
 */
export function CommandPalette({ getContext, palette }: CommandPaletteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Destructure command palette state and actions from props
  const {
    isOpen,
    query,
    selectedIndex,
    results,
    isExecuting,
    close,
    setQuery,
    selectPrevious,
    selectNext,
    selectIndex,
    executeSelected,
  } = palette;

  // Focus trap for modal behavior
  useFocusTrap(containerRef, isOpen);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Close on click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );

  // Handle navigation from search input
  const handleNavigate = useCallback(
    (direction: 'up' | 'down') => {
      if (direction === 'up') {
        selectPrevious();
      } else {
        selectNext();
      }
    },
    [selectPrevious, selectNext]
  );

  // Handle item selection (Enter key or click)
  const handleSelect = useCallback(async () => {
    if (results.length === 0) return;

    const ctx = getContext();
    await executeSelected(ctx);
  }, [results.length, getContext, executeSelected]);

  // Handle item click
  const handleItemSelect = useCallback(
    async (index: number) => {
      selectIndex(index);
      const ctx = getContext();
      const selected = results[index];
      if (selected) {
        await executeSelected(ctx);
      }
    },
    [selectIndex, getContext, results, executeSelected]
  );

  // Calculate active descendant ID for ARIA
  const activeDescendantId = useMemo(() => {
    if (results.length === 0) return undefined;
    return `${LISTBOX_ID}-item-${selectedIndex}`;
  }, [results.length, selectedIndex]);

  // Determine if we should show categories (when query is empty)
  const showCategories = query.trim() === '';

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="command-palette-backdrop"
      onClick={handleBackdropClick}
      data-testid="command-palette-backdrop"
    >
      <div
        ref={containerRef}
        className={`command-palette ${isExecuting ? 'command-palette--executing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        data-testid="command-palette"
      >
        {/* Search input */}
        <SearchInput
          ref={inputRef}
          value={query}
          onChange={setQuery}
          onNavigate={handleNavigate}
          onSelect={handleSelect}
          onClose={close}
          listboxId={LISTBOX_ID}
          activeDescendantId={activeDescendantId}
          placeholder="Type a command or search..."
        />

        {/* Command list */}
        <CommandList
          results={results}
          selectedIndex={selectedIndex}
          onSelect={handleItemSelect}
          onHover={selectIndex}
          id={LISTBOX_ID}
          showCategories={showCategories}
        />

        {/* Execution indicator */}
        {isExecuting && (
          <div className="command-palette__loading" aria-live="polite">
            Executing...
          </div>
        )}

        {/* Screen reader announcements */}
        <div className="sr-only" aria-live="polite">
          {results.length > 0
            ? `${results.length} commands available`
            : 'No commands found'}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

/**
 * CSS classes used by CommandPalette:
 *
 * .command-palette-backdrop - Semi-transparent overlay behind palette
 * .command-palette - Main palette container (centered modal)
 * .command-palette--executing - State when command is running
 * .command-palette__loading - Loading indicator
 * .sr-only - Screen reader only (visually hidden)
 */
