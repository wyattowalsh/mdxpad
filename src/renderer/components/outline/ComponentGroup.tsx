/**
 * ComponentGroup Component
 *
 * Renders a group of component instances in the outline.
 * Shows component name, count, built-in/custom badge, and expandable instance list.
 *
 * @module renderer/components/outline/ComponentGroup
 */

import { memo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Layers, Box } from 'lucide-react';
import type { ComponentGroupProps, ComponentInstance } from '@shared/types/outline';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Component group with expandable instance list.
 *
 * @param props - Component props
 * @returns JSX element
 */
function ComponentGroupComponent(props: ComponentGroupProps): React.JSX.Element {
  const { name, isBuiltIn, instances, isExpanded, onToggleExpand, onInstanceClick } = props;

  const instanceCount = instances.length;

  // Handle header click to toggle expansion
  const handleToggleClick = useCallback(() => {
    onToggleExpand();
  }, [onToggleExpand]);

  // Handle keyboard navigation on header
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggleExpand();
      }
    },
    [onToggleExpand]
  );

  // Handle instance click
  const handleInstanceClick = useCallback(
    (instance: ComponentInstance) => {
      onInstanceClick(instance);
    },
    [onInstanceClick]
  );

  // Handle instance keyboard navigation
  const handleInstanceKeyDown = useCallback(
    (e: React.KeyboardEvent, instance: ComponentInstance) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onInstanceClick(instance);
      }
    },
    [onInstanceClick]
  );

  return (
    <div className="mb-1">
      {/* Group header */}
      <div
        role="treeitem"
        aria-expanded={isExpanded}
        tabIndex={0}
        className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted transition-colors rounded-sm text-sm"
        onClick={handleToggleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Collapse toggle */}
        {instanceCount > 1 ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          )
        ) : (
          <span className="w-3" aria-hidden="true" />
        )}

        {/* Component icon */}
        {isBuiltIn ? (
          <Box className="h-4 w-4 flex-shrink-0 text-blue-500" aria-hidden="true" />
        ) : (
          <Layers className="h-4 w-4 flex-shrink-0 text-purple-500" aria-hidden="true" />
        )}

        {/* Component name */}
        <span className="truncate flex-1 font-medium">{name}</span>

        {/* Built-in/Custom badge */}
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${
            isBuiltIn
              ? 'bg-blue-500/10 text-blue-500'
              : 'bg-purple-500/10 text-purple-500'
          }`}
        >
          {isBuiltIn ? 'Built-in' : 'Custom'}
        </span>

        {/* Instance count */}
        {instanceCount > 1 && (
          <span className="text-xs text-muted-foreground">{instanceCount}</span>
        )}
      </div>

      {/* Instance list (when expanded and multiple instances) */}
      {isExpanded && instanceCount > 1 && (
        <div role="group" className="pl-6">
          {instances.map((instance, index) => (
            <div
              key={`${instance.line}-${instance.column}`}
              role="treeitem"
              tabIndex={0}
              className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted transition-colors rounded-sm text-xs text-muted-foreground"
              onClick={() => handleInstanceClick(instance)}
              onKeyDown={(e) => handleInstanceKeyDown(e, instance)}
            >
              <span className="w-3" aria-hidden="true" />
              <span>Line {instance.line}</span>
              {instance.context && (
                <span className="truncate text-muted-foreground/70">
                  {instance.context}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Single instance - clicking header navigates directly */}
      {instanceCount === 1 && (
        <div className="sr-only">
          Single instance at line {instances[0]?.line}
        </div>
      )}
    </div>
  );
}

/**
 * Memoized ComponentGroup component.
 */
export const ComponentGroup = memo(ComponentGroupComponent);
ComponentGroup.displayName = 'ComponentGroup';

export default ComponentGroup;
