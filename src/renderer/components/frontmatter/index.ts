/**
 * Frontmatter Components
 *
 * Public exports for frontmatter editing components.
 *
 * @module renderer/components/frontmatter
 */

// Main components
export { FrontmatterPanel, type FrontmatterPanelProps } from './FrontmatterPanel';
export { FrontmatterForm, type FrontmatterFormProps } from './FrontmatterForm';
export { AddFieldDropdown, type AddFieldDropdownProps } from './AddFieldDropdown';
export {
  ValidationIndicator,
  ValidationBadge,
  ValidationSummary,
  type ValidationIndicatorProps,
  type ValidationBadgeProps,
  type ValidationSummaryProps,
} from './ValidationIndicator';

// Field components
export {
  TextField,
  TextareaField,
  NumberField,
  BooleanField,
  DateField,
  ArrayField,
  getFieldComponent,
  FIELD_COMPONENTS,
  type BaseFieldProps,
  type FieldProps,
  type TextFieldProps,
  type TextareaFieldProps,
  type NumberFieldProps,
  type BooleanFieldProps,
  type DateFieldProps,
  type ArrayFieldProps,
} from './fields';
