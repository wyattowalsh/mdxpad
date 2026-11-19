/**
 * Plugin Loader
 *
 * Loads plugins from ~/.mdxpad/plugins/ directory.
 * Uses Node.js vm.createContext for sandboxed execution.
 * Manages plugin lifecycle: load, activate, deactivate, unload.
 *
 * @module main/services/plugin/plugin-loader
 */

import { constants as fsConstants, promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

import { app } from 'electron';

import { normalizeCapabilityPath } from '@main/ipc/document-capability';
import { trustedDirectoryError } from '@main/ipc/trusted-directory';
import type { PluginManifest, PluginRecord } from '@shared/contracts/plugin-schemas';

import { readFileWithoutFollowingLinks } from '@main/services/file-service';
import { resolveWorkspaceFilePath } from '../ai/agent-path';
import { resolveAppDirectory } from '../ensure-real-directory';
import { loadManifest, derivePluginId } from './plugin-manifest';
import { PluginRegistry } from './plugin-registry';

/** API surface exposed to plugins inside the sandbox */
interface PluginSandboxApi {
  readonly log: (...args: unknown[]) => void;
  readonly readFile?: ((filePath: string) => Promise<string>) | undefined;
  readonly writeFile?: ((filePath: string, content: string) => Promise<void>) | undefined;
}

interface LoadedPlugin {
  id: string;
  manifest: PluginManifest;
  context: vm.Context;
  activated: boolean;
}

function getDefaultPluginDir(): string {
  return path.join(app.getPath('home'), '.mdxpad', 'plugins');
}

/**
 * Build the sandbox API based on a plugin's declared permissions.
 */
function isInsidePluginRoot(pluginRoot: string, candidate: string): boolean {
  const root = normalizeCapabilityPath(pluginRoot);
  const target = normalizeCapabilityPath(candidate);
  if (root === null || target === null) {
    return false;
  }
  const relative = path.relative(root, target);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function assertInstallablePluginPath(pluginRoot: string, pluginPath: string): void {
  if (isInsidePluginRoot(pluginRoot, pluginPath)) {
    return;
  }
  const scopeError = trustedDirectoryError(pluginPath);
  if (scopeError !== null) {
    throw new Error(scopeError);
  }
}

async function writePluginFile(
  pluginRoot: string,
  filePath: string,
  content: string
): Promise<void> {
  const target = resolveWorkspaceFilePath(pluginRoot, filePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const confirmed = resolveWorkspaceFilePath(pluginRoot, filePath);
  if (confirmed !== target) {
    throw new Error('Plugin file could not be written');
  }
  const handle = await fs.open(
    confirmed,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC | fsConstants.O_NOFOLLOW,
    0o600
  );
  try {
    await handle.writeFile(content, 'utf-8');
  } finally {
    await handle.close();
  }
}

function buildSandboxApi(manifest: PluginManifest, pluginRoot: string): PluginSandboxApi {
  const log = (...args: unknown[]): void => {
    console.log(`[plugin:${manifest.name}]`, ...args);
  };

  const readFile = manifest.permissions.includes('file-read')
    ? async (filePath: string) => {
        const target = resolveWorkspaceFilePath(pluginRoot, filePath);
        const read = await readFileWithoutFollowingLinks(target);
        if (!read.ok) {
          throw new Error('Plugin file could not be read');
        }
        return read.value;
      }
    : undefined;

  const writeFile = manifest.permissions.includes('file-write')
    ? (filePath: string, content: string) => writePluginFile(pluginRoot, filePath, content)
    : undefined;

  return { log, readFile, writeFile };
}

export class PluginLoader {
  private readonly pluginDir: string;
  private readonly registry: PluginRegistry;
  private readonly loaded = new Map<string, LoadedPlugin>();

  constructor(pluginDir?: string, ownedRoot?: string) {
    const resolved = resolveAppDirectory(pluginDir, getDefaultPluginDir, ownedRoot);
    this.pluginDir = resolved.directory;
    this.registry = new PluginRegistry(this.pluginDir, resolved.ownedRoot);
  }

  getRegistry(): PluginRegistry {
    return this.registry;
  }

  /**
   * Discover all plugin directories under the plugins root.
   */
  async discoverPlugins(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.pluginDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => path.join(this.pluginDir, e.name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Install a plugin from a directory path.
   * Validates the manifest and registers it.
   */
  async installPlugin(pluginPath: string): Promise<PluginRecord> {
    assertInstallablePluginPath(this.pluginDir, pluginPath);
    const manifest = await loadManifest(pluginPath);
    const id = derivePluginId(pluginPath);
    return this.registry.addPlugin(id, manifest);
  }

  /**
   * Load a plugin into a sandboxed VM context.
   */
  async loadPlugin(pluginId: string): Promise<void> {
    if (this.loaded.has(pluginId)) {
      return;
    }

    const record = await this.registry.getPlugin(pluginId);
    if (!record) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const pluginPath = path.join(this.pluginDir, pluginId);
    const entryPath = resolveWorkspaceFilePath(pluginPath, record.manifest.entryPoint);

    const read = await readFileWithoutFollowingLinks(entryPath);
    if (!read.ok) {
      await this.registry.setError(
        pluginId,
        `Entry point not found: ${record.manifest.entryPoint}`
      );
      throw new Error(`Plugin entry point not found: ${entryPath}`);
    }
    const code = read.value;

    const sandboxApi = buildSandboxApi(record.manifest, pluginPath);
    const sandbox = {
      mdxpad: sandboxApi,
      console: { log: sandboxApi.log, warn: sandboxApi.log, error: sandboxApi.log },
      setTimeout,
      clearTimeout,
      exports: {} as Record<string, unknown>,
      module: { exports: {} as Record<string, unknown> },
    };

    const context = vm.createContext(sandbox, {
      name: `plugin:${pluginId}`,
    });

    try {
      const script = new vm.Script(code, {
        filename: entryPath,
      });
      script.runInContext(context, { timeout: 5000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.registry.setError(pluginId, message);
      throw new Error(`Failed to load plugin ${pluginId}: ${message}`);
    }

    this.loaded.set(pluginId, {
      id: pluginId,
      manifest: record.manifest,
      context,
      activated: false,
    });

    await this.registry.setState(pluginId, 'installed');
  }

  /**
   * Activate a loaded plugin by calling its activate export.
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.loaded.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not loaded: ${pluginId}`);
    }

    if (plugin.activated) {
      return;
    }

    try {
      const activateFn = vm.runInContext(
        'typeof module.exports.activate === "function" ? module.exports.activate : null',
        plugin.context
      ) as unknown;
      if (typeof activateFn === 'function') {
        await Promise.resolve((activateFn as () => unknown)());
      }
      plugin.activated = true;
      await this.registry.setState(pluginId, 'active');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.registry.setError(pluginId, message);
      throw new Error(`Failed to activate plugin ${pluginId}: ${message}`);
    }
  }

  /**
   * Deactivate a plugin by calling its deactivate export.
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.loaded.get(pluginId);
    if (!plugin?.activated) {
      return;
    }

    try {
      const deactivateFn = vm.runInContext(
        'typeof module.exports.deactivate === "function" ? module.exports.deactivate : null',
        plugin.context
      ) as unknown;
      if (typeof deactivateFn === 'function') {
        await Promise.resolve((deactivateFn as () => unknown)());
      }
    } catch {
      // Best-effort deactivation
    }

    plugin.activated = false;
    await this.registry.setState(pluginId, 'disabled');
  }

  /**
   * Unload a plugin from memory.
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.loaded.get(pluginId);
    if (!plugin) {
      return;
    }

    if (plugin.activated) {
      await this.deactivatePlugin(pluginId);
    }

    this.loaded.delete(pluginId);
  }

  /**
   * Uninstall a plugin: deactivate, unload, remove from registry.
   */
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    await this.unloadPlugin(pluginId);
    return this.registry.removePlugin(pluginId);
  }

  /**
   * List all registered plugins.
   */
  async listPlugins(): Promise<PluginRecord[]> {
    return this.registry.listPlugins();
  }

  /**
   * Check if a plugin is currently loaded in memory.
   */
  isLoaded(pluginId: string): boolean {
    return this.loaded.has(pluginId);
  }

  /**
   * Check if a plugin is activated.
   */
  isActivated(pluginId: string): boolean {
    return this.loaded.get(pluginId)?.activated ?? false;
  }
}
