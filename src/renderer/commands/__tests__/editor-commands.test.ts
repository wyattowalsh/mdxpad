/**
 * Tests for editor commands.
 *
 * Tests command IDs, shortcuts, execution logic, and enabled predicates
 * for all 14 editor commands wrapping CodeMirror.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandContext, CommandId } from '@shared/types/commands';

// =============================================================================
// MOCKS
// =============================================================================

const mockExecuteCommand = vi.fn().mockReturnValue(true);

vi.mock('../../hooks/useCodeMirror/commands', () => ({
  executeCommand: (...args: unknown[]) => mockExecuteCommand(...args),
}));

vi.mock('../../stores/command-registry-store', () => ({
  useCommandRegistry: {
    getState: () => ({
      register: vi.fn(() => ({ ok: true, command: {} })),
      unregister: vi.fn(() => true),
    }),
  },
}));

// Import after mocking
import { EDITOR_COMMANDS, registerEditorCommands } from '../editor-commands';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    editor: null,
    document: { fileId: null, filePath: null, content: '', isDirty: false },
    ui: { previewVisible: true, sidebarVisible: true, zoomLevel: 100 },
    platform: { isMac: true, isWindows: false, isLinux: false },
    api: {} as CommandContext['api'],
    notify: vi.fn(),
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('EDITOR_COMMANDS', () => {
  it('should contain 14 commands', () => {
    expect(EDITOR_COMMANDS).toHaveLength(14);
  });

  it('should have unique IDs', () => {
    const ids = EDITOR_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should all be in the "edit" category', () => {
    for (const cmd of EDITOR_COMMANDS) {
      expect(cmd.category).toBe('edit');
    }
  });
});

describe('Editor command IDs', () => {
  const expectedIds: string[] = [
    'edit.bold',
    'edit.italic',
    'edit.code',
    'edit.link',
    'edit.code-block',
    'edit.toggle-comment',
    'edit.undo',
    'edit.redo',
    'edit.find',
    'edit.find-replace',
    'edit.go-to-line',
    'edit.heading-1',
    'edit.heading-2',
    'edit.heading-3',
  ];

  it('should have all expected command IDs', () => {
    const ids = EDITOR_COMMANDS.map((c) => c.id);
    for (const expected of expectedIds) {
      expect(ids).toContain(expected);
    }
  });
});

describe('Editor command shortcuts', () => {
  const shortcutTests: Array<{ id: string; key: string; modifiers: string[] }> = [
    { id: 'edit.bold', key: 'b', modifiers: ['Mod'] },
    { id: 'edit.italic', key: 'i', modifiers: ['Mod'] },
    { id: 'edit.code', key: 'e', modifiers: ['Mod'] },
    { id: 'edit.link', key: 'k', modifiers: ['Mod'] },
    { id: 'edit.code-block', key: 'k', modifiers: ['Mod', 'Shift'] },
    { id: 'edit.toggle-comment', key: '/', modifiers: ['Mod'] },
    { id: 'edit.undo', key: 'z', modifiers: ['Mod'] },
    { id: 'edit.redo', key: 'z', modifiers: ['Mod', 'Shift'] },
    { id: 'edit.find', key: 'f', modifiers: ['Mod'] },
    { id: 'edit.find-replace', key: 'f', modifiers: ['Mod', 'Shift'] },
    { id: 'edit.go-to-line', key: 'g', modifiers: ['Mod'] },
    { id: 'edit.heading-1', key: '1', modifiers: ['Mod'] },
    { id: 'edit.heading-2', key: '2', modifiers: ['Mod'] },
    { id: 'edit.heading-3', key: '3', modifiers: ['Mod'] },
  ];

  for (const { id, key, modifiers } of shortcutTests) {
    it(`${id} should have correct shortcut`, () => {
      const cmd = EDITOR_COMMANDS.find((c) => c.id === id);
      expect(cmd?.shortcut).toEqual({ key, modifiers });
    });
  }
});

describe('Editor command execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when editor is null', () => {
    const ctx = createMockContext({ editor: null });
    const cmd = EDITOR_COMMANDS[0]!;

    const result = cmd.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'No editor available' });
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'No editor available',
    });
  });

  it('should call executeCMCommand when editor is present', () => {
    const mockEditor = {} as CommandContext['editor'];
    const ctx = createMockContext({ editor: mockEditor });
    const cmd = EDITOR_COMMANDS[0]!; // bold

    const result = cmd.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockExecuteCommand).toHaveBeenCalledWith(mockEditor, 'bold');
  });

  it('should return error when CM command fails', () => {
    mockExecuteCommand.mockReturnValueOnce(false);
    const mockEditor = {} as CommandContext['editor'];
    const ctx = createMockContext({ editor: mockEditor });
    const cmd = EDITOR_COMMANDS[0]!;

    const result = cmd.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'Command failed' });
  });
});

describe('Editor command enabled predicate', () => {
  it('should be disabled when editor is null', () => {
    const ctx = createMockContext({ editor: null });
    for (const cmd of EDITOR_COMMANDS) {
      expect(cmd.enabled?.(ctx)).toBe(false);
    }
  });

  it('should be enabled when editor is present', () => {
    const mockEditor = {} as CommandContext['editor'];
    const ctx = createMockContext({ editor: mockEditor });
    for (const cmd of EDITOR_COMMANDS) {
      expect(cmd.enabled?.(ctx)).toBe(true);
    }
  });
});

describe('registerEditorCommands', () => {
  it('should return an unregister function', () => {
    const unregister = registerEditorCommands();
    expect(typeof unregister).toBe('function');
  });
});
