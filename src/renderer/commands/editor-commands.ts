/**
 * Editor Commands
 *
 * Built-in editor formatting commands for the command palette.
 * Wraps CodeMirror commands as Command palette commands.
 *
 * @module renderer/commands/editor-commands
 */

import type {
  Command,
  CommandId,
  CommandContext,
  CommandResult,
  ShortcutBinding,
} from '@shared/types/commands';
import {
  executeCommand as executeCMCommand,
  type EditorCommandName,
} from '../hooks/useCodeMirror/commands';
import { editorDocumentKey } from '../lib/editor-document-key';
import { useCommandRegistry } from '../stores/command-registry-store';
import { useAISessionStore } from '../stores/ai-session-store';
import { useDocumentStore } from '../stores/document-store';
import { useTabStore } from '../stores/tab-store';
import { isFeatureEnabled } from '../stores/feature-flags-store';
import { hasWysiwygEdit, isVisualEditCommand, runWysiwygEdit } from '../lib/editor/wysiwyg-command';
import {
  applyWysiwygWriteText,
  hasWysiwygWrite,
  readWysiwygWriteSelection,
} from '../lib/editor/wysiwyg-write';

/**
 * Create an editor command that wraps a CodeMirror command.
 */
function createEditorCommand(
  id: CommandId,
  name: string,
  description: string,
  cmCommand: EditorCommandName,
  shortcut?: ShortcutBinding
): Command {
  const base = {
    id,
    name,
    description,
    category: 'edit' as const,
    execute: (ctx: CommandContext): CommandResult => {
      if (!ctx.editor) {
        if (isVisualEditCommand(cmCommand) && runWysiwygEdit(cmCommand)) {
          return { ok: true };
        }
        ctx.notify({ type: 'warning', message: 'No editor available' });
        return { ok: false, error: 'No editor available' };
      }
      const success = executeCMCommand(ctx.editor, cmCommand);
      return success ? { ok: true } : { ok: false, error: 'Command failed' };
    },
    enabled: (ctx: CommandContext) =>
      ctx.editor !== null || (isVisualEditCommand(cmCommand) && hasWysiwygEdit()),
  };
  return shortcut ? { ...base, shortcut } : base;
}

const WRITE_ACTION_CONTEXT_RADIUS = 240;
const WRITE_ACTION_TIMEOUT_MS = 45_000;

interface WriteActionSelection {
  from: number;
  to: number;
  text: string;
  context: string;
}

interface CompletedWriteActionResult {
  kind: 'completed';
  text: string;
}

interface CanceledWriteActionResult {
  kind: 'canceled';
}

type WriteActionCompletionResult = CompletedWriteActionResult | CanceledWriteActionResult;

function getWriteActionSelection(ctx: CommandContext): WriteActionSelection | null {
  if (!ctx.editor) {
    return readWysiwygWriteSelection();
  }

  const { from, to } = ctx.editor.state.selection.main;
  if (from === to) {
    return null;
  }

  const selectedText = ctx.editor.state.sliceDoc(from, to);
  if (selectedText.trim().length === 0) {
    return null;
  }

  const contextFrom = Math.max(0, from - WRITE_ACTION_CONTEXT_RADIUS);
  const contextTo = Math.min(ctx.editor.state.doc.length, to + WRITE_ACTION_CONTEXT_RADIUS);

  return {
    from,
    to,
    text: selectedText,
    context: ctx.editor.state.sliceDoc(contextFrom, contextTo),
  };
}

function buildWriteActionPrompt(instruction: string, selection: WriteActionSelection): string {
  return [
    instruction,
    '',
    'Selected text:',
    '"""',
    selection.text,
    '"""',
    '',
    'Nearby document context:',
    '"""',
    selection.context,
    '"""',
    '',
    'Return only the replacement text for the selected section.',
  ].join('\n');
}

function waitForWriteActionCompletion(): Promise<WriteActionCompletionResult> {
  return new Promise((resolve, reject) => {
    const evaluateState = (state: ReturnType<typeof useAISessionStore.getState>) => {
      if (state.stream.status === 'completed') {
        cleanup();
        resolve({ kind: 'completed', text: state.stream.text });
        return;
      }

      if (state.stream.status === 'error') {
        cleanup();
        reject(new Error(state.stream.error ?? 'AI write action failed'));
        return;
      }

      if (!state.isStreaming && state.stream.status === 'idle') {
        cleanup();
        resolve({ kind: 'canceled' });
      }
    };

    const unsubscribe = useAISessionStore.subscribe((state) => {
      evaluateState(state);
    });
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('AI write action timed out'));
    }, WRITE_ACTION_TIMEOUT_MS);

    function cleanup(): void {
      unsubscribe();
      window.clearTimeout(timeoutId);
    }

    evaluateState(useAISessionStore.getState());
  });
}

function notifyWriteActionError(
  ctx: CommandContext,
  message: string,
  error: string,
  type: 'warning' | 'info' | 'error' = 'error'
): CommandResult {
  ctx.notify({ type, message });
  return { ok: false, error };
}

function ensureWriteActionCanStart(ctx: CommandContext): CommandResult | null {
  if (!isFeatureEnabled('ai')) {
    return notifyWriteActionError(
      ctx,
      'AI feature is disabled',
      'AI feature is disabled',
      'warning'
    );
  }

  if (!ctx.editor && !hasWysiwygWrite()) {
    return notifyWriteActionError(ctx, 'No editor available', 'No editor available', 'warning');
  }

  const aiSessionState = useAISessionStore.getState();
  if (!aiSessionState.selectedSessionId) {
    return notifyWriteActionError(
      ctx,
      'Select an AI session before running write actions',
      'No AI session selected',
      'warning'
    );
  }

  if (aiSessionState.isStreaming) {
    return notifyWriteActionError(
      ctx,
      'An AI write action is already in progress',
      'AI write action already in progress',
      'info'
    );
  }

  return null;
}

function applyVisualWriteAction(
  ctx: CommandContext,
  selection: WriteActionSelection,
  nextText: string
): CommandResult {
  if (!applyWysiwygWriteText(selection, nextText)) {
    return notifyWriteActionError(
      ctx,
      'Selection changed before applying AI write action; no changes were made',
      'AI write action selection changed',
      'warning'
    );
  }
  useAISessionStore.getState().clearStream();
  ctx.notify({ type: 'success', message: 'AI write action applied' });
  return { ok: true };
}

function applyWriteActionText(
  ctx: CommandContext,
  selection: WriteActionSelection,
  nextText: string
): CommandResult {
  if (!ctx.editor) {
    return applyVisualWriteAction(ctx, selection, nextText);
  }

  const currentSelection = ctx.editor.state.selection.main;
  const hasSelectionDrift =
    currentSelection.from !== selection.from || currentSelection.to !== selection.to;
  const isRangeInvalid =
    selection.from < 0 ||
    selection.to > ctx.editor.state.doc.length ||
    selection.from > selection.to;
  const hasContentDrift =
    !isRangeInvalid && ctx.editor.state.sliceDoc(selection.from, selection.to) !== selection.text;

  if (hasSelectionDrift || isRangeInvalid || hasContentDrift) {
    return notifyWriteActionError(
      ctx,
      'Selection changed before applying AI write action; no changes were made',
      'AI write action selection changed',
      'warning'
    );
  }

  ctx.editor.dispatch({
    changes: {
      from: selection.from,
      to: selection.to,
      insert: nextText,
    },
    selection: {
      anchor: selection.from,
      head: selection.from + nextText.length,
    },
  });

  useAISessionStore.getState().clearStream();
  ctx.notify({
    type: 'success',
    message: 'AI write action applied',
  });
  return { ok: true };
}

function currentWriteDocument(): string {
  return editorDocumentKey(useDocumentStore.getState().filePath, useTabStore.getState().activeTabId);
}

function writeLeftDocument(ctx: CommandContext, startedFor: string): CommandResult | null {
  if (currentWriteDocument() === startedFor) {
    return null;
  }
  return notifyWriteActionError(
    ctx,
    'The document changed before the AI write was applied',
    'Document changed during AI write',
    'warning'
  );
}

async function finishAIWriteAction(
  ctx: CommandContext,
  selection: WriteActionSelection,
  startedFor: string
): Promise<CommandResult> {
  const result = await waitForWriteActionCompletion();
  const left = writeLeftDocument(ctx, startedFor);
  if (left) {
    return left;
  }
  if (result.kind === 'canceled') {
    return notifyWriteActionError(
      ctx,
      'AI write action canceled',
      'AI write action canceled',
      'info'
    );
  }
  if (result.text.trim().length === 0) {
    return notifyWriteActionError(
      ctx,
      'AI write action failed: Empty AI response',
      'Empty AI response'
    );
  }
  return applyWriteActionText(ctx, selection, result.text);
}

async function executeAIWriteAction(
  ctx: CommandContext,
  instruction: string
): Promise<CommandResult> {
  const blockedReason = ensureWriteActionCanStart(ctx);
  if (blockedReason) {
    return blockedReason;
  }

  const selection = getWriteActionSelection(ctx);
  if (!selection) {
    return notifyWriteActionError(
      ctx,
      'Select text in the editor to run AI write actions',
      'No text selected',
      'warning'
    );
  }

  const startedFor = currentWriteDocument();
  try {
    await useAISessionStore.getState().startStream({
      prompt: buildWriteActionPrompt(instruction, selection),
    });
    return await finishAIWriteAction(ctx, selection, startedFor);
  } catch (error) {
    const left = writeLeftDocument(ctx, startedFor);
    if (left) {
      return left;
    }
    const message = error instanceof Error ? error.message : String(error);
    return notifyWriteActionError(ctx, `AI write action failed: ${message}`, message);
  }
}

function createAIWriteActionCommand(
  id: CommandId,
  name: string,
  description: string,
  instruction: string
): Command {
  return {
    id,
    name,
    description,
    category: 'edit',
    execute: async (ctx: CommandContext): Promise<CommandResult> =>
      executeAIWriteAction(ctx, instruction),
    enabled: (ctx: CommandContext) =>
      (ctx.editor !== null || hasWysiwygWrite()) && isFeatureEnabled('ai'),
  };
}

const cancelAIWriteActionCommand: Command = {
  id: 'edit.ai-cancel-write-action' as CommandId,
  name: 'AI: Cancel Write Action',
  description: 'Cancel the in-progress AI write action stream',
  category: 'edit',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    if (!isFeatureEnabled('ai')) {
      ctx.notify({
        type: 'warning',
        message: 'AI feature is disabled',
      });
      return { ok: false, error: 'AI feature is disabled' };
    }

    const aiSessionState = useAISessionStore.getState();
    if (!aiSessionState.isStreaming) {
      ctx.notify({
        type: 'info',
        message: 'No AI write action is currently running',
      });
      return { ok: false, error: 'No AI write action in progress' };
    }

    await aiSessionState.cancelStream();
    ctx.notify({
      type: 'info',
      message: 'AI write action canceled',
    });
    return { ok: true };
  },
  enabled: (ctx: CommandContext) =>
    (ctx.editor !== null || hasWysiwygWrite()) && isFeatureEnabled('ai'),
};

// =============================================================================
// COMMAND DEFINITIONS
// =============================================================================

const boldCommand = createEditorCommand(
  'edit.bold' as CommandId,
  'Bold',
  'Toggle bold formatting',
  'bold',
  { key: 'b', modifiers: ['Mod'] }
);

const italicCommand = createEditorCommand(
  'edit.italic' as CommandId,
  'Italic',
  'Toggle italic formatting',
  'italic',
  { key: 'i', modifiers: ['Mod'] }
);

const codeCommand = createEditorCommand(
  'edit.code' as CommandId,
  'Inline Code',
  'Toggle inline code formatting',
  'code',
  { key: 'e', modifiers: ['Mod'] }
);

const linkCommand = createEditorCommand(
  'edit.link' as CommandId,
  'Insert Link',
  'Insert a markdown link',
  'link',
  { key: 'k', modifiers: ['Mod'] }
);

const codeBlockCommand = createEditorCommand(
  'edit.code-block' as CommandId,
  'Insert Code Block',
  'Insert a fenced code block',
  'codeBlock',
  { key: 'k', modifiers: ['Mod', 'Shift'] }
);

const toggleCommentCommand = createEditorCommand(
  'edit.toggle-comment' as CommandId,
  'Toggle Comment',
  'Toggle comment on current line',
  'toggleComment',
  { key: '/', modifiers: ['Mod'] }
);

const undoCommand = createEditorCommand(
  'edit.undo' as CommandId,
  'Undo',
  'Undo last change',
  'undo',
  { key: 'z', modifiers: ['Mod'] }
);

const redoCommand = createEditorCommand(
  'edit.redo' as CommandId,
  'Redo',
  'Redo last undone change',
  'redo',
  { key: 'z', modifiers: ['Mod', 'Shift'] }
);

const findCommand = createEditorCommand(
  'edit.find' as CommandId,
  'Find',
  'Open find dialog',
  'find',
  { key: 'f', modifiers: ['Mod'] }
);

const findReplaceCommand = createEditorCommand(
  'edit.find-replace' as CommandId,
  'Find and Replace',
  'Open find and replace dialog',
  'findReplace',
  { key: 'f', modifiers: ['Mod', 'Shift'] }
);

const goToLineCommand = createEditorCommand(
  'edit.go-to-line' as CommandId,
  'Go to Line',
  'Jump to a specific line number',
  'goToLine',
  { key: 'g', modifiers: ['Mod'] }
);

const heading1Command = createEditorCommand(
  'edit.heading-1' as CommandId,
  'Heading 1',
  'Convert line to heading level 1',
  'heading1',
  { key: '1', modifiers: ['Mod'] }
);

const heading2Command = createEditorCommand(
  'edit.heading-2' as CommandId,
  'Heading 2',
  'Convert line to heading level 2',
  'heading2',
  { key: '2', modifiers: ['Mod'] }
);

const heading3Command = createEditorCommand(
  'edit.heading-3' as CommandId,
  'Heading 3',
  'Convert line to heading level 3',
  'heading3',
  { key: '3', modifiers: ['Mod'] }
);

const aiRewriteCommand = createAIWriteActionCommand(
  'edit.ai-rewrite' as CommandId,
  'AI: Rewrite Selection',
  'Rewrite selected text for clarity while preserving intent',
  'Rewrite the selected Markdown or MDX text for clarity and readability while preserving intent and factual accuracy.'
);

const aiSummarizeCommand = createAIWriteActionCommand(
  'edit.ai-summarize' as CommandId,
  'AI: Summarize Selection',
  'Summarize selected text into concise key points',
  'Summarize the selected Markdown or MDX text into concise key points and preserve important details.'
);

const aiFixGrammarCommand = createAIWriteActionCommand(
  'edit.ai-fix-grammar' as CommandId,
  'AI: Fix Grammar',
  'Fix grammar, spelling, and punctuation in selected text',
  'Fix grammar, spelling, and punctuation in the selected Markdown or MDX text without changing meaning.'
);

const aiAdjustToneCommand = createAIWriteActionCommand(
  'edit.ai-adjust-tone' as CommandId,
  'AI: Adjust Tone',
  'Adjust selected text to a clear professional tone',
  'Adjust the tone of the selected Markdown or MDX text to be clear and professional while preserving meaning.'
);

// =============================================================================
// REGISTRATION
// =============================================================================

const EDITOR_COMMANDS: readonly Command[] = [
  boldCommand,
  italicCommand,
  codeCommand,
  linkCommand,
  codeBlockCommand,
  toggleCommentCommand,
  undoCommand,
  redoCommand,
  findCommand,
  findReplaceCommand,
  goToLineCommand,
  heading1Command,
  heading2Command,
  heading3Command,
  aiRewriteCommand,
  aiSummarizeCommand,
  aiFixGrammarCommand,
  aiAdjustToneCommand,
  cancelAIWriteActionCommand,
];

/**
 * Register all editor commands with the command registry.
 * @returns Unregister function
 */
export function registerEditorCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];

  for (const command of EDITOR_COMMANDS) {
    const result = register(command);
    if (result.ok) {
      registeredIds.push(command.id);
    }
  }

  return () => {
    for (const id of registeredIds) {
      unregister(id);
    }
  };
}

export { EDITOR_COMMANDS };
