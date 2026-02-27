/**
 * AutosaveSettingsService Unit Tests
 *
 * Tests for settings persistence, validation, partial updates,
 * and default value handling.
 *
 * @module tests/unit/autosave-settings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

const mockStore = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  return {
    get: vi.fn((key: string) => data[key]),
    set: vi.fn((key: string, value: unknown) => {
      data[key] = value;
    }),
    _data: data,
    _reset: () => {
      for (const k of Object.keys(data)) {
        data[k] = undefined;
      }
    },
  };
});

vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation((opts: { defaults?: Record<string, unknown> }) => {
    mockStore._reset();
    if (opts.defaults) {
      Object.entries(opts.defaults).forEach(([k, v]) => {
        mockStore._data[k] = v;
      });
    }
    return mockStore;
  }),
}));

import ElectronStore from 'electron-store';
import { AutosaveSettingsService, DEFAULT_AUTOSAVE_SETTINGS } from '../autosave-settings';

// ============================================================================
// Tests
// ============================================================================

describe('AutosaveSettingsService', () => {
  let service: AutosaveSettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AutosaveSettingsService();
  });

  // --------------------------------------------------------------------------
  // Constructor
  // --------------------------------------------------------------------------

  describe('constructor', () => {
    it('should create a store with correct name and defaults', () => {
      const Store = vi.mocked(ElectronStore);

      expect(Store).toHaveBeenCalledWith({
        name: 'autosave-settings',
        defaults: {
          settings: DEFAULT_AUTOSAVE_SETTINGS,
        },
      });
    });
  });

  // --------------------------------------------------------------------------
  // getSettings
  // --------------------------------------------------------------------------

  describe('getSettings', () => {
    it('should return default settings when no settings are saved', () => {
      const settings = service.getSettings();

      expect(settings).toEqual(DEFAULT_AUTOSAVE_SETTINGS);
    });

    it('should return persisted settings', () => {
      const custom = {
        enabled: false,
        intervalMs: 60000,
        retentionDays: 14,
        maxFiles: 100,
        maxStorageMB: 500,
      };
      mockStore._data.settings = custom;

      const settings = service.getSettings();

      expect(settings).toEqual(custom);
    });
  });

  // --------------------------------------------------------------------------
  // setSettings
  // --------------------------------------------------------------------------

  describe('setSettings', () => {
    it('should merge partial settings with current settings', () => {
      const result = service.setSettings({ intervalMs: 15000 });

      expect(result.intervalMs).toBe(15000);
      expect(result.enabled).toBe(DEFAULT_AUTOSAVE_SETTINGS.enabled);
      expect(result.retentionDays).toBe(DEFAULT_AUTOSAVE_SETTINGS.retentionDays);
    });

    it('should persist the merged settings', () => {
      service.setSettings({ enabled: false });

      expect(mockStore.set).toHaveBeenCalledWith(
        'settings',
        expect.objectContaining({
          enabled: false,
          intervalMs: DEFAULT_AUTOSAVE_SETTINGS.intervalMs,
        })
      );
    });

    it('should return validated settings', () => {
      const result = service.setSettings({
        intervalMs: 60000,
        retentionDays: 14,
      });

      expect(result.intervalMs).toBe(60000);
      expect(result.retentionDays).toBe(14);
    });

    it('should update multiple settings at once', () => {
      const result = service.setSettings({
        enabled: false,
        intervalMs: 5000,
        retentionDays: 7,
        maxFiles: 10,
        maxStorageMB: 50,
      });

      expect(result.enabled).toBe(false);
      expect(result.intervalMs).toBe(5000);
      expect(result.retentionDays).toBe(7);
      expect(result.maxFiles).toBe(10);
      expect(result.maxStorageMB).toBe(50);
    });

    it('should throw ZodError for invalid intervalMs below minimum', () => {
      expect(() => service.setSettings({ intervalMs: 1000 })).toThrow();
    });

    it('should throw ZodError for invalid intervalMs above maximum', () => {
      expect(() => service.setSettings({ intervalMs: 700000 })).toThrow();
    });

    it('should throw ZodError for invalid retentionDays below minimum', () => {
      expect(() => service.setSettings({ retentionDays: 0 })).toThrow();
    });

    it('should throw ZodError for invalid retentionDays above maximum', () => {
      expect(() => service.setSettings({ retentionDays: 400 })).toThrow();
    });

    it('should accept boundary values', () => {
      const minResult = service.setSettings({ intervalMs: 5000 });
      expect(minResult.intervalMs).toBe(5000);

      const maxResult = service.setSettings({ intervalMs: 600000 });
      expect(maxResult.intervalMs).toBe(600000);
    });
  });
});
