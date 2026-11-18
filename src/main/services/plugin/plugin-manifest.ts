/**
 * Plugin Manifest Loader
 *
 * Reads and validates plugin manifest.json files from disk.
 *
 * @module main/services/plugin/plugin-manifest
 */

import { constants as fsConstants, promises as fs } from 'node:fs';
import * as path from 'node:path';

import { PluginManifestSchema } from '@shared/contracts/plugin-schemas';
import type { PluginManifest } from '@shared/contracts/plugin-schemas';

/**
 * Load and validate a plugin manifest from a directory.
 * Reads manifest.json from the given plugin directory and validates
 * it against the PluginManifestSchema.
 *
 * @param pluginDir - Absolute path to the plugin directory
 * @returns Validated plugin manifest
 * @throws Error if manifest is missing or invalid
 */
async function readManifestText(manifestPath: string): Promise<string> {
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(manifestPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile()) {
      throw new Error(`Plugin manifest is a link: ${manifestPath}`);
    }
    return await handle.readFile({ encoding: 'utf8' });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Plugin manifest is a link')) {
      throw error;
    }
    const code =
      error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;
    if (code === 'ENOENT') {
      throw new Error(`Plugin manifest not found: ${manifestPath}`);
    }
    if (code === 'ELOOP' || code === 'EINVAL' || code === 'EPERM') {
      throw new Error(`Plugin manifest is a link: ${manifestPath}`);
    }
    throw new Error(`Failed to read plugin manifest: ${manifestPath}`);
  } finally {
    await handle?.close();
  }
}

export async function loadManifest(pluginDir: string): Promise<PluginManifest> {
  const manifestPath = path.join(pluginDir, 'manifest.json');
  const raw = await readManifestText(manifestPath);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in plugin manifest: ${manifestPath}`);
  }

  const result = PluginManifestSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid plugin manifest at ${manifestPath}: ${issues}`);
  }

  return result.data;
}

/**
 * Derive a plugin ID from its directory name.
 * Uses the basename of the plugin directory as the ID.
 */
export function derivePluginId(pluginDir: string): string {
  return path.basename(pluginDir);
}
