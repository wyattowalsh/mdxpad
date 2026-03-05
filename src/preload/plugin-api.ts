/**
 * Plugin Preload API
 *
 * Exposes plugin operations to the renderer via validated IPC.
 *
 * @module preload/plugin-api
 */

import {
  type PluginDisableRequest,
  type PluginDisableResponse,
  PluginListResponseSchema,
  type PluginListResponse,
  type PluginInstallRequest,
  type PluginInstallResponse,
  PluginInstallRequestSchema,
  PluginInstallResponseSchema,
  type PluginUninstallRequest,
  type PluginUninstallResponse,
  PluginUninstallRequestSchema,
  PluginUninstallResponseSchema,
  type PluginEnableRequest,
  type PluginEnableResponse,
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
  list: () =>
    validatedInvoke<void, PluginListResponse>(CHANNELS.list, null, PluginListResponseSchema),

  install: (pluginPath: string) =>
    validatedInvoke<PluginInstallRequest, PluginInstallResponse>(
      CHANNELS.install,
      PluginInstallRequestSchema,
      PluginInstallResponseSchema,
      { pluginPath }
    ),

  uninstall: (pluginId: string) =>
    validatedInvoke<PluginUninstallRequest, PluginUninstallResponse>(
      CHANNELS.uninstall,
      PluginUninstallRequestSchema,
      PluginUninstallResponseSchema,
      { pluginId }
    ),

  enable: (pluginId: string) =>
    validatedInvoke<PluginEnableRequest, PluginEnableResponse>(
      CHANNELS.enable,
      PluginEnableRequestSchema,
      PluginEnableResponseSchema,
      { pluginId }
    ),

  disable: (pluginId: string) =>
    validatedInvoke<PluginDisableRequest, PluginDisableResponse>(
      CHANNELS.disable,
      PluginDisableRequestSchema,
      PluginDisableResponseSchema,
      { pluginId }
    ),
};
