/**
 * Tests for filter commands.
 *
 * Tests command IDs, shortcuts, execution logic for focusFilter and clearFilter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandContext } from '@shared/types/commands';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('../../stores/command-registry-store', () => ({
  useCommandRegistry: {
    getState: () => ({
      register: vi.fn(() => ({ ok: true, command: {} })),
      unregister: vi.fn(() => true),
    }),
  },
}));

// Import after mocking
import { FILTER_COMMANDS, FILTER_EVENTS, registerFilterCommands } from '../filter-commands';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockContext(): CommandContext {
  return {
    editor: null,
    document: { fileId: null, filePath: null, content: '', isDirty: false },
    ui: { previewVisible: true, sidebarVisible: true, zoomLevel: 100 },
    platform: { isMac: true, isWindows: false, isLinux: false },
    api: {} as CommandContext['api'],
    notify: vi.fn(),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('FILTER_EVENTS', () => {
  it('should have correct event names', () => {
    expect(FILTER_EVENTS.focus).toBe('mdxpad:filter:focus');
    expect(FILTER_EVENTS.clear).toBe('mdxpad:filter:clear');
    expect(FILTER_EVENTS.focusWorkspaceLinkSearch).toBe('mdxpad:workspace-link-search:focus');
    expect(FILTER_EVENTS.clearWorkspaceLinkSearch).toBe('mdxpad:workspace-link-search:clear');
  });
});

describe('FILTER_COMMANDS', () => {
  it('should contain 4 commands', () => {
    expect(FILTER_COMMANDS).toHaveLength(4);
  });

  it('should have unique IDs', () => {
    const ids = FILTER_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('focusFilterCommand', () => {
  const focusCmd = FILTER_COMMANDS.find((c) => c.id === 'filter.focus')!;

  it('should have correct ID', () => {
    expect(focusCmd.id).toBe('filter.focus');
  });

  it('should have Cmd+P shortcut', () => {
    expect(focusCmd.shortcut).toEqual({ key: 'p', modifiers: ['Mod'] });
  });

  it('should be in view category', () => {
    expect(focusCmd.category).toBe('view');
  });

  it('should dispatch focus custom event on execute', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const ctx = createMockContext();

    const result = focusCmd.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]![0] as CustomEvent;
    expect(event.type).toBe(FILTER_EVENTS.focus);

    dispatchSpy.mockRestore();
  });
});

describe('clearFilterCommand', () => {
  const clearCmd = FILTER_COMMANDS.find((c) => c.id === 'filter.clear')!;

  it('should have correct ID', () => {
    expect(clearCmd.id).toBe('filter.clear');
  });

  it('should have no global shortcut', () => {
    expect(clearCmd.shortcut).toBeUndefined();
  });

  it('should be in view category', () => {
    expect(clearCmd.category).toBe('view');
  });

  it('should dispatch clear custom event on execute', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const ctx = createMockContext();

    const result = clearCmd.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]![0] as CustomEvent;
    expect(event.type).toBe(FILTER_EVENTS.clear);

    dispatchSpy.mockRestore();
  });
});

describe('focusWorkspaceLinkSearchCommand', () => {
  const command = FILTER_COMMANDS.find((c) => c.id === 'filter.focus-workspace-links')!;

  it('should dispatch workspace link search focus event on execute', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const ctx = createMockContext();

    const result = command.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]![0] as CustomEvent;
    expect(event.type).toBe(FILTER_EVENTS.focusWorkspaceLinkSearch);

    dispatchSpy.mockRestore();
  });
});

describe('clearWorkspaceLinkSearchCommand', () => {
  const command = FILTER_COMMANDS.find((c) => c.id === 'filter.clear-workspace-links')!;

  it('should dispatch workspace link search clear event on execute', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const ctx = createMockContext();

    const result = command.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]![0] as CustomEvent;
    expect(event.type).toBe(FILTER_EVENTS.clearWorkspaceLinkSearch);

    dispatchSpy.mockRestore();
  });
});

describe('registerFilterCommands', () => {
  it('should return an unregister function', () => {
    const unregister = registerFilterCommands();
    expect(typeof unregister).toBe('function');
  });
});
