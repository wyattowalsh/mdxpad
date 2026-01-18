/**
 * Template Parser Library
 *
 * Feature: 016-template-library
 * Phase: 3 - Implementation
 *
 * Parses .mdxt template files with YAML frontmatter and validates
 * against zod schemas. Supports both built-in and custom templates.
 *
 * @module template-parser
 */

import matter from 'gray-matter';
import {
  TemplateSchema,
  TemplateMetadataSchema,
  type Template,
  type TemplateMetadata,
} from '@shared/contracts/template-schemas';

/**
 * Error thrown when template parsing fails
 */
export class TemplateParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: unknown
  ) {
    super(`Failed to parse template at ${filePath}: ${message}`);
    this.name = 'TemplateParseError';
  }
}

/**
 * Generates a URL-safe slug from a template name
 *
 * @param name - The template display name
 * @returns Slugified string suitable for use as an ID
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parses a .mdxt file and returns full Template data
 *
 * @param filePath - Absolute path to the .mdxt file
 * @param content - Raw file content (frontmatter + MDX)
 * @param isBuiltIn - True if template is bundled with app
 * @returns Validated Template object
 * @throws TemplateParseError if parsing or validation fails
 */
export function parseTemplate(
  filePath: string,
  content: string,
  isBuiltIn: boolean
): Template {
  const { frontmatter, mdxContent } = extractFrontmatter(filePath, content);
  const now = new Date();

  const templateData = {
    ...frontmatter,
    id: (frontmatter.id as string | undefined) ?? slugify(frontmatter.name as string),
    isBuiltIn,
    content: mdxContent,
    filePath,
    createdAt: now,
    updatedAt: now,
  };

  return validateTemplate(filePath, templateData);
}

/**
 * Parses a .mdxt file and returns only metadata (no content)
 *
 * @param filePath - Absolute path to the .mdxt file
 * @param content - Raw file content (frontmatter + MDX)
 * @param isBuiltIn - True if template is bundled with app
 * @returns Validated TemplateMetadata object
 * @throws TemplateParseError if parsing or validation fails
 */
export function parseTemplateMetadata(
  filePath: string,
  content: string,
  isBuiltIn: boolean
): TemplateMetadata {
  const { frontmatter } = extractFrontmatter(filePath, content);

  const metadataData = {
    ...frontmatter,
    id: (frontmatter.id as string | undefined) ?? slugify(frontmatter.name as string),
    isBuiltIn,
  };

  return validateMetadata(filePath, metadataData);
}

/**
 * Extracts frontmatter and content from raw file content
 *
 * @param filePath - File path for error messages
 * @param content - Raw file content
 * @returns Parsed frontmatter object and MDX content string
 * @throws TemplateParseError if frontmatter parsing fails
 */
function extractFrontmatter(
  filePath: string,
  content: string
): { frontmatter: Record<string, unknown>; mdxContent: string } {
  try {
    const { data, content: mdxContent } = matter(content);
    return { frontmatter: data, mdxContent: mdxContent.trim() };
  } catch (error) {
    throw new TemplateParseError(
      'Invalid YAML frontmatter',
      filePath,
      error
    );
  }
}

/**
 * Validates template data against TemplateSchema
 *
 * @param filePath - File path for error messages
 * @param data - Raw template data to validate
 * @returns Validated Template
 * @throws TemplateParseError if validation fails
 */
function validateTemplate(
  filePath: string,
  data: Record<string, unknown>
): Template {
  try {
    return TemplateSchema.parse(data);
  } catch (error) {
    const message = formatValidationError(error);
    throw new TemplateParseError(message, filePath, error);
  }
}

/**
 * Validates metadata against TemplateMetadataSchema
 *
 * @param filePath - File path for error messages
 * @param data - Raw metadata to validate
 * @returns Validated TemplateMetadata
 * @throws TemplateParseError if validation fails
 */
function validateMetadata(
  filePath: string,
  data: Record<string, unknown>
): TemplateMetadata {
  try {
    return TemplateMetadataSchema.parse(data);
  } catch (error) {
    const message = formatValidationError(error);
    throw new TemplateParseError(message, filePath, error);
  }
}

/**
 * Formats a zod validation error into a readable message
 *
 * @param error - Error from zod validation
 * @returns Human-readable error message
 */
function formatValidationError(error: unknown): string {
  if (error instanceof Error && 'issues' in error) {
    const zodError = error as { issues: { path: (string | number)[]; message: string }[] };
    const issues = zodError.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    return `Validation failed: ${issues}`;
  }
  return error instanceof Error ? error.message : 'Unknown validation error';
}
