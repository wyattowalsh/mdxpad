/**
 * FrontmatterForm Component
 *
 * Renders a form with appropriate field components based on field types.
 * Connects to the frontmatter store for state management.
 *
 * @module renderer/components/frontmatter/FrontmatterForm
 */

import { memo, useCallback, useMemo } from 'react';
import { useFrontmatterStore, selectFields } from '@renderer/stores/frontmatter-store';
import { getFieldComponent, ObjectField } from './fields';
import { AddFieldDropdown } from './AddFieldDropdown';
import { Button } from '@renderer/components/ui/button';
import { Label } from '@renderer/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { X, Lock, Code } from 'lucide-react';
import type { FrontmatterField, FieldValue, FieldType } from '@shared/types/frontmatter';

// =============================================================================
// TYPES
// =============================================================================

export interface FrontmatterFormProps {
  readonly className?: string;
  readonly disabled?: boolean;
  readonly onSwitchToRawMode?: () => void;
  readonly unsupportedFieldNames?: readonly string[];
}

interface RemoveButtonProps {
  readonly fieldName: string;
  readonly disabled: boolean;
  readonly onRemove: () => void;
  readonly className?: string;
}

// =============================================================================
// REMOVE BUTTON
// =============================================================================

const RemoveButton = memo(function RemoveButton(props: RemoveButtonProps): React.JSX.Element {
  const { fieldName, disabled, onRemove, className = 'top-0' } = props;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onRemove}
      disabled={disabled}
      className={`absolute -right-2 ${className} h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background border`}
      aria-label={`Remove ${fieldName} field`}
    >
      <X className="h-3 w-3" />
    </Button>
  );
});

// =============================================================================
// LOCKED FIELD
// =============================================================================

interface LockedFieldProps {
  readonly field: FrontmatterField;
  readonly disabled: boolean;
  readonly onRemove: () => void;
  readonly onSwitchToRawMode?: () => void;
}

const LockedField = memo(function LockedField(props: LockedFieldProps): React.JSX.Element {
  const { field, disabled, onRemove, onSwitchToRawMode } = props;
  const handleClick = useCallback(() => onSwitchToRawMode?.(), [onSwitchToRawMode]);

  return (
    <div className="group relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              className="flex w-full items-center gap-2 rounded-md border border-dashed border-yellow-500/50 bg-yellow-500/5 p-2 text-left hover:bg-yellow-500/10 transition-colors"
            >
              <Lock className="h-3.5 w-3.5 shrink-0 text-yellow-600" />
              <div className="flex-1 min-w-0">
                <Label className="text-sm text-yellow-800 dark:text-yellow-200">{field.name}</Label>
                <p className="truncate text-xs text-muted-foreground">Uses advanced YAML features</p>
              </div>
              <Code className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent><p>Click to edit in raw mode</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <RemoveButton fieldName={field.name} disabled={disabled} onRemove={onRemove} className="-top-2" />
    </div>
  );
});

// =============================================================================
// OBJECT FIELD WRAPPER
// =============================================================================

interface ObjectFieldWrapperProps {
  readonly field: FrontmatterField;
  readonly disabled: boolean;
  readonly onRemove: () => void;
  readonly onChange: (value: FieldValue) => void;
  readonly onSwitchToRawMode?: () => void;
}

const ObjectFieldWrapper = memo(function ObjectFieldWrapper(props: ObjectFieldWrapperProps): React.JSX.Element {
  const { field, disabled, onRemove, onChange, onSwitchToRawMode } = props;
  const fieldProps = {
    name: field.name,
    value: field.value as Record<string, FieldValue>,
    onChange,
    disabled,
    hasError: !field.validation.valid,
    ...(field.validation.errors[0]?.message !== undefined && { errorMessage: field.validation.errors[0].message }),
    ...(field.description !== undefined && { description: field.description }),
    ...(onSwitchToRawMode !== undefined && { onSwitchToRawMode }),
  };

  return (
    <div className="group relative">
      <ObjectField {...fieldProps} />
      <RemoveButton fieldName={field.name} disabled={disabled} onRemove={onRemove} />
    </div>
  );
});

// =============================================================================
// STANDARD FIELD WRAPPER
// =============================================================================

interface StandardFieldWrapperProps {
  readonly field: FrontmatterField;
  readonly disabled: boolean;
  readonly onRemove: () => void;
  readonly onChange: (value: FieldValue) => void;
}

const StandardFieldWrapper = memo(function StandardFieldWrapper(props: StandardFieldWrapperProps): React.JSX.Element {
  const { field, disabled, onRemove, onChange } = props;
  const FieldComponent = getFieldComponent(field.type);
  const hasError = !field.validation.valid;
  const errorMessage = hasError ? field.validation.errors[0]?.message : undefined;

  const fieldProps = {
    name: field.name,
    value: field.value,
    onChange,
    disabled,
    hasError,
    ...(field.description !== undefined && { description: field.description }),
    ...(errorMessage !== undefined && { errorMessage }),
  };

  return (
    <div className="group relative">
      <FieldComponent {...fieldProps} />
      <RemoveButton fieldName={field.name} disabled={disabled} onRemove={onRemove} />
    </div>
  );
});

// =============================================================================
// FIELD RENDERER
// =============================================================================

interface FieldRendererProps {
  readonly field: FrontmatterField;
  readonly onUpdate: (path: string[], value: FieldValue) => void;
  readonly onRemove: (path: readonly string[]) => void;
  readonly disabled: boolean;
  readonly isUnsupported: boolean;
  readonly onSwitchToRawMode?: () => void;
}

const FieldRenderer = memo(function FieldRenderer(props: FieldRendererProps): React.JSX.Element {
  const { field, onUpdate, onRemove, disabled, isUnsupported, onSwitchToRawMode } = props;
  const handleChange = useCallback((value: FieldValue) => onUpdate([...field.path], value), [field.path, onUpdate]);
  const handleRemove = useCallback(() => onRemove(field.path), [field.path, onRemove]);

  if (isUnsupported) {
    const lockedProps = {
      field,
      disabled,
      onRemove: handleRemove,
      ...(onSwitchToRawMode !== undefined && { onSwitchToRawMode }),
    };
    return <LockedField {...lockedProps} />;
  }

  if (field.type === 'object') {
    const objectProps = {
      field,
      disabled,
      onRemove: handleRemove,
      onChange: handleChange,
      ...(onSwitchToRawMode !== undefined && { onSwitchToRawMode }),
    };
    return <ObjectFieldWrapper {...objectProps} />;
  }

  return <StandardFieldWrapper field={field} disabled={disabled} onRemove={handleRemove} onChange={handleChange} />;
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function FrontmatterFormComponent(props: FrontmatterFormProps): React.JSX.Element {
  const { className, disabled = false, onSwitchToRawMode, unsupportedFieldNames = [] } = props;

  const fields = useFrontmatterStore(selectFields);
  const updateField = useFrontmatterStore((s) => s.updateField);
  const addField = useFrontmatterStore((s) => s.addField);
  const removeField = useFrontmatterStore((s) => s.removeField);

  const existingFieldNames = useMemo(() => fields.map((f) => f.name), [fields]);
  const unsupportedFieldSet = useMemo(() => new Set(unsupportedFieldNames), [unsupportedFieldNames]);
  const handleAddField = useCallback((name: string, type: FieldType) => addField(name, type), [addField]);
  const handleRemoveField = useCallback((path: readonly string[]) => removeField([...path]), [removeField]);

  return (
    <div className={className}>
      <div className="space-y-4">
        {fields.map((field) => (
          <FieldRenderer
            key={field.path.join('.')}
            field={field}
            onUpdate={updateField}
            onRemove={handleRemoveField}
            disabled={disabled}
            isUnsupported={unsupportedFieldSet.has(field.name)}
            {...(onSwitchToRawMode !== undefined && { onSwitchToRawMode })}
          />
        ))}
        {fields.length === 0 && <p className="text-sm text-muted-foreground">No frontmatter fields. Add a field below.</p>}
        <AddFieldDropdown existingFields={existingFieldNames} onAddField={handleAddField} disabled={disabled} />
      </div>
    </div>
  );
}

export const FrontmatterForm = memo(FrontmatterFormComponent);
FrontmatterForm.displayName = 'FrontmatterForm';
