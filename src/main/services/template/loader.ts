/**
 * Template Loading and Lookup
 *
 * Feature: 016-template-library
 *
 * Loads templates from file system and finds templates by ID.
 *
 * @module template/loader
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import matter from 'gray-matter';

import type { TemplateMetadata } from '@shared/contracts/template-schemas';
import { getBuiltinTemplatesPath, getCustomTemplatesPath } from './paths';
import { parseTemplateMetadataFile, slugify } from './parser';

/**
 * Loads all .mdxt files from a directory as metadata.
 */
export async function loadTemplatesFromDir(
  dirPath: string,
  isBuiltIn: boolean
): Promise<TemplateMetadata[]> {
  try {
    const files = await fs.readdir(dirPath);
    const mdxtFiles = files.filter((f) => f.endsWith('.mdxt'));
    const templates: TemplateMetadata[] = [];

    for (const file of mdxtFiles) {
      try {
        const filePath = path.join(dirPath, file);
        const metadata = await parseTemplateMetadataFile(filePath, isBuiltIn);
        templates.push(metadata);
      } catch (err) {
        console.warn(`[TemplateService] Failed to parse ${file}:`, err);
      }
    }

    return templates;
  } catch {
    return [];
  }
}

/**
 * Loads all built-in templates.
 */
export async function loadBuiltinTemplates(): Promise<TemplateMetadata[]> {
  const builtinPath = getBuiltinTemplatesPath();
  return loadTemplatesFromDir(builtinPath, true);
}

/**
 * Loads all custom templates.
 */
export async function loadCustomTemplates(): Promise<TemplateMetadata[]> {
  const customPath = getCustomTemplatesPath();
  return loadTemplatesFromDir(customPath, false);
}

/**
 * Finds a template file by ID in a specific directory.
 */
async function findTemplateInDir(
  dirPath: string,
  id: string
): Promise<string | null> {
  try {
    const files = await fs.readdir(dirPath);
    const mdxtFiles = files.filter((f) => f.endsWith('.mdxt'));

    for (const file of mdxtFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const { data: frontmatter } = matter(content);
        const templateId = (frontmatter.id as string | undefined) ??
          slugify(frontmatter.name as string);
        if (templateId === id) {
          return filePath;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Finds a template file by ID in both built-in and custom directories.
 */
export async function findTemplateById(
  id: string
): Promise<{ filePath: string; isBuiltIn: boolean } | null> {
  // Check built-in templates
  const builtinPath = getBuiltinTemplatesPath();
  const builtinResult = await findTemplateInDir(builtinPath, id);
  if (builtinResult) {
    return { filePath: builtinResult, isBuiltIn: true };
  }

  // Check custom templates
  const customPath = getCustomTemplatesPath();
  const customResult = await findTemplateInDir(customPath, id);
  if (customResult) {
    return { filePath: customResult, isBuiltIn: false };
  }

  return null;
}
