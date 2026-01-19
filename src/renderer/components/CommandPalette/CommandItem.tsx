/**
 * CommandItem component.
 * Renders a single command in the palette list with fuzzy match highlighting.
 *
 * @module renderer/components/CommandPalette/CommandItem
 */

import React, { memo, useMemo } from 'react';
import type { Command, FuzzyMatchResult, HighlightSegment, NormalizedShortcut, ShortcutBinding } from '@shared/types/commands';
import { highlightMatches } from '../../lib/fuzzy-search';
import { formatShortcut } from '../../hooks/useKeyboardShortcuts';

/**
 * Convert a ShortcutBinding to NormalizedShortcut format for display.
 */
function shortcutBindingToNormalized(binding: ShortcutBinding): NormalizedShortcut {
  const parts = [...binding.modifiers, binding.key];
  return parts.join('+') as NormalizedShortcut;
}

// =============================================================================
// TYPES
// =============================================================================

export interface CommandItemProps {
  /** Fuzzy match result containing command and match info */
  readonly result: FuzzyMatchResult<Command>;
  /** Whether this item is currently selected */
  readonly isSelected: boolean;
  /** Unique id for ARIA */
  readonly id: string;
  /** Click handler */
  readonly onClick: () => void;
  /** Mouse enter handler for hover selection */
  readonly onMouseEnter: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders a single command item in the palette.
 * Displays command name with match highlighting, optional shortcut, and selection state.
 */
export const CommandItem = memo(function CommandItem({
  result,
  isSelected,
  id,
  onClick,
  onMouseEnter,
}: CommandItemProps) {
  const { item: command, matches } = result;

  // Highlight matched characters in command name
  const highlightedSegments = useMemo(
    () => highlightMatches(command.name, matches as number[]),
    [command.name, matches]
  );

  // Format shortcut for display (e.g., { key: 's', modifiers: ['Mod'] } -> "⌘S")
  const formattedShortcut = useMemo(() => {
    if (!command.shortcut) return null;
    const normalized = shortcutBindingToNormalized(command.shortcut);
    return formatShortcut(normalized);
  }, [command.shortcut]);

  return (
    <li
      role="option"
      id={id}
      aria-selected={isSelected}
      className={`command-item ${isSelected ? 'command-item--selected' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      data-testid="command-item"
    >
      <div className="command-item__content">
        {/* Icon placeholder */}
        {command.icon && (
          <span className="command-item__icon" aria-hidden="true">
            {command.icon}
          </span>
        )}

        {/* Command name with match highlighting */}
        <span className="command-item__name">
          {highlightedSegments.map((segment: HighlightSegment, i: number) => (
            <span
              key={i}
              className={segment.isMatch ? 'command-item__highlight' : undefined}
            >
              {segment.text}
            </span>
          ))}
        </span>

        {/* Category badge */}
        <span className="command-item__category">{command.category}</span>
      </div>

      {/* Keyboard shortcut */}
      {formattedShortcut && (
        <kbd className="command-item__shortcut">{formattedShortcut}</kbd>
      )}
    </li>
  );
});

// =============================================================================
// STYLES (CSS-in-JS would go here or in separate CSS file)
// =============================================================================

/**
 * CSS classes used by CommandItem:
 *
 * .command-item - Base list item styles
 * .command-item--selected - Selected state (background highlight)
 * .command-item__content - Flex container for icon, name, category
 * .command-item__icon - Icon display area
 * .command-item__name - Command name text
 * .command-item__highlight - Matched character highlight (bold/underline)
 * .command-item__category - Category badge
 * .command-item__shortcut - Keyboard shortcut display (kbd element)
 */
