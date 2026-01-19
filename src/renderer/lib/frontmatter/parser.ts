/**
 * Frontmatter YAML Parser
 *
 * @module renderer/lib/frontmatter/parser
 * @description Parses and serializes YAML frontmatter with formatting preservation.
 * Uses the yaml package for round-trip parsing that maintains indentation and style.
 */

import { parseDocument, stringify, Document, YAMLParseError } from 'yaml';
import type {
  FrontmatterData,
  FrontmatterField,
  FrontmatterParseError,
  FrontmatterDelimiterError,
  FieldValue,
  YamlFormatOptions,
} from '@shared/types/frontmatter';
import {
  DEFAULT_YAML_FORMAT_OPTIONS,
  VALID_RESULT,
} from '@shared/types/frontmatter';
import { inferFieldType } from './type-inference';

/** Regex to match frontmatter delimiters */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

/** Regex to detect opening delimiter only */
const OPENING_DELIMITER_REGEX = /^---\r?\n/;

/** Regex to detect closing delimiter */
const CLOSING_DELIMITER_REGEX = /\r?\n---(\r?\n|$)/;

/**
 * Detects YAML format options from raw YAML content
 */
function detectFormatOptions(rawYaml: string): YamlFormatOptions {
  // Detect indentation by finding first indented line
  const lines = rawYaml.split('\n');
  let indent = 2; // default

  for (const line of lines) {
    const match = /^(\s+)\S/.exec(line);
    if (match?.[0] !== undefined && match[1] !== undefined) {
      indent = match[1].length;
      break;
    }
  }

  return {
    indent,
    defaultQuoteStyle: 'plain',
    lineWidth: 80,
  };
}

/** Regex to detect YAML anchors (&anchor_name) */
const ANCHOR_REGEX = /&[\w-]+/;

/** Regex to detect YAML aliases (*alias_name) */
const ALIAS_REGEX = /\*[\w-]+/;

/** Regex to detect custom YAML tags (!tag) */
const CUSTOM_TAG_REGEX = /^![\w-]+/;

/** Regex to detect multi-line block scalars (| or >) */
const BLOCK_SCALAR_REGEX = /^[|>][+-]?\s*$/;

/**
 * Checks for unsupported YAML features:
 * - Anchors (&anchor_name)
 * - Aliases (*alias_name)
 * - Custom tags (!tag)
 * - Complex multi-line strings (| or >)
 *
 * @param doc - Parsed YAML document
 * @param rawYaml - Raw YAML string for regex-based detection
 * @returns Object with hasUnsupported flag and list of affected field names
 */
function detectUnsupportedFeatures(
  doc: Document,
  rawYaml: string
): { hasUnsupported: boolean; fieldNames: string[]; reasons: string[] } {
  const fieldNames: string[] = [];
  const reasons: string[] = [];
  let hasUnsupported = false;

  // Check for anchors and aliases using regex on raw YAML
  // This is more reliable than AST traversal for these features
  const lines = rawYaml.split('\n');

  for (const line of lines) {
    // Detect anchors
    if (ANCHOR_REGEX.exec(line)) {
      hasUnsupported = true;
      if (!reasons.includes('anchors')) {
        reasons.push('anchors');
      }
      // Try to extract field name (key before the anchor)
      const keyMatch = /^(\s*)(\w+):/.exec(line);
      if (keyMatch?.[2] && !fieldNames.includes(keyMatch[2])) {
        fieldNames.push(keyMatch[2]);
      }
    }

    // Detect aliases
    if (ALIAS_REGEX.exec(line)) {
      hasUnsupported = true;
      if (!reasons.includes('aliases')) {
        reasons.push('aliases');
      }
      // Try to extract field name
      const keyMatch = /^(\s*)(\w+):/.exec(line);
      if (keyMatch?.[2] && !fieldNames.includes(keyMatch[2])) {
        fieldNames.push(keyMatch[2]);
      }
    }

    // Detect custom tags (but not standard YAML tags)
    const tagMatch = /^(\s*)(\w+):\s*(![\w-]+)/.exec(line);
    if (tagMatch?.[3] && CUSTOM_TAG_REGEX.exec(tagMatch[3])) {
      hasUnsupported = true;
      if (!reasons.includes('custom tags')) {
        reasons.push('custom tags');
      }
      if (tagMatch[2] && !fieldNames.includes(tagMatch[2])) {
        fieldNames.push(tagMatch[2]);
      }
    }

    // Detect block scalars (| or >)
    const blockMatch = /^(\s*)(\w+):\s*([|>][+-]?)\s*$/.exec(line);
    if (blockMatch?.[3] && BLOCK_SCALAR_REGEX.exec(blockMatch[3])) {
      hasUnsupported = true;
      if (!reasons.includes('multi-line block strings')) {
        reasons.push('multi-line block strings');
      }
      if (blockMatch[2] && !fieldNames.includes(blockMatch[2])) {
        fieldNames.push(blockMatch[2]);
      }
    }
  }

  // Also check AST for anchors and aliases that might not be caught by regex
  const contents = doc.contents;
  if (contents && 'items' in contents) {
    for (const item of (contents as { items: unknown[] }).items) {
      if (item && typeof item === 'object') {
        const pair = item as {
          key?: { value?: string };
          value?: { anchor?: string; source?: string; tag?: string };
        };

        // Check for anchors
        if (pair.value?.anchor) {
          hasUnsupported = true;
          if (!reasons.includes('anchors')) {
            reasons.push('anchors');
          }
          if (pair.key?.value && !fieldNames.includes(pair.key.value)) {
            fieldNames.push(pair.key.value);
          }
        }

        // Check for aliases (source indicates alias reference)
        if (pair.value?.source) {
          hasUnsupported = true;
          if (!reasons.includes('aliases')) {
            reasons.push('aliases');
          }
          if (pair.key?.value && !fieldNames.includes(pair.key.value)) {
            fieldNames.push(pair.key.value);
          }
        }

        // Check for custom tags
        if (pair.value?.tag && CUSTOM_TAG_REGEX.test(pair.value.tag)) {
          hasUnsupported = true;
          if (!reasons.includes('custom tags')) {
            reasons.push('custom tags');
          }
          if (pair.key?.value && !fieldNames.includes(pair.key.value)) {
            fieldNames.push(pair.key.value);
          }
        }
      }
    }
  }

  return { hasUnsupported, fieldNames, reasons };
}

/**
 * Converts parsed YAML data to FrontmatterField array
 */
function dataToFields(
  data: Record<string, unknown>,
  parentPath: readonly string[] = []
): FrontmatterField[] {
  const fields: FrontmatterField[] = [];
  let order = 0;

  for (const [name, value] of Object.entries(data)) {
    const path = [...parentPath, name];
    const type = inferFieldType(value);

    fields.push({
      name,
      value: value as FieldValue,
      type,
      validation: VALID_RESULT,
      path,
      isFromSchema: false,
      order: order++,
    });
  }

  return fields;
}

/** Regex to detect YAML document end marker (...) used as closing delimiter */
const YAML_DOC_END_REGEX = /\r?\n\.\.\.(\r?\n|$)/;

/**
 * Checks for delimiter errors in document content:
 * - Missing opening `---`
 * - Missing closing `---`
 * - Mismatched delimiters (`---` vs `...`)
 *
 * @param content - Full document content
 * @returns Delimiter error with suggested fix, or null if valid
 */
function checkDelimiterErrors(content: string): FrontmatterDelimiterError | null {
  const hasOpening = OPENING_DELIMITER_REGEX.test(content);
  const hasClosing = CLOSING_DELIMITER_REGEX.test(content);
  const hasYamlDocEnd = YAML_DOC_END_REGEX.test(content);

  // Check for mismatched delimiters (--- opening, ... closing)
  if (hasOpening && !hasClosing && hasYamlDocEnd) {
    // Replace ... with --- for consistency
    const fixedContent = content.replace(/\r?\n\.\.\.(\r?\n|$)/, '\n---$1');
    return {
      type: 'mismatched',
      message: 'Mismatched frontmatter delimiters (--- and ...)',
      suggestedFix: fixedContent,
    };
  }

  if (!hasOpening && hasClosing) {
    return {
      type: 'missing_opening',
      message: 'Missing opening frontmatter delimiter (---)',
      suggestedFix: `---\n${content}`,
    };
  }

  if (hasOpening && !hasClosing) {
    // Find where the frontmatter content ends (first blank line or content start)
    const lines = content.split('\n');
    let endIndex = lines.length;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      // End at first line that looks like content (not a YAML key-value)
      if (line.trim() === '' || (!line.includes(':') && !line.startsWith(' ') && !line.startsWith('-'))) {
        endIndex = i;
        break;
      }
    }

    const frontmatterLines = lines.slice(0, endIndex);
    const contentLines = lines.slice(endIndex);

    return {
      type: 'missing_closing',
      message: 'Missing closing frontmatter delimiter (---)',
      suggestedFix: `${frontmatterLines.join('\n')}\n---\n${contentLines.join('\n')}`,
    };
  }

  return null;
}

/**
 * Parses frontmatter from document content
 *
 * @param content - Full document content
 * @returns Parsed frontmatter data with fields, validation, and format options
 */
export function parseFrontmatter(content: string): FrontmatterData {
  // Check for delimiter errors first
  const delimiterError = checkDelimiterErrors(content);

  const match = FRONTMATTER_REGEX.exec(content);

  if (!match) {
    return {
      fields: [],
      rawYaml: '',
      parseError: null,
      exists: false,
      formatOptions: DEFAULT_YAML_FORMAT_OPTIONS,
      hasUnsupportedFeatures: false,
      unsupportedFieldNames: [],
      unsupportedReasons: [],
      delimiterError,
    };
  }

  const rawYaml = match[1] ?? '';

  try {
    const doc = parseDocument(rawYaml);
    const formatOptions = detectFormatOptions(rawYaml);
    const { hasUnsupported, fieldNames, reasons } = detectUnsupportedFeatures(doc, rawYaml);

    // Handle parse errors from yaml library
    if (doc.errors.length > 0) {
      const firstError = doc.errors[0];
      if (firstError) {
        const parseError: FrontmatterParseError = {
          message: firstError.message,
          line: firstError.linePos?.[0]?.line ?? 1,
          column: firstError.linePos?.[0]?.col ?? 1,
        };

        return {
          fields: [],
          rawYaml,
          parseError,
          exists: true,
          formatOptions,
          hasUnsupportedFeatures: hasUnsupported,
          unsupportedFieldNames: fieldNames,
          unsupportedReasons: reasons,
          delimiterError: null,
        };
      }
    }

    const data = doc.toJS() as Record<string, unknown> | null;

    // Handle empty frontmatter
    if (data === null || typeof data !== 'object') {
      return {
        fields: [],
        rawYaml,
        parseError: null,
        exists: true,
        formatOptions,
        hasUnsupportedFeatures: false,
        unsupportedFieldNames: [],
        unsupportedReasons: [],
        delimiterError: null,
      };
    }

    const fields = dataToFields(data);

    return {
      fields,
      rawYaml,
      parseError: null,
      exists: true,
      formatOptions,
      hasUnsupportedFeatures: hasUnsupported,
      unsupportedFieldNames: fieldNames,
      unsupportedReasons: reasons,
      delimiterError: null,
    };
  } catch (error) {
    const yamlError = error as YAMLParseError;
    const parseError: FrontmatterParseError = {
      message: yamlError.message ?? 'Unknown parse error',
      line: yamlError.linePos?.[0]?.line ?? 1,
      column: yamlError.linePos?.[0]?.col ?? 1,
    };

    return {
      fields: [],
      rawYaml,
      parseError,
      exists: true,
      formatOptions: DEFAULT_YAML_FORMAT_OPTIONS,
      hasUnsupportedFeatures: false,
      unsupportedFieldNames: [],
      unsupportedReasons: [],
      delimiterError: null,
    };
  }
}

/**
 * Converts FrontmatterField array back to plain object
 */
function fieldsToData(fields: readonly FrontmatterField[]): Record<string, FieldValue> {
  const data: Record<string, FieldValue> = {};

  for (const field of fields) {
    // Only handle top-level fields here
    if (field.path.length === 1) {
      data[field.name] = field.value;
    }
  }

  return data;
}

/**
 * Serializes frontmatter data to YAML string
 *
 * @param data - Frontmatter data to serialize
 * @returns YAML string without delimiters
 */
export function serializeFrontmatter(data: FrontmatterData): string {
  if (!data.exists || data.fields.length === 0) {
    return '';
  }

  const obj = fieldsToData(data.fields);

  return stringify(obj, {
    indent: data.formatOptions.indent,
    lineWidth: data.formatOptions.lineWidth,
    defaultStringType: data.formatOptions.defaultQuoteStyle === 'single'
      ? 'QUOTE_SINGLE'
      : data.formatOptions.defaultQuoteStyle === 'double'
        ? 'QUOTE_DOUBLE'
        : 'PLAIN',
  }).trim();
}

/**
 * Wraps YAML content with frontmatter delimiters
 *
 * @param yaml - YAML content without delimiters
 * @returns Complete frontmatter block with delimiters
 */
export function wrapWithDelimiters(yaml: string): string {
  if (!yaml.trim()) {
    return '';
  }
  return `---\n${yaml}\n---`;
}

/**
 * Extracts frontmatter YAML from document, returning raw string
 *
 * @param content - Full document content
 * @returns Raw YAML string or empty string if no frontmatter
 */
export function extractRawFrontmatter(content: string): string {
  const match = FRONTMATTER_REGEX.exec(content);
  return match?.[1] ?? '';
}

/**
 * Replaces frontmatter in document content
 *
 * @param content - Original document content
 * @param newYaml - New YAML content (without delimiters)
 * @returns Updated document content
 */
export function replaceFrontmatter(content: string, newYaml: string): string {
  const match = FRONTMATTER_REGEX.exec(content);

  if (!match) {
    // No existing frontmatter - add at beginning
    if (!newYaml.trim()) {
      return content;
    }
    return `${wrapWithDelimiters(newYaml)}\n\n${content}`;
  }

  // Replace existing frontmatter
  if (!newYaml.trim()) {
    // Remove frontmatter entirely
    return content.replace(FRONTMATTER_REGEX, '').replace(/^\n+/, '');
  }

  return content.replace(FRONTMATTER_REGEX, wrapWithDelimiters(newYaml));
}

/**
 * Validates YAML syntax without full parsing
 *
 * @param yaml - YAML string to validate
 * @returns Parse error or null if valid
 */
export function validateYamlSyntax(yaml: string): FrontmatterParseError | null {
  try {
    const doc = parseDocument(yaml);
    if (doc.errors.length > 0) {
      const firstError = doc.errors[0];
      if (firstError) {
        return {
          message: firstError.message,
          line: firstError.linePos?.[0]?.line ?? 1,
          column: firstError.linePos?.[0]?.col ?? 1,
        };
      }
    }
    return null;
  } catch (error) {
    const yamlError = error as YAMLParseError;
    return {
      message: yamlError.message ?? 'Unknown parse error',
      line: yamlError.linePos?.[0]?.line ?? 1,
      column: yamlError.linePos?.[0]?.col ?? 1,
    };
  }
}

// Re-export constants for convenience
export { DEFAULT_YAML_FORMAT_OPTIONS } from '@shared/types/frontmatter';
