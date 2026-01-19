/**
 * DateField Component
 *
 * Date input field for frontmatter editing.
 *
 * @module renderer/components/frontmatter/fields/DateField
 */

import { memo, useCallback } from 'react';
import { Input } from '@renderer/components/ui/input';
import { FieldLabel } from './FieldLabel';
import type { FieldValue } from '@shared/types/frontmatter';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for DateField component.
 */
export interface DateFieldProps {
  /** Field name (key in YAML) */
  readonly name: string;

  /** Current field value (ISO date string YYYY-MM-DD) */
  readonly value: string;

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
 * Date input field.
 *
 * @param props - Component props
 * @returns JSX element
 */
function DateFieldComponent(props: DateFieldProps): React.JSX.Element {
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
      onChange(e.target.value);
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
        type="date"
        value={value}
        onChange={handleChange}
        disabled={disabled}
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

export const DateField = memo(DateFieldComponent);
DateField.displayName = 'DateField';
