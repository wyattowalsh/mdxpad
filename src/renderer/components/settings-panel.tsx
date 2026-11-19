/**
 * SettingsPanel Component
 *
 * Modal dialog for application settings including autosave configuration.
 * Per FR-009: Configurable autosave interval (5s-10min, slider shows 5s-30s for common use).
 * Per FR-010: Enable/disable autosave toggle.
 * Per FR-011: Settings persist via IPC to electron-store.
 *
 * @module renderer/components/settings-panel
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { Settings, Clock, Save, Info, Type } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import type { AutosaveSettings } from '@shared/contracts/autosave-schemas';
import { DEFAULT_AUTOSAVE_SETTINGS } from '@shared/contracts/autosave-schemas';
import {
  useFeatureFlagsStore,
  selectFeatureFlags,
  type FeatureFlagKey,
} from '../stores/feature-flags-store';
import { useUtilityPanelStore } from '../stores/utility-panel-store';
import { useEditorPreferencesStore } from '../stores/editor-preferences-store';
import type { KeymapMode } from '../lib/editor/keymaps';

// ============================================================================
// Types
// ============================================================================

export interface SettingsPanelProps {
  /** Whether the settings panel is open */
  readonly isOpen: boolean;
  /** Callback when the panel should close */
  readonly onClose: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Autosave interval choices.
 * FR-009: 5 seconds through 10 minutes.
 */
export const AUTOSAVE_INTERVAL_STEPS = [
  5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000,
] as const;

const FEATURE_FLAG_OPTIONS: readonly {
  key: FeatureFlagKey;
  label: string;
  description: string;
}[] = [
  {
    key: 'workspace',
    label: 'Workspace Surface',
    description: 'Workspace status and workspace-linked interactions.',
  },
  {
    key: 'ai',
    label: 'AI Surface',
    description: 'AI provider settings and AI-assisted authoring actions.',
  },
  {
    key: 'export',
    label: 'Export Surface',
    description: 'Export actions from the command palette and file flows.',
  },
  {
    key: 'authoring',
    label: 'Authoring Surface',
    description: 'Frontmatter authoring and related writing workflows.',
  },
  {
    key: 'plugin',
    label: 'Plugin Surface',
    description: 'Plugin discovery and management flows.',
  },
] as const;

// ============================================================================
// IPC Helpers (Stubs until preload is updated)
// ============================================================================

// Type guard for settings API availability

function hasSettingsApi(api: unknown): api is {
  settings: {
    get: () => Promise<AutosaveSettings>;
    set: (s: Partial<AutosaveSettings>) => Promise<AutosaveSettings>;
  };
} {
  return (
    typeof api === 'object' &&
    api !== null &&
    'settings' in api &&
    typeof (api as Record<string, unknown>).settings === 'object' &&
    (api as Record<string, unknown>).settings !== null
  );
}

/**
 * Get current autosave settings from main process.
 * TODO: Replace with window.mdxpad.settings.get() when preload is updated.
 */
const getSettings = async (): Promise<AutosaveSettings> => {
  // Check if the API is available
  if (typeof window !== 'undefined' && hasSettingsApi(window.mdxpad)) {
    return window.mdxpad.settings.get();
  }
  console.debug('[SettingsPanel] Getting settings (stub)');
  return DEFAULT_AUTOSAVE_SETTINGS;
};

/**
 * Update autosave settings in main process.
 * TODO: Replace with window.mdxpad.settings.set(settings) when preload is updated.
 */
const setSettings = async (settings: Partial<AutosaveSettings>): Promise<AutosaveSettings> => {
  // Check if the API is available
  if (typeof window !== 'undefined' && hasSettingsApi(window.mdxpad)) {
    return window.mdxpad.settings.set(settings);
  }
  console.debug('[SettingsPanel] Setting settings (stub):', settings);
  // For now, just return merged settings optimistically
  const current = await getSettings();
  return { ...current, ...settings };
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format interval in milliseconds for display.
 *
 * @param ms - Interval in milliseconds
 * @returns Human-readable string (e.g., "30 seconds", "1 minute")
 */
function formatInterval(ms: number): string {
  if (ms < 60000) {
    return `${ms / 1000} seconds`;
  }
  const minutes = ms / 60000;
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Convert milliseconds to slider step index.
 *
 * @param ms - Interval in milliseconds
 * @returns Slider step index (0-based)
 */
function msToSliderValue(ms: number): number {
  const idx = AUTOSAVE_INTERVAL_STEPS.findIndex((step) => step >= ms);
  return idx >= 0 ? idx : AUTOSAVE_INTERVAL_STEPS.length - 1;
}

/**
 * Convert slider step index to milliseconds.
 *
 * @param value - Slider step index
 * @returns Interval in milliseconds
 */
export function autosaveIntervalFromSlider(value: number): number {
  return AUTOSAVE_INTERVAL_STEPS[value] ?? DEFAULT_AUTOSAVE_SETTINGS.intervalMs;
}

type RecoveryLimitField = 'retentionDays' | 'maxFiles' | 'maxStorageMB';

const RECOVERY_LIMITS: Record<RecoveryLimitField, { readonly min: number; readonly max: number }> = {
  retentionDays: { min: 1, max: 365 },
  maxFiles: { min: 5, max: 200 },
  maxStorageMB: { min: 10, max: 1000 },
};

function recoveryLimitPatch(
  field: RecoveryLimitField,
  value: number
): Partial<AutosaveSettings> {
  switch (field) {
    case 'retentionDays':
      return { retentionDays: value };
    case 'maxFiles':
      return { maxFiles: value };
    case 'maxStorageMB':
      return { maxStorageMB: value };
    default: {
      const unreachable: never = field;
      return unreachable;
    }
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Settings panel component for configuring application settings.
 *
 * Features:
 * - Autosave enable/disable toggle (FR-010)
 * - Autosave interval slider (FR-009, Constitution VII.3)
 * - Settings persist via IPC (FR-011)
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <SettingsPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
function RecoveryLimitInput({
  id,
  label,
  hint,
  min,
  max,
  value,
  disabled,
  onValue,
  onCommit,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly disabled: boolean;
  readonly onValue: (value: number) => void;
  readonly onCommit: (raw: string) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <input
        id={id}
        data-testid={id}
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-sm"
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isInteger(next)) {
            onValue(next);
          }
        }}
        onBlur={(event) => {
          onCommit(event.target.value);
        }}
      />
    </div>
  );
}

function SettingsPanelComponent({ isOpen, onClose }: SettingsPanelProps): React.JSX.Element {
  // Local state for settings form
  const [settings, setLocalSettings] = useState<AutosaveSettings>(DEFAULT_AUTOSAVE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const featureFlags = useFeatureFlagsStore(selectFeatureFlags);
  const setFeatureFlag = useFeatureFlagsStore((state) => state.setFlag);

  // Load settings when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoading(true);

    getSettings()
      .then((s) => {
        if (mounted) setLocalSettings(s);
      })
      .catch((err: unknown) => console.error('[SettingsPanel] Failed to load settings:', err))
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Handle enabled toggle change
  const handleEnabledChange = useCallback(async (enabled: boolean) => {
    // Optimistic update
    setLocalSettings((prev) => ({ ...prev, enabled }));
    setIsSaving(true);

    try {
      const updated = await setSettings({ enabled });
      setLocalSettings(updated);
    } catch (error) {
      console.error('[SettingsPanel] Failed to update enabled:', error);
      // Revert optimistic update on error
      setLocalSettings((prev) => ({ ...prev, enabled: !enabled }));
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Handle interval change (optimistic update during drag)
  const handleIntervalChange = useCallback((value: number[]) => {
    const intervalMs = autosaveIntervalFromSlider(value[0] ?? 0);
    setLocalSettings((prev) => ({ ...prev, intervalMs }));
  }, []);

  const handleLimitCommit = useCallback(async (field: RecoveryLimitField, raw: string) => {
    const value = Number(raw);
    const bounds = RECOVERY_LIMITS[field];
    if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) {
      setLocalSettings(await getSettings());
      return;
    }
    setIsSaving(true);
    try {
      const updated = await setSettings(recoveryLimitPatch(field, value));
      setLocalSettings(updated);
    } catch (error) {
      console.error('[SettingsPanel] Failed to update recovery limit:', error);
      setLocalSettings(await getSettings());
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Commit interval on slider release
  const handleIntervalCommit = useCallback(async (value: number[]) => {
    const intervalMs = autosaveIntervalFromSlider(value[0] ?? 0);
    setIsSaving(true);

    try {
      const updated = await setSettings({ intervalMs });
      setLocalSettings(updated);
    } catch (error) {
      console.error('[SettingsPanel] Failed to update interval:', error);
      // Reload settings to revert to actual value
      const current = await getSettings();
      setLocalSettings(current);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Handle dialog open state change
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose]
  );

  const handleOpenAiProviders = useCallback(() => {
    if (!featureFlags.ai) {
      return;
    }
    void import('../features/ai-provider/store').then(({ useAIProviderStore }) => {
      useAIProviderStore.getState().openSettings();
    });
  }, [featureFlags.ai]);

  const openPluginMarketplace = useCallback(() => {
    useUtilityPanelStore.getState().setActiveUtilityPanel('plugins');
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="settings-panel">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" aria-hidden="true" />
            Settings
          </DialogTitle>
          <DialogDescription>Configure application preferences.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Autosave Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-sm font-medium">Autosave</h3>
              </div>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autosave-enabled">Enable Autosave</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically save documents to recovery files
                  </p>
                </div>
                <Switch
                  id="autosave-enabled"
                  checked={settings.enabled}
                  onCheckedChange={(checked) => {
                    void handleEnabledChange(checked);
                  }}
                  disabled={isSaving}
                  data-testid="autosave-enabled-switch"
                />
              </div>

              {/* Interval Slider */}
              <div className={cn('space-y-3', !settings.enabled && 'opacity-50')}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autosave-interval">Autosave Interval</Label>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      <span>{formatInterval(settings.intervalMs)}</span>
                    </p>
                  </div>
                </div>
                <Slider
                  id="autosave-interval"
                  value={[msToSliderValue(settings.intervalMs)]}
                  min={0}
                  max={AUTOSAVE_INTERVAL_STEPS.length - 1}
                  step={1}
                  onValueChange={handleIntervalChange}
                  onValueCommit={(value) => {
                    void handleIntervalCommit(value);
                  }}
                  disabled={!settings.enabled || isSaving}
                  data-testid="autosave-interval-slider"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5s</span>
                  <span>10 min</span>
                </div>
              </div>

              <RecoveryLimitInput
                id="recovery-retention-days"
                label="Keep recovery files"
                hint="Days before old recovery files are removed"
                min={RECOVERY_LIMITS.retentionDays.min}
                max={RECOVERY_LIMITS.retentionDays.max}
                value={settings.retentionDays}
                disabled={isSaving}
                onValue={(next) => setLocalSettings((prev) => ({ ...prev, retentionDays: next }))}
                onCommit={(raw) => {
                  void handleLimitCommit('retentionDays', raw);
                }}
              />
              <RecoveryLimitInput
                id="recovery-max-files"
                label="Maximum recovery files"
                hint="Oldest files are removed after this count"
                min={RECOVERY_LIMITS.maxFiles.min}
                max={RECOVERY_LIMITS.maxFiles.max}
                value={settings.maxFiles}
                disabled={isSaving}
                onValue={(next) => setLocalSettings((prev) => ({ ...prev, maxFiles: next }))}
                onCommit={(raw) => {
                  void handleLimitCommit('maxFiles', raw);
                }}
              />
              <RecoveryLimitInput
                id="recovery-max-storage"
                label="Recovery storage (MB)"
                hint="Oldest files are removed after this size"
                min={RECOVERY_LIMITS.maxStorageMB.min}
                max={RECOVERY_LIMITS.maxStorageMB.max}
                value={settings.maxStorageMB}
                disabled={isSaving}
                onValue={(next) => setLocalSettings((prev) => ({ ...prev, maxStorageMB: next }))}
                onCommit={(raw) => {
                  void handleLimitCommit('maxStorageMB', raw);
                }}
              />

              {/* Info Note */}
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
                <Info
                  className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-xs text-muted-foreground">
                  Autosave creates recovery files that can restore your work if the app crashes.
                  Files are saved to the recovery directory and cleaned up after manual saves.
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Feature Flags</h3>
                <p className="text-xs text-muted-foreground">
                  Toggle staged surfaces for incremental rollout.
                </p>
              </div>
              <div className="space-y-3">
                {FEATURE_FLAG_OPTIONS.map((flag) => (
                  <div key={flag.key} className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label htmlFor={`feature-flag-${flag.key}`}>{flag.label}</Label>
                      <p className="text-xs text-muted-foreground">{flag.description}</p>
                    </div>
                    <Switch
                      id={`feature-flag-${flag.key}`}
                      checked={featureFlags[flag.key]}
                      onCheckedChange={(checked) => {
                        setFeatureFlag(flag.key, checked);
                      }}
                      data-testid={`feature-flag-${flag.key}-switch`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Editor Preferences Section */}
            <EditorPreferencesSection />

            {featureFlags.ai && (
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">AI</h3>
                <p className="text-xs text-muted-foreground">
                  Configure providers used for AI features in MDXPad.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenAiProviders}
                  data-testid="open-ai-provider-settings-button"
                >
                  Open AI Provider Settings
                </Button>
              </div>
            )}

            {featureFlags.plugin && (
              <div className="space-y-2 border-t pt-4" data-testid="plugin-settings-section">
                <h3 className="text-sm font-medium">Plugins</h3>
                <p className="text-xs text-muted-foreground">
                  Browse installed plugins and discover available extensions.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openPluginMarketplace}
                  data-testid="toggle-plugin-marketplace-button"
                >
                  Open Plugin Marketplace
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Editor Preferences Sub-Component
// ============================================================================

const KEYMAP_OPTIONS: { value: KeymapMode; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'vim', label: 'Vim' },
  { value: 'emacs', label: 'Emacs' },
];

const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 32;
const LINE_HEIGHT_MIN = 1.0;
const LINE_HEIGHT_MAX = 3.0;
const LINE_HEIGHT_STEP = 0.1;

function EditorPreferencesSection(): React.JSX.Element {
  const prefs = useEditorPreferencesStore();

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center gap-2">
        <Type className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium">Editor</h3>
      </div>

      {/* Keymap Mode */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="keymap-mode">Keymap</Label>
          <p className="text-xs text-muted-foreground">Editor keybinding mode</p>
        </div>
        <select
          id="keymap-mode"
          value={prefs.keymapMode}
          onChange={(e) => prefs.setKeymapMode(e.target.value as KeymapMode)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="keymap-mode-select"
        >
          {KEYMAP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font Family */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="font-family">Font Family</Label>
          <p className="text-xs text-muted-foreground">{prefs.fontFamily}</p>
        </div>
        <input
          id="font-family"
          type="text"
          value={prefs.fontFamily}
          onChange={(e) => prefs.setFontFamily(e.target.value)}
          className="h-8 w-40 rounded-md border border-input bg-background px-2 text-sm"
          data-testid="font-family-input"
        />
      </div>

      {/* Font Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="font-size">Font Size</Label>
          <span className="text-xs text-muted-foreground">{prefs.fontSize}px</span>
        </div>
        <Slider
          id="font-size"
          value={[prefs.fontSize]}
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={1}
          onValueChange={(v) => prefs.setFontSize(v[0] ?? 14)}
          data-testid="font-size-slider"
        />
      </div>

      {/* Line Height */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="line-height">Line Height</Label>
          <span className="text-xs text-muted-foreground">{prefs.lineHeight.toFixed(1)}</span>
        </div>
        <Slider
          id="line-height"
          value={[prefs.lineHeight]}
          min={LINE_HEIGHT_MIN}
          max={LINE_HEIGHT_MAX}
          step={LINE_HEIGHT_STEP}
          onValueChange={(v) => prefs.setLineHeight(v[0] ?? 1.6)}
          data-testid="line-height-slider"
        />
      </div>

      {/* Toggle Options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="spellcheck-toggle">Spellcheck</Label>
            <p className="text-xs text-muted-foreground">Highlight potential misspellings</p>
          </div>
          <Switch
            id="spellcheck-toggle"
            checked={prefs.spellcheckEnabled}
            onCheckedChange={() => prefs.toggleSpellcheck()}
            data-testid="spellcheck-toggle"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="minimap-toggle">Minimap</Label>
            <p className="text-xs text-muted-foreground">Show document overview</p>
          </div>
          <Switch
            id="minimap-toggle"
            checked={prefs.minimapEnabled}
            onCheckedChange={() => prefs.toggleMinimap()}
            data-testid="minimap-toggle"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="focus-mode-toggle">Focus Mode</Label>
            <p className="text-xs text-muted-foreground">Dim non-active paragraphs</p>
          </div>
          <Switch
            id="focus-mode-toggle"
            checked={prefs.focusModeEnabled}
            onCheckedChange={() => prefs.toggleFocusMode()}
            data-testid="focus-mode-toggle"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="word-wrap-toggle">Word Wrap</Label>
            <p className="text-xs text-muted-foreground">Wrap long lines</p>
          </div>
          <Switch
            id="word-wrap-toggle"
            checked={prefs.wordWrapEnabled}
            onCheckedChange={() => prefs.toggleWordWrap()}
            data-testid="word-wrap-toggle"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="distraction-free-toggle">Distraction Free</Label>
            <p className="text-xs text-muted-foreground">Minimal writing environment</p>
          </div>
          <Switch
            id="distraction-free-toggle"
            checked={prefs.distractionFreeEnabled}
            onCheckedChange={() => prefs.toggleDistractionFree()}
            data-testid="distraction-free-toggle"
          />
        </div>
      </div>
    </div>
  );
}

export const SettingsPanel = memo(SettingsPanelComponent);
SettingsPanel.displayName = 'SettingsPanel';

export default SettingsPanel;
