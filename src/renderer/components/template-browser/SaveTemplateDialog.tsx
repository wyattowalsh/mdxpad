/**
 * Save Template Dialog Component
 *
 * Modal dialog for saving the current document as a reusable template.
 * Includes form fields for metadata and variable definitions.
 *
 * Feature: 016-template-library
 * Phase: 4 - US3 (Create Custom Template)
 *
 * T017: Form fields for name, description, category, tags
 * T018: Variable definition UI for declaring template variables
 *
 * FR-009: Save as template from current document
 * FR-010: Duplicate name detection
 *
 * @module renderer/components/template-browser/SaveTemplateDialog
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, ChevronDown, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@ui/dialog';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Textarea } from '@ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { cn } from '@shared/lib/utils';
import type { TemplateCategory, TemplateVariable } from '@shared/contracts/template-schemas';
import { extractVariables } from '@renderer/lib/template-variables';

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the SaveTemplateDialog component.
 */
export interface SaveTemplateDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed without saving */
  onClose: () => void;
  /** Callback when template is saved */
  onSave: (data: SaveTemplateFormData) => void;
  /** Current document content to save as template */
  content: string;
  /** Whether a save operation is in progress */
  isSaving?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Existing template names for duplicate detection */
  existingNames?: string[];
}

/**
 * Form data for saving a template.
 */
export interface SaveTemplateFormData {
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  variables: TemplateVariable[];
  content: string;
}

/**
 * Form validation errors.
 */
interface FormErrors {
  name?: string;
  description?: string;
  category?: string;
  variables?: Record<number, { name?: string }>;
}

/**
 * Helper to clear a specific error field.
 */
function clearErrorField<K extends keyof FormErrors>(
  errors: FormErrors,
  field: K
): FormErrors {
  const { [field]: _, ...rest } = errors;
  return rest;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Display names for template categories
 */
const CATEGORY_DISPLAY_NAMES: Record<TemplateCategory, string> = {
  blog: 'Blog Posts',
  documentation: 'Documentation',
  presentation: 'Presentations',
  notes: 'Meeting Notes',
  tutorial: 'Tutorials',
  custom: 'Custom',
};

/**
 * All template categories in display order
 */
const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'blog',
  'documentation',
  'presentation',
  'notes',
  'tutorial',
  'custom',
];

/**
 * Default variable for new entries
 */
const DEFAULT_VARIABLE: Omit<TemplateVariable, 'name'> = {
  description: '',
  default: '',
  required: false,
};

// =============================================================================
// Sub-components
// =============================================================================

interface CategorySelectorProps {
  value: TemplateCategory | null;
  onSelect: (category: TemplateCategory) => void;
  error: string | undefined;
}

function CategorySelector({ value, onSelect, error }: CategorySelectorProps): React.JSX.Element {
  const displayText = value ? CATEGORY_DISPLAY_NAMES[value] : 'Select category...';

  return (
    <div className="space-y-2">
      <Label htmlFor="category">
        Category <span className="text-destructive">*</span>
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id="category"
            variant="outline"
            className={cn(
              'w-full justify-between',
              value && 'text-foreground',
              error && 'border-destructive'
            )}
            aria-label="Select category"
          >
            <span className="truncate">{displayText}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]">
          {TEMPLATE_CATEGORIES.map((category) => (
            <DropdownMenuItem
              key={category}
              onClick={() => onSelect(category)}
              className="flex items-center justify-between"
            >
              <span>{CATEGORY_DISPLAY_NAMES[category]}</span>
              {value === category && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

function TagInput({ tags, onTagsChange }: TagInputProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const trimmed = inputValue.trim().toLowerCase();
        if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
          onTagsChange([...tags, trimmed]);
          setInputValue('');
        }
      } else if (event.key === 'Backspace' && inputValue === '' && tags.length > 0) {
        onTagsChange(tags.slice(0, -1));
      }
    },
    [inputValue, tags, onTagsChange]
  );

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      onTagsChange(tags.filter((tag) => tag !== tagToRemove));
    },
    [tags, onTagsChange]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor="tags">Tags (optional, max 10)</Label>
      <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[42px] bg-background">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary text-secondary-foreground rounded-md text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="hover:text-destructive"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          id="tags"
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Type and press Enter...' : ''}
          className="flex-1 min-w-[100px] border-0 shadow-none focus-visible:ring-0 p-0 h-6"
          disabled={tags.length >= 10}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Press Enter or comma to add a tag
      </p>
    </div>
  );
}

interface VariableEditorProps {
  variables: TemplateVariable[];
  onVariablesChange: (variables: TemplateVariable[]) => void;
  detectedVariables: string[];
  errors: Record<number, { name?: string }> | undefined;
}

function VariableEditor({
  variables,
  onVariablesChange,
  detectedVariables,
  errors,
}: VariableEditorProps): React.JSX.Element {
  const handleAddVariable = useCallback(() => {
    const newVariable: TemplateVariable = {
      name: '',
      ...DEFAULT_VARIABLE,
    };
    onVariablesChange([...variables, newVariable]);
  }, [variables, onVariablesChange]);

  const handleRemoveVariable = useCallback(
    (index: number) => {
      onVariablesChange(variables.filter((_, i) => i !== index));
    },
    [variables, onVariablesChange]
  );

  const handleUpdateVariable = useCallback(
    (index: number, field: keyof TemplateVariable, value: string | boolean) => {
      const updated = variables.map((v, i) => {
        if (i !== index) return v;
        return { ...v, [field]: value };
      });
      onVariablesChange(updated);
    },
    [variables, onVariablesChange]
  );

  const handleAddDetected = useCallback(
    (varName: string) => {
      if (!variables.some((v) => v.name === varName)) {
        const newVariable: TemplateVariable = {
          name: varName,
          ...DEFAULT_VARIABLE,
        };
        onVariablesChange([...variables, newVariable]);
      }
    },
    [variables, onVariablesChange]
  );

  // Find detected variables that aren't defined yet
  const undefinedVars = useMemo(() => {
    return detectedVariables.filter((name) => !variables.some((v) => v.name === name));
  }, [detectedVariables, variables]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Template Variables</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddVariable}
          className="h-7"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Variable
        </Button>
      </div>

      {/* Show detected variables hint */}
      {undefinedVars.length > 0 && (
        <div className="text-sm bg-muted/50 p-2 rounded-md">
          <p className="text-muted-foreground mb-1.5">
            Detected in content: {' '}
            {undefinedVars.map((varName, i) => (
              <React.Fragment key={varName}>
                <button
                  type="button"
                  onClick={() => handleAddDetected(varName)}
                  className="text-primary hover:underline"
                >
                  {`{{${varName}}}`}
                </button>
                {i < undefinedVars.length - 1 && ', '}
              </React.Fragment>
            ))}
          </p>
          <p className="text-xs text-muted-foreground">Click to add definition</p>
        </div>
      )}

      {/* Variable list */}
      {variables.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No variables defined. Variables use {'{{name}}'} syntax in content.
        </p>
      ) : (
        <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
          {variables.map((variable, index) => {
            const varError = errors?.[index]?.name;
            return (
              <div
                key={index}
                className="p-3 border rounded-md space-y-2 bg-muted/30"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`var-name-${index}`} className="text-xs">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`var-name-${index}`}
                      type="text"
                      value={variable.name}
                      onChange={(e) => handleUpdateVariable(index, 'name', e.target.value)}
                      placeholder="variableName"
                      className={cn('h-8 text-sm', varError && 'border-destructive')}
                    />
                    {varError && (
                      <p className="text-xs text-destructive">{varError}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveVariable(index)}
                    className="h-8 w-8 p-0 mt-5"
                    aria-label="Remove variable"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`var-desc-${index}`} className="text-xs">
                      Description
                    </Label>
                    <Input
                      id={`var-desc-${index}`}
                      type="text"
                      value={variable.description ?? ''}
                      onChange={(e) => handleUpdateVariable(index, 'description', e.target.value)}
                      placeholder="Help text"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`var-default-${index}`} className="text-xs">
                      Default value
                    </Label>
                    <Input
                      id={`var-default-${index}`}
                      type="text"
                      value={variable.default ?? ''}
                      onChange={(e) => handleUpdateVariable(index, 'default', e.target.value)}
                      placeholder="Optional"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={variable.required}
                    onChange={(e) => handleUpdateVariable(index, 'required', e.target.checked)}
                    className="rounded border-input"
                  />
                  Required
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Save Template Dialog for creating custom templates from current document.
 *
 * Features:
 * - Form validation with required fields
 * - Category selection dropdown
 * - Tag input with add/remove
 * - Variable definition editor with auto-detection
 * - Duplicate name detection
 */
export function SaveTemplateDialog({
  isOpen,
  onClose,
  onSave,
  content,
  isSaving = false,
  error: externalError,
  existingNames = [],
}: SaveTemplateDialogProps): React.JSX.Element {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Ref for first input to focus
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Detect variables in content
  const detectedVariables = useMemo(() => {
    return extractVariables(content);
  }, [content]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setCategory(null);
      setTags([]);
      setVariables([]);
      setErrors({});
      setTouched(new Set());

      // Focus name input after animation
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Validate form
  const validateForm = useCallback((): FormErrors => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Template name is required';
    } else if (existingNames.includes(name.trim().toLowerCase())) {
      newErrors.name = 'A template with this name already exists';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!category) {
      newErrors.category = 'Please select a category';
    }

    // Validate variables
    const varErrors: Record<number, { name?: string }> = {};
    variables.forEach((v, i) => {
      if (!v.name.trim()) {
        varErrors[i] = { name: 'Variable name is required' };
      } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v.name)) {
        varErrors[i] = { name: 'Invalid variable name format' };
      }
    });
    if (Object.keys(varErrors).length > 0) {
      newErrors.variables = varErrors;
    }

    return newErrors;
  }, [name, description, category, variables, existingNames]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    const validationErrors = validateForm();
    return Object.keys(validationErrors).length === 0;
  }, [validateForm]);

  // Handle blur for validation display
  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => new Set([...prev, field]));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      const validationErrors = validateForm();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        // Mark all fields as touched to show errors
        setTouched(new Set(['name', 'description', 'category']));
        return;
      }

      // Submit form data
      onSave({
        name: name.trim(),
        description: description.trim(),
        category: category!,
        tags,
        variables,
        content,
      });
    },
    [name, description, category, tags, variables, content, validateForm, onSave]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto"
        aria-describedby="save-template-description"
      >
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription id="save-template-description">
            Save your current document as a reusable template. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="template-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="template-name"
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => clearErrorField(prev, 'name'));
              }}
              onBlur={() => handleBlur('name')}
              placeholder="My Template"
              maxLength={100}
              aria-required="true"
              aria-invalid={touched.has('name') && errors.name ? 'true' : undefined}
              className={cn(touched.has('name') && errors.name && 'border-destructive')}
            />
            {touched.has('name') && errors.name && (
              <p className="text-xs text-destructive" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="template-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors((prev) => clearErrorField(prev, 'description'));
              }}
              onBlur={() => handleBlur('description')}
              placeholder="Describe what this template is for..."
              maxLength={500}
              rows={3}
              aria-required="true"
              aria-invalid={touched.has('description') && errors.description ? 'true' : undefined}
              className={cn(
                touched.has('description') && errors.description && 'border-destructive'
              )}
            />
            {touched.has('description') && errors.description && (
              <p className="text-xs text-destructive" role="alert">
                {errors.description}
              </p>
            )}
          </div>

          {/* Category dropdown */}
          <CategorySelector
            value={category}
            onSelect={(cat) => {
              setCategory(cat);
              setErrors((prev) => clearErrorField(prev, 'category'));
            }}
            error={touched.has('category') ? errors.category : undefined}
          />

          {/* Tags input */}
          <TagInput tags={tags} onTagsChange={setTags} />

          {/* Separator */}
          <div className="border-t my-4" />

          {/* Variable editor */}
          <VariableEditor
            variables={variables}
            onVariablesChange={setVariables}
            detectedVariables={detectedVariables}
            errors={errors.variables}
          />

          {/* External error message */}
          {externalError && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {externalError}
            </div>
          )}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={!isFormValid || isSaving}>
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaveTemplateDialog;
