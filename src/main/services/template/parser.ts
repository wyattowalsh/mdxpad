/**
 * Template Parsing
 *
 * Feature: 016-template-library
 *
 * Parses .mdxt template files with YAML frontmatter.
 *
 * @module template/parser
 */

import { constants as fsConstants } from 'node:fs';
import * as fs from 'node:fs/promises';
import matter from 'gray-matter';

import {
  TemplateSchema,
  TemplateMetadataSchema,
  type Template,
  type TemplateMetadata,
} from '@shared/contracts/template-schemas';

function linkOpenError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === 'ELOOP' || code === 'EINVAL' || code === 'EPERM';
}

export async function readTemplateSource(filePath: string): Promise<{
  content: string;
  birthtime: Date;
  mtime: Date;
}> {
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile()) {
      throw new Error('Template file is a link');
    }
    const content = await handle.readFile({ encoding: 'utf8' });
    return { content, birthtime: info.birthtime, mtime: info.mtime };
  } catch (error) {
    if (error instanceof Error && error.message === 'Template file is a link') {
      throw error;
    }
    if (linkOpenError(error)) {
      throw new Error('Template file is a link');
    }
    throw error;
  } finally {
    await handle?.close();
  }
}

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
export async function parseTemplateFile(filePath: string, isBuiltIn: boolean): Promise<Template> {
  const source = await readTemplateSource(filePath);
  const { data: frontmatter, content: mdxContent } = matter(source.content);

  const templateData = {
    ...frontmatter,
    id: (frontmatter.id as string | undefined) ?? slugify(frontmatter.name as string),
    isBuiltIn,
    content: mdxContent.trim(),
    filePath,
    createdAt: source.birthtime,
    updatedAt: source.mtime,
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
  const source = await readTemplateSource(filePath);
  const { data: frontmatter } = matter(source.content);

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
  variables?: {
    name: string;
    description?: string | undefined;
    default?: string | undefined;
    required?: boolean;
  }[];
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
export function substituteVariables(content: string, values: Record<string, string>): string {
  const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;
  return content.replace(VARIABLE_REGEX, (match, name: string) => {
    return values[name] ?? match;
  });
}
