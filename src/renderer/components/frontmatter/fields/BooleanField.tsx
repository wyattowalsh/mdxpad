/**
 * BooleanField Component
 *
 * Checkbox field for boolean frontmatter values.
 *
 * @module renderer/components/frontmatter/fields/BooleanField
 */

import { memo, useCallback } from 'react';
import { FieldLabel } from './FieldLabel';
import type { FieldValue } from '@shared/types/frontmatter';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for BooleanField component.
 */
export interface BooleanFieldProps {
  /** Field name (key in YAML) */
  readonly name: string;

  /** Current field value */
  readonly value: boolean;

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
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Checkbox field for boolean values.
 *
 * @param props - Component props
 * @returns JSX element
 */
function BooleanFieldComponent(props: BooleanFieldProps): React.JSX.Element {
  const {
    name,
    value,
    onChange,
    description,
    disabled = false,
    hasError = false,
    errorMessage,
  } = props;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.checked);
    },
    [onChange]
  );

  const inputId = `field-${name}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={inputId}
          checked={value}
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}-error` : undefined}
          className="h-4 w-4 rounded border-input bg-transparent accent-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <FieldLabel htmlFor={inputId} description={description} hasError={hasError}>
          {name}
        </FieldLabel>
      </div>
      {hasError && errorMessage && (
        <p id={`${inputId}-error`} className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export const BooleanField = memo(BooleanFieldComponent);
BooleanField.displayName = 'BooleanField';
