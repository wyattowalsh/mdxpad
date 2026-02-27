/**
 * Plugin Store
 *
 * Zustand store for managing plugin marketplace and installed plugins state.
 *
 * @module renderer/features/plugins/plugin-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type { PluginRecord, MarketplacePlugin } from '@shared/contracts/plugin-schemas';

// ============================================================================
// Types
// ============================================================================

interface PluginStoreState {
  /** Currently installed plugins */
  plugins: PluginRecord[];
  /** Available marketplace plugins */
  marketplace: MarketplacePlugin[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Currently selected plugin for detail view */
  selectedPluginId: string | null;

  /** Set installed plugins */
  setPlugins: (plugins: PluginRecord[]) => void;
  /** Set marketplace plugins */
  setMarketplace: (plugins: MarketplacePlugin[]) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error */
  setError: (error: string | null) => void;
  /** Select a plugin for detail view */
  selectPlugin: (pluginId: string | null) => void;
  /** Update a single plugin in the list */
  updatePlugin: (plugin: PluginRecord) => void;
  /** Remove a plugin from the list */
  removePlugin: (pluginId: string) => void;
  /** Add a plugin to the list */
  addPlugin: (plugin: PluginRecord) => void;
}

// ============================================================================
// Store
// ============================================================================

export const usePluginStore = create<PluginStoreState>()(
  immer((set) => ({
    plugins: [],
    marketplace: [],
    isLoading: false,
    error: null,
    selectedPluginId: null,

    setPlugins: (plugins) =>
      set((state) => {
        state.plugins = plugins;
      }),

    setMarketplace: (plugins) =>
      set((state) => {
        state.marketplace = plugins;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
      }),

    selectPlugin: (pluginId) =>
      set((state) => {
        state.selectedPluginId = pluginId;
      }),

    updatePlugin: (plugin) =>
      set((state) => {
        const index = state.plugins.findIndex((p) => p.id === plugin.id);
        if (index >= 0) {
          state.plugins[index] = plugin;
        }
      }),

    removePlugin: (pluginId) =>
      set((state) => {
        state.plugins = state.plugins.filter((p) => p.id !== pluginId);
      }),

    addPlugin: (plugin) =>
      set((state) => {
        const existing = state.plugins.findIndex((p) => p.id === plugin.id);
        if (existing >= 0) {
          state.plugins[existing] = plugin;
        } else {
          state.plugins.push(plugin);
        }
      }),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectPlugins = (s: PluginStoreState): PluginRecord[] => s.plugins;
export const selectMarketplace = (s: PluginStoreState): MarketplacePlugin[] => s.marketplace;
export const selectIsLoading = (s: PluginStoreState): boolean => s.isLoading;
export const selectError = (s: PluginStoreState): string | null => s.error;
export const selectSelectedPluginId = (s: PluginStoreState): string | null => s.selectedPluginId;
