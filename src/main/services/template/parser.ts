/**
 * Template Parsing
 *
 * Feature: 016-template-library
 *
 * Parses .mdxt template files with YAML frontmatter.
 *
 * @module template/parser
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import matter from 'gray-matter';

import {
  TemplateSchema,
  TemplateMetadataSchema,
  type Template,
  type TemplateMetadata,
} from '@shared/contracts/template-schemas';

/**
 * Generates a URL-safe slug from a template name.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parses a .mdxt file and returns full Template data.
 */
export async function parseTemplateFile(
  filePath: string,
  isBuiltIn: boolean
): Promise<Template> {
  const content = await fs.readFile(filePath, 'utf-8');
  const { data: frontmatter, content: mdxContent } = matter(content);
  const stats = await fs.stat(filePath);

  const templateData = {
    ...frontmatter,
    id: (frontmatter.id as string | undefined) ?? slugify(frontmatter.name as string),
    isBuiltIn,
    content: mdxContent.trim(),
    filePath,
    createdAt: stats.birthtime,
    updatedAt: stats.mtime,
  };

  return TemplateSchema.parse(templateData);
}

/**
 * Parses a .mdxt file and returns only metadata (no content).
 */
export async function parseTemplateMetadataFile(
  filePath: string,
  isBuiltIn: boolean
): Promise<TemplateMetadata> {
  const content = await fs.readFile(filePath, 'utf-8');
  const { data: frontmatter } = matter(content);

  const metadataData = {
    ...frontmatter,
    id: (frontmatter.id as string | undefined) ?? slugify(frontmatter.name as string),
    isBuiltIn,
  };

  return TemplateMetadataSchema.parse(metadataData);
}

/**
 * Builds a .mdxt file content from template data.
 */
export function buildTemplateFile(template: {
  name: string;
  description: string;
  category: string;
  tags: string[];
  variables?: Array<{
    name: string;
    description?: string | undefined;
    default?: string | undefined;
    required?: boolean;
  }>;
  content: string;
}): string {
  const frontmatter: Record<string, unknown> = {
    name: template.name,
    description: template.description,
    category: template.category,
    tags: template.tags,
    version: '1.0.0',
  };

  if (template.variables && template.variables.length > 0) {
    frontmatter.variables = template.variables;
  }

  const yamlContent = matter.stringify(template.content, frontmatter);
  return yamlContent;
}

/**
 * Substitutes variables in template content.
 */
export function substituteVariables(
  content: string,
  values: Record<string, string>
): string {
  const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;
  return content.replace(VARIABLE_REGEX, (match, name: string) => {
    return values[name] ?? match;
  });
}
