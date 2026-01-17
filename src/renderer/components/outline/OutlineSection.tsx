/**
 * OutlineSection Component
 *
 * Renders a collapsible section of the outline (Headings, Components, or Frontmatter).
 * Contains a header with collapse toggle and a list of items.
 * For Components section, groups items by component name using ComponentGroup.
 *
 * @module renderer/components/outline/OutlineSection
 */

import { memo, useCallback, useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { OutlineItem } from './OutlineItem';
import { ComponentGroup } from './ComponentGroup';
import { FrontmatterSection } from './FrontmatterSection';
import type {
  OutlineSection as OutlineSectionType,
  OutlineSectionId,
  OutlineItem as OutlineItemType,
  ComponentInstance,
  FrontmatterField,
} from '@shared/types/outline';
import { groupComponentsByName, DEFAULT_FRONTMATTER_FIELDS, buildHeadingHierarchy } from '@shared/types/outline';
import { useOutlineStore, selectCollapsedItemIds } from '@renderer/stores/outline-store';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for OutlineSection component.
 */
export interface OutlineSectionProps {
  /** Section data */
  readonly section: OutlineSectionType;

  /** Callback when section header collapse toggle is clicked */
  readonly onToggleCollapse: (sectionId: OutlineSectionId) => void;

  /** Callback when an item is clicked for navigation */
  readonly onItemClick: (item: OutlineItemType) => void;

  /** Callback when a nested heading collapse toggle is clicked */
  readonly onItemToggleCollapse?: (itemId: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Collapsible outline section.
 *
 * @param props - Component props
 * @returns JSX element
 */
function OutlineSectionComponent(props: OutlineSectionProps): React.JSX.Element | null {
  const { section, onToggleCollapse, onItemClick, onItemToggleCollapse } = props;

  // Track expanded component groups (by component name)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Track frontmatter expansion (show all fields)
  const [frontmatterExpanded, setFrontmatterExpanded] = useState(false);

  // Get collapsed item IDs from store
  const collapsedItemIds = useOutlineStore(selectCollapsedItemIds);

  // Build hierarchical heading tree
  const hierarchicalHeadings = useMemo(() => {
    if (section.id !== 'headings') return null;
    return buildHeadingHierarchy(section.items);
  }, [section.id, section.items]);

  // Don't render empty sections
  if (section.isEmpty) {
    return null;
  }

  // Group components by name for the components section
  const groupedComponents = useMemo(() => {
    if (section.id !== 'components') return null;
    return groupComponentsByName(section.items);
  }, [section.id, section.items]);

  // Parse frontmatter items into fields with priority separation
  const frontmatterFields = useMemo(() => {
    if (section.id !== 'frontmatter') return null;

    const priorityFields: FrontmatterField[] = [];
    const additionalFields: FrontmatterField[] = [];
    const prioritySet = new Set(DEFAULT_FRONTMATTER_FIELDS);

    for (const item of section.items) {
      // Parse "key: value" format from label
      const colonIndex = item.label.indexOf(':');
      if (colonIndex === -1) continue;

      const key = item.label.slice(0, colonIndex).trim();
      const value = item.label.slice(colonIndex + 1).trim();
      const field: FrontmatterField = { key, value };

      if (prioritySet.has(key.toLowerCase())) {
        priorityFields.push(field);
      } else {
        additionalFields.push(field);
      }
    }

    // Sort priority fields by DEFAULT_FRONTMATTER_FIELDS order
    priorityFields.sort((a, b) => {
      const aIndex = DEFAULT_FRONTMATTER_FIELDS.indexOf(a.key.toLowerCase());
      const bIndex = DEFAULT_FRONTMATTER_FIELDS.indexOf(b.key.toLowerCase());
      return aIndex - bIndex;
    });

    // Sort additional fields alphabetically
    additionalFields.sort((a, b) => a.key.localeCompare(b.key));

    return { priorityFields, additionalFields };
  }, [section.id, section.items]);

  // Handle section collapse toggle
  const handleToggleClick = useCallback(() => {
    onToggleCollapse(section.id);
  }, [onToggleCollapse, section.id]);

  // Handle keyboard interaction on header
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggleCollapse(section.id);
      }
    },
    [onToggleCollapse, section.id]
  );

  // Handle component group toggle
  const handleGroupToggle = useCallback((groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }, []);

  // Handle component instance click - navigate to location
  const handleInstanceClick = useCallback(
    (instance: ComponentInstance) => {
      // Create a minimal OutlineItem-like object for navigation
      const item: OutlineItemType = {
        id: `c-instance-${instance.line}`,
        type: 'component',
        label: '',
        level: 0,
        line: instance.line,
        column: instance.column,
        children: [],
      };
      onItemClick(item);
    },
    [onItemClick]
  );

  // Handle frontmatter expansion toggle
  const handleFrontmatterToggle = useCallback(() => {
    setFrontmatterExpanded((prev) => !prev);
  }, []);

  // Handle frontmatter navigation (always go to line 1)
  const handleFrontmatterNavigate = useCallback(() => {
    const item: OutlineItemType = {
      id: 'fm-navigate',
      type: 'frontmatter',
      label: 'Frontmatter',
      level: 0,
      line: 1,
      column: 1,
      children: [],
    };
    onItemClick(item);
  }, [onItemClick]);

  // Compute item count for display
  const itemCount = section.id === 'components' && groupedComponents
    ? groupedComponents.length
    : section.id === 'frontmatter' && frontmatterFields
    ? frontmatterFields.priorityFields.length + frontmatterFields.additionalFields.length
    : section.items.length;

  return (
    <div className="mb-2">
      {/* Section header */}
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-muted transition-colors rounded-sm"
        onClick={handleToggleClick}
        onKeyDown={handleKeyDown}
        aria-expanded={!section.isCollapsed}
      >
        {/* Collapse indicator */}
        {section.isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}

        {/* Section label */}
        <span className="text-sm font-medium">{section.label}</span>

        {/* Item count */}
        <span className="text-xs text-muted-foreground ml-auto">
          {itemCount}
        </span>
      </div>

      {/* Section items */}
      {!section.isCollapsed && (
        <div role="tree" aria-label={`${section.label} tree`}>
          {/* Frontmatter section uses FrontmatterSection display */}
          {section.id === 'frontmatter' && frontmatterFields ? (
            frontmatterFields.additionalFields.length > 0 ? (
              <FrontmatterSection
                fields={frontmatterFields.priorityFields}
                additionalFields={frontmatterFields.additionalFields}
                isExpanded={frontmatterExpanded}
                onToggleExpand={handleFrontmatterToggle}
                onNavigate={handleFrontmatterNavigate}
              />
            ) : (
              <FrontmatterSection
                fields={frontmatterFields.priorityFields}
                isExpanded={frontmatterExpanded}
                onToggleExpand={handleFrontmatterToggle}
                onNavigate={handleFrontmatterNavigate}
              />
            )
          ) : /* Components section uses grouped display */
          section.id === 'components' && groupedComponents ? (
            groupedComponents.map((group) => (
              <ComponentGroup
                key={group.name}
                name={group.name}
                isBuiltIn={group.isBuiltIn}
                instances={group.instances}
                isExpanded={expandedGroups.has(group.name)}
                onToggleExpand={() => handleGroupToggle(group.name)}
                onInstanceClick={handleInstanceClick}
              />
            ))
          ) : /* Headings use hierarchical display */
          section.id === 'headings' && hierarchicalHeadings ? (
            hierarchicalHeadings.map((item) => {
              // Build props carefully for exactOptionalPropertyTypes
              const hasChildren = item.children.length > 0;
              const isCollapsed = collapsedItemIds.has(item.id);

              const itemProps: import('./OutlineItem').OutlineItemProps =
                onItemToggleCollapse !== undefined && hasChildren
                  ? {
                      item,
                      depth: 0,
                      onClick: onItemClick,
                      onToggleCollapse: onItemToggleCollapse,
                      isCollapsed,
                      collapsedItemIds,
                    }
                  : {
                      item,
                      depth: 0,
                      onClick: onItemClick,
                      isCollapsed: false,
                    };
              return <OutlineItem key={item.id} {...itemProps} />;
            })
          ) : (
            /* Fallback for other section types */
            section.items.map((item) => (
              <OutlineItem
                key={item.id}
                item={item}
                depth={0}
                onClick={onItemClick}
                isCollapsed={false}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Memoized OutlineSection component.
 */
export const OutlineSection = memo(OutlineSectionComponent);
OutlineSection.displayName = 'OutlineSection';

export default OutlineSection;
