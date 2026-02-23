/**
 * Tests for AutosaveIndicator component.
 *
 * Tests visual states (idle, saving, saved, failed),
 * tooltip content, failure toast display, and button callbacks.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { AutosaveIndicator } from '../autosave-indicator';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('../ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// =============================================================================
// TEST HELPERS
// =============================================================================

const defaultProps = {
  isSaving: false,
  lastSaveAt: null,
  lastSaveResult: null as 'success' | 'error' | null,
  lastError: null as string | null,
  consecutiveFailures: 0,
  onRetry: vi.fn(),
  onDisable: vi.fn(),
};

// =============================================================================
// CLEANUP
// =============================================================================

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// =============================================================================
// TESTS
// =============================================================================

describe('AutosaveIndicator', () => {
  it('should render the indicator container', () => {
    render(<AutosaveIndicator {...defaultProps} />);
    expect(screen.getByTestId('autosave-indicator')).toBeTruthy();
  });

  it('should have status role', () => {
    render(<AutosaveIndicator {...defaultProps} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  describe('idle state', () => {
    it('should show "Autosave enabled" label when idle', () => {
      render(<AutosaveIndicator {...defaultProps} />);
      expect(screen.getByLabelText('Autosave enabled')).toBeTruthy();
    });
  });

  describe('saving state', () => {
    it('should show "Saving..." label when saving', () => {
      render(<AutosaveIndicator {...defaultProps} isSaving={true} />);
      expect(screen.getByLabelText('Saving...')).toBeTruthy();
    });
  });

  describe('saved state', () => {
    it('should show "Saved" label after successful save', () => {
      render(
        <AutosaveIndicator {...defaultProps} lastSaveResult="success" lastSaveAt={Date.now()} />
      );
      const status = screen.getByRole('status');
      expect(status.getAttribute('aria-label')).toMatch(/Saved/);
    });
  });

  describe('failed state', () => {
    it('should show error label when last save failed', () => {
      render(
        <AutosaveIndicator
          {...defaultProps}
          lastSaveResult="error"
          lastError="Disk full"
          consecutiveFailures={1}
        />
      );
      expect(screen.getByLabelText(/Save failed/)).toBeTruthy();
    });

    it('should include truncated error in label', () => {
      render(
        <AutosaveIndicator
          {...defaultProps}
          lastSaveResult="error"
          lastError="Disk full"
          consecutiveFailures={1}
        />
      );
      expect(screen.getByLabelText(/Disk full/)).toBeTruthy();
    });
  });

  describe('failure toast', () => {
    it('should not show toast below threshold', () => {
      render(
        <AutosaveIndicator
          {...defaultProps}
          lastSaveResult="error"
          lastError="Error"
          consecutiveFailures={2}
        />
      );
      expect(screen.queryByTestId('autosave-failure-toast')).toBeNull();
    });

    it('should show toast at failure threshold (3)', () => {
      // First render with 2 failures (below threshold)
      const { rerender } = render(
        <AutosaveIndicator
          {...defaultProps}
          lastSaveResult="error"
          lastError="Disk full"
          consecutiveFailures={2}
        />
      );

      // Then increase to 3 (at threshold)
      rerender(
        <AutosaveIndicator
          {...defaultProps}
          lastSaveResult="error"
          lastError="Disk full"
          consecutiveFailures={3}
        />
      );

      expect(screen.getByTestId('autosave-failure-toast')).toBeTruthy();
    });

    it('should show retry and disable buttons in toast', () => {
      const { rerender } = render(
        <AutosaveIndicator
          {...defaultProps}
          lastSaveResult="error"
          lastError="Error"
          consecutiveFailures={2}
        />
      );

      rerender(
        <AutosaveIndicator
          {...defaultProps}
          lastSaveResult="error"
          lastError="Error"
          consecutiveFailures={3}
        />
      );

      expect(screen.getByTestId('autosave-retry-button')).toBeTruthy();
      expect(screen.getByTestId('autosave-disable-button')).toBeTruthy();
    });

    it('should call onRetry when retry button clicked', () => {
      const onRetry = vi.fn();
      const { rerender } = render(
        <AutosaveIndicator
          {...defaultProps}
          onRetry={onRetry}
          lastSaveResult="error"
          lastError="Error"
          consecutiveFailures={2}
        />
      );

      rerender(
        <AutosaveIndicator
          {...defaultProps}
          onRetry={onRetry}
          lastSaveResult="error"
          lastError="Error"
          consecutiveFailures={3}
        />
      );

      fireEvent.click(screen.getByTestId('autosave-retry-button'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onDisable when disable button clicked', () => {
      const onDisable = vi.fn();
      const { rerender } = render(
        <AutosaveIndicator
          {...defaultProps}
          onDisable={onDisable}
          lastSaveResult="error"
          lastError="Error"
          consecutiveFailures={2}
        />
      );

      rerender(
        <AutosaveIndicator
          {...defaultProps}
          onDisable={onDisable}
          lastSaveResult="error"
          lastError="Error"
          consecutiveFailures={3}
        />
      );

      fireEvent.click(screen.getByTestId('autosave-disable-button'));
      expect(onDisable).toHaveBeenCalledTimes(1);
    });

    it('should hide toast when failures reset to 0', () => {
      const { rerender } = render(
        <AutosaveIndicator
          {...defaultProps}
          lastSaveResult="error"
          lastError="Error"
          consecutiveFailures={2}
        />
      );

      // Show toast
      rerender(
        <AutosaveIndicator
          {...defaultProps}
          lastSaveResult="error"
          lastError="Error"
          consecutiveFailures={3}
        />
      );
      expect(screen.getByTestId('autosave-failure-toast')).toBeTruthy();

      // Reset failures
      rerender(
        <AutosaveIndicator
          {...defaultProps}
          lastSaveResult="success"
          lastSaveAt={Date.now()}
          consecutiveFailures={0}
        />
      );
      expect(screen.queryByTestId('autosave-failure-toast')).toBeNull();
    });
  });
});
