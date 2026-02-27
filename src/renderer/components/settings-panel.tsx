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
import { Settings, Clock, Save, Info } from 'lucide-react';
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
 * Slider steps for autosave interval.
 * Per Constitution VII.3: minimum every 30 seconds if dirty.
 * Per FR-009: range 5s to 10min, slider shows common use 5s-30s.
 */
const INTERVAL_STEPS = [5000, 10000, 15000, 20000, 30000] as const;

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
  const idx = INTERVAL_STEPS.findIndex((s) => s >= ms);
  return idx >= 0 ? idx : INTERVAL_STEPS.length - 1;
}

/**
 * Convert slider step index to milliseconds.
 *
 * @param value - Slider step index
 * @returns Interval in milliseconds
 */
function sliderValueToMs(value: number): number {
  return INTERVAL_STEPS[value] ?? DEFAULT_AUTOSAVE_SETTINGS.intervalMs;
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
    const intervalMs = sliderValueToMs(value[0] ?? 0);
    setLocalSettings((prev) => ({ ...prev, intervalMs }));
  }, []);

  // Commit interval on slider release
  const handleIntervalCommit = useCallback(async (value: number[]) => {
    const intervalMs = sliderValueToMs(value[0] ?? 0);
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
                  max={INTERVAL_STEPS.length - 1}
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
                  <span>30s</span>
                </div>
              </div>

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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const SettingsPanel = memo(SettingsPanelComponent);
SettingsPanel.displayName = 'SettingsPanel';

export default SettingsPanel;
