/**
 * Frontmatter Field Components
 *
 * Field type registry and component exports for frontmatter editing.
 *
 * @module renderer/components/frontmatter/fields
 */

import type { ComponentType } from 'react';
import type { FieldType, FieldValue } from '@shared/types/frontmatter';
import { TextField, type TextFieldProps } from './TextField';
import { TextareaField, type TextareaFieldProps } from './TextareaField';
import { NumberField, type NumberFieldProps } from './NumberField';
import { BooleanField, type BooleanFieldProps } from './BooleanField';
import { DateField, type DateFieldProps } from './DateField';
import { ArrayField, type ArrayFieldProps } from './ArrayField';
import { ObjectField, type ObjectFieldProps } from './ObjectField';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Base props shared by all field components.
 */
export interface BaseFieldProps {
  /** Field name (key in YAML) */
  readonly name: string;

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

/**
 * Props for a field component with typed value.
 */
export type FieldProps<T = FieldValue> = BaseFieldProps & {
  /** Current field value */
  readonly value: T;
};

// =============================================================================
// FIELD REGISTRY
// =============================================================================

/**
 * Registry mapping field types to their components.
 */
export const FIELD_COMPONENTS: Record<
  FieldType,
  ComponentType<FieldProps<unknown>>
> = {
  text: TextField as ComponentType<FieldProps<unknown>>,
  textarea: TextareaField as ComponentType<FieldProps<unknown>>,
  number: NumberField as ComponentType<FieldProps<unknown>>,
  boolean: BooleanField as ComponentType<FieldProps<unknown>>,
  date: DateField as ComponentType<FieldProps<unknown>>,
  array: ArrayField as ComponentType<FieldProps<unknown>>,
  object: ObjectField as ComponentType<FieldProps<unknown>>,
};

/**
 * Gets the appropriate field component for a field type.
 *
 * @param type - Field type
 * @returns Field component for the given type
 */
export function getFieldComponent(
  type: FieldType
): ComponentType<FieldProps<unknown>> {
  return FIELD_COMPONENTS[type];
}

// =============================================================================
// EXPORTS
// =============================================================================

export { TextField, type TextFieldProps };
export { TextareaField, type TextareaFieldProps };
export { NumberField, type NumberFieldProps };
export { BooleanField, type BooleanFieldProps };
export { DateField, type DateFieldProps };
export { ArrayField, type ArrayFieldProps };
export { ObjectField, type ObjectFieldProps };
export { FieldLabel, type FieldLabelProps } from './FieldLabel';
