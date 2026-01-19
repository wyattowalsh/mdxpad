/**
 * Template Variable Utilities
 *
 * Feature: 016-template-library
 * Phase: 3 - Variable System
 *
 * Provides functions for extracting, validating, and substituting
 * template variables in MDX content. Variables use Mustache-style
 * syntax: {{variableName}}
 *
 * CONSTITUTION COMPLIANCE (Article VI.2):
 * - All functions kept under 50 lines
 * - Single responsibility per function
 */

import type { TemplateVariable } from '@shared/contracts/template-schemas';

// =============================================================================
// Constants
// =============================================================================

/**
 * Regex pattern to match {{variableName}} placeholders
 * Captures the variable name (alphanumeric + underscores)
 */
const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

/**
 * Special auto-computed variable names
 */
const AUTO_VARIABLES = ['date', 'datetime', 'author'] as const;

type AutoVariable = (typeof AUTO_VARIABLES)[number];

// =============================================================================
// Auto-Variable Computation
// =============================================================================

/**
 * Get auto-computed value for special variables.
 *
 * @param varName - Variable name to compute
 * @returns Auto-computed value, or null if not a special variable
 *
 * Special variables:
 * - `date`: Current date in ISO format (YYYY-MM-DD)
 * - `datetime`: Current datetime in ISO format
 * - `author`: Placeholder for user preferences (returns null for now)
 */
export function getAutoValue(varName: string): string | null {
  const now = new Date();

  switch (varName as AutoVariable) {
    case 'date': {
      const datePart = now.toISOString().split('T')[0];
      return datePart ?? now.toISOString().slice(0, 10);
    }
    case 'datetime':
      return now.toISOString();
    case 'author':
      // TODO: Integrate with user preferences when available
      return null;
    default:
      return null;
  }
}

/**
 * Check if a variable name is a special auto-variable
 */
export function isAutoVariable(varName: string): boolean {
  return AUTO_VARIABLES.includes(varName as AutoVariable);
}

// =============================================================================
// Variable Extraction
// =============================================================================

/**
 * Extract unique variable names from template content.
 *
 * @param content - Template content with {{variable}} placeholders
 * @returns Array of unique variable names found in content
 *
 * @example
 * extractVariables('Hello {{name}}, today is {{date}}!')
 * // Returns: ['name', 'date']
 */
export function extractVariables(content: string): string[] {
  const matches = content.matchAll(VARIABLE_REGEX);
  const names: string[] = [];
  for (const match of matches) {
    const name = match[1];
    if (name !== undefined) {
      names.push(name);
    }
  }
  return [...new Set(names)];
}

// =============================================================================
// Variable Substitution
// =============================================================================

/**
 * Substitute variables in template content with provided values.
 *
 * @param content - Template content with {{variable}} placeholders
 * @param values - Map of variable names to replacement values
 * @returns Content with variables replaced; unmatched variables preserved
 *
 * Behavior:
 * - Variables with provided values are replaced
 * - Auto-variables (date, datetime) with empty default are auto-computed
 * - Variables without values are left as-is ({{varName}} preserved)
 *
 * @example
 * substituteVariables('Hello {{name}}!', { name: 'World' })
 * // Returns: 'Hello World!'
 *
 * substituteVariables('Date: {{date}}', {})
 * // Returns: 'Date: 2026-01-17' (auto-computed)
 */
export function substituteVariables(
  content: string,
  values: Record<string, string>
): string {
  return content.replace(VARIABLE_REGEX, (match, varName: string): string => {
    // Check if explicit value provided
    const providedValue = values[varName];
    if (providedValue !== undefined && providedValue !== '') {
      return providedValue;
    }

    // Try auto-computed value for special variables with no explicit value
    const autoValue = getAutoValue(varName);
    if (autoValue !== null) {
      return autoValue;
    }

    // Preserve unmatched variables
    return match;
  });
}

// =============================================================================
// Variable Validation
// =============================================================================

/**
 * Validation result for template variables
 */
export interface VariableValidationResult {
  /** True if all required variables have values */
  valid: boolean;
  /** List of validation error messages */
  errors: string[];
}

/**
 * Validate that required variables have values.
 *
 * @param variables - Template variable definitions from frontmatter
 * @param values - Provided variable values
 * @returns Validation result with errors for missing required variables
 *
 * Validation rules:
 * - Required variables must have a non-empty value
 * - Auto-variables with empty default are considered valid (auto-computed)
 * - Non-required variables pass validation regardless of value
 *
 * @example
 * const vars = [{ name: 'title', required: true }, { name: 'date', required: false }];
 * validateVariables(vars, { title: 'My Post' })
 * // Returns: { valid: true, errors: [] }
 *
 * validateVariables(vars, {})
 * // Returns: { valid: false, errors: ['Required variable "title" is missing'] }
 */
export function validateVariables(
  variables: TemplateVariable[],
  values: Record<string, string>
): VariableValidationResult {
  const errors: string[] = [];

  for (const variable of variables) {
    if (!variable.required) {
      continue;
    }

    const value = values[variable.name];
    const hasValue = value !== undefined && value !== '';

    // Auto-variables with empty default don't need explicit values
    if (!hasValue && isAutoVariable(variable.name) && !variable.default) {
      continue;
    }

    // Required variable with default is valid
    if (!hasValue && variable.default !== undefined && variable.default !== '') {
      continue;
    }

    if (!hasValue) {
      errors.push(`Required variable "${variable.name}" is missing`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Build variable values map with defaults applied.
 *
 * @param variables - Template variable definitions
 * @param providedValues - User-provided values
 * @returns Complete values map with defaults filled in
 *
 * Priority order:
 * 1. User-provided value
 * 2. Auto-computed value (for special variables with empty default)
 * 3. Default value from variable definition
 * 4. Empty string
 */
export function buildVariableValues(
  variables: TemplateVariable[],
  providedValues: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = { ...providedValues };

  for (const variable of variables) {
    const { name } = variable;

    // Skip if user provided a value
    if (name in result && result[name] !== '') {
      continue;
    }

    // Try auto-computed value for special variables with empty/no default
    if (isAutoVariable(name) && (!variable.default || variable.default === '')) {
      const autoValue = getAutoValue(name);
      if (autoValue !== null) {
        result[name] = autoValue;
        continue;
      }
    }

    // Apply default if defined
    if (variable.default !== undefined) {
      result[name] = variable.default;
    }
  }

  return result;
}
