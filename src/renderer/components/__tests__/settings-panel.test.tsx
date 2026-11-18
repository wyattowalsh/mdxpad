/**
 * Tests for SettingsPanel component.
 *
 * Tests rendering, autosave toggle, interval slider,
 * loading state, and settings persistence.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DEFAULT_AUTOSAVE_SETTINGS } from '@shared/contracts/autosave-schemas';

import { AUTOSAVE_INTERVAL_STEPS, SettingsPanel, autosaveIntervalFromSlider } from '../settings-panel';
import { useFeatureFlagsStore } from '../../stores/feature-flags-store';

// =============================================================================
// MOCKS
// =============================================================================

// Mock the Dialog primitives to simplify testing
vi.mock('../ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('../ui/label', () => ({
  Label: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('../ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
    ...props
  }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled: boolean;
    [key: string]: unknown;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    />
  ),
}));

vi.mock('../ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
    onValueCommit,
    disabled,
    ...props
  }: {
    value: number[];
    onValueChange: (value: number[]) => void;
    onValueCommit: (value: number[]) => void;
    disabled: boolean;
    [key: string]: unknown;
  }) => (
    <input
      type="range"
      value={value[0]}
      disabled={disabled}
      onChange={(e) => onValueChange([Number(e.target.value)])}
      onMouseUp={() => onValueCommit(value)}
      {...props}
    />
  ),
}));

vi.mock('../../features/plugins/PluginMarketplace', () => ({
  PluginMarketplace: () => <div data-testid="plugin-marketplace-component" />,
}));

// =============================================================================
// CLEANUP
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// TESTS
// =============================================================================

describe('SettingsPanel', () => {
  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
    useFeatureFlagsStore.getState().setFlags({
      workspace: true,
      ai: true,
      export: true,
      authoring: true,
      plugin: true,
    });
  });

  it('should render feature flag toggles', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('feature-flag-workspace-switch')).toBeTruthy();
      expect(screen.getByTestId('feature-flag-ai-switch')).toBeTruthy();
      expect(screen.getByTestId('feature-flag-export-switch')).toBeTruthy();
      expect(screen.getByTestId('feature-flag-authoring-switch')).toBeTruthy();
      expect(screen.getByTestId('feature-flag-plugin-switch')).toBeTruthy();
    });
  });

  it('should update feature flags when toggles are changed', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    const aiSwitch = await screen.findByTestId('feature-flag-ai-switch');
    fireEvent.click(aiSwitch);

    await waitFor(() => {
      expect(useFeatureFlagsStore.getState().flags.ai).toBe(false);
    });
  });

  it('should hide AI settings section when AI feature flag is disabled', async () => {
    useFeatureFlagsStore.getState().setFlag('ai', false);
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByTestId('open-ai-provider-settings-button')).toBeNull();
    });
  });

  it('should show plugin section when plugin feature flag is enabled', async () => {
    useFeatureFlagsStore.getState().setFlag('plugin', true);
    expect(useFeatureFlagsStore.getState().flags.plugin).toBe(true);
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('plugin-settings-section')).toBeTruthy();
      expect(screen.getByTestId('toggle-plugin-marketplace-button')).toBeTruthy();
    });
  });

  it('should hide plugin section when plugin feature flag is disabled', async () => {
    useFeatureFlagsStore.getState().setFlag('plugin', false);
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByTestId('plugin-settings-section')).toBeNull();
    });
  });

  it('should not render when closed', () => {
    const { container } = render(<SettingsPanel isOpen={false} onClose={vi.fn()} />);
    expect(container.querySelector('[data-testid="settings-panel"]')).toBeNull();
  });

  it('should render when open', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    // Wait for loading to finish (getSettings resolves with defaults)
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy();
    });
  });

  it('should show autosave section', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Autosave')).toBeTruthy();
      expect(screen.getByText('Enable Autosave')).toBeTruthy();
      expect(screen.getByText('Autosave Interval')).toBeTruthy();
    });
  });

  it('should show the autosave toggle switch', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const toggle = screen.getByTestId('autosave-enabled-switch');
      expect(toggle).toBeTruthy();
    });
  });

  it('should show the interval slider', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const slider = screen.getByTestId('autosave-interval-slider');
      expect(slider).toBeTruthy();
    });
  });

  it('should show info note about recovery files', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Autosave creates recovery files/)).toBeTruthy();
    });
  });

  it('should show interval labels from 5 seconds to 10 minutes', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('5s')).toBeTruthy();
      expect(screen.getByText('10 min')).toBeTruthy();
    });
    expect(autosaveIntervalFromSlider(0)).toBe(5000);
    expect(autosaveIntervalFromSlider(AUTOSAVE_INTERVAL_STEPS.length - 1)).toBe(600000);
  });

  it('saves how long recovery files are kept', async () => {
    const previous = window.mdxpad;
    const set = vi.fn(async (partial: { retentionDays: number }) => ({
      ...DEFAULT_AUTOSAVE_SETTINGS,
      ...partial,
    }));
    window.mdxpad = {
      ...previous,
      settings: {
        get: async () => DEFAULT_AUTOSAVE_SETTINGS,
        set,
      },
    } as unknown as typeof window.mdxpad;

    try {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);
      const input = await screen.findByTestId('recovery-retention-days');
      fireEvent.change(input, { target: { value: '14' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(set).toHaveBeenCalledWith({ retentionDays: 14 });
      });
    } finally {
      window.mdxpad = previous;
    }
  });

  it('should display default interval as "30 seconds"', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('30 seconds')).toBeTruthy();
    });
  });
});
