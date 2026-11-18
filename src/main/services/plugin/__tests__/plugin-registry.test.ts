/**
 * Plugin Registry Tests
 *
 * @module main/services/plugin/__tests__/plugin-registry.test
 */

import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PluginManifest } from '@shared/contracts/plugin-schemas';

import { PluginRegistry } from '../plugin-registry';

const testManifest: PluginManifest = {
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin',
  permissions: ['ui'],
  entryPoint: 'index.js',
};

describe('PluginRegistry', () => {
  let tempDir = '';
  let registry: PluginRegistry;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-plugin-reg-'));
    registry = new PluginRegistry(tempDir);
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('starts with empty plugin list', async () => {
    const plugins = await registry.listPlugins();
    expect(plugins).toEqual([]);
  });

  it('adds a plugin', async () => {
    const record = await registry.addPlugin('test-plugin', testManifest);
    expect(record.id).toBe('test-plugin');
    expect(record.state).toBe('installed');
    expect(record.manifest.name).toBe('Test Plugin');
    expect(record.installedAt).toBeGreaterThan(0);
  });

  it('persists plugins across reads', async () => {
    await registry.addPlugin('test-plugin', testManifest);
    const plugins = await registry.listPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.id).toBe('test-plugin');
  });

  it('overwrites existing plugin on add', async () => {
    await registry.addPlugin('test-plugin', testManifest);
    const updated: PluginManifest = { ...testManifest, version: '2.0.0' };
    await registry.addPlugin('test-plugin', updated);

    const plugins = await registry.listPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.manifest.version).toBe('2.0.0');
  });

  it('gets a plugin by ID', async () => {
    await registry.addPlugin('test-plugin', testManifest);
    const plugin = await registry.getPlugin('test-plugin');
    expect(plugin?.id).toBe('test-plugin');
  });

  it('returns undefined for non-existent plugin', async () => {
    const plugin = await registry.getPlugin('nonexistent');
    expect(plugin).toBeUndefined();
  });

  it('removes a plugin', async () => {
    await registry.addPlugin('test-plugin', testManifest);
    const removed = await registry.removePlugin('test-plugin');
    expect(removed).toBe(true);

    const plugins = await registry.listPlugins();
    expect(plugins).toHaveLength(0);
  });

  it('returns false when removing non-existent plugin', async () => {
    const removed = await registry.removePlugin('nonexistent');
    expect(removed).toBe(false);
  });

  it('sets plugin state', async () => {
    await registry.addPlugin('test-plugin', testManifest);
    const updated = await registry.setState('test-plugin', 'active');
    expect(updated?.state).toBe('active');

    const plugin = await registry.getPlugin('test-plugin');
    expect(plugin?.state).toBe('active');
  });

  it('returns undefined when setting state of non-existent plugin', async () => {
    const result = await registry.setState('nonexistent', 'active');
    expect(result).toBeUndefined();
  });

  it('sets plugin error', async () => {
    await registry.addPlugin('test-plugin', testManifest);
    const updated = await registry.setError('test-plugin', 'Something failed');
    expect(updated?.state).toBe('error');
    expect(updated?.error).toBe('Something failed');
  });

  it('returns undefined when setting error of non-existent plugin', async () => {
    const result = await registry.setError('nonexistent', 'oops');
    expect(result).toBeUndefined();
  });

  it('does not read or overwrite a registry that is a link', async () => {
    const outside = path.join(tempDir, 'outside.json');
    const registryPath = path.join(tempDir, 'registry.json');
    await writeFile(
      outside,
      JSON.stringify({
        plugins: [
          {
            id: 'secret',
            manifest: testManifest,
            state: 'installed',
            installedAt: 1,
          },
        ],
      })
    );
    await symlink(outside, registryPath);

    await expect(registry.listPlugins()).resolves.toEqual([]);
    await registry.addPlugin('local', testManifest);

    expect(await readFile(outside, 'utf-8')).toContain('secret');
    expect((await lstat(registryPath)).isSymbolicLink()).toBe(false);
    await expect(registry.listPlugins()).resolves.toEqual([
      expect.objectContaining({ id: 'local' }),
    ]);
  });
});
