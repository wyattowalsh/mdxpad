/**
 * TemplateCard Component
 *
 * Displays a template in a card format for the template browser.
 * Shows metadata including name, description, category, and built-in status.
 *
 * @module renderer/components/template-browser/TemplateCard
 */

import { memo, useCallback } from 'react';
import { Package, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@ui/button';
import type { TemplateMetadata, TemplateCategory } from '@shared/contracts/template-schemas';
import { cn } from '@shared/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the TemplateCard component.
 */
export interface TemplateCardProps {
  /** Template metadata to display */
  readonly template: TemplateMetadata;

  /** Whether this card is currently selected */
  readonly isSelected: boolean;

  /** Callback when the card is selected */
  readonly onSelect: (id: string) => void;

  /** Callback when edit is requested (only for custom templates) */
  readonly onEdit?: (id: string) => void;

  /** Callback when delete is requested (only for custom templates) */
  readonly onDelete?: (id: string) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Category badge color mappings.
 * Colors follow the specification:
 * - blog: blue
 * - documentation: green
 * - presentation: purple
 * - notes: yellow/amber
 * - tutorial: orange
 * - custom: gray
 */
const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  blog: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  documentation: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  presentation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  notes: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  tutorial: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  custom: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

/**
 * Maximum description length before truncation.
 */
const MAX_DESCRIPTION_LENGTH = 120;

/**
 * Maximum number of tags to display.
 */
const MAX_VISIBLE_TAGS = 3;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Truncates text to a maximum length with ellipsis.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

/**
 * Formats a category name for display.
 *
 * @param category - Category enum value
 * @returns Formatted display name
 */
function formatCategoryName(category: TemplateCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Category badge component.
 */
interface CategoryBadgeProps {
  readonly category: TemplateCategory;
}

function CategoryBadge({ category }: CategoryBadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full',
        CATEGORY_COLORS[category]
      )}
    >
      {formatCategoryName(category)}
    </span>
  );
}

/**
 * Built-in indicator badge.
 */
function BuiltInBadge(): React.JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary"
      title="Built-in template"
    >
      <Package className="h-3 w-3" aria-hidden="true" />
      Built-in
    </span>
  );
}

/**
 * Tag display component.
 */
interface TagListProps {
  readonly tags: readonly string[];
}

function TagList({ tags }: TagListProps): React.JSX.Element | null {
  if (tags.length === 0) {
    return null;
  }

  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const remainingCount = tags.length - MAX_VISIBLE_TAGS;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground"
        >
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Template card displaying metadata in the template browser.
 *
 * Features:
 * - Displays template name, description, category, and built-in status
 * - Truncates long descriptions
 * - Shows tags when space allows
 * - Visual distinction for selected state
 * - Fully accessible with keyboard navigation
 * - Edit/delete actions for custom templates (FR-012, FR-013, FR-014)
 *
 * @param props - Component props
 * @returns JSX element
 */
function TemplateCardComponent({
  template,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: TemplateCardProps): React.JSX.Element {
  // Handle card selection
  const handleClick = useCallback(() => {
    onSelect(template.id);
  }, [onSelect, template.id]);

  // Handle keyboard interaction
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(template.id);
      }
    },
    [onSelect, template.id]
  );

  // Handle edit click (prevent card selection)
  const handleEditClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onEdit?.(template.id);
    },
    [onEdit, template.id]
  );

  // Handle delete click (prevent card selection)
  const handleDeleteClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onDelete?.(template.id);
    },
    [onDelete, template.id]
  );

  // Show actions only for custom templates
  const showActions = !template.isBuiltIn && (onEdit !== undefined || onDelete !== undefined);

  const truncatedDescription = truncateText(template.description, MAX_DESCRIPTION_LENGTH);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      className={cn(
        // Base styles
        'group relative flex flex-col p-4 rounded-lg border cursor-pointer transition-all duration-150',
        // Default state
        'bg-card text-card-foreground',
        'border-border hover:border-primary/50',
        'hover:shadow-md',
        // Focus styles
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        // Selected state
        isSelected && [
          'border-primary',
          'bg-primary/5',
          'ring-2 ring-primary ring-offset-1',
          'shadow-md',
        ]
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid="template-card"
      data-template-id={template.id}
    >
      {/* Header with badges and actions */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={template.category} />
          {template.isBuiltIn && <BuiltInBadge />}
        </div>

        {/* Action buttons - only for custom templates */}
        {showActions && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleEditClick}
                title="Edit template metadata"
                aria-label={`Edit ${template.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDeleteClick}
                title="Delete template"
                aria-label={`Delete ${template.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Template name */}
      <h3 className="text-base font-semibold text-foreground mb-1 line-clamp-1">{template.name}</h3>

      {/* Description */}
      <p
        className="text-sm text-muted-foreground flex-grow"
        title={template.description.length > MAX_DESCRIPTION_LENGTH ? template.description : undefined}
      >
        {truncatedDescription}
      </p>

      {/* Tags */}
      {template.tags && template.tags.length > 0 && <TagList tags={template.tags} />}

      {/* Author attribution (if available) */}
      {template.author && (
        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
          By {template.author}
        </p>
      )}
    </div>
  );
}

/**
 * Memoized TemplateCard component for performance optimization.
 */
export const TemplateCard = memo(TemplateCardComponent);
TemplateCard.displayName = 'TemplateCard';

export default TemplateCard;
