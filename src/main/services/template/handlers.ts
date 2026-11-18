/**
 * Template IPC Handlers
 *
 * Feature: 016-template-library
 *
 * IPC handler implementations for template operations.
 *
 * @module template/handlers
 * @see Constitution §III.3 - All payloads validated with zod safeParse()
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import matter from 'gray-matter';
import { compile } from '@mdx-js/mdx';
import { dialog } from 'electron';

import {
  TemplateListRequestSchema,
  TemplateGetRequestSchema,
  TemplateSaveRequestSchema,
  TemplateDeleteRequestSchema,
  TemplateImportRequestSchema,
  TemplateExportRequestSchema,
  TemplateValidateRequestSchema,
  CreateFromTemplateRequestSchema,
  TemplateOpenDialogRequestSchema,
  TemplateSaveDialogRequestSchema,
  type Template,
  type TemplateMetadata,
  type TemplateListResponse,
  type TemplateGetResponse,
  type TemplateSaveResponse,
  type TemplateDeleteResponse,
  type TemplateImportResponse,
  type TemplateExportResponse,
  type TemplateValidateResponse,
  type CreateFromTemplateResponse,
  type TemplateOpenDialogResponse,
  type TemplateSaveDialogResponse,
  type TemplateErrorResponse,
} from '@shared/contracts/template-schemas';

import { prepareRegularOutput, writeRegularFile } from '../export-formats/write-regular-file';
import { getCustomTemplatesPath, ensureCustomTemplatesDir, fileExists } from './paths';
import {
  validationError,
  notFoundError,
  permissionError,
  fileError,
  parseError,
  alreadyExistsError,
} from './errors';
import { parseTemplateFile, buildTemplateFile, substituteVariables, slugify } from './parser';
import { loadBuiltinTemplates, loadCustomTemplates, findTemplateById } from './loader';
import { rememberChosenTemplatePath, unchosenTemplatePathError } from './template-scope';

// =============================================================================
// Types
// =============================================================================

type TemplateResponse<T> = T | TemplateErrorResponse;

// =============================================================================
// IPC Handlers
// =============================================================================

/**
 * Handler for template:list - loads and returns all template metadata.
 */
export async function handleTemplateList(
  payload: unknown
): Promise<TemplateResponse<TemplateListResponse>> {
  const result = TemplateListRequestSchema.safeParse(payload);
  if (!result.success) {
    return validationError(result.error.message);
  }

  const { source } = result.data;
  let templates: TemplateMetadata[] = [];

  if (source === 'all' || source === 'builtin') {
    const builtin = await loadBuiltinTemplates();
    templates = templates.concat(builtin);
  }

  if (source === 'all' || source === 'custom') {
    const custom = await loadCustomTemplates();
    templates = templates.concat(custom);
  }

  return { success: true, templates };
}

/**
 * Handler for template:get - gets single template with full content by ID.
 */
export async function handleTemplateGet(
  payload: unknown
): Promise<TemplateResponse<TemplateGetResponse>> {
  const result = TemplateGetRequestSchema.safeParse(payload);
  if (!result.success) {
    return validationError(result.error.message);
  }

  const { id } = result.data;

  // SEC-3: Validate template ID to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return validationError(
      'Invalid template ID: must contain only alphanumeric, dash, or underscore'
    );
  }

  const found = await findTemplateById(id);

  if (!found) {
    return notFoundError(`Template with ID "${id}" not found`);
  }

  try {
    const template = await parseTemplateFile(found.filePath, found.isBuiltIn);
    return { success: true, template };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return parseError(`Failed to parse template: ${msg}`);
  }
}

/**
 * Handler for template:save - creates or updates custom template.
 */
export async function handleTemplateSave(
  payload: unknown
): Promise<TemplateResponse<TemplateSaveResponse>> {
  const result = TemplateSaveRequestSchema.safeParse(payload);
  if (!result.success) {
    return validationError(result.error.message);
  }

  const { template, replace } = result.data;
  await ensureCustomTemplatesDir();

  const id = template.id ?? slugify(template.name);
  const filePath = storedTemplatePath(id);
  if (filePath === null) {
    return validationError(
      'Invalid template ID: must contain only alphanumeric, dash, or underscore'
    );
  }

  const exists = await fileExists(filePath);
  if (exists && !replace) {
    return alreadyExistsError(`Template "${template.name}" already exists`);
  }

  const content = buildTemplateFile(template);

  try {
    await writeRegularFile(filePath, content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fileError(`Failed to save template: ${msg}`);
  }

  const metadata: TemplateMetadata = {
    id,
    name: template.name,
    description: template.description,
    category: template.category,
    tags: template.tags,
    isBuiltIn: false,
  };

  return { success: true, template: metadata };
}

/**
 * Handler for template:delete - deletes custom template (protects built-in).
 */
export async function handleTemplateDelete(
  payload: unknown
): Promise<TemplateResponse<TemplateDeleteResponse>> {
  const result = TemplateDeleteRequestSchema.safeParse(payload);
  if (!result.success) {
    return validationError(result.error.message);
  }

  const { id } = result.data;

  // SEC-3: Validate template ID to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return validationError(
      'Invalid template ID: must contain only alphanumeric, dash, or underscore'
    );
  }

  const found = await findTemplateById(id);

  if (!found) {
    return notFoundError(`Template with ID "${id}" not found`);
  }

  if (found.isBuiltIn) {
    return permissionError('Cannot delete built-in templates');
  }

  try {
    await fs.unlink(found.filePath);
    return { success: true, id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fileError(`Failed to delete template: ${msg}`);
  }
}

async function copyOntoPath(source: string, destination: string): Promise<void> {
  await prepareRegularOutput(destination);
  await fs.copyFile(source, destination);
}

function storedTemplatePath(id: string): string | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return null;
  }
  return path.join(getCustomTemplatesPath(), `${path.basename(id)}.mdxt`);
}

/**
 * Handler for template:import - imports .mdxt file from path.
 */
export async function handleTemplateImport(
  payload: unknown
): Promise<TemplateResponse<TemplateImportResponse>> {
  const result = TemplateImportRequestSchema.safeParse(payload);
  if (!result.success) {
    return validationError(result.error.message);
  }

  const { path: importPath, replace } = result.data;

  if (!importPath.endsWith('.mdxt')) {
    return validationError('File must have .mdxt extension');
  }

  const importScopeError = unchosenTemplatePathError(importPath);
  if (importScopeError !== null) {
    return permissionError(importScopeError);
  }

  let template: Template;
  try {
    template = await parseTemplateFile(importPath, false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return parseError(`Invalid template file: ${msg}`);
  }

  await ensureCustomTemplatesDir();

  const destPath = storedTemplatePath(template.id);
  if (destPath === null) {
    return validationError(
      'Invalid template ID: must contain only alphanumeric, dash, or underscore'
    );
  }

  const exists = await fileExists(destPath);
  if (exists && !replace) {
    return alreadyExistsError(`Template "${template.name}" already exists`);
  }

  try {
    await copyOntoPath(importPath, destPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fileError(`Failed to import template: ${msg}`);
  }

  const metadata: TemplateMetadata = {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    tags: template.tags,
    author: template.author,
    isBuiltIn: false,
  };

  return { success: true, template: metadata };
}

/**
 * Handler for template:export - exports template to path.
 */
export async function handleTemplateExport(
  payload: unknown
): Promise<TemplateResponse<TemplateExportResponse>> {
  const result = TemplateExportRequestSchema.safeParse(payload);
  if (!result.success) {
    return validationError(result.error.message);
  }

  const { id, path: exportPath } = result.data;
  const found = await findTemplateById(id);

  if (!found) {
    return notFoundError(`Template with ID "${id}" not found`);
  }

  const exportScopeError = unchosenTemplatePathError(exportPath);
  if (exportScopeError !== null) {
    return permissionError(exportScopeError);
  }

  try {
    await copyOntoPath(found.filePath, exportPath);
    return { success: true, path: exportPath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fileError(`Failed to export template: ${msg}`);
  }
}

/**
 * Handler for template:validate - validates MDX content compiles.
 */
export async function handleTemplateValidate(
  payload: unknown
): Promise<TemplateResponse<TemplateValidateResponse>> {
  const result = TemplateValidateRequestSchema.safeParse(payload);
  if (!result.success) {
    return validationError(result.error.message);
  }

  const { content } = result.data;
  const errors: string[] = [];

  try {
    const { content: mdxContent } = matter(content);
    await compile(mdxContent, { development: false, jsx: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
  }

  return { success: true, valid: errors.length === 0, errors };
}

/**
 * Handler for template:createFromTemplate - creates document with substitution.
 */
export async function handleCreateFromTemplate(
  payload: unknown
): Promise<TemplateResponse<CreateFromTemplateResponse>> {
  const result = CreateFromTemplateRequestSchema.safeParse(payload);
  if (!result.success) {
    return validationError(result.error.message);
  }

  const { templateId, variables, savePath } = result.data;
  const found = await findTemplateById(templateId);

  if (!found) {
    return notFoundError(`Template with ID "${templateId}" not found`);
  }

  let template: Template;
  try {
    template = await parseTemplateFile(found.filePath, found.isBuiltIn);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return parseError(`Failed to parse template: ${msg}`);
  }

  const content = substituteVariables(template.content, variables);

  if (savePath) {
    const saveScopeError = unchosenTemplatePathError(savePath);
    if (saveScopeError !== null) {
      return permissionError(saveScopeError);
    }
    try {
      await writeRegularFile(savePath, content);
      return { success: true, content, path: savePath };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fileError(`Failed to save document: ${msg}`);
    }
  }

  return { success: true, content };
}

/**
 * Handler for template:showOpenDialog - shows file open dialog for .mdxt files.
 */
export async function handleTemplateOpenDialog(
  payload: unknown
): Promise<TemplateResponse<TemplateOpenDialogResponse>> {
  const result = TemplateOpenDialogRequestSchema.safeParse(payload);
  if (!result.success) {
    return validationError(result.error.message);
  }

  const dialogResult = await dialog.showOpenDialog({
    title: 'Import Template',
    filters: [
      { name: 'MDX Template', extensions: ['mdxt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  const selectedPath = dialogResult.filePaths[0];
  if (dialogResult.canceled || selectedPath === undefined) {
    return { success: true, path: null, canceled: true };
  }

  rememberChosenTemplatePath(selectedPath);
  return { success: true, path: selectedPath, canceled: false };
}

/**
 * Handler for template:showSaveDialog - shows file save dialog for .mdxt files.
 */
export async function handleTemplateSaveDialog(
  payload: unknown
): Promise<TemplateResponse<TemplateSaveDialogResponse>> {
  const result = TemplateSaveDialogRequestSchema.safeParse(payload);
  if (!result.success) {
    return validationError(result.error.message);
  }

  const { defaultName } = result.data;

  const dialogResult = await dialog.showSaveDialog({
    title: 'Export Template',
    defaultPath: defaultName ? `${defaultName}.mdxt` : 'template.mdxt',
    filters: [{ name: 'MDX Template', extensions: ['mdxt'] }],
  });

  if (dialogResult.canceled || !dialogResult.filePath) {
    return { success: true, path: null, canceled: true };
  }

  rememberChosenTemplatePath(dialogResult.filePath);
  return { success: true, path: dialogResult.filePath, canceled: false };
}
