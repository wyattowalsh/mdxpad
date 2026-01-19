/**
 * Edit Template Dialog
 *
 * Modal dialog for editing template metadata (name, description, category, tags).
 * Does not allow editing template content or variables.
 *
 * Feature: 016-template-library
 * FR-012: Edit template metadata
 *
 * @module renderer/components/template-browser/EditTemplateDialog
 */

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { TemplateCategory, TemplateMetadata } from '@shared/contracts/template-schemas';
import { TemplateCategorySchema } from '@shared/contracts/template-schemas';
import { cn } from '@shared/lib/utils';

/**
 * Available template categories derived from the schema.
 */
const TEMPLATE_CATEGORIES = TemplateCategorySchema.options;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Form data for editing template metadata.
 */
export interface EditTemplateFormData {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
}

/**
 * Props for the EditTemplateDialog component.
 */
export interface EditTemplateDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed */
  onClose: () => void;
  /** Callback when the form is submitted */
  onSave: (data: EditTemplateFormData) => void;
  /** Template metadata to edit */
  template: TemplateMetadata | null;
  /** Whether a save operation is in progress */
  isSaving?: boolean;
  /** Error message from the last save attempt */
  error?: string | null;
  /** Existing template names for duplicate detection (excluding current template) */
  existingNames?: string[];
}

/**
 * Form validation errors.
 */
interface FormErrors {
  name: string | undefined;
  description: string | undefined;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  blog: 'Blog',
  documentation: 'Documentation',
  presentation: 'Presentation',
  notes: 'Notes',
  tutorial: 'Tutorial',
  custom: 'Custom',
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Clears an error field by removing it from the errors object.
 * Uses destructuring to avoid exactOptionalPropertyTypes issues.
 */
function clearErrorField<K extends keyof FormErrors>(
  errors: FormErrors,
  field: K
): FormErrors {
  const { [field]: _, ...rest } = errors;
  return rest as FormErrors;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Dialog for editing template metadata.
 *
 * Features:
 * - Edit name, description, category, and tags
 * - Duplicate name detection
 * - Form validation
 *
 * @param props - Component props
 * @returns JSX element
 */
export function EditTemplateDialog({
  isOpen,
  onClose,
  onSave,
  template,
  isSaving = false,
  error = null,
  existingNames = [],
}: EditTemplateDialogProps): React.JSX.Element {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('custom');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<FormErrors>({
    name: undefined,
    description: undefined,
  });

  // Reset form when template changes or dialog opens
  useEffect(() => {
    if (isOpen && template) {
      setName(template.name);
      setDescription(template.description);
      setCategory(template.category);
      setTags(template.tags ? [...template.tags] : []);
      setTagInput('');
      setErrors({ name: undefined, description: undefined });
    }
  }, [isOpen, template]);

  // Clear form on close
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setCategory('custom');
      setTags([]);
      setTagInput('');
      setErrors({ name: undefined, description: undefined });
    }
  }, [isOpen]);

  // Validation
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = { name: undefined, description: undefined };
    let isValid = true;

    // Name validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'Template name is required';
      isValid = false;
    } else if (trimmedName.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
      isValid = false;
    } else if (trimmedName.length > 100) {
      newErrors.name = 'Name must be less than 100 characters';
      isValid = false;
    } else if (
      template &&
      existingNames.some(
        (n) => n.toLowerCase() === trimmedName.toLowerCase() && n !== template.name
      )
    ) {
      newErrors.name = 'A template with this name already exists';
      isValid = false;
    }

    // Description validation
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      newErrors.description = 'Description is required';
      isValid = false;
    } else if (trimmedDescription.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
      isValid = false;
    } else if (trimmedDescription.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [name, description, template, existingNames]);

  // Handle tag addition
  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) {
      setTags((prev) => [...prev, trimmedTag]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  // Handle tag removal
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  // Handle tag input key down
  const handleTagInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!template) return;

      if (validateForm()) {
        onSave({
          id: template.id,
          name: name.trim(),
          description: description.trim(),
          category,
          tags,
        });
      }
    },
    [template, name, description, category, tags, validateForm, onSave]
  );

  // Handle dialog close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  if (!template) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>No template selected.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
          <DialogDescription>
            Update the metadata for &ldquo;{template.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="edit-template-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-template-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) {
                  setErrors((prev) => clearErrorField(prev, 'name'));
                }
              }}
              placeholder="My Template"
              disabled={isSaving}
              aria-invalid={errors.name ? 'true' : 'false'}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="edit-template-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="edit-template-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) {
                  setErrors((prev) => clearErrorField(prev, 'description'));
                }
              }}
              placeholder="A brief description of what this template is for..."
              rows={3}
              disabled={isSaving}
              aria-invalid={errors.description ? 'true' : 'false'}
              aria-describedby={errors.description ? 'description-error' : undefined}
            />
            {errors.description && (
              <p id="description-error" className="text-sm text-destructive">
                {errors.description}
              </p>
            )}
          </div>

          {/* Category dropdown */}
          <div className="space-y-2">
            <Label>Category</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled={isSaving}
                >
                  {CATEGORY_LABELS[category]}
                  <span className="ml-2 opacity-50">▼</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <DropdownMenuItem
                    key={cat}
                    onSelect={() => setCategory(cat)}
                    className={cn(category === cat && 'bg-accent')}
                  >
                    {CATEGORY_LABELS[cat]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tags input */}
          <div className="space-y-2">
            <Label htmlFor="edit-template-tags">Tags (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="edit-template-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Add a tag..."
                disabled={isSaving || tags.length >= 10}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                disabled={isSaving || !tagInput.trim() || tags.length >= 10}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-muted rounded"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-muted-foreground hover:text-foreground"
                      disabled={isSaving}
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{tags.length}/10 tags</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </form>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditTemplateDialog;
