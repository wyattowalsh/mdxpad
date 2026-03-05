/**
 * Tests for useCommandPalette Hook
 *
 * Tests command palette state management, search, selection, and execution.
 *
 * @see useCommandPalette.ts for implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCommandPalette } from './useCommandPalette';
import { useCommandRegistry } from '../stores/command-registry-store';
import type { Command, CommandContext, CommandId } from '@shared/types/commands';

// =============================================================================
// Test Setup
// =============================================================================

const createMockCommand = (overrides?: Partial<Command>): Command => ({
  id: 'test.command' as CommandId,
  name: 'Test Command',
  category: 'file',
  execute: vi.fn().mockResolvedValue({ ok: true }),
  ...overrides,
});

const createMockContext = (): CommandContext => ({
  editor: null,
  document: {
    fileId: null,
    filePath: null,
    content: '',
    isDirty: false,
  },
  ui: {
    previewVisible: true,
    sidebarVisible: true,
    zoomLevel: 1,
  },
  platform: {
    isMac: true,
    isWindows: false,
    isLinux: false,
  },
  api: {} as any,
  notify: vi.fn(),
});

beforeEach(() => {
  // Reset command registry store
  useCommandRegistry.setState({
    commands: new Map(),
    shortcutIndex: new Map(),
    recentCommands: [],
  });
});

// =============================================================================
// Tests
// =============================================================================

describe('useCommandPalette', () => {
  describe('initial state', () => {
    it('should start with palette closed', () => {
      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.isOpen).toBe(false);
      expect(result.current.query).toBe('');
      expect(result.current.selectedIndex).toBe(0);
      expect(result.current.results).toEqual([]);
      expect(result.current.isExecuting).toBe(false);
    });
  });

  describe('open', () => {
    it('should open palette and reset state', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.setQuery('test');
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.query).toBe('');
      expect(result.current.selectedIndex).toBe(0);
    });

    it('should be idempotent when already open', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('close', () => {
    it('should close palette and reset state', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
        result.current.setQuery('search term');
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.query).toBe('');
      expect(result.current.selectedIndex).toBe(0);
      expect(result.current.isExecuting).toBe(false);
    });

    it('should be idempotent when already closed', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should open when closed', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should close when open', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
      });

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should toggle multiple times', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.toggle(); // open
      });
      act(() => {
        result.current.toggle(); // close
      });
      act(() => {
        result.current.toggle(); // open
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('setQuery', () => {
    it('should update query', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.setQuery('new query');
      });

      expect(result.current.query).toBe('new query');
    });

    it('should reset selectedIndex when query changes', () => {
      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Command 1' });
      const cmd2 = createMockCommand({ id: 'cmd.two' as CommandId, name: 'Command 2' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.selectIndex(1);
        result.current.setQuery('new query');
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    it('should handle empty string query', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.setQuery('');
      });

      expect(result.current.query).toBe('');
    });
  });

  describe('selectPrevious', () => {
    it('should move selection up', () => {
      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Command 1' });
      const cmd2 = createMockCommand({ id: 'cmd.two' as CommandId, name: 'Command 2' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.selectIndex(1);
        result.current.selectPrevious();
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    it('should wrap to last item from first', () => {
      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Command 1' });
      const cmd2 = createMockCommand({ id: 'cmd.two' as CommandId, name: 'Command 2' });
      const cmd3 = createMockCommand({ id: 'cmd.three' as CommandId, name: 'Command 3' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);
      useCommandRegistry.getState().register(cmd3);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.selectPrevious();
      });

      expect(result.current.selectedIndex).toBe(2);
    });

    it('should handle empty results', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.selectPrevious();
      });

      // Should wrap to -1 when no results (length - 1 = 0 - 1 = -1)
      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  describe('selectNext', () => {
    it('should move selection down', () => {
      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Command 1' });
      const cmd2 = createMockCommand({ id: 'cmd.two' as CommandId, name: 'Command 2' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.selectNext();
      });

      expect(result.current.selectedIndex).toBe(1);
    });

    it('should wrap to first item from last', () => {
      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Command 1' });
      const cmd2 = createMockCommand({ id: 'cmd.two' as CommandId, name: 'Command 2' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.selectIndex(1);
        result.current.selectNext();
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    it('should handle empty results', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.selectNext();
      });

      // Should wrap to 0 when no results
      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('selectIndex', () => {
    it('should set index within valid range', () => {
      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Command 1' });
      const cmd2 = createMockCommand({ id: 'cmd.two' as CommandId, name: 'Command 2' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.selectIndex(1);
      });

      expect(result.current.selectedIndex).toBe(1);
    });

    it('should ignore index out of range (too high)', () => {
      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Command 1' });

      useCommandRegistry.getState().register(cmd1);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.selectIndex(5);
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    it('should ignore negative index', () => {
      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Command 1' });

      useCommandRegistry.getState().register(cmd1);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.selectIndex(-1);
      });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('executeCommand', () => {
    it('should execute command by id', async () => {
      const executeMock = vi.fn().mockResolvedValue({ ok: true });
      const cmd = createMockCommand({
        id: 'test.cmd' as CommandId,
        execute: executeMock,
      });

      useCommandRegistry.getState().register(cmd);

      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      await act(async () => {
        const res = await result.current.executeCommand('test.cmd' as CommandId, ctx);
        expect(res.ok).toBe(true);
      });

      expect(executeMock).toHaveBeenCalledWith(ctx);
    });

    it('should return error for non-existent command', async () => {
      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      const res = await act(async () => {
        return await result.current.executeCommand('nonexistent' as CommandId, ctx);
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('Command not found');
      }
    });

    it('should return error when command is disabled', async () => {
      const cmd = createMockCommand({
        id: 'disabled.cmd' as CommandId,
        enabled: () => false,
      });

      useCommandRegistry.getState().register(cmd);

      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      const res = await act(async () => {
        return await result.current.executeCommand('disabled.cmd' as CommandId, ctx);
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('disabled');
      }
    });

    it('should track command in recent commands on success', async () => {
      const cmd = createMockCommand({ id: 'track.me' as CommandId });

      useCommandRegistry.getState().register(cmd);

      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      await act(async () => {
        await result.current.executeCommand('track.me' as CommandId, ctx);
      });

      const recent = useCommandRegistry.getState().getRecentCommands(5);
      expect(recent.some((r) => r.commandId === 'track.me')).toBe(true);
    });

    it('should NOT track command in recent commands on failure', async () => {
      const cmd = createMockCommand({
        id: 'fail.cmd' as CommandId,
        execute: vi.fn().mockResolvedValue({ ok: false, error: 'Command failed' }),
      });

      useCommandRegistry.getState().register(cmd);

      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      await act(async () => {
        await result.current.executeCommand('fail.cmd' as CommandId, ctx);
      });

      const recent = useCommandRegistry.getState().getRecentCommands(5);
      expect(recent.some((r) => r.commandId === 'fail.cmd')).toBe(false);
    });

    it('should close palette after execution', async () => {
      const cmd = createMockCommand({ id: 'close.test' as CommandId });

      useCommandRegistry.getState().register(cmd);

      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      act(() => {
        result.current.open();
      });

      await act(async () => {
        await result.current.executeCommand('close.test' as CommandId, ctx);
      });

      // Need to wait for close to happen after execution
      await waitFor(() => {
        expect(result.current.isOpen).toBe(false);
      });
    });

    it('should handle command execution error', async () => {
      const cmd = createMockCommand({
        id: 'throw.error' as CommandId,
        execute: vi.fn().mockRejectedValue(new Error('Execution failed')),
      });

      useCommandRegistry.getState().register(cmd);

      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      const res = await act(async () => {
        return await result.current.executeCommand('throw.error' as CommandId, ctx);
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('Execution failed');
      }
    });

    it('should set isExecuting during execution', async () => {
      let resolveExecution!: (value: any) => void;
      const executionPromise = new Promise((resolve) => {
        resolveExecution = resolve;
      });

      const cmd = createMockCommand({
        id: 'slow.cmd' as CommandId,
        execute: vi.fn().mockReturnValue(executionPromise),
      });

      useCommandRegistry.getState().register(cmd);

      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      // Start execution (don't await the full promise yet)
      let execResultPromise: Promise<any>;
      await act(async () => {
        execResultPromise = result.current.executeCommand('slow.cmd' as CommandId, ctx);
      });

      // Should be executing (setIsExecuting(true) was called in the sync part)
      expect(result.current.isExecuting).toBe(true);

      // Resolve execution and wait for completion
      await act(async () => {
        resolveExecution({ ok: true });
        await execResultPromise;
      });

      // Should no longer be executing
      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });
    });
  });

  describe('executeSelected', () => {
    it('should execute currently selected command', async () => {
      const executeMock = vi.fn().mockResolvedValue({ ok: true });
      const cmd = createMockCommand({
        id: 'selected.cmd' as CommandId,
        name: 'Selected Command',
        execute: executeMock,
      });

      useCommandRegistry.getState().register(cmd);

      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      await act(async () => {
        await result.current.executeSelected(ctx);
      });

      expect(executeMock).toHaveBeenCalledWith(ctx);
    });

    it('should return error when no command selected', async () => {
      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      const res = await act(async () => {
        return await result.current.executeSelected(ctx);
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('No command selected');
      }
    });

    it('should execute command at selected index', async () => {
      const exec1 = vi.fn().mockResolvedValue({ ok: true });
      const exec2 = vi.fn().mockResolvedValue({ ok: true });

      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Alpha', execute: exec1 });
      const cmd2 = createMockCommand({ id: 'cmd.two' as CommandId, name: 'Beta', execute: exec2 });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());
      const ctx = createMockContext();

      act(() => {
        result.current.selectIndex(1);
      });

      await act(async () => {
        await result.current.executeSelected(ctx);
      });

      expect(exec1).not.toHaveBeenCalled();
      expect(exec2).toHaveBeenCalledWith(ctx);
    });
  });

  describe('reset', () => {
    it('should reset query and selection', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.setQuery('test query');
        result.current.selectIndex(2);
        result.current.reset();
      });

      expect(result.current.query).toBe('');
      expect(result.current.selectedIndex).toBe(0);
    });

    it('should not close the palette', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
        result.current.reset();
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('results filtering', () => {
    it('should show all commands when query is empty', () => {
      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Alpha' });
      const cmd2 = createMockCommand({ id: 'cmd.two' as CommandId, name: 'Beta' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.results).toHaveLength(2);
    });

    it('should filter commands by fuzzy search', () => {
      const cmd1 = createMockCommand({ id: 'file.new' as CommandId, name: 'New File' });
      const cmd2 = createMockCommand({ id: 'edit.copy' as CommandId, name: 'Copy' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.setQuery('file');
      });

      expect(result.current.results.length).toBeGreaterThan(0);
      expect(result.current.results[0]?.item.id).toBe('file.new');
    });

    it('should match commands by description metadata', () => {
      const cmd1 = createMockCommand({
        id: 'file.save-as' as CommandId,
        name: 'Save As',
        description: 'Export document to a new destination',
      });
      const cmd2 = createMockCommand({
        id: 'edit.copy' as CommandId,
        name: 'Copy',
      });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.setQuery('export');
      });

      expect(result.current.results[0]?.item.id).toBe('file.save-as');
    });

    it('should match commands by command id metadata', () => {
      const cmd1 = createMockCommand({ id: 'file.save-as' as CommandId, name: 'Save As' });
      const cmd2 = createMockCommand({ id: 'edit.copy' as CommandId, name: 'Copy' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.setQuery('save-as');
      });

      expect(result.current.results[0]?.item.id).toBe('file.save-as');
    });

    it('should match commands by shortcut metadata', () => {
      const cmd1 = createMockCommand({
        id: 'file.save' as CommandId,
        name: 'Save File',
        shortcut: { key: 's', modifiers: ['Mod'] },
      });
      const cmd2 = createMockCommand({ id: 'edit.copy' as CommandId, name: 'Copy' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.setQuery('mod+s');
      });

      expect(result.current.results[0]?.item.id).toBe('file.save');
    });

    it('should prioritize recent commands when query is empty', () => {
      const cmd1 = createMockCommand({ id: 'cmd.one' as CommandId, name: 'Zulu' });
      const cmd2 = createMockCommand({ id: 'cmd.two' as CommandId, name: 'Alpha' });

      useCommandRegistry.getState().register(cmd1);
      useCommandRegistry.getState().register(cmd2);

      // Track cmd1 as recent
      useCommandRegistry.getState().trackRecentCommand('cmd.one' as CommandId);

      const { result } = renderHook(() => useCommandPalette());

      // With empty query, recent commands (cmd.1) should appear first
      expect(result.current.results[0]?.item.id).toBe('cmd.one');
    });

    it('should exclude commands hidden by visibility predicate', () => {
      const visibleContext = createMockContext();
      const hiddenCommand = createMockCommand({
        id: 'view.hidden' as CommandId,
        name: 'Hidden Command',
        visible: () => false,
      });
      const visibleCommand = createMockCommand({
        id: 'view.visible' as CommandId,
        name: 'Visible Command',
        visible: () => true,
      });

      useCommandRegistry.getState().register(hiddenCommand);
      useCommandRegistry.getState().register(visibleCommand);

      const { result } = renderHook(() => useCommandPalette(() => visibleContext));
      const commandIds = result.current.results.map((entry) => entry.item.id);

      expect(commandIds).toContain('view.visible');
      expect(commandIds).not.toContain('view.hidden');
    });

    it('should recompute visibility when context changes without query changes', () => {
      let hasOpenDocument = false;
      const context = createMockContext();
      const contextProvider = () => ({
        ...context,
        document: {
          ...context.document,
          filePath: hasOpenDocument ? '/notes/example.mdx' : null,
        },
      });

      const conditionalCommand = createMockCommand({
        id: 'file.only-when-open' as CommandId,
        name: 'Open-Document Command',
        visible: (ctx) => ctx.document.filePath !== null,
      });
      useCommandRegistry.getState().register(conditionalCommand);

      const { result, rerender } = renderHook(() => useCommandPalette(contextProvider));

      expect(result.current.results.map((entry) => entry.item.id)).not.toContain('file.only-when-open');

      hasOpenDocument = true;
      rerender();

      expect(result.current.results.map((entry) => entry.item.id)).toContain('file.only-when-open');
    });
  });

  describe('stability', () => {
    it('should return stable action functions', () => {
      const { result, rerender } = renderHook(() => useCommandPalette());

      const firstOpen = result.current.open;
      const firstClose = result.current.close;
      const firstToggle = result.current.toggle;

      rerender();

      expect(result.current.open).toBe(firstOpen);
      expect(result.current.close).toBe(firstClose);
      expect(result.current.toggle).toBe(firstToggle);
    });
  });
});
