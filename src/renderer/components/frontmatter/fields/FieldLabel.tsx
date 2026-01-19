/**
 * FieldLabel Component
 *
 * Label component with optional tooltip for field descriptions.
 * Uses shadcn/ui Tooltip component when description is provided.
 *
 * @module renderer/components/frontmatter/fields/FieldLabel
 */

import { memo } from 'react';
import { Label } from '@renderer/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@renderer/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for FieldLabel component.
 */
export interface FieldLabelProps {
  /** Label text (typically field name) */
  readonly children: React.ReactNode;

  /** HTML for attribute to associate with input */
  readonly htmlFor: string;

  /** Optional field description for tooltip */
  readonly description?: string | undefined;

  /** Whether to display in error state */
  readonly hasError?: boolean | undefined;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Label with optional tooltip for schema descriptions.
 * When a description is provided, displays a help icon that shows
 * the description on hover.
 *
 * @param props - Component props
 * @returns JSX element
 */
function FieldLabelComponent(props: FieldLabelProps): React.JSX.Element {
  const { children, htmlFor, description, hasError = false } = props;

  const label = (
    <Label
      htmlFor={htmlFor}
      className={hasError ? 'text-destructive' : undefined}
    >
      {children}
    </Label>
  );

  // If no description, return plain label
  if (!description) {
    return label;
  }

  // With description, wrap in tooltip
  return (
    <div className="flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={`Help: ${description}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">{description}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export const FieldLabel = memo(FieldLabelComponent);
FieldLabel.displayName = 'FieldLabel';
