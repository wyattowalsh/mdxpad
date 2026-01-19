/**
 * AutosaveSettingsService - Manages autosave configuration settings.
 *
 * This service provides persistence for autosave settings using electron-store,
 * storing data at the user's app data directory. It validates all settings
 * using zod schemas per Constitution Article III.3.
 *
 * Per FR-009: Configurable autosave interval (5s to 10min).
 * Per FR-010: Enable/disable autosave support.
 * Per FR-011: Settings persist across application restarts.
 *
 * @module main/services/autosave-settings
 */

import Store from 'electron-store';
import {
  type AutosaveSettings,
  AutosaveSettingsSchema,
  DEFAULT_AUTOSAVE_SETTINGS,
} from '@shared/contracts/autosave-schemas';

// Re-export for consumers of this service
export { DEFAULT_AUTOSAVE_SETTINGS };

/**
 * Schema definition for the electron-store instance.
 */
interface StoreSchema {
  settings: AutosaveSettings;
}

/**
 * Service for managing autosave configuration settings.
 *
 * Provides methods to retrieve and update autosave settings with full
 * validation and persistence. Settings are merged with defaults on partial
 * updates, ensuring all required fields are always present.
 *
 * Per FR-009: Supports configurable interval from 5000ms to 600000ms.
 * Per FR-010: Supports enabling/disabling autosave functionality.
 * Per FR-011: All settings are persisted to disk and restored on startup.
 *
 * @example
 * ```typescript
 * const settingsService = new AutosaveSettingsService();
 *
 * // Get current settings (returns defaults if none saved)
 * const settings = settingsService.getSettings();
 * console.log(settings.intervalMs); // 30000 (default)
 *
 * // Update specific settings (partial update)
 * const updated = settingsService.setSettings({ intervalMs: 15000 });
 * console.log(updated.intervalMs); // 15000
 *
 * // Disable autosave
 * settingsService.setSettings({ enabled: false });
 * ```
 */
export class AutosaveSettingsService {
  private readonly store: Store<StoreSchema>;

  /**
   * Creates a new AutosaveSettingsService instance.
   *
   * The store is persisted at the user's app data directory
   * (app.getPath('userData')) in a file named 'autosave-settings.json'.
   * Default settings are applied per Constitution VII.3: minimum every
   * 30 seconds if dirty.
   */
  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'autosave-settings',
      defaults: {
        settings: DEFAULT_AUTOSAVE_SETTINGS,
      },
    });
  }

  /**
   * Retrieves the current autosave settings.
   *
   * Returns persisted settings if available, otherwise returns
   * {@link DEFAULT_AUTOSAVE_SETTINGS}. The returned settings are
   * guaranteed to be valid per {@link AutosaveSettingsSchema}.
   *
   * Per FR-011: Settings persist across application restarts.
   *
   * @returns The current autosave settings
   */
  getSettings(): AutosaveSettings {
    return this.store.get('settings');
  }

  /**
   * Updates autosave settings with partial values.
   *
   * Merges the provided partial settings with current settings, validates
   * the result against {@link AutosaveSettingsSchema}, and persists the
   * validated settings. Throws an error if validation fails.
   *
   * Per FR-009: intervalMs must be between 5000 and 600000 milliseconds.
   * Per FR-010: enabled can be set to true or false.
   * Per FR-011: Updated settings are immediately persisted.
   *
   * @param partial - Partial settings to merge with current settings
   * @returns The validated and persisted settings after the update
   * @throws {ZodError} If the merged settings fail validation
   *
   * @example
   * ```typescript
   * // Update interval only
   * settingsService.setSettings({ intervalMs: 60000 });
   *
   * // Update multiple settings
   * settingsService.setSettings({
   *   enabled: true,
   *   intervalMs: 15000,
   *   retentionDays: 14,
   * });
   * ```
   */
  setSettings(partial: Partial<AutosaveSettings>): AutosaveSettings {
    const current = this.getSettings();
    const merged = { ...current, ...partial };

    // Validate the merged settings - throws ZodError on validation failure
    const validated = AutosaveSettingsSchema.parse(merged);

    this.store.set('settings', validated);
    return validated;
  }
}
