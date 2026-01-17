/**
 * FrontmatterSection Component
 *
 * Renders the frontmatter section of the outline with priority fields
 * (title, date, author, tags) and expandable "Show all" for additional fields.
 *
 * @module renderer/components/outline/FrontmatterSection
 */

import { memo, useCallback } from 'react';
import { ChevronRight, ChevronDown, FileCode } from 'lucide-react';
import type { FrontmatterSectionProps, FrontmatterField } from '@shared/types/outline';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Single frontmatter field display.
 *
 * @param props - Field props
 * @returns JSX element
 */
function FieldRow({
  field,
  onClick,
}: {
  readonly field: FrontmatterField;
  readonly onClick: () => void;
}): React.JSX.Element {
  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <div
      role="treeitem"
      tabIndex={0}
      className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted transition-colors rounded-sm text-sm"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="w-4" aria-hidden="true" />
      <span className="text-muted-foreground font-medium truncate flex-shrink-0 max-w-[80px]">
        {field.key}:
      </span>
      <span className="truncate flex-1 text-foreground">{field.value}</span>
    </div>
  );
}

/**
 * Frontmatter section with priority fields and expansion.
 *
 * @param props - Component props
 * @returns JSX element
 */
function FrontmatterSectionComponent(props: FrontmatterSectionProps): React.JSX.Element {
  const {
    fields,
    isExpanded,
    onToggleExpand,
    onNavigate,
    additionalFields,
  } = props;

  const hasAdditionalFields = additionalFields && additionalFields.length > 0;

  // Handle keyboard navigation on expand toggle
  const handleExpandKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggleExpand();
      }
    },
    [onToggleExpand]
  );

  return (
    <div role="group" className="space-y-0.5">
      {/* Header row that navigates to frontmatter */}
      <div
        role="treeitem"
        tabIndex={0}
        className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted transition-colors rounded-sm text-sm"
        onClick={onNavigate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate();
          }
        }}
      >
        <FileCode className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">Document Metadata</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {fields.length + (additionalFields?.length ?? 0)} fields
        </span>
      </div>

      {/* Priority fields (always visible) */}
      {fields.map((field) => (
        <FieldRow key={field.key} field={field} onClick={onNavigate} />
      ))}

      {/* Additional fields (when expanded) */}
      {isExpanded && additionalFields && additionalFields.map((field) => (
        <FieldRow key={field.key} field={field} onClick={onNavigate} />
      ))}

      {/* Show all/less toggle */}
      {hasAdditionalFields && (
        <div
          role="button"
          tabIndex={0}
          className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted transition-colors rounded-sm text-xs text-muted-foreground"
          onClick={onToggleExpand}
          onKeyDown={handleExpandKeyDown}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          )}
          <span>
            {isExpanded
              ? 'Show less'
              : `Show ${additionalFields.length} more field${additionalFields.length === 1 ? '' : 's'}`}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Memoized FrontmatterSection component.
 */
export const FrontmatterSection = memo(FrontmatterSectionComponent);
FrontmatterSection.displayName = 'FrontmatterSection';

export default FrontmatterSection;
