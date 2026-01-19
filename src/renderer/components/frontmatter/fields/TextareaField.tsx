/**
 * TextareaField Component
 *
 * Multi-line text input field for frontmatter editing.
 *
 * @module renderer/components/frontmatter/fields/TextareaField
 */

import { memo, useCallback } from 'react';
import { Textarea } from '@renderer/components/ui/textarea';
import { FieldLabel } from './FieldLabel';
import type { FieldValue } from '@shared/types/frontmatter';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for TextareaField component.
 */
export interface TextareaFieldProps {
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

  /** Number of visible rows */
  readonly rows?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Multi-line text input field.
 *
 * @param props - Component props
 * @returns JSX element
 */
function TextareaFieldComponent(props: TextareaFieldProps): React.JSX.Element {
  const {
    name,
    value,
    onChange,
    description,
    disabled = false,
    hasError = false,
    errorMessage,
    rows = 3,
  } = props;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
      <Textarea
        id={inputId}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        rows={rows}
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

export const TextareaField = memo(TextareaFieldComponent);
TextareaField.displayName = 'TextareaField';
