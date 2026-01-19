/**
 * ArrayField Component
 *
 * Tag input field for array values in frontmatter editing.
 * Displays items as removable tags with an input for adding new items.
 *
 * @module renderer/components/frontmatter/fields/ArrayField
 */

import { memo, useCallback, useState, useRef } from 'react';
import { X } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { FieldLabel } from './FieldLabel';
import type { FieldValue } from '@shared/types/frontmatter';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for ArrayField component.
 */
export interface ArrayFieldProps {
  /** Field name (key in YAML) */
  readonly name: string;

  /** Current field value (array of strings) */
  readonly value: string[];

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

  /** Placeholder text for the input */
  readonly placeholder?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Tag input field for array values.
 *
 * @param props - Component props
 * @returns JSX element
 */
function ArrayFieldComponent(props: ArrayFieldProps): React.JSX.Element {
  const {
    name,
    value,
    onChange,
    description,
    disabled = false,
    hasError = false,
    errorMessage,
    placeholder = 'Type and press Enter',
  } = props;

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    },
    []
  );

  const addItem = useCallback(
    (item: string) => {
      const trimmed = item.trim();
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
      setInputValue('');
    },
    [value, onChange]
  );

  const removeItem = useCallback(
    (index: number) => {
      const newValue = [...value];
      newValue.splice(index, 1);
      onChange(newValue);
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addItem(inputValue);
      } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
        e.preventDefault();
        removeItem(value.length - 1);
      }
    },
    [inputValue, value.length, addItem, removeItem]
  );

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const inputId = `field-${name}`;

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={inputId} description={description} hasError={hasError}>
        {name}
      </FieldLabel>
      <div
        onClick={handleContainerClick}
        className={`flex min-h-9 w-full flex-wrap gap-1.5 rounded-md border bg-transparent px-2 py-1.5 ${
          hasError ? 'border-destructive' : 'border-input'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-text'}`}
      >
        {value.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm"
          >
            {item}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(index);
                }}
                className="rounded-full hover:bg-muted-foreground/20"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <Input
          ref={inputRef}
          id={inputId}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : ''}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}-error` : undefined}
          className="h-6 flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>
      {hasError && errorMessage && (
        <p id={`${inputId}-error`} className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export const ArrayField = memo(ArrayFieldComponent);
ArrayField.displayName = 'ArrayField';
