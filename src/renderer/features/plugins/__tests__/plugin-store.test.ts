/**
 * Plugin Store Tests
 *
 * @module renderer/features/plugins/__tests__/plugin-store.test
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { PluginRecord, MarketplacePlugin } from '@shared/contracts/plugin-schemas';

import { usePluginStore } from '../plugin-store';

const mockPlugin: PluginRecord = {
  id: 'test-plugin',
  manifest: {
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    permissions: ['ui'],
    entryPoint: 'index.js',
  },
  state: 'installed',
  installedAt: 1700000000000,
};

const mockMarketplace: MarketplacePlugin = {
  id: 'market-plugin',
  name: 'Market Plugin',
  version: '2.0.0',
  description: 'A marketplace plugin',
  permissions: ['network'],
};

describe('usePluginStore', () => {
  beforeEach(() => {
    // Reset store between tests
    usePluginStore.setState({
      plugins: [],
      marketplace: [],
      isLoading: false,
      error: null,
      selectedPluginId: null,
    });
  });

  it('starts with empty state', () => {
    const { result } = renderHook(() => usePluginStore());
    expect(result.current.plugins).toEqual([]);
    expect(result.current.marketplace).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.selectedPluginId).toBeNull();
  });

  it('sets plugins', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.setPlugins([mockPlugin]);
    });

    expect(result.current.plugins).toHaveLength(1);
    expect(result.current.plugins[0]?.id).toBe('test-plugin');
  });

  it('sets marketplace plugins', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.setMarketplace([mockMarketplace]);
    });

    expect(result.current.marketplace).toHaveLength(1);
    expect(result.current.marketplace[0]?.id).toBe('market-plugin');
  });

  it('sets loading state', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('sets error', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.setError('Something went wrong');
    });

    expect(result.current.error).toBe('Something went wrong');
  });

  it('sets error to null', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.setError('error');
    });
    act(() => {
      result.current.setError(null);
    });

    expect(result.current.error).toBeNull();
  });

  it('selects a plugin', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.selectPlugin('test-plugin');
    });

    expect(result.current.selectedPluginId).toBe('test-plugin');
  });

  it('deselects a plugin', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.selectPlugin('test-plugin');
    });
    act(() => {
      result.current.selectPlugin(null);
    });

    expect(result.current.selectedPluginId).toBeNull();
  });

  it('updates a plugin', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.setPlugins([mockPlugin]);
    });

    const updated: PluginRecord = { ...mockPlugin, state: 'active' };

    act(() => {
      result.current.updatePlugin(updated);
    });

    expect(result.current.plugins[0]?.state).toBe('active');
  });

  it('does not crash when updating non-existent plugin', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.updatePlugin({ ...mockPlugin, id: 'nonexistent' });
    });

    expect(result.current.plugins).toHaveLength(0);
  });

  it('removes a plugin', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.setPlugins([mockPlugin]);
    });

    act(() => {
      result.current.removePlugin('test-plugin');
    });

    expect(result.current.plugins).toHaveLength(0);
  });

  it('adds a plugin', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.addPlugin(mockPlugin);
    });

    expect(result.current.plugins).toHaveLength(1);
    expect(result.current.plugins[0]?.id).toBe('test-plugin');
  });

  it('replaces plugin when adding with existing ID', () => {
    const { result } = renderHook(() => usePluginStore());

    act(() => {
      result.current.addPlugin(mockPlugin);
    });

    const updated: PluginRecord = {
      ...mockPlugin,
      manifest: { ...mockPlugin.manifest, version: '2.0.0' },
    };

    act(() => {
      result.current.addPlugin(updated);
    });

    expect(result.current.plugins).toHaveLength(1);
    expect(result.current.plugins[0]?.manifest.version).toBe('2.0.0');
  });
});
