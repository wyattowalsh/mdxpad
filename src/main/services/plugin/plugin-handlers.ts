/**
 * Plugin IPC Handlers
 *
 * Registers IPC handlers for plugin lifecycle operations.
 *
 * @module main/services/plugin/plugin-handlers
 */

import { ipcMain } from 'electron';

import {
  PluginInstallRequestSchema,
  PluginUninstallRequestSchema,
  PluginEnableRequestSchema,
  PluginDisableRequestSchema,
} from '@shared/contracts/plugin-schemas';
import type {
  PluginListResponse,
  PluginInstallResponse,
  PluginUninstallResponse,
  PluginEnableResponse,
  PluginDisableResponse,
} from '@shared/contracts/plugin-schemas';

import type { PluginLoader } from './plugin-loader';

/** IPC channel names for plugin operations */
export const PLUGIN_CHANNELS = {
  list: 'mdxpad:plugin:list',
  install: 'mdxpad:plugin:install',
  uninstall: 'mdxpad:plugin:uninstall',
  enable: 'mdxpad:plugin:enable',
  disable: 'mdxpad:plugin:disable',
} as const;

/**
 * Register all plugin-related IPC handlers.
 */
export function registerPluginHandlers(loader: PluginLoader): void {
  ipcMain.handle(PLUGIN_CHANNELS.list, async (): Promise<PluginListResponse> => {
    const plugins = await loader.listPlugins();
    return { plugins };
  });

  ipcMain.handle(PLUGIN_CHANNELS.install, async (_, request): Promise<PluginInstallResponse> => {
    const validated = PluginInstallRequestSchema.parse(request);
    try {
      const plugin = await loader.installPlugin(validated.pluginPath);
      await loader.loadPlugin(plugin.id);
      await loader.activatePlugin(plugin.id);
      const updated = await loader.getRegistry().getPlugin(plugin.id);
      return { ok: true, plugin: updated ?? plugin };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle(
    PLUGIN_CHANNELS.uninstall,
    async (_, request): Promise<PluginUninstallResponse> => {
      const validated = PluginUninstallRequestSchema.parse(request);
      try {
        const removed = await loader.uninstallPlugin(validated.pluginId);
        if (!removed) {
          return { ok: false, error: `Plugin not found: ${validated.pluginId}` };
        }
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  ipcMain.handle(PLUGIN_CHANNELS.enable, async (_, request): Promise<PluginEnableResponse> => {
    const validated = PluginEnableRequestSchema.parse(request);
    try {
      if (!loader.isLoaded(validated.pluginId)) {
        await loader.loadPlugin(validated.pluginId);
      }
      await loader.activatePlugin(validated.pluginId);
      const plugin = await loader.getRegistry().getPlugin(validated.pluginId);
      if (!plugin) {
        return { ok: false, error: `Plugin not found: ${validated.pluginId}` };
      }
      return { ok: true, plugin };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle(PLUGIN_CHANNELS.disable, async (_, request): Promise<PluginDisableResponse> => {
    const validated = PluginDisableRequestSchema.parse(request);
    try {
      await loader.deactivatePlugin(validated.pluginId);
      const plugin = await loader.getRegistry().getPlugin(validated.pluginId);
      if (!plugin) {
        return { ok: false, error: `Plugin not found: ${validated.pluginId}` };
      }
      return { ok: true, plugin };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
