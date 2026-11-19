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

import { ensureRealDirectory } from '../ensure-real-directory';

/**
 * Gets ordered candidate paths for built-in templates.
 *
 * In packaged builds, only process.resourcesPath/templates is valid.
 * In dev/dist launches, we probe appPath-relative candidates and cwd fallback.
 */
export function getBuiltinTemplatesPathCandidates(): string[] {
  if (app.isPackaged) {
    return [path.join(process.resourcesPath, 'templates')];
  }

  const appPath = app.getAppPath();

  return Array.from(new Set([
    path.resolve(appPath, 'resources', 'templates'),
    path.resolve(appPath, '..', 'resources', 'templates'),
    path.resolve(appPath, '..', '..', 'resources', 'templates'),
    path.resolve(process.cwd(), 'resources', 'templates'),
  ]));
}

/**
 * Gets the primary built-in templates path.
 * For non-packaged runs this is the first candidate path.
 */
export function getBuiltinTemplatesPath(): string {
  const [primaryPath] = getBuiltinTemplatesPathCandidates();
  return primaryPath ?? path.resolve(process.cwd(), 'resources', 'templates');
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
  await ensureRealDirectory(getCustomTemplatesPath());
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
