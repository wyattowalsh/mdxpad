/**
 * OutlineEmptyState Component
 *
 * Displays a friendly message when no outline content is available.
 * Shows guidance for users on how to populate the outline.
 *
 * @module renderer/components/outline/OutlineEmptyState
 */

import { memo } from 'react';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_EMPTY_MESSAGE =
  'No outline available. Add headings, components, or frontmatter to see the document structure.';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for OutlineEmptyState component.
 */
export interface OutlineEmptyStateProps {
  /** Optional custom message */
  readonly message?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Empty state component for outline panel.
 *
 * Displays when the document has no headings, components, or frontmatter.
 *
 * @param props - Component props
 * @returns JSX element
 */
function OutlineEmptyStateComponent(props: OutlineEmptyStateProps): React.JSX.Element {
  const { message = DEFAULT_EMPTY_MESSAGE } = props;

  return (
    <div
      className="flex flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <p>{message}</p>
    </div>
  );
}

/**
 * Memoized OutlineEmptyState component.
 */
export const OutlineEmptyState = memo(OutlineEmptyStateComponent);
OutlineEmptyState.displayName = 'OutlineEmptyState';

export default OutlineEmptyState;
