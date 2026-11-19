/**
 * Plugin Loader Tests
 *
 * @module main/services/plugin/__tests__/plugin-loader.test
 */

import { access, mkdtemp, readFile, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PluginLoader } from '../plugin-loader';

// Mock electron app module
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'home') return os.homedir();
      return os.tmpdir();
    },
  },
}));

async function createPluginDir(
  baseDir: string,
  pluginName: string,
  manifest: Record<string, unknown>,
  code = 'module.exports = { activate: function() {}, deactivate: function() {} };'
): Promise<string> {
  const pluginDir = path.join(baseDir, pluginName);
  await mkdir(pluginDir, { recursive: true });
  await writeFile(path.join(pluginDir, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(path.join(pluginDir, 'index.js'), code);
  return pluginDir;
}

describe('PluginLoader', () => {
  let tempDir = '';
  let loader: PluginLoader;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-plugin-loader-'));
    loader = new PluginLoader(tempDir);
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('discoverPlugins', () => {
    it('returns empty array for empty directory', async () => {
      const plugins = await loader.discoverPlugins();
      expect(plugins).toEqual([]);
    });

    it('discovers plugin directories', async () => {
      await createPluginDir(tempDir, 'plugin-a', {
        name: 'Plugin A',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });
      await createPluginDir(tempDir, 'plugin-b', {
        name: 'Plugin B',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });

      const plugins = await loader.discoverPlugins();
      expect(plugins).toHaveLength(2);
    });

    it('returns empty array if directory does not exist', async () => {
      const missingLoader = new PluginLoader('/nonexistent/path');
      const plugins = await missingLoader.discoverPlugins();
      expect(plugins).toEqual([]);
    });
  });

  describe('installPlugin', () => {
    it('installs a plugin from a directory', async () => {
      const pluginDir = await createPluginDir(tempDir, 'my-plugin', {
        name: 'My Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        permissions: ['ui'],
      });

      const record = await loader.installPlugin(pluginDir);
      expect(record.id).toBe('my-plugin');
      expect(record.state).toBe('installed');
      expect(record.manifest.name).toBe('My Plugin');
    });

    it('does not install a plugin from a folder the user has not opened', async () => {
      const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-plugin-outside-'));
      try {
        await createPluginDir(outside, 'foreign', {
          name: 'Foreign',
          version: '1.0.0',
          description: 'test',
          permissions: [],
        });
        await expect(loader.installPlugin(path.join(outside, 'foreign'))).rejects.toThrow(
          'open a file'
        );
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });

    it('throws for invalid manifest', async () => {
      const pluginDir = path.join(tempDir, 'bad-plugin');
      await mkdir(pluginDir, { recursive: true });
      await writeFile(path.join(pluginDir, 'manifest.json'), JSON.stringify({ name: '' }));

      await expect(loader.installPlugin(pluginDir)).rejects.toThrow();
    });
  });

  describe('loadPlugin', () => {
    it('loads a plugin into sandbox', async () => {
      await createPluginDir(tempDir, 'loadable', {
        name: 'Loadable',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });
      await loader.installPlugin(path.join(tempDir, 'loadable'));
      await loader.loadPlugin('loadable');

      expect(loader.isLoaded('loadable')).toBe(true);
    });

    it('does not install a plugin directory that is a link', async () => {
      const outside = path.join(tempDir, 'outside-plugin');
      await mkdir(outside);
      await writeFile(
        path.join(outside, 'manifest.json'),
        JSON.stringify({
          name: 'Outside',
          version: '1.0.0',
          description: 'secret',
          permissions: [],
          entryPoint: 'index.js',
        })
      );
      await writeFile(path.join(outside, 'index.js'), 'module.exports = {};');
      const linked = path.join(tempDir, 'linked-plugin');
      await symlink(outside, linked);

      await expect(loader.installPlugin(linked)).rejects.toThrow('Plugin directory is a link');
    });

    it('does not load an entry point that is a link', async () => {
      const outside = path.join(tempDir, 'secret.js');
      await writeFile(outside, 'module.exports = { leaked: true };');
      const pluginDir = await createPluginDir(tempDir, 'linked-entry', {
        name: 'Linked',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });
      await rm(path.join(pluginDir, 'index.js'));
      await symlink(outside, path.join(pluginDir, 'index.js'));
      await loader.installPlugin(pluginDir);

      await expect(loader.loadPlugin('linked-entry')).rejects.toThrow('outside the workspace');
      expect(loader.isLoaded('linked-entry')).toBe(false);
    });

    it('does not load an entry point outside the plugin directory', async () => {
      await writeFile(path.join(tempDir, 'secret.js'), 'module.exports = { leaked: true };');
      await createPluginDir(tempDir, 'escape', {
        name: 'Escape',
        version: '1.0.0',
        description: 'test',
        permissions: [],
        entryPoint: '../secret.js',
      });
      await loader.installPlugin(path.join(tempDir, 'escape'));
      await expect(loader.loadPlugin('escape')).rejects.toThrow('outside the workspace');
      expect(loader.isLoaded('escape')).toBe(false);
    });

    it('does not let a plugin write through a linked file', async () => {
      const outside = path.join(tempDir, 'secret.txt');
      await writeFile(outside, 'secret');
      const pluginDir = await createPluginDir(
        tempDir,
        'linked-writer',
        {
          name: 'Linked Writer',
          version: '1.0.0',
          description: 'test',
          permissions: ['file-write'],
        },
        `module.exports = { activate: function() { return mdxpad.writeFile('linked.txt', 'pwned'); }, deactivate: function() {} };`
      );
      await symlink(outside, path.join(pluginDir, 'linked.txt'));
      await loader.installPlugin(pluginDir);
      await loader.loadPlugin('linked-writer');
      await expect(loader.activatePlugin('linked-writer')).rejects.toThrow('outside the workspace');
      expect(await readFile(outside, 'utf-8')).toBe('secret');
    });

    it('does not let a plugin write outside its directory', async () => {
      const outside = path.join(tempDir, 'escaped.txt');
      await createPluginDir(
        tempDir,
        'writer',
        {
          name: 'Writer',
          version: '1.0.0',
          description: 'test',
          permissions: ['file-write'],
        },
        `module.exports = { activate: function() { return mdxpad.writeFile(${JSON.stringify(outside)}, 'nope'); }, deactivate: function() {} };`
      );
      await loader.installPlugin(path.join(tempDir, 'writer'));
      await loader.loadPlugin('writer');
      await expect(loader.activatePlugin('writer')).rejects.toThrow('outside the workspace');
      await expect(access(outside)).rejects.toThrow();
    });

    it('throws for non-existent plugin', async () => {
      await expect(loader.loadPlugin('nonexistent')).rejects.toThrow('Plugin not found');
    });

    it('is idempotent', async () => {
      await createPluginDir(tempDir, 'idem', {
        name: 'Idem',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });
      await loader.installPlugin(path.join(tempDir, 'idem'));
      await loader.loadPlugin('idem');
      await loader.loadPlugin('idem');

      expect(loader.isLoaded('idem')).toBe(true);
    });
  });

  describe('activatePlugin', () => {
    it('activates a loaded plugin', async () => {
      await createPluginDir(tempDir, 'activable', {
        name: 'Activable',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });
      await loader.installPlugin(path.join(tempDir, 'activable'));
      await loader.loadPlugin('activable');
      await loader.activatePlugin('activable');

      expect(loader.isActivated('activable')).toBe(true);
    });

    it('throws if plugin is not loaded', async () => {
      await expect(loader.activatePlugin('not-loaded')).rejects.toThrow('not loaded');
    });

    it('is idempotent for already activated plugin', async () => {
      await createPluginDir(tempDir, 'act-idem', {
        name: 'ActIdem',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });
      await loader.installPlugin(path.join(tempDir, 'act-idem'));
      await loader.loadPlugin('act-idem');
      await loader.activatePlugin('act-idem');
      await loader.activatePlugin('act-idem');

      expect(loader.isActivated('act-idem')).toBe(true);
    });
  });

  describe('deactivatePlugin', () => {
    it('deactivates an active plugin', async () => {
      await createPluginDir(tempDir, 'deact', {
        name: 'Deactivable',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });
      await loader.installPlugin(path.join(tempDir, 'deact'));
      await loader.loadPlugin('deact');
      await loader.activatePlugin('deact');
      await loader.deactivatePlugin('deact');

      expect(loader.isActivated('deact')).toBe(false);
    });

    it('is a no-op for non-loaded plugins', async () => {
      await loader.deactivatePlugin('nonexistent');
    });
  });

  describe('unloadPlugin', () => {
    it('unloads a loaded plugin', async () => {
      await createPluginDir(tempDir, 'unloadable', {
        name: 'Unloadable',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });
      await loader.installPlugin(path.join(tempDir, 'unloadable'));
      await loader.loadPlugin('unloadable');
      await loader.unloadPlugin('unloadable');

      expect(loader.isLoaded('unloadable')).toBe(false);
    });
  });

  describe('uninstallPlugin', () => {
    it('uninstalls a plugin', async () => {
      await createPluginDir(tempDir, 'removable', {
        name: 'Removable',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });
      await loader.installPlugin(path.join(tempDir, 'removable'));
      const removed = await loader.uninstallPlugin('removable');
      expect(removed).toBe(true);

      const plugins = await loader.listPlugins();
      expect(plugins).toHaveLength(0);
    });
  });

  describe('listPlugins', () => {
    it('lists all registered plugins', async () => {
      await createPluginDir(tempDir, 'p1', {
        name: 'P1',
        version: '1.0.0',
        description: 'test',
        permissions: [],
      });
      await createPluginDir(tempDir, 'p2', {
        name: 'P2',
        version: '2.0.0',
        description: 'test',
        permissions: ['network'],
      });
      await loader.installPlugin(path.join(tempDir, 'p1'));
      await loader.installPlugin(path.join(tempDir, 'p2'));

      const plugins = await loader.listPlugins();
      expect(plugins).toHaveLength(2);
    });
  });
});
