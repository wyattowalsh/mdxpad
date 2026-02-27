/**
 * Plugin Manifest Tests
 *
 * @module main/services/plugin/__tests__/plugin-manifest.test
 */

import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadManifest, derivePluginId } from '../plugin-manifest';

describe('loadManifest', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-plugin-manifest-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('loads and validates a valid manifest', async () => {
    const pluginDir = path.join(tempDir, 'my-plugin');
    await mkdir(pluginDir, { recursive: true });
    await writeFile(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify({
        name: 'My Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        permissions: ['ui'],
      })
    );

    const manifest = await loadManifest(pluginDir);
    expect(manifest.name).toBe('My Plugin');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.permissions).toEqual(['ui']);
    expect(manifest.entryPoint).toBe('index.js');
  });

  it('throws if manifest.json is missing', async () => {
    const pluginDir = path.join(tempDir, 'no-manifest');
    await mkdir(pluginDir, { recursive: true });

    await expect(loadManifest(pluginDir)).rejects.toThrow('manifest not found');
  });

  it('throws if manifest.json is invalid JSON', async () => {
    const pluginDir = path.join(tempDir, 'bad-json');
    await mkdir(pluginDir, { recursive: true });
    await writeFile(path.join(pluginDir, 'manifest.json'), 'not valid json');

    await expect(loadManifest(pluginDir)).rejects.toThrow('Invalid JSON');
  });

  it('throws if manifest does not match schema', async () => {
    const pluginDir = path.join(tempDir, 'bad-schema');
    await mkdir(pluginDir, { recursive: true });
    await writeFile(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify({ name: '', version: 'invalid' })
    );

    await expect(loadManifest(pluginDir)).rejects.toThrow('Invalid plugin manifest');
  });
});

describe('derivePluginId', () => {
  it('derives ID from directory name', () => {
    expect(derivePluginId('/home/user/.mdxpad/plugins/my-plugin')).toBe('my-plugin');
  });

  it('handles nested paths', () => {
    expect(derivePluginId('/a/b/c/some-plugin')).toBe('some-plugin');
  });
});
