/**
 * OutlineItem Component
 *
 * Renders a single item in the outline tree with indentation,
 * icons, and click-to-navigate functionality.
 *
 * @module renderer/components/outline/OutlineItem
 */

import { memo, useCallback } from 'react';
import { ChevronRight, ChevronDown, FileText, Layers, Settings } from 'lucide-react';
import type { OutlineItem as OutlineItemType } from '@shared/types/outline';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Indentation per nesting level in pixels */
const INDENT_PER_LEVEL = 16;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for OutlineItem component.
 */
export interface OutlineItemProps {
  /** Item data */
  readonly item: OutlineItemType;

  /** Nesting depth for indentation */
  readonly depth: number;

  /** Callback when item is clicked */
  readonly onClick: (item: OutlineItemType) => void;

  /** Callback when collapse toggle is clicked (headings only) */
  readonly onToggleCollapse?: (itemId: string) => void;

  /** Whether children are currently collapsed */
  readonly isCollapsed?: boolean;

  /** Set of collapsed item IDs for nested items */
  readonly collapsedItemIds?: ReadonlySet<string>;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get icon for outline item type.
 */
function getItemIcon(type: OutlineItemType['type']): React.ReactNode {
  switch (type) {
    case 'heading':
      return <FileText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />;
    case 'component':
      return <Layers className="h-4 w-4 flex-shrink-0" aria-hidden="true" />;
    case 'frontmatter':
      return <Settings className="h-4 w-4 flex-shrink-0" aria-hidden="true" />;
    default:
      return <FileText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Single outline item with click-to-navigate.
 *
 * @param props - Component props
 * @returns JSX element
 */
function OutlineItemComponent(props: OutlineItemProps): React.JSX.Element {
  const { item, depth, onClick, onToggleCollapse, isCollapsed = false, collapsedItemIds } = props;

  const hasChildren = item.children.length > 0;
  const indentStyle = { paddingLeft: `${depth * INDENT_PER_LEVEL}px` };

  // Handle item click - navigate to position
  const handleClick = useCallback(() => {
    onClick(item);
  }, [onClick, item]);

  // Handle collapse toggle click
  const handleToggleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleCollapse?.(item.id);
    },
    [onToggleCollapse, item.id]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(item);
      }
    },
    [onClick, item]
  );

  return (
    <>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        aria-level={depth + 1}
        tabIndex={0}
        className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted transition-colors rounded-sm text-sm"
        style={indentStyle}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        title={item.label}
      >
        {/* Collapse toggle for items with children */}
        {hasChildren && onToggleCollapse ? (
          <button
            type="button"
            className="p-0.5 -ml-1 hover:bg-muted-foreground/20 rounded"
            onClick={handleToggleClick}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
        ) : (
          // Spacer for alignment when no collapse toggle
          <span className="w-4" aria-hidden="true" />
        )}

        {/* Item icon */}
        {getItemIcon(item.type)}

        {/* Item label */}
        <span className="truncate flex-1">{item.label}</span>

        {/* Heading level indicator */}
        {item.type === 'heading' && item.level > 0 && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            H{item.level}
          </span>
        )}
      </div>

      {/* Render children if not collapsed */}
      {hasChildren && !isCollapsed && (
        <div role="group">
          {item.children.map((child) => {
            const childHasChildren = child.children.length > 0;
            const childIsCollapsed = collapsedItemIds?.has(child.id) ?? false;

            // Build props carefully for exactOptionalPropertyTypes
            const childProps: OutlineItemProps =
              onToggleCollapse !== undefined && childHasChildren
                ? collapsedItemIds !== undefined
                  ? {
                      item: child,
                      depth: depth + 1,
                      onClick,
                      onToggleCollapse,
                      isCollapsed: childIsCollapsed,
                      collapsedItemIds,
                    }
                  : {
                      item: child,
                      depth: depth + 1,
                      onClick,
                      onToggleCollapse,
                      isCollapsed: childIsCollapsed,
                    }
                : {
                    item: child,
                    depth: depth + 1,
                    onClick,
                    isCollapsed: false,
                  };
            return <OutlineItem key={child.id} {...childProps} />;
          })}
        </div>
      )}
    </>
  );
}

/**
 * Memoized OutlineItem component.
 */
export const OutlineItem = memo(OutlineItemComponent);
OutlineItem.displayName = 'OutlineItem';

export default OutlineItem;
