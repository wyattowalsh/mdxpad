/**
 * Tag Badge Component
 *
 * Colored pill badge showing a tag name with optional close button.
 *
 * @module renderer/components/tags/TagBadge
 */

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@shared/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface TagBadgeProps {
  readonly name: string;
  readonly color: string;
  readonly onClick?: () => void;
  readonly onRemove?: () => void;
  readonly className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * A colored pill badge displaying a tag name.
 * Optionally includes a close button for removal and click handler for filtering.
 */
function useActivationHandler(handler?: () => void) {
  return React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler?.();
      }
    },
    [handler]
  );
}

const RemoveButton: React.FC<{
  readonly name: string;
  readonly onRemove: () => void;
}> = ({ name, onRemove }) => {
  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove();
    },
    [onRemove]
  );
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      }
    },
    [onRemove]
  );

  return (
    <button
      type="button"
      className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-current"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Remove tag ${name}`}
    >
      <X className="h-3 w-3" />
    </button>
  );
};
RemoveButton.displayName = 'RemoveButton';

export const TagBadge: React.FC<TagBadgeProps> = ({
  name,
  color,
  onClick,
  onRemove,
  className,
}) => {
  const handleKeyDown = useActivationHandler(onClick);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
        onClick ? 'cursor-pointer hover:opacity-80' : '',
        className
      )}
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
    >
      {name}
      {onRemove ? <RemoveButton name={name} onRemove={onRemove} /> : null}
    </span>
  );
};

TagBadge.displayName = 'TagBadge';
