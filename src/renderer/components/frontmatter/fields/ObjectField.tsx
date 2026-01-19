/**
 * ObjectField Component
 *
 * Collapsible section for nested object fields in frontmatter editing.
 * Recursively renders nested fields with a depth limit of 2 levels.
 * For deeper nesting, shows "Edit in raw mode" button.
 *
 * @module renderer/components/frontmatter/fields/ObjectField
 */

import { memo, useCallback, useState } from 'react';
import { ChevronRight, ChevronDown, Code } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Label } from '@renderer/components/ui/label';
import type { FieldValue, FieldType } from '@shared/types/frontmatter';
import { inferFieldType } from '@renderer/lib/frontmatter';
import { getFieldComponent } from './index';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum visual nesting depth for object fields */
const MAX_NESTING_DEPTH = 2;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for ObjectField component.
 */
export interface ObjectFieldProps {
  /** Field name (key in YAML) */
  readonly name: string;

  /** Current field value (nested object) */
  readonly value: Record<string, FieldValue>;

  /** Callback when value changes */
  readonly onChange: (value: FieldValue) => void;

  /** Optional field description for tooltip */
  readonly description?: string;

  /** Whether field is disabled */
  readonly disabled?: boolean;

  /** Whether field has validation errors */
  readonly hasError?: boolean;

  /** Error message to display */
  readonly errorMessage?: string;

  /** Current nesting depth (internal use) */
  readonly depth?: number;

  /** Callback to switch to raw mode (for deep nesting) */
  readonly onSwitchToRawMode?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Collapsible object field for nested frontmatter values.
 *
 * @param props - Component props
 * @returns JSX element
 */
function ObjectFieldComponent(props: ObjectFieldProps): React.JSX.Element {
  const {
    name,
    value,
    onChange,
    description,
    disabled = false,
    hasError = false,
    errorMessage,
    depth = 0,
    onSwitchToRawMode,
  } = props;

  const [isExpanded, setIsExpanded] = useState(depth === 0);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleNestedChange = useCallback(
    (key: string) => (newValue: FieldValue) => {
      const updatedValue = { ...value, [key]: newValue };
      onChange(updatedValue);
    },
    [value, onChange]
  );

  // Check if we've exceeded the nesting depth limit
  const exceedsDepthLimit = depth >= MAX_NESTING_DEPTH;

  // If exceeds depth, show "Edit in raw mode" message
  if (exceedsDepthLimit) {
    return (
      <div className="space-y-1.5">
        <Label
          className={hasError ? 'text-destructive' : undefined}
          title={description}
        >
          {name}
        </Label>
        <div className="rounded border border-dashed border-muted-foreground/50 p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Nested object is too deep for visual editing.
          </p>
          {onSwitchToRawMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchToRawMode}
              className="h-7 gap-1 text-xs"
            >
              <Code className="h-3 w-3" />
              Edit in raw mode
            </Button>
          )}
        </div>
        {hasError && errorMessage && (
          <p className="text-xs text-destructive">{errorMessage}</p>
        )}
      </div>
    );
  }

  const entries = Object.entries(value);

  return (
    <div className="space-y-1.5">
      {/* Header with collapse toggle */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`flex w-full items-center gap-1.5 text-left ${
          hasError ? 'text-destructive' : ''
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-foreground/80'}`}
        aria-expanded={isExpanded}
        title={description}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <Label
          className={`cursor-pointer ${hasError ? 'text-destructive' : ''}`}
        >
          {name}
        </Label>
        <span className="text-xs text-muted-foreground">
          ({entries.length} {entries.length === 1 ? 'field' : 'fields'})
        </span>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div
          className={`space-y-3 border-l-2 border-muted pl-3 ${
            depth > 0 ? 'ml-1' : 'ml-0.5'
          }`}
        >
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Empty object</p>
          ) : (
            entries.map(([key, fieldValue]) => (
              <NestedFieldRenderer
                key={key}
                name={key}
                value={fieldValue}
                onChange={handleNestedChange(key)}
                disabled={disabled}
                depth={depth + 1}
                {...(onSwitchToRawMode !== undefined && { onSwitchToRawMode })}
              />
            ))
          )}
        </div>
      )}

      {hasError && errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}

// =============================================================================
// NESTED FIELD RENDERER
// =============================================================================

/**
 * Props for NestedFieldRenderer.
 */
interface NestedFieldRendererProps {
  /** Field name */
  readonly name: string;

  /** Field value */
  readonly value: FieldValue;

  /** Change handler */
  readonly onChange: (value: FieldValue) => void;

  /** Whether disabled */
  readonly disabled: boolean;

  /** Current depth */
  readonly depth: number;

  /** Raw mode callback */
  readonly onSwitchToRawMode?: () => void;
}

/**
 * Renders a nested field with appropriate component based on inferred type.
 */
const NestedFieldRenderer = memo(function NestedFieldRenderer(
  props: NestedFieldRendererProps
): React.JSX.Element {
  const { name, value, onChange, disabled, depth, onSwitchToRawMode } = props;

  const fieldType: FieldType = inferFieldType(value);

  // For nested objects, use ObjectField recursively
  if (fieldType === 'object') {
    return (
      <ObjectField
        name={name}
        value={value as Record<string, FieldValue>}
        onChange={onChange}
        disabled={disabled}
        depth={depth}
        {...(onSwitchToRawMode !== undefined && { onSwitchToRawMode })}
      />
    );
  }

  // Get appropriate field component for other types
  const FieldComponent = getFieldComponent(fieldType);

  return <FieldComponent name={name} value={value} onChange={onChange} disabled={disabled} />;
});

export const ObjectField = memo(ObjectFieldComponent);
ObjectField.displayName = 'ObjectField';
