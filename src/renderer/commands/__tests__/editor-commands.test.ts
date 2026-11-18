/**
 * Tests for editor commands.
 *
 * Tests command IDs, shortcuts, execution logic, and enabled predicates
 * for all 14 editor commands wrapping CodeMirror.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandContext, CommandId } from '@shared/types/commands';
import { useFeatureFlagsStore } from '../../stores/feature-flags-store';
import { registerWysiwygEdit } from '../../lib/editor/wysiwyg-command';
import { registerWysiwygWrite } from '../../lib/editor/wysiwyg-write';

// =============================================================================
// MOCKS
// =============================================================================

const mockExecuteCommand = vi.fn().mockReturnValue(true);
const aiStoreListeners = new Set<(state: MockAISessionStoreState) => void>();

interface MockAISessionStoreState {
  selectedSessionId: string | null;
  isStreaming: boolean;
  stream: {
    status: 'idle' | 'starting' | 'streaming' | 'completed' | 'canceling' | 'error';
    text: string;
    error: string | null;
  };
  startStream: ReturnType<typeof vi.fn>;
  cancelStream: ReturnType<typeof vi.fn>;
  clearStream: ReturnType<typeof vi.fn>;
}

const mockAISessionStoreState: MockAISessionStoreState = {
  selectedSessionId: '33333333-3333-4333-8333-333333333333',
  isStreaming: false,
  stream: {
    status: 'idle',
    text: '',
    error: null,
  },
  startStream: vi.fn(async () => undefined),
  cancelStream: vi.fn(async () => undefined),
  clearStream: vi.fn(() => undefined),
};

function resetMockAISessionStoreState(): void {
  mockAISessionStoreState.selectedSessionId = '33333333-3333-4333-8333-333333333333';
  mockAISessionStoreState.isStreaming = false;
  mockAISessionStoreState.stream = {
    status: 'idle',
    text: '',
    error: null,
  };
  mockAISessionStoreState.startStream.mockReset();
  mockAISessionStoreState.cancelStream.mockReset();
  mockAISessionStoreState.clearStream.mockReset();
  mockAISessionStoreState.startStream.mockResolvedValue(undefined);
  mockAISessionStoreState.cancelStream.mockResolvedValue(undefined);
  mockAISessionStoreState.clearStream.mockImplementation(() => undefined);
  aiStoreListeners.clear();
}

function emitAISessionStoreState(
  nextState: Partial<Omit<MockAISessionStoreState, 'stream'>> & {
    stream?: Partial<MockAISessionStoreState['stream']>;
  }
): void {
  if (nextState.selectedSessionId !== undefined) {
    mockAISessionStoreState.selectedSessionId = nextState.selectedSessionId;
  }
  if (nextState.isStreaming !== undefined) {
    mockAISessionStoreState.isStreaming = nextState.isStreaming;
  }
  if (nextState.stream) {
    mockAISessionStoreState.stream = {
      ...mockAISessionStoreState.stream,
      ...nextState.stream,
    };
  }

  for (const listener of aiStoreListeners) {
    listener(mockAISessionStoreState);
  }
}

vi.mock('../../hooks/useCodeMirror/commands', () => ({
  executeCommand: (...args: unknown[]) => mockExecuteCommand(...args),
}));

vi.mock('../../stores/ai-session-store', () => ({
  useAISessionStore: {
    getState: () => mockAISessionStoreState,
    subscribe: (listener: (state: MockAISessionStoreState) => void) => {
      aiStoreListeners.add(listener);
      return () => {
        aiStoreListeners.delete(listener);
      };
    },
  },
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

function createMockEditor(options: { content: string; from: number; to: number }): {
  state: {
    selection: { main: { from: number; to: number } };
    doc: { length: number };
    sliceDoc: (from: number, to: number) => string;
  };
  dispatch: ReturnType<typeof vi.fn>;
} {
  return {
    state: {
      selection: { main: { from: options.from, to: options.to } },
      doc: { length: options.content.length },
      sliceDoc: (from: number, to: number) => options.content.slice(from, to),
    },
    dispatch: vi.fn(),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('EDITOR_COMMANDS', () => {
  it('should contain 19 commands', () => {
    expect(EDITOR_COMMANDS).toHaveLength(19);
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
    'edit.ai-rewrite',
    'edit.ai-summarize',
    'edit.ai-fix-grammar',
    'edit.ai-adjust-tone',
    'edit.ai-cancel-write-action',
  ];

  it('should have all expected command IDs', () => {
    const ids = EDITOR_COMMANDS.map((c) => c.id);
    for (const expected of expectedIds) {
      expect(ids).toContain(expected);
    }
  });
});

describe('Editor command shortcuts', () => {
  const shortcutTests: { id: string; key: string; modifiers: string[] }[] = [
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
    resetMockAISessionStoreState();
    useFeatureFlagsStore.getState().setFlag('ai', true);
    registerWysiwygEdit(null);
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

  it('runs bold in the visual editor when the source editor is closed', () => {
    const ran: string[] = [];
    registerWysiwygEdit((command) => {
      ran.push(command);
      return true;
    });
    const ctx = createMockContext({ editor: null });
    const cmd = EDITOR_COMMANDS.find((item) => item.id === 'edit.bold');
    expect(cmd?.execute(ctx)).toEqual({ ok: true });
    expect(ran).toEqual(['bold']);
    expect(ctx.notify).not.toHaveBeenCalled();
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

describe('AI write command execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockAISessionStoreState();
    registerWysiwygWrite(null);
    useFeatureFlagsStore.getState().setFlag('ai', true);
  });

  it('should block AI write commands when AI feature flag is off', async () => {
    useFeatureFlagsStore.getState().setFlag('ai', false);
    const editor = createMockEditor({ content: 'Hello world', from: 0, to: 5 });
    const ctx = createMockContext({ editor: editor as unknown as CommandContext['editor'] });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-rewrite');

    const result = await cmd?.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'AI feature is disabled' });
    expect(mockAISessionStoreState.startStream).not.toHaveBeenCalled();
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'AI feature is disabled',
    });
  });

  it('should show warning when no AI session is selected', async () => {
    mockAISessionStoreState.selectedSessionId = null;
    const editor = createMockEditor({ content: 'Hello world', from: 0, to: 5 });
    const ctx = createMockContext({ editor: editor as unknown as CommandContext['editor'] });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-rewrite');

    const result = await cmd?.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'No AI session selected' });
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'Select an AI session before running write actions',
    });
  });

  it('should show warning when there is no text selection', async () => {
    const editor = createMockEditor({ content: 'Hello world', from: 0, to: 0 });
    const ctx = createMockContext({ editor: editor as unknown as CommandContext['editor'] });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-rewrite');

    const result = await cmd?.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'No text selected' });
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'Select text in the editor to run AI write actions',
    });
  });

  it('should preserve AI response whitespace when replacing selected text', async () => {
    const editor = createMockEditor({ content: 'Hello world', from: 0, to: 5 });
    const ctx = createMockContext({ editor: editor as unknown as CommandContext['editor'] });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-summarize');

    mockAISessionStoreState.startStream.mockImplementation(async () => {
      emitAISessionStoreState({
        isStreaming: true,
        stream: { status: 'streaming', text: '', error: null },
      });
      emitAISessionStoreState({
        isStreaming: false,
        stream: { status: 'completed', text: '  Summary  \n', error: null },
      });
    });

    const result = await cmd?.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockAISessionStoreState.startStream).toHaveBeenCalledWith({
      prompt: expect.stringContaining('Hello'),
    });
    expect(editor.dispatch).toHaveBeenCalledWith({
      changes: { from: 0, to: 5, insert: '  Summary  \n' },
      selection: { anchor: 0, head: 12 },
    });
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'success',
      message: 'AI write action applied',
    });
  });

  it('should reject AI write action when selection drifts before apply', async () => {
    const editor = createMockEditor({ content: 'Hello world', from: 0, to: 5 });
    const ctx = createMockContext({ editor: editor as unknown as CommandContext['editor'] });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-rewrite');

    mockAISessionStoreState.startStream.mockImplementation(async () => {
      emitAISessionStoreState({
        isStreaming: true,
        stream: { status: 'streaming', text: '', error: null },
      });
      editor.state.selection.main = { from: 1, to: 6 };
      emitAISessionStoreState({
        isStreaming: false,
        stream: { status: 'completed', text: 'Updated', error: null },
      });
    });

    const result = await cmd?.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'AI write action selection changed' });
    expect(editor.dispatch).not.toHaveBeenCalled();
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'Selection changed before applying AI write action; no changes were made',
    });
  });

  it('should treat whitespace-only AI responses as empty', async () => {
    const editor = createMockEditor({ content: 'Hello world', from: 0, to: 5 });
    const ctx = createMockContext({ editor: editor as unknown as CommandContext['editor'] });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-adjust-tone');

    mockAISessionStoreState.startStream.mockImplementation(async () => {
      emitAISessionStoreState({
        isStreaming: false,
        stream: { status: 'completed', text: ' \n\t ', error: null },
      });
    });

    const result = await cmd?.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'Empty AI response' });
    expect(editor.dispatch).not.toHaveBeenCalled();
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'error',
      message: 'AI write action failed: Empty AI response',
    });
  });

  it('should handle stream errors from AI write action', async () => {
    const editor = createMockEditor({ content: 'Hello world', from: 0, to: 5 });
    const ctx = createMockContext({ editor: editor as unknown as CommandContext['editor'] });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-fix-grammar');

    mockAISessionStoreState.startStream.mockImplementation(async () => {
      emitAISessionStoreState({
        isStreaming: false,
        stream: { status: 'error', text: '', error: 'Provider unavailable' },
      });
    });

    const result = await cmd?.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'Provider unavailable' });
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'error',
      message: 'AI write action failed: Provider unavailable',
    });
    expect(editor.dispatch).not.toHaveBeenCalled();
  });

  it('should apply an AI rewrite to the visual selection', async () => {
    const applied: { text: string }[] = [];
    registerWysiwygWrite({
      read: () => ({ from: 1, to: 6, text: 'Hello', context: 'Hello world' }),
      apply: (_expected, next) => {
        applied.push({ text: next });
        return true;
      },
    });
    const ctx = createMockContext({ editor: null });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-rewrite');
    mockAISessionStoreState.startStream.mockImplementation(async () => {
      emitAISessionStoreState({
        isStreaming: false,
        stream: { status: 'completed', text: 'Hi', error: null },
      });
    });

    const result = await cmd?.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(applied).toEqual([{ text: 'Hi' }]);
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'success',
      message: 'AI write action applied',
    });
  });

  it('cancels an in-progress AI write action from the visual editor', async () => {
    mockAISessionStoreState.isStreaming = true;
    registerWysiwygWrite({
      read: () => null,
      apply: () => false,
    });
    const ctx = createMockContext({ editor: null });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-cancel-write-action');

    const result = await cmd?.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockAISessionStoreState.cancelStream).toHaveBeenCalledTimes(1);
  });

  it('should cancel an in-progress AI write action', async () => {
    mockAISessionStoreState.isStreaming = true;
    const ctx = createMockContext({
      editor: createMockEditor({
        content: 'Hello world',
        from: 0,
        to: 5,
      }) as unknown as CommandContext['editor'],
    });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-cancel-write-action');

    const result = await cmd?.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockAISessionStoreState.cancelStream).toHaveBeenCalledTimes(1);
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'AI write action canceled',
    });
  });
});

describe('Editor command enabled predicate', () => {
  beforeEach(() => {
    useFeatureFlagsStore.getState().setFlag('ai', true);
    registerWysiwygEdit(null);
    registerWysiwygWrite(null);
  });

  it('should be disabled when editor is null', () => {
    const ctx = createMockContext({ editor: null });
    for (const cmd of EDITOR_COMMANDS) {
      expect(cmd.enabled?.(ctx)).toBe(false);
    }
  });

  it('enables canceling an AI write while the visual editor is open', () => {
    registerWysiwygWrite({
      read: () => null,
      apply: () => false,
    });
    const ctx = createMockContext({ editor: null });
    const cmd = EDITOR_COMMANDS.find((command) => command.id === 'edit.ai-cancel-write-action');
    expect(cmd?.enabled?.(ctx)).toBe(true);
  });

  it('should be enabled when editor is present', () => {
    const mockEditor = {} as CommandContext['editor'];
    const ctx = createMockContext({ editor: mockEditor });
    for (const cmd of EDITOR_COMMANDS) {
      expect(cmd.enabled?.(ctx)).toBe(true);
    }
  });

  it('should disable only AI commands when AI feature flag is off', () => {
    useFeatureFlagsStore.getState().setFlag('ai', false);
    const mockEditor = {} as CommandContext['editor'];
    const ctx = createMockContext({ editor: mockEditor });
    for (const cmd of EDITOR_COMMANDS) {
      if (cmd.id.startsWith('edit.ai-')) {
        expect(cmd.enabled?.(ctx)).toBe(false);
      } else {
        expect(cmd.enabled?.(ctx)).toBe(true);
      }
    }
  });
});

describe('registerEditorCommands', () => {
  it('should return an unregister function', () => {
    const unregister = registerEditorCommands();
    expect(typeof unregister).toBe('function');
  });
});
