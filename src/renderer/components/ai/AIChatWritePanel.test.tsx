import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  AIInstructionFileMetadata,
  AIPromptFileMetadata,
  AIInstructionScope,
} from '@shared/contracts/ai-schemas';
import type { AISession } from '@shared/types/root';
import {
  useAISessionStore,
  type LoadAttachmentOptions,
  type StartStreamRequest,
} from '@renderer/stores/ai-session-store';
import { AIChatWritePanel } from './AIChatWritePanel';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-02-22T12:00:00.000Z';

function createSession(overrides: Partial<AISession> = {}): AISession {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    provider: 'provider-1',
    model: 'gpt-4o-mini',
    contextDocumentIds: [],
    startedAt: NOW,
    lastActivityAt: NOW,
    ...overrides,
  };
}

function createPrompt(overrides: Partial<AIPromptFileMetadata> = {}): AIPromptFileMetadata {
  return {
    id: 'prompt-1',
    kind: 'prompt',
    filePath: '/prompts/rewrite.md',
    fileName: 'rewrite.md',
    title: 'Rewrite',
    variables: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createInstruction(
  overrides: Partial<AIInstructionFileMetadata> = {}
): AIInstructionFileMetadata {
  return {
    id: 'instruction-1',
    kind: 'instruction',
    scope: 'workspace',
    filePath: '/instructions/workspace.md',
    fileName: 'workspace.md',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('AIChatWritePanel', () => {
  beforeEach(() => {
    useAISessionStore.getState().reset();
  });

  it('loads sessions and attachment options on mount', async () => {
    const loadSessions = vi
      .fn<(workspaceId?: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    const loadAttachmentOptions = vi
      .fn<(options?: LoadAttachmentOptions) => Promise<void>>()
      .mockResolvedValue(undefined);

    useAISessionStore.setState({
      loadSessions,
      loadAttachmentOptions,
    });

    render(<AIChatWritePanel workspaceId={WORKSPACE_ID} instructionScope="workspace" />);

    await waitFor(() => {
      expect(loadSessions).toHaveBeenCalledWith(WORKSPACE_ID);
      expect(loadAttachmentOptions).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        instructionScope: 'workspace',
      });
    });
  });

  it('selects an AI session from the session control', () => {
    const session = createSession();
    const selectSession = vi
      .fn<(sessionId: string | null) => Promise<void>>()
      .mockResolvedValue(undefined);

    useAISessionStore.setState({
      sessions: [session],
      selectSession,
    });

    render(<AIChatWritePanel />);

    fireEvent.change(screen.getByTestId('ai-session-select'), {
      target: { value: session.id },
    });

    expect(selectSession).toHaveBeenCalledWith(session.id);
  });

  it('attaches prompt and instruction files for the selected session', () => {
    const session = createSession();
    const prompt = createPrompt();
    const instruction = createInstruction();
    const attachPrompt = vi
      .fn<(promptFileId: string | null) => Promise<void>>()
      .mockResolvedValue(undefined);
    const attachInstruction = vi
      .fn<(instructionFileId: string | null) => Promise<void>>()
      .mockResolvedValue(undefined);

    useAISessionStore.setState({
      selectedSessionId: session.id,
      selectedSession: session,
      prompts: [prompt],
      instructions: [instruction],
      attachPrompt,
      attachInstruction,
    });

    render(<AIChatWritePanel />);

    fireEvent.change(screen.getByTestId('ai-prompt-select'), {
      target: { value: prompt.id },
    });
    fireEvent.change(screen.getByTestId('ai-instruction-select'), {
      target: { value: instruction.id },
    });

    expect(attachPrompt).toHaveBeenCalledWith(prompt.id);
    expect(attachInstruction).toHaveBeenCalledWith(instruction.id);
  });

  it('triggers a write action with the composed prompt', () => {
    const session = createSession();
    const startStream = vi
      .fn<(request: StartStreamRequest) => Promise<void>>()
      .mockResolvedValue(undefined);

    useAISessionStore.setState({
      selectedSessionId: session.id,
      selectedSession: session,
      startStream,
    });

    render(<AIChatWritePanel />);

    fireEvent.change(screen.getByTestId('ai-write-action-select'), {
      target: { value: 'rewrite' },
    });
    fireEvent.change(screen.getByTestId('ai-write-input'), {
      target: { value: 'Preserve all technical terms.' },
    });
    fireEvent.click(screen.getByTestId('ai-run-action-button'));

    expect(startStream).toHaveBeenCalledWith({
      prompt:
        'Rewrite the selected content for clarity and readability.\n\nPreserve all technical terms.',
    });
  });

  it('cancels an in-flight write action stream', () => {
    const session = createSession();
    const cancelStream = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const instructionScope: AIInstructionScope = 'workspace';

    useAISessionStore.setState({
      selectedSessionId: session.id,
      selectedSession: session,
      isStreaming: true,
      cancelStream,
    });

    render(<AIChatWritePanel instructionScope={instructionScope} />);

    fireEvent.click(screen.getByTestId('ai-cancel-action-button'));

    expect(cancelStream).toHaveBeenCalledTimes(1);
  });
});
