/**
 * Frontmatter Schema Loading and Validation
 *
 * Handles loading frontmatter schemas from project files and user settings,
 * validating schema structure, and converting schema properties to zod validators.
 *
 * @module renderer/lib/frontmatter/schema
 */

import { z } from 'zod';
import type {
  FrontmatterSchema,
  SchemaProperty,
  SchemaSource,
  ValidationResult,
} from '@shared/types/frontmatter';
import { EMPTY_SCHEMA, VALID_RESULT } from '@shared/types/frontmatter';
import type { FileError } from '@shared/types/file';

// =============================================================================
// LOCAL TYPES
// =============================================================================

/**
 * Result type for file read operations from the preload API.
 */
type FileReadResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: FileError };

// =============================================================================
// CONSTANTS
// =============================================================================

/** Standard schema filename in workspace root */
export const SCHEMA_FILENAME = 'frontmatter.schema.json';

/** Schema load timeout in milliseconds */
export const SCHEMA_LOAD_TIMEOUT_MS = 50;

// =============================================================================
// SCHEMA FILE VALIDATION
// =============================================================================

/**
 * Zod schema for validating x-frontmatter extension properties
 */
const xFrontmatterExtensionSchema = z
  .object({
    suggested: z.boolean().optional(),
    order: z.number().int().optional(),
    hidden: z.boolean().optional(),
    placeholder: z.string().optional(),
  })
  .strict()
  .optional();

/**
 * Zod schema for validating a single schema property (recursive for nested objects).
 * Using z.ZodType<unknown> to avoid recursive type inference issues.
 */
const schemaPropertySchema: z.ZodType<unknown> = z.lazy(() =>
  z
    .object({
      type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
      format: z.enum(['date', 'date-time', 'email', 'uri', 'uuid']).optional(),
      description: z.string().optional(),
      default: z.unknown().optional(),
      minLength: z.number().int().min(0).optional(),
      maxLength: z.number().int().min(0).optional(),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
      pattern: z.string().optional(),
      enum: z.array(z.unknown()).optional(),
      items: schemaPropertySchema.optional(),
      properties: z.record(schemaPropertySchema).optional(),
      'x-frontmatter': xFrontmatterExtensionSchema,
    })
    .passthrough()
);

/**
 * Zod schema for validating the entire frontmatter schema file
 */
const frontmatterSchemaFileSchema = z.object({
  $schema: z.string().optional(),
  properties: z.record(schemaPropertySchema).optional().default({}),
  required: z.array(z.string()).optional().default([]),
});

// =============================================================================
// SCHEMA VALIDATION
// =============================================================================

/**
 * Validates the structure of a schema file.
 *
 * @param content - Raw JSON content to validate
 * @returns ValidationResult indicating success or failure with errors
 */
export function validateSchemaFile(content: unknown): ValidationResult {
  const result = frontmatterSchemaFileSchema.safeParse(content);

  if (result.success) {
    return VALID_RESULT;
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      code: 'INVALID_FORMAT' as const,
      message: `${issue.path.join('.')}: ${issue.message}`,
      path: issue.path.map(String),
    })),
    warnings: [],
  };
}

/**
 * Parses a validated JSON object into a FrontmatterSchema.
 *
 * @param json - Parsed JSON object (should be pre-validated)
 * @param source - Source of the schema for debugging
 * @returns Parsed FrontmatterSchema
 */
export function parseSchemaFile(
  json: unknown,
  source: SchemaSource
): FrontmatterSchema {
  const parsed = frontmatterSchemaFileSchema.parse(json);

  return {
    properties: parsed.properties as Record<string, SchemaProperty>,
    required: parsed.required,
    source,
  };
}

// =============================================================================
// SCHEMA LOADING
// =============================================================================

/**
 * In-memory cache for loaded schemas, keyed by workspace path.
 * Prevents redundant file reads for the same workspace.
 */
const schemaCache = new Map<string, FrontmatterSchema>();

/**
 * Clears the schema cache. Useful for testing or when schema files change.
 */
export function clearSchemaCache(): void {
  schemaCache.clear();
}

/**
 * Gets the workspace root directory from a file path.
 * Returns the directory containing the file.
 *
 * @param filePath - Absolute path to the current file
 * @returns Directory path (workspace root)
 */
export function getWorkspaceRoot(filePath: string): string {
  // Handle both Unix and Windows path separators
  const lastSlash = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\')
  );
  return lastSlash >= 0 ? filePath.slice(0, lastSlash) : filePath;
}

/**
 * Constructs the schema file path from workspace root.
 *
 * @param workspaceRoot - Directory path to workspace root
 * @returns Full path to schema file
 */
export function getSchemaPath(workspaceRoot: string): string {
  // Normalize to forward slashes for consistency
  const normalizedRoot = workspaceRoot.replace(/\\/g, '/');
  return `${normalizedRoot}/${SCHEMA_FILENAME}`;
}

/**
 * Gets the MdxpadAPI from the window object if available.
 */
function getMdxpadApi(): { readFile: (path: string) => Promise<FileReadResult> } | null {
  const api = (
    window as unknown as { mdxpad?: { readFile?: (path: string) => Promise<FileReadResult> } }
  ).mdxpad;
  return api?.readFile ? (api as { readFile: (path: string) => Promise<FileReadResult> }) : null;
}

/**
 * Reads a file with timeout protection.
 */
async function readFileWithTimeout(
  api: { readFile: (path: string) => Promise<FileReadResult> },
  path: string
): Promise<FileReadResult | null> {
  const readPromise = api.readFile(path);
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), SCHEMA_LOAD_TIMEOUT_MS)
  );
  return Promise.race([readPromise, timeoutPromise]);
}

/**
 * Parses and validates JSON content into a FrontmatterSchema.
 */
function parseAndValidateSchema(content: string, path: string): FrontmatterSchema | null {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch (parseError) {
    console.warn('[schema] Invalid JSON in schema file:', parseError);
    return null;
  }

  const validation = validateSchemaFile(json);
  if (!validation.valid) {
    console.warn('[schema] Schema validation failed:', validation.errors);
    return null;
  }

  return parseSchemaFile(json, { type: 'project', path });
}

/**
 * Loads a frontmatter schema from a file path.
 * Uses the MdxpadAPI.readFile IPC call to read the file.
 *
 * @param path - Absolute path to the schema file
 * @returns FrontmatterSchema if found and valid, null otherwise
 */
export async function loadSchemaFromFile(path: string): Promise<FrontmatterSchema | null> {
  // Check cache first
  const cachedSchema = schemaCache.get(path);
  if (cachedSchema) return cachedSchema;

  const api = getMdxpadApi();
  if (!api) {
    console.warn('[schema] MdxpadAPI not available');
    return null;
  }

  try {
    const result = await readFileWithTimeout(api, path);

    if (result === null) {
      console.warn(`[schema] Load timeout exceeded (${SCHEMA_LOAD_TIMEOUT_MS}ms)`);
      return null;
    }

    if (!result.ok) {
      if (result.error.code !== 'NOT_FOUND') {
        console.warn('[schema] Failed to read schema file:', result.error);
      }
      return null;
    }

    const schema = parseAndValidateSchema(result.value, path);
    if (schema) schemaCache.set(path, schema);
    return schema;
  } catch (error) {
    console.error('[schema] Unexpected error loading schema:', error);
    return null;
  }
}

/**
 * Loads schema for a workspace, checking project config first then user defaults.
 *
 * @param filePath - Path to the current document (used to determine workspace root)
 * @returns FrontmatterSchema with source information
 */
export async function loadSchemaForWorkspace(
  filePath: string | null
): Promise<FrontmatterSchema> {
  // If no file is open, return empty schema
  if (!filePath) {
    return EMPTY_SCHEMA;
  }

  // Try to load from project root
  const workspaceRoot = getWorkspaceRoot(filePath);
  const schemaPath = getSchemaPath(workspaceRoot);

  const projectSchema = await loadSchemaFromFile(schemaPath);
  if (projectSchema) {
    return projectSchema;
  }

  // TODO: Fall back to electron-store user defaults
  // For now, return empty schema
  return { ...EMPTY_SCHEMA, source: { type: 'none' } };
}

// =============================================================================
// SCHEMA-TO-ZOD CONVERTER
// =============================================================================

/**
 * Converts a SchemaProperty to a zod validator.
 * Handles all JSON Schema types and constraints.
 *
 * @param property - Schema property definition
 * @returns Zod validator for the property
 */
export function schemaPropertyToZod(property: SchemaProperty): z.ZodType {
  switch (property.type) {
    case 'string':
      return buildStringValidator(property);

    case 'number':
      return buildNumberValidator(property);

    case 'boolean':
      return z.boolean();

    case 'array':
      return buildArrayValidator(property);

    case 'object':
      return buildObjectValidator(property);

    default:
      // Fallback for unknown types
      return z.unknown();
  }
}

/**
 * Creates a string format validator based on format hint.
 */
function createFormatValidator(format: SchemaProperty['format']): z.ZodType {
  switch (format) {
    case 'date':
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)');
    case 'date-time':
      return z.string().regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,
        'Invalid datetime format (expected ISO 8601)'
      );
    case 'email':
      return z.string().email('Invalid email address');
    case 'uri':
      return z.string().url('Invalid URL');
    case 'uuid':
      return z.string().uuid('Invalid UUID');
    default:
      return z.string();
  }
}

/**
 * Applies length constraints to a string validator.
 */
function applyLengthConstraints(
  validator: z.ZodString,
  minLength: number | undefined,
  maxLength: number | undefined
): z.ZodString {
  let result = validator;
  if (minLength !== undefined) {
    result = result.min(minLength, `Must be at least ${minLength} characters`);
  }
  if (maxLength !== undefined) {
    result = result.max(maxLength, `Must be at most ${maxLength} characters`);
  }
  return result;
}

/**
 * Builds a string validator with format hints and constraints.
 */
function buildStringValidator(property: SchemaProperty): z.ZodType {
  // Handle enum constraint first (takes precedence)
  if (property.enum && property.enum.length > 0) {
    const enumValues = property.enum.filter((v): v is string => typeof v === 'string');
    if (enumValues.length > 0) {
      return z.string().refine((val) => enumValues.includes(val), `Must be one of: ${enumValues.join(', ')}`);
    }
  }

  // Handle pattern constraint
  if (property.pattern) {
    try {
      const regex = new RegExp(property.pattern);
      return z.string().regex(regex, 'Does not match required pattern');
    } catch {
      console.warn(`[schema] Invalid regex pattern: ${property.pattern}`);
    }
  }

  // Handle format with optional length constraints
  if (property.format) {
    let validator = createFormatValidator(property.format);
    if (property.minLength !== undefined || property.maxLength !== undefined) {
      const lengthValidator = applyLengthConstraints(z.string(), property.minLength, property.maxLength);
      validator = lengthValidator.and(validator);
    }
    return validator;
  }

  // Handle length-only constraints
  if (property.minLength !== undefined || property.maxLength !== undefined) {
    return applyLengthConstraints(z.string(), property.minLength, property.maxLength);
  }

  return z.string();
}

/**
 * Builds a number validator with constraints.
 */
function buildNumberValidator(property: SchemaProperty): z.ZodType {
  let numberValidator = z.number();

  // Apply minimum constraint
  if (property.minimum !== undefined) {
    numberValidator = numberValidator.min(
      property.minimum,
      `Must be at least ${property.minimum}`
    );
  }

  // Apply maximum constraint
  if (property.maximum !== undefined) {
    numberValidator = numberValidator.max(
      property.maximum,
      `Must be at most ${property.maximum}`
    );
  }

  // Apply enum constraint for numbers
  if (property.enum && property.enum.length > 0) {
    const enumValues = property.enum.filter(
      (v): v is number => typeof v === 'number'
    );
    if (enumValues.length > 0) {
      return numberValidator.refine(
        (val) => enumValues.includes(val),
        `Must be one of: ${enumValues.join(', ')}`
      );
    }
  }

  return numberValidator;
}

/**
 * Builds an array validator with item schema.
 */
function buildArrayValidator(property: SchemaProperty): z.ZodType {
  // If items schema is defined, use it
  if (property.items) {
    const itemValidator = schemaPropertyToZod(property.items);
    return z.array(itemValidator);
  }

  // Default to array of unknown
  return z.array(z.unknown());
}

/**
 * Builds an object validator with nested properties.
 */
function buildObjectValidator(property: SchemaProperty): z.ZodType {
  // If properties are defined, build a shape
  if (property.properties && Object.keys(property.properties).length > 0) {
    const shape: Record<string, z.ZodType> = {};

    for (const [key, propSchema] of Object.entries(property.properties)) {
      shape[key] = schemaPropertyToZod(propSchema);
    }

    return z.object(shape).passthrough();
  }

  // Default to record of unknown
  return z.record(z.unknown());
}

/**
 * Creates a complete zod validator for a frontmatter schema.
 * Includes required field validation.
 *
 * @param schema - Frontmatter schema
 * @returns Zod object validator
 */
export function schemaToZodValidator(
  schema: FrontmatterSchema
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType> = {};

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    let fieldValidator = schemaPropertyToZod(propSchema);

    // Make required fields non-optional
    if (!schema.required.includes(key)) {
      fieldValidator = fieldValidator.optional();
    }

    shape[key] = fieldValidator;
  }

  return z.object(shape).passthrough();
}

/**
 * Validates a frontmatter field value against its schema property.
 *
 * @param value - Value to validate
 * @param property - Schema property definition
 * @returns ValidationResult with errors if invalid
 */
export function validateFieldValue(
  value: unknown,
  property: SchemaProperty
): ValidationResult {
  const validator = schemaPropertyToZod(property);
  const result = validator.safeParse(value);

  if (result.success) {
    return VALID_RESULT;
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      code: 'INVALID_FORMAT' as const,
      message: issue.message,
      path: issue.path.map(String),
    })),
    warnings: [],
  };
}

// =============================================================================
// SCHEMA HELPERS
// =============================================================================

/**
 * Gets suggested fields from a schema (fields with x-frontmatter.suggested: true).
 *
 * @param schema - Frontmatter schema
 * @returns Array of field names that are suggested
 */
export function getSuggestedFields(schema: FrontmatterSchema): string[] {
  return Object.entries(schema.properties)
    .filter(([, prop]) => prop['x-frontmatter']?.suggested === true)
    .sort((a, b) => {
      const orderA = a[1]['x-frontmatter']?.order ?? 100;
      const orderB = b[1]['x-frontmatter']?.order ?? 100;
      return orderA - orderB;
    })
    .map(([name]) => name);
}

/**
 * Gets fields sorted by display order from schema.
 *
 * @param schema - Frontmatter schema
 * @param fieldNames - Field names to sort
 * @returns Sorted field names based on x-frontmatter.order
 */
export function sortFieldsBySchemaOrder(
  schema: FrontmatterSchema,
  fieldNames: string[]
): string[] {
  return [...fieldNames].sort((a, b) => {
    const orderA = schema.properties[a]?.['x-frontmatter']?.order ?? 100;
    const orderB = schema.properties[b]?.['x-frontmatter']?.order ?? 100;
    return orderA - orderB;
  });
}

/**
 * Gets the placeholder text for a field from its schema.
 *
 * @param schema - Frontmatter schema
 * @param fieldName - Field name
 * @returns Placeholder text or undefined
 */
export function getFieldPlaceholder(
  schema: FrontmatterSchema,
  fieldName: string
): string | undefined {
  return schema.properties[fieldName]?.['x-frontmatter']?.placeholder;
}

/**
 * Checks if a field is hidden from the visual editor.
 *
 * @param schema - Frontmatter schema
 * @param fieldName - Field name
 * @returns True if field should be hidden in visual mode
 */
export function isFieldHidden(
  schema: FrontmatterSchema,
  fieldName: string
): boolean {
  return schema.properties[fieldName]?.['x-frontmatter']?.hidden === true;
}

/**
 * Gets the description for a field from its schema.
 *
 * @param schema - Frontmatter schema
 * @param fieldName - Field name
 * @returns Description string or undefined
 */
export function getFieldDescription(
  schema: FrontmatterSchema,
  fieldName: string
): string | undefined {
  return schema.properties[fieldName]?.description;
}
