/**
 * Tests for App component.
 * Validates the current application shell contract and command registration health.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { useCommandRegistry } from '../stores/command-registry-store';
import type { CommandId, NormalizedShortcut } from '@shared/types/commands';

function createMockMdxpadApi() {
  return {
    getVersion: vi.fn().mockResolvedValue('0.1.0'),
    getSecurityInfo: vi
      .fn()
      .mockResolvedValue({
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      }),
    platform: {
      os: 'darwin',
      arch: 'arm64',
    },
    openFile: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { id: 'test', path: '/test.mdx', name: 'test.mdx' } }),
    saveFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveFileAs: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { id: 'test', path: '/test.mdx', name: 'test.mdx' } }),
    readFile: vi.fn().mockResolvedValue({ ok: true, value: '# mock content' }),
    writeFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    closeWindow: vi.fn().mockResolvedValue(undefined),
    minimizeWindow: vi.fn().mockResolvedValue(undefined),
    maximizeWindow: vi.fn().mockResolvedValue(undefined),
    signalReady: vi.fn().mockResolvedValue(undefined),
    onFileChange: vi.fn(() => () => {}),
    onMenuCommandPalette: vi.fn(() => () => {}),
    onMenuNewFile: vi.fn(() => () => {}),
    onMenuOpenFile: vi.fn(() => () => {}),
    onMenuOpenFileDialog: vi.fn(() => () => {}),
    onMenuSaveFile: vi.fn(() => () => {}),
    onMenuSaveFileAs: vi.fn(() => () => {}),
    recoveryCheck: vi.fn().mockResolvedValue({ hasRecoveryData: false, count: 0 }),
    recoveryList: vi.fn().mockResolvedValue({ entries: [] }),
    recoveryPreview: vi.fn().mockResolvedValue({ ok: true, content: '', conflict: null }),
    recoveryRestore: vi.fn().mockResolvedValue({ ok: true, restored: [] }),
    recoveryDiscard: vi.fn().mockResolvedValue({ discardedCount: 0 }),
    autosaveTrigger: vi.fn().mockResolvedValue({ ok: true, savedAt: Date.now() }),
    autosaveStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
    autosaveSettingsGet: vi
      .fn()
      .mockResolvedValue({
        enabled: true,
        intervalMs: 30000,
        retentionDays: 30,
        maxFiles: 50,
        maxStorageMB: 100,
      }),
    autosaveSettingsSet: vi
      .fn()
      .mockResolvedValue({
        enabled: true,
        intervalMs: 30000,
        retentionDays: 30,
        maxFiles: 50,
        maxStorageMB: 100,
      }),
    conflictResolve: vi.fn().mockResolvedValue({ ok: true }),
    onAutosaveSettingsChange: vi.fn(() => () => {}),
    ai: {
      listProviders: vi.fn().mockResolvedValue({ providers: [], activeProviderId: null }),
      addProvider: vi.fn().mockResolvedValue({ success: true, providerId: 'test-provider' }),
      updateProvider: vi.fn().mockResolvedValue({ success: true }),
      removeProvider: vi.fn().mockResolvedValue({ success: true }),
      setActiveProvider: vi.fn().mockResolvedValue({ success: true }),
      validateProvider: vi.fn().mockResolvedValue({ valid: true, error: null }),
      setCredential: vi.fn().mockResolvedValue({ success: true }),
      hasCredential: vi.fn().mockResolvedValue({ hasCredential: false }),
      clearCredential: vi.fn().mockResolvedValue({ success: true }),
      generateText: vi.fn().mockResolvedValue({ text: 'ok', usage: null }),
      generateStream: vi.fn().mockResolvedValue({ streamId: 'stream-1' }),
      generateEmbed: vi.fn().mockResolvedValue({ embedding: [], usage: null }),
      generateImage: vi.fn().mockResolvedValue({ url: 'data:image/png;base64,...', usage: null }),
      queryUsage: vi.fn().mockResolvedValue({ entries: [], totalTokens: 0, totalCost: 0 }),
      exportUsage: vi.fn().mockResolvedValue({ path: '/tmp/usage.csv' }),
      clearUsage: vi.fn().mockResolvedValue({ success: true, count: 0 }),
      getCapability: vi.fn().mockResolvedValue({ capabilities: [], modelInfo: null }),
      listModels: vi.fn().mockResolvedValue({ models: [] }),
      refreshCapabilities: vi.fn().mockResolvedValue({ success: true }),
      onStreamChunk: vi.fn(() => () => {}),
      onStreamComplete: vi.fn(() => () => {}),
      onStreamError: vi.fn(() => () => {}),
    },
    template: {
      list: vi.fn().mockResolvedValue({ success: true, data: [] }),
      get: vi.fn().mockResolvedValue({ success: true, data: {} }),
      save: vi.fn().mockResolvedValue({ success: true, data: {} }),
      delete: vi.fn().mockResolvedValue({ success: true, data: { id: 'test' } }),
      import: vi.fn().mockResolvedValue({ success: true, data: {} }),
      export: vi.fn().mockResolvedValue({ success: true, data: { path: '/test/path' } }),
      validate: vi.fn().mockResolvedValue({ success: true, data: { valid: true, errors: [] } }),
      createFromTemplate: vi.fn().mockResolvedValue({ success: true, data: { content: '' } }),
      showOpenDialog: vi.fn().mockResolvedValue({ success: true, data: { path: null, canceled: true } }),
      showSaveDialog: vi.fn().mockResolvedValue({ success: true, data: { path: null, canceled: true } }),
    },
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('mdxpad', createMockMdxpadApi());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders core application shell regions', () => {
    render(<App />);

    expect(screen.getByRole('textbox', { name: /mdx document editor/i })).toBeDefined();
    expect(screen.getByRole('region', { name: /mdx preview/i })).toBeDefined();
    expect(screen.getByRole('status', { name: /status bar/i })).toBeDefined();
  });

  it('renders the frontmatter sidebar toggle', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /frontmatter/i })).toBeDefined();
  });

  it('subscribes to menu command-palette events on mount', async () => {
    render(<App />);

    await waitFor(() => {
      expect(window.mdxpad.onMenuCommandPalette).toHaveBeenCalledTimes(1);
    });
  });

  it('does not warn about invalid command IDs during command registration', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<App />);

    const invalidIdWarnings = warnSpy.mock.calls.filter(([message]) =>
      typeof message === 'string' && message.includes('Invalid CommandId format')
    );
    expect(invalidIdWarnings).toHaveLength(0);

    warnSpy.mockRestore();
  });

  it('registers the command palette shortcut command with a valid command id', () => {
    render(<App />);

    const state = useCommandRegistry.getState();
    const command = state.getCommand('view.command-palette' as CommandId);
    const byShortcut = state.getCommandByShortcut('Mod+Shift+p' as NormalizedShortcut);

    expect(command).toBeDefined();
    expect(command?.shortcut).toEqual({ key: 'p', modifiers: ['Mod', 'Shift'] });
    expect(byShortcut?.id).toBe('view.command-palette');
  });

  it('opens command palette when shortcut is pressed', async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        useCommandRegistry.getState().getCommand('view.command-palette' as CommandId)
      ).toBeDefined();
    });

    const isMac = navigator.platform.includes('Mac');
    fireEvent.keyDown(window, {
      key: 'p',
      shiftKey: true,
      metaKey: isMac,
      ctrlKey: !isMac,
    });

    await waitFor(() => {
      expect(screen.getByTestId('command-palette')).toBeDefined();
    });
  });

  it('has drag region for macOS titlebar', () => {
    const { container } = render(<App />);

    const dragRegion = container.querySelector('.h-8');
    expect(dragRegion).not.toBeNull();
    expect(dragRegion?.className).toContain('w-full');
  });
});
