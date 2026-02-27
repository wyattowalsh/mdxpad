/**
 * Plugin System IPC Contracts
 *
 * Zod schemas for plugin system IPC communication.
 * Defines manifest validation, lifecycle operations, and marketplace schemas.
 *
 * @module shared/contracts/plugin-schemas
 */

import { z } from 'zod';

// ============================================================================
// Plugin Permission Types
// ============================================================================

export const PluginPermissionSchema = z.enum(['file-read', 'file-write', 'ui', 'network']);
export type PluginPermission = z.infer<typeof PluginPermissionSchema>;

// ============================================================================
// Plugin Manifest
// ============================================================================

export const PluginManifestSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500),
  author: z.string().optional(),
  permissions: z.array(PluginPermissionSchema),
  entryPoint: z.string().default('index.js'),
});
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

// ============================================================================
// Plugin State
// ============================================================================

export const PluginStateSchema = z.enum(['installed', 'active', 'disabled', 'error']);
export type PluginState = z.infer<typeof PluginStateSchema>;

// ============================================================================
// Plugin Record
// ============================================================================

export const PluginRecordSchema = z.object({
  id: z.string().min(1),
  manifest: PluginManifestSchema,
  state: PluginStateSchema,
  installedAt: z.number().int().nonnegative(),
  error: z.string().optional(),
});
export type PluginRecord = z.infer<typeof PluginRecordSchema>;

// ============================================================================
// IPC Request/Response Schemas
// ============================================================================

export const PluginListRequestSchema = z.void();
export const PluginListResponseSchema = z.object({
  plugins: z.array(PluginRecordSchema),
});
export type PluginListResponse = z.infer<typeof PluginListResponseSchema>;

export const PluginInstallRequestSchema = z.object({
  pluginPath: z.string().min(1),
});
export type PluginInstallRequest = z.infer<typeof PluginInstallRequestSchema>;

export const PluginInstallResponseSchema = z.object({
  ok: z.boolean(),
  plugin: PluginRecordSchema.optional(),
  error: z.string().optional(),
});
export type PluginInstallResponse = z.infer<typeof PluginInstallResponseSchema>;

export const PluginUninstallRequestSchema = z.object({
  pluginId: z.string().min(1),
});
export type PluginUninstallRequest = z.infer<typeof PluginUninstallRequestSchema>;

export const PluginUninstallResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});
export type PluginUninstallResponse = z.infer<typeof PluginUninstallResponseSchema>;

export const PluginEnableRequestSchema = z.object({
  pluginId: z.string().min(1),
});
export type PluginEnableRequest = z.infer<typeof PluginEnableRequestSchema>;

export const PluginEnableResponseSchema = z.object({
  ok: z.boolean(),
  plugin: PluginRecordSchema.optional(),
  error: z.string().optional(),
});
export type PluginEnableResponse = z.infer<typeof PluginEnableResponseSchema>;

export const PluginDisableRequestSchema = z.object({
  pluginId: z.string().min(1),
});
export type PluginDisableRequest = z.infer<typeof PluginDisableRequestSchema>;

export const PluginDisableResponseSchema = z.object({
  ok: z.boolean(),
  plugin: PluginRecordSchema.optional(),
  error: z.string().optional(),
});
export type PluginDisableResponse = z.infer<typeof PluginDisableResponseSchema>;

// ============================================================================
// Marketplace Schemas
// ============================================================================

export const MarketplacePluginSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500),
  author: z.string().optional(),
  permissions: z.array(PluginPermissionSchema),
  downloadUrl: z.string().optional(),
  downloads: z.number().int().nonnegative().optional(),
});
export type MarketplacePlugin = z.infer<typeof MarketplacePluginSchema>;

export const MarketplaceListResponseSchema = z.object({
  plugins: z.array(MarketplacePluginSchema),
});
export type MarketplaceListResponse = z.infer<typeof MarketplaceListResponseSchema>;

// ============================================================================
// Theme Schemas
// ============================================================================

export const ThemeTokensSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  cursor: z.string().optional(),
  selection: z.string().optional(),
  lineHighlight: z.string().optional(),
  comment: z.string().optional(),
  keyword: z.string().optional(),
  string: z.string().optional(),
  number: z.string().optional(),
  function: z.string().optional(),
  variable: z.string().optional(),
  type: z.string().optional(),
  operator: z.string().optional(),
});
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;

export const ThemeDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum(['light', 'dark']),
  tokens: ThemeTokensSchema,
  cssVariables: z.record(z.string()).optional(),
  builtIn: z.boolean().default(false),
});
export type ThemeDefinition = z.infer<typeof ThemeDefinitionSchema>;

export const ThemeListResponseSchema = z.object({
  themes: z.array(ThemeDefinitionSchema),
  activeThemeId: z.string().nullable(),
});
export type ThemeListResponse = z.infer<typeof ThemeListResponseSchema>;

export const ThemeApplyRequestSchema = z.object({
  themeId: z.string().min(1),
});
export type ThemeApplyRequest = z.infer<typeof ThemeApplyRequestSchema>;

export const ThemeApplyResponseSchema = z.object({
  ok: z.boolean(),
  theme: ThemeDefinitionSchema.optional(),
  error: z.string().optional(),
});
export type ThemeApplyResponse = z.infer<typeof ThemeApplyResponseSchema>;
