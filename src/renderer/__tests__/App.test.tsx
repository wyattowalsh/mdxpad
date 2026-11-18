/**
 * Tests for App component.
 * Validates the current application shell contract and command registration health.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { useCommandRegistry } from '../stores/command-registry-store';
import { useDocumentStore } from '../stores/document-store';
import { useTabStore } from '../stores/tab-store';
import { useSettingsStore } from '../stores/settings-store';
import { useFrontmatterStore } from '../stores/frontmatter-store';
import { useAIProviderStore } from '../features/ai-provider/store';
import { useFileExplorerStore } from '../stores/file-explorer-store';
import { useFeatureFlagsStore } from '../stores/feature-flags-store';
import type { CommandId, NormalizedShortcut } from '@shared/types/commands';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createMockMdxpadApi() {
  return {
    getVersion: vi.fn().mockResolvedValue('0.1.0'),
    getSecurityInfo: vi.fn().mockResolvedValue({
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
    exportFile: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { path: '/test.html', format: 'html', warnings: [] } }),
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
    onMenuExportFile: vi.fn(() => () => {}),
    recoveryCheck: vi.fn().mockResolvedValue({ hasRecoveryData: false, count: 0 }),
    recoveryList: vi.fn().mockResolvedValue({ entries: [] }),
    recoveryPreview: vi.fn().mockResolvedValue({ ok: true, content: '', conflict: null }),
    recoveryRestore: vi.fn().mockResolvedValue({ ok: true, restored: [] }),
    recoveryDiscard: vi.fn().mockResolvedValue({ discardedCount: 0 }),
    autosaveTrigger: vi.fn().mockResolvedValue({ ok: true, savedAt: Date.now() }),
    autosaveStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
    autosaveSettingsGet: vi.fn().mockResolvedValue({
      enabled: true,
      intervalMs: 30000,
      retentionDays: 30,
      maxFiles: 50,
      maxStorageMB: 100,
    }),
    autosaveSettingsSet: vi.fn().mockResolvedValue({
      enabled: true,
      intervalMs: 30000,
      retentionDays: 30,
      maxFiles: 50,
      maxStorageMB: 100,
    }),
    conflictResolve: vi.fn().mockResolvedValue({ ok: true }),
    onAutosaveSettingsChange: vi.fn(() => () => {}),
    settings: {
      get: vi.fn().mockResolvedValue({
        enabled: true,
        intervalMs: 30000,
        retentionDays: 30,
        maxFiles: 50,
        maxStorageMB: 100,
      }),
      set: vi.fn().mockResolvedValue({
        enabled: true,
        intervalMs: 30000,
        retentionDays: 30,
        maxFiles: 50,
        maxStorageMB: 100,
      }),
      onChange: vi.fn(() => () => {}),
    },
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
      createSession: vi.fn().mockResolvedValue({ success: true }),
      listSessions: vi.fn().mockResolvedValue({ sessions: [], activeSessionId: null }),
      getSession: vi.fn().mockResolvedValue({ session: null }),
      archiveSession: vi.fn().mockResolvedValue({ success: true }),
      restoreSession: vi.fn().mockResolvedValue({ session: null }),
      listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
      attachPrompt: vi.fn().mockResolvedValue({ success: true }),
      listInstructions: vi.fn().mockResolvedValue({ instructions: [] }),
      loadInstruction: vi.fn().mockResolvedValue({ instruction: null }),
      attachInstruction: vi.fn().mockResolvedValue({ success: true }),
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
      showOpenDialog: vi
        .fn()
        .mockResolvedValue({ success: true, data: { path: null, canceled: true } }),
      showSaveDialog: vi
        .fn()
        .mockResolvedValue({ success: true, data: { path: null, canceled: true } }),
    },
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('mdxpad', createMockMdxpadApi());
    useFeatureFlagsStore.getState().reset();
    useFeatureFlagsStore.getState().setFlags({
      workspace: true,
      ai: true,
      export: true,
      authoring: true,
    });
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    useSettingsStore.getState().close();
    useFrontmatterStore.getState().reset();
    useAIProviderStore.getState().closeSettings();
    useFileExplorerStore.getState().clearFilter();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('hides frontmatter authoring controls when authoring feature flag is off', () => {
    useFeatureFlagsStore.getState().setFlag('authoring', false);
    render(<App />);

    expect(screen.queryByRole('button', { name: /frontmatter/i })).toBeNull();
  });

  it('renders file explorer filter controls', () => {
    render(<App />);

    expect(screen.getByRole('textbox', { name: /filter file tree/i })).toBeDefined();
    expect(screen.getByTestId('file-explorer-list')).toBeDefined();
  });

  it('does not reset filter results when filter is already empty and inactive', () => {
    const applyFilterResultsSpy = vi.spyOn(useFileExplorerStore.getState(), 'applyFilterResults');
    render(<App />);
    expect(applyFilterResultsSpy).not.toHaveBeenCalled();
    applyFilterResultsSpy.mockRestore();
  });

  it('adds frontmatter content when Add Frontmatter is clicked', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /frontmatter/i }));
    fireEvent.click(screen.getByRole('button', { name: /add frontmatter/i }));

    await waitFor(() => {
      const content = useDocumentStore.getState().content;
      expect(content).toContain('---');
      expect(content).toContain('title');
    });
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

    const invalidIdWarnings = warnSpy.mock.calls.filter(
      ([message]) => typeof message === 'string' && message.includes('Invalid CommandId format')
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

  it('opens AI provider settings from settings panel action', async () => {
    act(() => {
      useSettingsStore.getState().open();
    });

    render(<App />);

    fireEvent.click(await screen.findByTestId('open-ai-provider-settings-button'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-provider-settings-dialog')).toBeDefined();
    });
  });

  it('hides AI settings actions when AI feature flag is off', async () => {
    useFeatureFlagsStore.getState().setFlag('ai', false);
    act(() => {
      useSettingsStore.getState().open();
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId('open-ai-provider-settings-button')).toBeNull();
    });
  });

  it('opens conflict dialog when restoring a conflicted recovery entry', async () => {
    const mdxpad = createMockMdxpadApi();
    const documentId = '123e4567-e89b-12d3-a456-426614174000';
    const now = Date.now();

    mdxpad.recoveryCheck.mockResolvedValue({ hasRecoveryData: true, count: 1 });
    mdxpad.recoveryList.mockResolvedValue({
      entries: [
        {
          documentId,
          fileName: 'conflicted.mdx',
          filePath: '/conflicted.mdx',
          savedAt: now - 1_000,
          contentPreview: '# Recovery content',
          isValid: true,
          hasConflict: true,
        },
      ],
    });
    mdxpad.recoveryPreview.mockResolvedValue({
      ok: true,
      content: '# Recovery content',
      conflict: {
        documentId,
        filePath: '/conflicted.mdx',
        recoveryContent: '# Recovery content',
        diskContent: '# Disk content',
        recoveryTimestamp: now - 1_000,
        diskModifiedAt: now,
      },
    });

    vi.stubGlobal('mdxpad', mdxpad);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('recovery-dialog')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('recovery-restore-button'));

    await waitFor(() => {
      expect(screen.getByTestId('conflict-dialog')).toBeDefined();
    });
  });

  it('ignores stale frontmatter sync timeouts when document changes rapidly', () => {
    vi.useFakeTimers();
    const parseSpy = vi.spyOn(useFrontmatterStore.getState(), 'parseFromDocument');
    render(<App />);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    parseSpy.mockClear();

    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout').mockImplementation(() => {});
    act(() => {
      useDocumentStore.getState().setContent('---\ntitle: first\n---\n');
    });
    act(() => {
      useDocumentStore.getState().setContent('---\ntitle: second\n---\n');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(parseSpy).toHaveBeenLastCalledWith('---\ntitle: second\n---\n');

    clearTimeoutSpy.mockRestore();
    parseSpy.mockRestore();
  });

  it('does not update conflict state after unmount while preview request is pending', async () => {
    const mdxpad = createMockMdxpadApi();
    const documentId = '123e4567-e89b-12d3-a456-426614174001';
    const now = Date.now();
    const deferredPreview = createDeferred<{
      ok: boolean;
      content: string;
      conflict: {
        documentId: string;
        filePath: string;
        recoveryContent: string;
        diskContent: string;
        recoveryTimestamp: number;
        diskModifiedAt: number;
      } | null;
    }>();

    mdxpad.recoveryCheck.mockResolvedValue({ hasRecoveryData: true, count: 1 });
    mdxpad.recoveryList.mockResolvedValue({
      entries: [
        {
          documentId,
          fileName: 'pending-conflict.mdx',
          filePath: '/pending-conflict.mdx',
          savedAt: now - 1_000,
          contentPreview: '# Recovery content',
          isValid: true,
          hasConflict: true,
        },
      ],
    });
    mdxpad.recoveryPreview.mockReturnValue(deferredPreview.promise);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('mdxpad', mdxpad);
    const { unmount } = render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('recovery-dialog')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('recovery-restore-button'));
    unmount();

    await act(async () => {
      deferredPreview.resolve({
        ok: true,
        content: '# Recovery content',
        conflict: {
          documentId,
          filePath: '/pending-conflict.mdx',
          recoveryContent: '# Recovery content',
          diskContent: '# Disk content',
          recoveryTimestamp: now - 1_000,
          diskModifiedAt: now,
        },
      });
      await deferredPreview.promise;
    });

    const hasUnmountedUpdateWarning = errorSpy.mock.calls.some((args) =>
      args.some(
        (arg) =>
          typeof arg === 'string' &&
          arg.includes("Can't perform a React state update on an unmounted component")
      )
    );
    expect(hasUnmountedUpdateWarning).toBe(false);
    errorSpy.mockRestore();
  });

  it('opens command palette when shortcut is pressed', async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        useCommandRegistry.getState().getCommand('view.command-palette' as CommandId)
      ).toBeDefined();
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
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
