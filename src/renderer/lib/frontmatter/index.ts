/**
 * Frontmatter Library
 *
 * @module renderer/lib/frontmatter
 * @description Public exports for frontmatter parsing, serialization, and type inference.
 */

// Parser exports
export {
  parseFrontmatter,
  serializeFrontmatter,
  wrapWithDelimiters,
  extractRawFrontmatter,
  replaceFrontmatter,
  validateYamlSyntax,
  DEFAULT_YAML_FORMAT_OPTIONS,
} from './parser';

// Type inference exports
export {
  inferFieldType,
  valueMatchesType,
  convertToType,
  getDefaultValue,
  inferTypesForObject,
  isEmptyValue,
} from './type-inference';

// Sync exports
export {
  debounce,
  createSourceAwareHandler,
  createSyncManager,
  createSubscription,
  DEFAULT_DEBOUNCE_MS,
  type DebouncedFunction,
  type SyncManagerOptions,
  type SyncManager,
} from './sync';

// Validation exports
export {
  validateField,
  validateRequired,
  validateDate,
  validateNumber,
  validateString,
  validateArray,
  validateBoolean,
  validateWithZod,
  validateAllFields,
  schemaPropertyToZod,
  getValidationErrorCount,
  hasValidationErrors,
} from './validation';

// Re-export types for convenience
export type {
  FieldType,
  FieldValue,
  FrontmatterData,
  FrontmatterField,
  FrontmatterParseError,
  FrontmatterDelimiterError,
  YamlFormatOptions,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  FrontmatterSchema,
  SchemaProperty,
  CommonFieldSuggestion,
} from '@shared/types/frontmatter';

// Schema exports
export {
  loadSchemaFromFile,
  loadSchemaForWorkspace,
  validateSchemaFile,
  parseSchemaFile,
  schemaToZodValidator,
  validateFieldValue,
  getSuggestedFields,
  sortFieldsBySchemaOrder,
  getFieldPlaceholder,
  isFieldHidden,
  getFieldDescription,
  getWorkspaceRoot,
  getSchemaPath,
  clearSchemaCache,
  SCHEMA_FILENAME,
  SCHEMA_LOAD_TIMEOUT_MS,
} from './schema';

// Re-export constants
export {
  COMMON_FIELDS,
  FIELD_TYPE_CONFIG,
  EMPTY_FRONTMATTER_DATA,
  EMPTY_SCHEMA,
  VALID_RESULT,
} from '@shared/types/frontmatter';
