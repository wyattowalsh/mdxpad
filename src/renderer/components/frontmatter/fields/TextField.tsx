/**
 * TextField Component
 *
 * Single-line text input field for frontmatter editing.
 *
 * @module renderer/components/frontmatter/fields/TextField
 */

import { memo, useCallback } from 'react';
import { Input } from '@renderer/components/ui/input';
import { FieldLabel } from './FieldLabel';
import type { FieldValue } from '@shared/types/frontmatter';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for TextField component.
 */
export interface TextFieldProps {
  /** Field name (key in YAML) */
  readonly name: string;

  /** Current field value */
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
 * Single-line text input field.
 *
 * @param props - Component props
 * @returns JSX element
 */
function TextFieldComponent(props: TextFieldProps): React.JSX.Element {
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
        type="text"
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

export const TextField = memo(TextFieldComponent);
TextField.displayName = 'TextField';
