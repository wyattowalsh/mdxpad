/**
 * Template Storage Paths
 *
 * Feature: 016-template-library
 *
 * Handles path resolution for built-in and custom templates.
 *
 * @module template/paths
 */

import { app } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Gets the path to built-in templates directory.
 * In development: ./resources/templates/
 * In production: process.resourcesPath/templates/
 */
export function getBuiltinTemplatesPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(app.getAppPath(), 'resources', 'templates');
  }
  return path.join(process.resourcesPath, 'templates');
}

/**
 * Gets the path to custom templates directory.
 * Location: ~/.mdxpad/templates/
 */
export function getCustomTemplatesPath(): string {
  return path.join(os.homedir(), '.mdxpad', 'templates');
}

/**
 * Ensures the custom templates directory exists.
 */
export async function ensureCustomTemplatesDir(): Promise<void> {
  const customPath = getCustomTemplatesPath();
  await fs.mkdir(customPath, { recursive: true });
}

/**
 * Checks if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
