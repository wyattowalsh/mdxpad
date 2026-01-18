/**
 * Variable Dialog Component
 *
 * Modal dialog that prompts users to fill in template variables before
 * document creation. Supports validation, default values, and special
 * auto-computed variables (date, datetime, author).
 *
 * Feature: 016-template-library
 * FR-024: Special variable handling for auto-computed values
 *
 * @module renderer/components/template-browser/VariableDialog
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { validateVariables, isAutoVariable, getAutoValue } from '@renderer/lib/template-variables';
import type { TemplateVariable } from '@shared/contracts/template-schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the VariableDialog component.
 */
export interface VariableDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed without action */
  onClose: () => void;
  /** Callback when values are submitted */
  onSubmit: (values: Record<string, string>) => void;
  /** Template variable definitions */
  variables: TemplateVariable[];
  /** Name of the template being used */
  templateName: string;
}

/**
 * Form validation error state.
 */
interface FormErrors {
  [variableName: string]: string | undefined;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format variable name for display (convert snake_case to Title Case).
 */
function formatVariableName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Get placeholder text for auto-variables.
 */
function getAutoPlaceholder(varName: string): string | undefined {
  if (!isAutoVariable(varName)) {
    return undefined;
  }

  switch (varName) {
    case 'date':
      return 'Auto-fills with current date';
    case 'datetime':
      return 'Auto-fills with current date and time';
    case 'author':
      return 'Auto-fills from user preferences';
    default:
      return undefined;
  }
}

/**
 * Get preview value for auto-variables (shown as hint).
 */
function getAutoPreview(varName: string): string | null {
  if (!isAutoVariable(varName)) {
    return null;
  }

  const autoValue = getAutoValue(varName);
  if (autoValue === null) {
    return null;
  }

  switch (varName) {
    case 'date':
      return `Will be: ${autoValue}`;
    case 'datetime':
      // Truncate datetime for display
      return `Will be: ${autoValue.slice(0, 19)}...`;
    default:
      return null;
  }
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Modal dialog for collecting template variable values.
 *
 * Features:
 * - Dynamic form fields for each variable
 * - Pre-fills default values
 * - Shows auto-fill indicators for special variables
 * - Validates required fields
 * - Focuses first input on open
 */
export function VariableDialog({
  isOpen,
  onClose,
  onSubmit,
  variables,
  templateName,
}: VariableDialogProps): React.JSX.Element {
  // Form state
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Ref for first input to focus
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Initialize form values with defaults when dialog opens or variables change
  useEffect(() => {
    if (isOpen && variables.length > 0) {
      const initialValues: Record<string, string> = {};
      for (const variable of variables) {
        // Use default value if provided, otherwise empty string
        initialValues[variable.name] = variable.default ?? '';
      }
      setValues(initialValues);
      setErrors({});
      setTouched(new Set());
    }
  }, [isOpen, variables]);

  // Focus first input when dialog opens
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      // Delay focus to ensure dialog animation completes
      const timeoutId = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isOpen]);

  // Compute whether form is valid
  const isFormValid = useMemo(() => {
    const result = validateVariables(variables, values);
    return result.valid;
  }, [variables, values]);

  // Handle input value change
  const handleValueChange = useCallback((variableName: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [variableName]: value,
    }));

    // Clear error when user types
    setErrors((prev) => ({
      ...prev,
      [variableName]: undefined,
    }));
  }, []);

  // Handle input blur (mark as touched for validation display)
  const handleBlur = useCallback((variableName: string) => {
    setTouched((prev) => new Set([...prev, variableName]));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      // Validate all fields
      const result = validateVariables(variables, values);

      if (!result.valid) {
        // Build error map from validation errors
        const newErrors: FormErrors = {};
        for (const errorMsg of result.errors) {
          // Extract variable name from error message
          const match = errorMsg.match(/Required variable "(\w+)"/);
          if (match?.[1]) {
            newErrors[match[1]] = 'This field is required';
          }
        }
        setErrors(newErrors);

        // Mark all fields as touched to show errors
        setTouched(new Set(variables.map((v) => v.name)));
        return;
      }

      // Submit values
      onSubmit(values);
    },
    [variables, values, onSubmit]
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Render nothing if no variables
  if (variables.length === 0) {
    return <></>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md w-[90vw]"
        aria-describedby="variable-dialog-description"
      >
        <DialogHeader>
          <DialogTitle>Configure Template Variables</DialogTitle>
          <DialogDescription id="variable-dialog-description">
            Fill in the values below to customize your new document from the "{templateName}"
            template.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {variables.map((variable, index) => {
            const inputId = `var-${variable.name}`;
            const errorId = `${inputId}-error`;
            const hasError = touched.has(variable.name) && errors[variable.name];
            const isAuto =
              isAutoVariable(variable.name) &&
              (!variable.default || variable.default === '');
            const autoPlaceholder = getAutoPlaceholder(variable.name);
            const autoPreview = isAuto ? getAutoPreview(variable.name) : null;

            return (
              <div key={variable.name} className="space-y-2">
                <Label htmlFor={inputId} className="flex items-center gap-1">
                  {formatVariableName(variable.name)}
                  {variable.required && (
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  )}
                  {isAuto && (
                    <span className="text-xs text-muted-foreground ml-1">(auto-fill)</span>
                  )}
                </Label>

                <Input
                  id={inputId}
                  ref={index === 0 ? firstInputRef : undefined}
                  type="text"
                  value={values[variable.name] ?? ''}
                  onChange={(e) => handleValueChange(variable.name, e.target.value)}
                  onBlur={() => handleBlur(variable.name)}
                  placeholder={autoPlaceholder ?? variable.description}
                  aria-required={variable.required}
                  aria-invalid={hasError ? 'true' : undefined}
                  aria-describedby={
                    hasError
                      ? errorId
                      : variable.description
                        ? `${inputId}-desc`
                        : undefined
                  }
                  className={hasError ? 'border-destructive' : undefined}
                />

                {/* Description/help text */}
                {variable.description && !hasError && !isAuto && (
                  <p id={`${inputId}-desc`} className="text-xs text-muted-foreground">
                    {variable.description}
                  </p>
                )}

                {/* Auto-fill preview for special variables */}
                {autoPreview && !hasError && !values[variable.name] && (
                  <p className="text-xs text-muted-foreground italic">{autoPreview}</p>
                )}

                {/* Error message */}
                {hasError && (
                  <p id={errorId} className="text-xs text-destructive" role="alert">
                    {errors[variable.name]}
                  </p>
                )}
              </div>
            );
          })}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!isFormValid}
          >
            Create Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VariableDialog;
