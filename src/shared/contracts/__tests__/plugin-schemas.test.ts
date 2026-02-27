/**
 * Plugin Schemas Tests
 *
 * @module shared/contracts/__tests__/plugin-schemas.test
 */

import { describe, expect, it } from 'vitest';

import {
  PluginManifestSchema,
  PluginRecordSchema,
  PluginStateSchema,
  PluginPermissionSchema,
  MarketplacePluginSchema,
  ThemeDefinitionSchema,
  ThemeTokensSchema,
  PluginInstallRequestSchema,
  PluginUninstallRequestSchema,
  PluginEnableRequestSchema,
  PluginDisableRequestSchema,
} from '../plugin-schemas';

// ============================================================================
// PluginManifestSchema
// ============================================================================

describe('PluginManifestSchema', () => {
  it('validates a valid manifest', () => {
    const result = PluginManifestSchema.safeParse({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test Author',
      permissions: ['file-read', 'ui'],
      entryPoint: 'index.js',
    });
    expect(result.success).toBe(true);
  });

  it('applies default entryPoint', () => {
    const result = PluginManifestSchema.safeParse({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'A test plugin',
      permissions: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entryPoint).toBe('index.js');
    }
  });

  it('rejects empty name', () => {
    const result = PluginManifestSchema.safeParse({
      name: '',
      version: '1.0.0',
      description: 'test',
      permissions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    const result = PluginManifestSchema.safeParse({
      name: 'a'.repeat(101),
      version: '1.0.0',
      description: 'test',
      permissions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid version format', () => {
    const result = PluginManifestSchema.safeParse({
      name: 'test',
      version: 'v1.0',
      description: 'test',
      permissions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects description over 500 chars', () => {
    const result = PluginManifestSchema.safeParse({
      name: 'test',
      version: '1.0.0',
      description: 'a'.repeat(501),
      permissions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid permission', () => {
    const result = PluginManifestSchema.safeParse({
      name: 'test',
      version: '1.0.0',
      description: 'test',
      permissions: ['invalid-perm'],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// PluginPermissionSchema
// ============================================================================

describe('PluginPermissionSchema', () => {
  it.each(['file-read', 'file-write', 'ui', 'network'])('accepts %s', (perm) => {
    expect(PluginPermissionSchema.safeParse(perm).success).toBe(true);
  });

  it('rejects invalid permission', () => {
    expect(PluginPermissionSchema.safeParse('admin').success).toBe(false);
  });
});

// ============================================================================
// PluginStateSchema
// ============================================================================

describe('PluginStateSchema', () => {
  it.each(['installed', 'active', 'disabled', 'error'])('accepts %s', (state) => {
    expect(PluginStateSchema.safeParse(state).success).toBe(true);
  });

  it('rejects invalid state', () => {
    expect(PluginStateSchema.safeParse('loading').success).toBe(false);
  });
});

// ============================================================================
// PluginRecordSchema
// ============================================================================

describe('PluginRecordSchema', () => {
  it('validates a complete plugin record', () => {
    const result = PluginRecordSchema.safeParse({
      id: 'my-plugin',
      manifest: {
        name: 'My Plugin',
        version: '1.0.0',
        description: 'test',
        permissions: ['ui'],
        entryPoint: 'index.js',
      },
      state: 'active',
      installedAt: 1700000000000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional error field', () => {
    const result = PluginRecordSchema.safeParse({
      id: 'my-plugin',
      manifest: {
        name: 'My Plugin',
        version: '1.0.0',
        description: 'test',
        permissions: [],
        entryPoint: 'index.js',
      },
      state: 'error',
      installedAt: 1700000000000,
      error: 'Something went wrong',
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// MarketplacePluginSchema
// ============================================================================

describe('MarketplacePluginSchema', () => {
  it('validates marketplace plugin', () => {
    const result = MarketplacePluginSchema.safeParse({
      id: 'market-plugin',
      name: 'Market Plugin',
      version: '2.0.0',
      description: 'A marketplace plugin',
      author: 'Author',
      permissions: ['network'],
      downloadUrl: 'https://example.com/plugin.zip',
      downloads: 1500,
    });
    expect(result.success).toBe(true);
  });

  it('allows optional fields', () => {
    const result = MarketplacePluginSchema.safeParse({
      id: 'minimal',
      name: 'Minimal',
      version: '0.1.0',
      description: 'min',
      permissions: [],
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// ThemeSchemas
// ============================================================================

describe('ThemeTokensSchema', () => {
  it('validates with required fields only', () => {
    const result = ThemeTokensSchema.safeParse({
      background: '#fff',
      foreground: '#000',
    });
    expect(result.success).toBe(true);
  });

  it('validates with all fields', () => {
    const result = ThemeTokensSchema.safeParse({
      background: '#fff',
      foreground: '#000',
      cursor: '#333',
      selection: '#aaa',
      lineHighlight: '#f0f0f0',
      comment: '#999',
      keyword: '#00f',
      string: '#0a0',
      number: '#a0a',
      function: '#aa0',
      variable: '#0aa',
      type: '#f00',
      operator: '#555',
    });
    expect(result.success).toBe(true);
  });
});

describe('ThemeDefinitionSchema', () => {
  it('validates a theme definition', () => {
    const result = ThemeDefinitionSchema.safeParse({
      id: 'my-theme',
      name: 'My Theme',
      type: 'dark',
      tokens: { background: '#1e1e1e', foreground: '#d4d4d4' },
      builtIn: false,
    });
    expect(result.success).toBe(true);
  });

  it('defaults builtIn to false', () => {
    const result = ThemeDefinitionSchema.safeParse({
      id: 'custom',
      name: 'Custom',
      type: 'light',
      tokens: { background: '#fff', foreground: '#000' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.builtIn).toBe(false);
    }
  });

  it('accepts cssVariables', () => {
    const result = ThemeDefinitionSchema.safeParse({
      id: 'vars',
      name: 'With Vars',
      type: 'dark',
      tokens: { background: '#000', foreground: '#fff' },
      cssVariables: { '--color-primary': '#0066cc' },
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// IPC Request Schemas
// ============================================================================

describe('IPC Request Schemas', () => {
  it('validates PluginInstallRequestSchema', () => {
    const result = PluginInstallRequestSchema.safeParse({ pluginPath: '/path/to/plugin' });
    expect(result.success).toBe(true);
  });

  it('rejects empty pluginPath', () => {
    const result = PluginInstallRequestSchema.safeParse({ pluginPath: '' });
    expect(result.success).toBe(false);
  });

  it('validates PluginUninstallRequestSchema', () => {
    const result = PluginUninstallRequestSchema.safeParse({ pluginId: 'my-plugin' });
    expect(result.success).toBe(true);
  });

  it('validates PluginEnableRequestSchema', () => {
    const result = PluginEnableRequestSchema.safeParse({ pluginId: 'my-plugin' });
    expect(result.success).toBe(true);
  });

  it('validates PluginDisableRequestSchema', () => {
    const result = PluginDisableRequestSchema.safeParse({ pluginId: 'my-plugin' });
    expect(result.success).toBe(true);
  });
});
