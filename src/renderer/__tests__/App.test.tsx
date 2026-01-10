/**
 * Tests for App component.
 * Validates rendering and integration with preload API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';

describe('App', () => {
  beforeEach(() => {
    // Mock window.mdxpad API with vi.stubGlobal
    vi.stubGlobal('mdxpad', {
      getVersion: vi.fn().mockResolvedValue('0.1.0'),
      platform: {
        os: 'darwin',
        arch: 'arm64',
      },
      // File operations
      openFile: vi.fn().mockResolvedValue({ ok: true, value: { id: 'test', path: '/test.mdx', name: 'test.mdx' } }),
      saveFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      saveFileAs: vi.fn().mockResolvedValue({ ok: true, value: { id: 'test', path: '/test.mdx', name: 'test.mdx' } }),
      closeWindow: vi.fn().mockResolvedValue(undefined),
      // Menu event subscriptions
      onMenuCommandPalette: vi.fn().mockReturnValue(() => {}),
      onMenuNewFile: vi.fn().mockReturnValue(() => {}),
      onMenuOpenFile: vi.fn().mockReturnValue(() => {}),
      onMenuOpenFileDialog: vi.fn().mockReturnValue(() => {}),
      onMenuSaveFile: vi.fn().mockReturnValue(() => {}),
      onMenuSaveFileAs: vi.fn().mockReturnValue(() => {}),
    });
  });

  it('renders mdxpad heading', () => {
    render(<App />);

    const heading = screen.getByRole('heading', { name: /mdxpad/i });
    expect(heading).toBeDefined();
    expect(heading.textContent).toBe('mdxpad');
  });

  it('displays version from preload API', async () => {
    render(<App />);

    // Initially shows loading state
    expect(screen.getByText(/Version \.\.\./i)).toBeDefined();

    // Wait for version to be fetched
    await waitFor(() => {
      expect(screen.getByText(/Version 0\.1\.0/i)).toBeDefined();
    });
  });

  it('displays platform information', () => {
    render(<App />);

    const platformText = screen.getByText(/darwin arm64/i);
    expect(platformText).toBeDefined();
  });

  it('has drag region for macOS titlebar', () => {
    const { container } = render(<App />);

    // The drag region is a div with h-8 w-full classes at the top of the app
    // In actual Electron it would have WebkitAppRegion: drag style
    // We verify the element exists by checking for the h-8 class
    const dragRegion = container.querySelector('.h-8');
    expect(dragRegion).not.toBeNull();
    expect(dragRegion?.className).toContain('w-full');
  });
});
