/**
 * CommandList component.
 * Renders the list of command items in the palette.
 *
 * @module renderer/components/CommandPalette/CommandList
 */

import React, { memo, useCallback, useRef, useEffect } from 'react';
import type { Command, FuzzyMatchResult, CommandCategory } from '@shared/types/commands';
import { CommandItem } from './CommandItem';

// =============================================================================
// TYPES
// =============================================================================

export interface CommandListProps {
  /** Filtered and scored command results */
  readonly results: readonly FuzzyMatchResult<Command>[];
  /** Currently selected index */
  readonly selectedIndex: number;
  /** Called when an item is selected via click */
  readonly onSelect: (index: number) => void;
  /** Called when an item is hovered */
  readonly onHover: (index: number) => void;
  /** Unique ID for ARIA */
  readonly id: string;
  /** Whether to show category headers (when query is empty) */
  readonly showCategories?: boolean;
}

// =============================================================================
// CATEGORY ORDER
// =============================================================================

/** Display order for command categories */
const CATEGORY_ORDER: CommandCategory[] = ['file', 'edit', 'format', 'view', 'help'];

/** Human-readable category labels */
const CATEGORY_LABELS: Record<CommandCategory, string> = {
  file: 'File',
  edit: 'Edit',
  format: 'Format',
  view: 'View',
  help: 'Help',
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders a scrollable list of command items.
 * Supports optional category grouping when not searching.
 */
export const CommandList = memo(function CommandList({
  results,
  selectedIndex,
  onSelect,
  onHover,
  id,
  showCategories = false,
}: CommandListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;

    const selectedElement = listRef.current.querySelector(
      `[aria-selected="true"]`
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleItemClick = useCallback(
    (index: number) => () => {
      onSelect(index);
    },
    [onSelect]
  );

  const handleItemHover = useCallback(
    (index: number) => () => {
      onHover(index);
    },
    [onHover]
  );

  // Group results by category if showing categories
  const renderContent = useCallback(() => {
    if (results.length === 0) {
      return (
        <li className="command-list__empty" role="option" aria-disabled="true">
          No commands found
        </li>
      );
    }

    if (!showCategories) {
      // Flat list when searching
      return results.map((result, index) => (
        <CommandItem
          key={result.item.id}
          result={result}
          isSelected={index === selectedIndex}
          id={`${id}-item-${index}`}
          onClick={handleItemClick(index)}
          onMouseEnter={handleItemHover(index)}
        />
      ));
    }

    // Grouped by category
    const grouped = new Map<CommandCategory, { result: FuzzyMatchResult<Command>; index: number }[]>();

    results.forEach((result, index) => {
      const category = result.item.category;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push({ result, index });
    });

    const elements: React.ReactNode[] = [];

    for (const category of CATEGORY_ORDER) {
      const items = grouped.get(category);
      if (!items || items.length === 0) continue;

      // Category header
      elements.push(
        <li
          key={`header-${category}`}
          className="command-list__header"
          role="presentation"
          aria-hidden="true"
        >
          {CATEGORY_LABELS[category]}
        </li>
      );

      // Category items
      for (const { result, index } of items) {
        elements.push(
          <CommandItem
            key={result.item.id}
            result={result}
            isSelected={index === selectedIndex}
            id={`${id}-item-${index}`}
            onClick={handleItemClick(index)}
            onMouseEnter={handleItemHover(index)}
          />
        );
      }
    }

    return elements;
  }, [results, selectedIndex, showCategories, id, handleItemClick, handleItemHover]);

  return (
    <ul
      ref={listRef}
      role="listbox"
      id={id}
      className="command-list"
      aria-label="Commands"
      data-testid="command-list"
    >
      {renderContent()}
    </ul>
  );
});

// =============================================================================
// STYLES
// =============================================================================

/**
 * CSS classes used by CommandList:
 *
 * .command-list - The ul container (scrollable)
 * .command-list__header - Category header (presentation only)
 * .command-list__empty - Empty state message
 */
