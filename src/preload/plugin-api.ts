/**
 * Plugin Preload API
 *
 * Exposes plugin operations to the renderer via validated IPC.
 *
 * @module preload/plugin-api
 */

import {
  PluginListResponseSchema,
  PluginInstallRequestSchema,
  PluginInstallResponseSchema,
  PluginUninstallRequestSchema,
  PluginUninstallResponseSchema,
  PluginEnableRequestSchema,
  PluginEnableResponseSchema,
  PluginDisableRequestSchema,
  PluginDisableResponseSchema,
} from '@shared/contracts/plugin-schemas';

import { validatedInvoke } from './validated-invoke';

const CHANNELS = {
  list: 'mdxpad:plugin:list',
  install: 'mdxpad:plugin:install',
  uninstall: 'mdxpad:plugin:uninstall',
  enable: 'mdxpad:plugin:enable',
  disable: 'mdxpad:plugin:disable',
} as const;

export const pluginApi = {
  list: () => validatedInvoke(CHANNELS.list, null, PluginListResponseSchema),

  install: (pluginPath: string) =>
    validatedInvoke(CHANNELS.install, PluginInstallRequestSchema, PluginInstallResponseSchema, {
      pluginPath,
    }),

  uninstall: (pluginId: string) =>
    validatedInvoke(
      CHANNELS.uninstall,
      PluginUninstallRequestSchema,
      PluginUninstallResponseSchema,
      { pluginId }
    ),

  enable: (pluginId: string) =>
    validatedInvoke(CHANNELS.enable, PluginEnableRequestSchema, PluginEnableResponseSchema, {
      pluginId,
    }),

  disable: (pluginId: string) =>
    validatedInvoke(CHANNELS.disable, PluginDisableRequestSchema, PluginDisableResponseSchema, {
      pluginId,
    }),
};
