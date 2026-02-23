/**
 * Tests for SettingsPanel component.
 *
 * Tests rendering, autosave toggle, interval slider,
 * loading state, and settings persistence.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPanel } from '../settings-panel';

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

  it('should show interval labels (5s and 30s)', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('5s')).toBeTruthy();
      expect(screen.getByText('30s')).toBeTruthy();
    });
  });

  it('should display default interval as "30 seconds"', async () => {
    render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('30 seconds')).toBeTruthy();
    });
  });
});
