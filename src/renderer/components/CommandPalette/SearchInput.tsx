/**
 * SearchInput component.
 * Accessible search input for the command palette.
 *
 * @module renderer/components/CommandPalette/SearchInput
 */

import React, { forwardRef, useCallback, type ChangeEvent, type KeyboardEvent } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface SearchInputProps {
  /** Current search query value */
  readonly value: string;
  /** Called when query changes */
  readonly onChange: (query: string) => void;
  /** Called when up/down arrow pressed */
  readonly onNavigate: (direction: 'up' | 'down') => void;
  /** Called when Enter pressed */
  readonly onSelect: () => void;
  /** Called when Escape pressed */
  readonly onClose: () => void;
  /** ID of the listbox for aria-controls */
  readonly listboxId: string;
  /** ID of the currently selected option for aria-activedescendant */
  readonly activeDescendantId: string | undefined;
  /** Placeholder text */
  readonly placeholder?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Accessible search input with keyboard navigation support.
 * Implements ARIA combobox pattern.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      value,
      onChange,
      onNavigate,
      onSelect,
      onClose,
      listboxId,
      activeDescendantId,
      placeholder = 'Type a command...',
    },
    ref
  ) {
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      },
      [onChange]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            onNavigate('down');
            break;
          case 'ArrowUp':
            e.preventDefault();
            onNavigate('up');
            break;
          case 'Enter':
            e.preventDefault();
            onSelect();
            break;
          case 'Escape':
            e.preventDefault();
            onClose();
            break;
          // Tab navigation is handled by focus trap
        }
      },
      [onNavigate, onSelect, onClose]
    );

    return (
      <div className="search-input" role="combobox" aria-expanded="true" aria-haspopup="listbox" aria-owns={listboxId}>
        <input
          ref={ref}
          type="text"
          className="search-input__field"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          data-testid="command-palette-input"
        />
        <span className="search-input__icon" aria-hidden="true">
          {/* Search icon SVG or placeholder */}
          🔍
        </span>
      </div>
    );
  }
);

// =============================================================================
// STYLES
// =============================================================================

/**
 * CSS classes used by SearchInput:
 *
 * .search-input - Container with combobox role
 * .search-input__field - The actual input element
 * .search-input__icon - Search icon decoration
 */
