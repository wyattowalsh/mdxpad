/**
 * Frontmatter Visual Editor Type Definitions
 *
 * @module shared/types/frontmatter
 * @description Shared type definitions for frontmatter parsing, editing, and validation.
 * Used by both lib functions and UI components.
 */

import { z } from 'zod';

// ============================================================================
// Field Types
// ============================================================================

/**
 * Supported field types with their corresponding UI controls
 */
export type FieldType =
  | 'text' // Single-line text input
  | 'textarea' // Multi-line text input
  | 'number' // Numeric input
  | 'boolean' // Checkbox or switch
  | 'date' // Date picker
  | 'array' // Tag input for string arrays
  | 'object'; // Nested form (collapsible)

/**
 * Possible values for frontmatter fields
 */
export type FieldValue =
  | string
  | number
  | boolean
  | Date
  | FieldValue[]
  | { [key: string]: FieldValue }
  | null;

// ============================================================================
// YAML Format Options
// ============================================================================

/**
 * YAML formatting options for round-trip preservation
 */
export interface YamlFormatOptions {
  /** Indentation width (typically 2) */
  readonly indent: number;
  /** Quote style for strings */
  readonly defaultQuoteStyle: 'single' | 'double' | 'plain';
  /** Line width before wrapping */
  readonly lineWidth: number;
}

/** Default YAML format options */
export const DEFAULT_YAML_FORMAT_OPTIONS: YamlFormatOptions = {
  indent: 2,
  defaultQuoteStyle: 'plain',
  lineWidth: 80,
};

// ============================================================================
// Parse Errors
// ============================================================================

/**
 * Error information from YAML parsing
 */
export interface FrontmatterParseError {
  readonly message: string;
  readonly line: number;
  readonly column: number;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation error codes
 */
export type ValidationErrorCode =
  | 'REQUIRED'
  | 'INVALID_TYPE'
  | 'INVALID_FORMAT'
  | 'MIN_LENGTH'
  | 'MAX_LENGTH'
  | 'MIN_VALUE'
  | 'MAX_VALUE'
  | 'PATTERN_MISMATCH';

/**
 * Single validation error
 */
export interface ValidationError {
  readonly code: ValidationErrorCode;
  readonly message: string;
  readonly path?: readonly string[];
}

/**
 * Validation warning codes (non-blocking)
 */
export type ValidationWarningCode = 'DEPRECATED' | 'UNKNOWN_FIELD';

/**
 * Single validation warning
 */
export interface ValidationWarning {
  readonly code: ValidationWarningCode;
  readonly message: string;
}

/**
 * Result of validating a field value
 */
export interface ValidationResult {
  /** Whether the field is valid */
  readonly valid: boolean;
  /** Validation errors (blocking) */
  readonly errors: readonly ValidationError[];
  /** Validation warnings (non-blocking) */
  readonly warnings: readonly ValidationWarning[];
}

/** Valid result constant for convenience */
export const VALID_RESULT: ValidationResult = {
  valid: true,
  errors: [],
  warnings: [],
};

// ============================================================================
// Frontmatter Field
// ============================================================================

/**
 * Represents a single field within the frontmatter
 */
export interface FrontmatterField {
  /** Field name (key in YAML) */
  readonly name: string;
  /** Field value (typed based on content) */
  readonly value: FieldValue;
  /** Detected or schema-defined type */
  readonly type: FieldType;
  /** Validation result for this field */
  readonly validation: ValidationResult;
  /** Path for nested fields (e.g., ['author', 'name']) */
  readonly path: readonly string[];
  /** Whether type came from schema (vs inferred) */
  readonly isFromSchema: boolean;
  /** Schema-provided description for tooltip */
  readonly description?: string;
  /** Display order from schema (lower = first) */
  readonly order: number;
}

// ============================================================================
// Frontmatter Data
// ============================================================================

/**
 * Represents the complete parsed frontmatter from a document
 */
export interface FrontmatterData {
  /** Parsed fields from frontmatter */
  readonly fields: FrontmatterField[];
  /** Raw YAML string (for raw mode editing) */
  readonly rawYaml: string;
  /** Parse error if YAML is invalid */
  readonly parseError: FrontmatterParseError | null;
  /** Whether frontmatter exists in document */
  readonly exists: boolean;
  /** Original YAML formatting options (for preservation) */
  readonly formatOptions: YamlFormatOptions;
  /** Whether frontmatter contains unsupported YAML features */
  readonly hasUnsupportedFeatures: boolean;
  /** Names of fields with unsupported YAML features */
  readonly unsupportedFieldNames: readonly string[];
  /** Reasons for unsupported features (e.g., 'anchors', 'aliases', 'custom tags', 'multi-line block strings') */
  readonly unsupportedReasons: readonly string[];
  /** Delimiter error if frontmatter is malformed */
  readonly delimiterError: FrontmatterDelimiterError | null;
}

/**
 * Error for malformed frontmatter delimiters
 */
export interface FrontmatterDelimiterError {
  readonly type: 'missing_opening' | 'missing_closing' | 'mismatched';
  readonly message: string;
  /** Suggested auto-fix */
  readonly suggestedFix?: string;
}

/** Empty frontmatter state */
export const EMPTY_FRONTMATTER_DATA: FrontmatterData = {
  fields: [],
  rawYaml: '',
  parseError: null,
  exists: false,
  formatOptions: DEFAULT_YAML_FORMAT_OPTIONS,
  hasUnsupportedFeatures: false,
  unsupportedFieldNames: [],
  unsupportedReasons: [],
  delimiterError: null,
};

// ============================================================================
// Schema
// ============================================================================

/**
 * Source of schema definition
 */
export type SchemaSource =
  | { type: 'project'; path: string }
  | { type: 'user' }
  | { type: 'none' };

/**
 * Schema property definition (subset of JSON Schema)
 */
export interface SchemaProperty {
  /** JSON Schema type */
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Format hint (e.g., 'date', 'email') */
  readonly format?: string;
  /** Human-readable description */
  readonly description?: string;
  /** Default value */
  readonly default?: unknown;
  /** Minimum string length */
  readonly minLength?: number;
  /** Maximum string length */
  readonly maxLength?: number;
  /** Minimum numeric value */
  readonly minimum?: number;
  /** Maximum numeric value */
  readonly maximum?: number;
  /** Regex pattern for string validation */
  readonly pattern?: string;
  /** Allowed values (renders as dropdown) */
  readonly enum?: unknown[];
  /** For arrays: item schema */
  readonly items?: SchemaProperty;
  /** For objects: nested properties */
  readonly properties?: Record<string, SchemaProperty>;
  /** Custom frontmatter extensions */
  readonly 'x-frontmatter'?: {
    /** Show in common field suggestions */
    suggested?: boolean;
    /** Display order (lower = first) */
    order?: number;
    /** Hide from visual editor (raw mode only) */
    hidden?: boolean;
    /** Input placeholder text */
    placeholder?: string;
  };
}

/**
 * Frontmatter schema for field definitions and validation
 */
export interface FrontmatterSchema {
  /** Schema properties by field name */
  readonly properties: Record<string, SchemaProperty>;
  /** Required field names */
  readonly required: readonly string[];
  /** Schema source for debugging */
  readonly source: SchemaSource;
}

/** Empty schema constant */
export const EMPTY_SCHEMA: FrontmatterSchema = {
  properties: {},
  required: [],
  source: { type: 'none' },
};

// ============================================================================
// Common Field Suggestions
// ============================================================================

/**
 * Common field suggestion for the "Add Field" dropdown
 */
export interface CommonFieldSuggestion {
  readonly name: string;
  readonly type: FieldType;
  readonly description: string;
}

/**
 * Predefined common fields for frontmatter
 */
export const COMMON_FIELDS: readonly CommonFieldSuggestion[] = [
  { name: 'title', type: 'text', description: 'Document title' },
  { name: 'description', type: 'textarea', description: 'Brief summary' },
  { name: 'date', type: 'date', description: 'Publication date' },
  { name: 'author', type: 'text', description: 'Author name' },
  { name: 'tags', type: 'array', description: 'Categorization tags' },
  { name: 'categories', type: 'array', description: 'Content categories' },
  { name: 'draft', type: 'boolean', description: 'Draft status' },
  { name: 'slug', type: 'text', description: 'URL slug' },
  { name: 'image', type: 'text', description: 'Featured image path' },
] as const;

// ============================================================================
// Field Type Configuration
// ============================================================================

/**
 * Configuration for a field type including its default value and validator
 */
export interface FieldTypeDefinition {
  readonly component: string;
  readonly defaultValue: FieldValue;
  readonly validator: z.ZodType;
}

/**
 * Field type configurations with validators
 */
export const FIELD_TYPE_CONFIG: Record<FieldType, FieldTypeDefinition> = {
  text: {
    component: 'TextField',
    defaultValue: '',
    validator: z.string(),
  },
  textarea: {
    component: 'TextareaField',
    defaultValue: '',
    validator: z.string(),
  },
  number: {
    component: 'NumberField',
    defaultValue: 0,
    validator: z.number(),
  },
  boolean: {
    component: 'BooleanField',
    defaultValue: false,
    validator: z.boolean(),
  },
  date: {
    component: 'DateField',
    defaultValue: null,
    validator: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  },
  array: {
    component: 'ArrayField',
    defaultValue: [],
    validator: z.array(z.string()),
  },
  object: {
    component: 'ObjectField',
    defaultValue: {},
    validator: z.record(z.unknown()),
  },
};

// ============================================================================
// Store Types
// ============================================================================

/**
 * Edit mode for the frontmatter panel
 */
export type FrontmatterMode = 'visual' | 'raw';

/**
 * Change source tracking to prevent sync loops
 */
export type ChangeSource = 'panel' | 'document' | null;

/**
 * Frontmatter store state interface
 */
export interface FrontmatterStoreState {
  /** Current frontmatter data */
  data: FrontmatterData | null;
  /** Active schema */
  schema: FrontmatterSchema | null;
  /** Current editing mode */
  mode: FrontmatterMode;
  /** Panel visibility */
  isPanelOpen: boolean;
  /** Raw YAML text (for raw mode) */
  rawYamlDraft: string;
  /** Pending changes flag */
  isDirty: boolean;
  /** Sync source tracking (prevents loops) */
  lastChangeSource: ChangeSource;
  /** Schema loading state */
  isLoadingSchema: boolean;
  /** Schema loading error */
  schemaError: string | null;
}

/**
 * Frontmatter store actions interface
 */
export interface FrontmatterStoreActions {
  /** Parse frontmatter from document content */
  parseFromDocument: (content: string) => void;
  /** Update a field value */
  updateField: (path: string[], value: FieldValue) => void;
  /** Add a new field */
  addField: (name: string, type: FieldType) => void;
  /** Remove a field */
  removeField: (path: string[]) => void;
  /** Toggle editing mode */
  setMode: (mode: FrontmatterMode) => ValidationResult;
  /** Update raw YAML draft */
  setRawYaml: (yaml: string) => void;
  /** Apply raw YAML changes (parse and validate) */
  applyRawYaml: () => ValidationResult;
  /** Toggle panel visibility */
  togglePanel: () => void;
  /** Set panel visibility */
  setPanelOpen: (open: boolean) => void;
  /** Validate all fields and update their validation state */
  validateFields: () => void;
  /** Load schema from project or user settings */
  loadSchema: () => Promise<void>;
  /** Serialize to YAML for document update */
  serializeToYaml: () => string;
  /** Reset state */
  reset: () => void;
  /** Set change source */
  setChangeSource: (source: ChangeSource) => void;
}

/**
 * Complete frontmatter store type
 */
export type FrontmatterStore = FrontmatterStoreState & FrontmatterStoreActions;
