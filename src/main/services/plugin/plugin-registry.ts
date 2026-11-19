/**
 * Plugin Registry
 *
 * Tracks installed, active, and disabled plugins.
 * Persists plugin state to a JSON file on disk.
 *
 * @module main/services/plugin/plugin-registry
 */

import { constants as fsConstants, promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { PluginManifest, PluginRecord, PluginState } from '@shared/contracts/plugin-schemas';
import { writeWithoutFollowingLink } from '@shared/lib/atomic-write';

import { ensureRealDirectory } from '../ensure-real-directory';

interface RegistryData {
  plugins: PluginRecord[];
}

const EMPTY_REGISTRY: RegistryData = { plugins: [] };

export class PluginRegistry {
  private readonly registryPath: string;
  private readonly ownedRoot: string | undefined;

  constructor(pluginDir: string, ownedRoot?: string) {
    this.registryPath = path.join(pluginDir, 'registry.json');
    this.ownedRoot = ownedRoot;
  }

  private async read(): Promise<RegistryData> {
    await ensureRealDirectory(path.dirname(this.registryPath), this.ownedRoot);
    let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
    try {
      handle = await fs.open(this.registryPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
      const info = await handle.stat();
      if (!info.isFile()) {
        return { ...EMPTY_REGISTRY, plugins: [] };
      }
      const content = await handle.readFile({ encoding: 'utf8' });
      return JSON.parse(content) as RegistryData;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ELOOP' || code === 'EINVAL' || code === 'EPERM') {
        return { ...EMPTY_REGISTRY, plugins: [] };
      }
      throw error;
    } finally {
      await handle?.close();
    }
  }

  private async write(data: RegistryData): Promise<void> {
    const dir = path.dirname(this.registryPath);
    await ensureRealDirectory(dir, this.ownedRoot);
    await writeWithoutFollowingLink(this.registryPath, JSON.stringify(data, null, 2));
  }

  async listPlugins(): Promise<PluginRecord[]> {
    const data = await this.read();
    return data.plugins;
  }

  async getPlugin(pluginId: string): Promise<PluginRecord | undefined> {
    const data = await this.read();
    return data.plugins.find((p) => p.id === pluginId);
  }

  async addPlugin(id: string, manifest: PluginManifest): Promise<PluginRecord> {
    const data = await this.read();
    const existing = data.plugins.findIndex((p) => p.id === id);

    const record: PluginRecord = {
      id,
      manifest,
      state: 'installed',
      installedAt: Date.now(),
    };

    if (existing >= 0) {
      data.plugins[existing] = record;
    } else {
      data.plugins.push(record);
    }

    await this.write(data);
    return record;
  }

  async removePlugin(pluginId: string): Promise<boolean> {
    const data = await this.read();
    const index = data.plugins.findIndex((p) => p.id === pluginId);
    if (index < 0) {
      return false;
    }
    data.plugins.splice(index, 1);
    await this.write(data);
    return true;
  }

  async setState(pluginId: string, state: PluginState): Promise<PluginRecord | undefined> {
    const data = await this.read();
    const plugin = data.plugins.find((p) => p.id === pluginId);
    if (!plugin) {
      return undefined;
    }
    plugin.state = state;
    await this.write(data);
    return plugin;
  }

  async setError(pluginId: string, error: string): Promise<PluginRecord | undefined> {
    const data = await this.read();
    const plugin = data.plugins.find((p) => p.id === pluginId);
    if (!plugin) {
      return undefined;
    }
    plugin.state = 'error';
    plugin.error = error;
    await this.write(data);
    return plugin;
  }
}
