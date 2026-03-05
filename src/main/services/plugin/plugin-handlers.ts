/**
 * Plugin IPC Handlers
 *
 * Registers IPC handlers for plugin lifecycle operations.
 *
 * @module main/services/plugin/plugin-handlers
 */

import type { BrowserWindow, IpcMain } from 'electron';

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
import { registerAuthorizedIpcHandler } from '@main/ipc/ipc-sender-authorization';

/** IPC channel names for plugin operations */
export const PLUGIN_CHANNELS = {
  list: 'mdxpad:plugin:list',
  install: 'mdxpad:plugin:install',
  uninstall: 'mdxpad:plugin:uninstall',
  enable: 'mdxpad:plugin:enable',
  disable: 'mdxpad:plugin:disable',
} as const;

/** Handle plugin:list */
async function handleList(loader: PluginLoader): Promise<PluginListResponse> {
  const plugins = await loader.listPlugins();
  return { plugins };
}

/** Handle plugin:install */
async function handleInstall(
  loader: PluginLoader,
  request: unknown
): Promise<PluginInstallResponse> {
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
}

/** Handle plugin:uninstall */
async function handleUninstall(
  loader: PluginLoader,
  request: unknown
): Promise<PluginUninstallResponse> {
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

/** Handle plugin:enable */
async function handleEnable(loader: PluginLoader, request: unknown): Promise<PluginEnableResponse> {
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
}

/** Handle plugin:disable */
async function handleDisable(
  loader: PluginLoader,
  request: unknown
): Promise<PluginDisableResponse> {
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
}

/**
 * Register all plugin-related IPC handlers.
 */
export function registerPluginHandlers(
  ipcMain: IpcMain,
  window: BrowserWindow,
  loader: PluginLoader
): void {
  registerAuthorizedIpcHandler(ipcMain, window, PLUGIN_CHANNELS.list, async () =>
    handleList(loader)
  );
  registerAuthorizedIpcHandler(ipcMain, window, PLUGIN_CHANNELS.install, async (_, req) =>
    handleInstall(loader, req)
  );
  registerAuthorizedIpcHandler(ipcMain, window, PLUGIN_CHANNELS.uninstall, async (_, req) =>
    handleUninstall(loader, req)
  );
  registerAuthorizedIpcHandler(ipcMain, window, PLUGIN_CHANNELS.enable, async (_, req) =>
    handleEnable(loader, req)
  );
  registerAuthorizedIpcHandler(ipcMain, window, PLUGIN_CHANNELS.disable, async (_, req) =>
    handleDisable(loader, req)
  );
}
