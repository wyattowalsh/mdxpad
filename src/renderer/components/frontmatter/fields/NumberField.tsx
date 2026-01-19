/**
 * NumberField Component
 *
 * Numeric input field for frontmatter editing.
 *
 * @module renderer/components/frontmatter/fields/NumberField
 */

import { memo, useCallback } from 'react';
import { Input } from '@renderer/components/ui/input';
import { FieldLabel } from './FieldLabel';
import type { FieldValue } from '@shared/types/frontmatter';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for NumberField component.
 */
export interface NumberFieldProps {
  /** Field name (key in YAML) */
  readonly name: string;

  /** Current field value */
  readonly value: number;

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

  /** Minimum value */
  readonly min?: number;

  /** Maximum value */
  readonly max?: number;

  /** Step increment */
  readonly step?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Numeric input field.
 *
 * @param props - Component props
 * @returns JSX element
 */
function NumberFieldComponent(props: NumberFieldProps): React.JSX.Element {
  const {
    name,
    value,
    onChange,
    description,
    disabled = false,
    hasError = false,
    errorMessage,
    min,
    max,
    step,
  } = props;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const numValue = e.target.valueAsNumber;
      onChange(Number.isNaN(numValue) ? 0 : numValue);
    },
    [onChange]
  );

  const inputId = `field-${name}`;

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={inputId} description={description} hasError={hasError}>
        {name}
      </FieldLabel>
      <Input
        id={inputId}
        type="number"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${inputId}-error` : undefined}
        className={hasError ? 'border-destructive' : undefined}
      />
      {hasError && errorMessage && (
        <p id={`${inputId}-error`} className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export const NumberField = memo(NumberFieldComponent);
NumberField.displayName = 'NumberField';
