import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ConnectionStatus, ProviderConfig } from '@shared/ai/types';
import type {
  AIInstructionFileMetadata,
  AIPromptFileMetadata,
  AIInstructionScope,
} from '@shared/contracts/ai-schemas';
import type { DocumentId } from '@shared/types/document';
import type { AISession } from '@shared/types/root';
import type { WorkspaceModel } from '@shared/types/workspace';
import { useAIProviderStore } from '@renderer/features/ai-provider/store';
import { useDocumentStore } from '@renderer/stores/document-store';
import { registerLiveSourceText } from '@renderer/components/tabs/live-source-text';
import {
  useAISessionStore,
  type LoadAttachmentOptions,
  type StartStreamRequest,
} from '@renderer/stores/ai-session-store';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import { AIChatWritePanel } from './AIChatWritePanel';
import {
  INSTRUCTION_LOAD_FAILED_MESSAGE,
  NO_MODELS_AVAILABLE_MESSAGE,
  buildWritePrompt,
} from './build-write-prompt';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const PROVIDER_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const DOCUMENT_ID = '55555555-5555-4555-8555-555555555555';
const MODEL_ID = 'gpt-4o-mini';
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

function createWorkspaceModel(rootPath = '/workspace/notes'): WorkspaceModel {
  return {
    version: 1,
    workspace: {
      id: WORKSPACE_ID,
      name: 'Notes',
      rootPath,
      documents: [],
      activeDocumentId: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
    projects: [],
    linkIndex: {},
  };
}

function createProvider(status: ConnectionStatus): ProviderConfig {
  return {
    id: PROVIDER_ID,
    displayName: 'OpenAI',
    type: 'openai',
    isActive: true,
    status,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function installAiBridge(ai: {
  listModels?: ReturnType<typeof vi.fn>;
  loadInstruction?: ReturnType<typeof vi.fn>;
}): void {
  Object.defineProperty(window, 'mdxpad', {
    configurable: true,
    writable: true,
    value: { ai },
  });
}

function readPrompt(startStream: { mock: { calls: unknown[][] } }): string {
  const request = startStream.mock.calls[0]?.[0] as StartStreamRequest | undefined;
  return request?.prompt ?? '';
}

function resetPanelStores(): void {
  registerLiveSourceText(null);
  useAISessionStore.getState().reset();
  useAISessionStore.setState({
    loadSessions: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    loadAttachmentOptions: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  });
  useDocumentStore.getState().reset();
  useWorkspaceStore.getState().reset();
  useAIProviderStore.setState({
    providers: [],
    activeProviderId: null,
    error: null,
  });
}

describe('AIChatWritePanel', () => {
  beforeEach(() => {
    resetPanelStores();
  });

  afterEach(() => {
    cleanup();
    resetPanelStores();
  });

  it('inserts a finished draft into the open document', () => {
    useDocumentStore.setState({ content: 'Hello', filePath: '/notes/draft.mdx' });
    useAISessionStore.setState({
      stream: {
        status: 'idle',
        streamId: null,
        documentKey: '/notes/draft.mdx',
        text: 'more text',
        usage: null,
        error: null,
      },
      isStreaming: false,
    });

    render(<AIChatWritePanel />);
    fireEvent.click(screen.getByTestId('ai-insert-result-button'));

    expect(useDocumentStore.getState().content).toBe('Hello\n\nmore text');
  });

  it('hides a draft that was written for another file', () => {
    useDocumentStore.setState({ content: 'Hello', filePath: '/notes/other.mdx' });
    useAISessionStore.setState({
      stream: {
        status: 'idle',
        streamId: null,
        documentKey: '/notes/draft.mdx',
        text: 'more text',
        usage: null,
        error: null,
      },
      isStreaming: false,
    });

    render(<AIChatWritePanel />);

    expect(screen.queryByTestId('ai-insert-result-button')).toBeNull();
    expect(useDocumentStore.getState().content).toBe('Hello');
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

  it('sends one prompt with the action text, document path, and document body', () => {
    const session = createSession();
    const startStream = vi
      .fn<(request: StartStreamRequest) => Promise<void>>()
      .mockResolvedValue(undefined);
    const documentBody = '# Draft body\n\nKeep this paragraph.';

    useDocumentStore.setState({
      filePath: '/notes/draft.mdx',
      content: documentBody,
    });
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

    expect(startStream).toHaveBeenCalledTimes(1);
    const prompt = readPrompt(startStream);
    expect(prompt).toContain('Rewrite the selected content for clarity and readability.');
    expect(prompt).toContain('Preserve all technical terms.');
    expect(prompt).toContain('Path: /notes/draft.mdx');
    expect(prompt).toContain(documentBody);
    expect(prompt).toBe(
      buildWritePrompt(
        'Rewrite the selected content for clarity and readability.\n\nPreserve all technical terms.',
        '/notes/draft.mdx',
        documentBody,
        null
      )
    );
    expect(prompt).not.toContain('## Instruction');
  });

  it('sends keystrokes that are still only in the editor', () => {
    const session = createSession();
    const startStream = vi
      .fn<(request: StartStreamRequest) => Promise<void>>()
      .mockResolvedValue(undefined);
    useDocumentStore.setState({
      filePath: '/notes/draft.mdx',
      content: 'Hello',
    });
    registerLiveSourceText(() => 'Hello!');
    useAISessionStore.setState({
      selectedSessionId: session.id,
      selectedSession: session,
      startStream,
    });

    render(<AIChatWritePanel />);
    fireEvent.change(screen.getByTestId('ai-write-action-select'), {
      target: { value: 'continue' },
    });
    fireEvent.change(screen.getByTestId('ai-write-input'), {
      target: { value: 'Add a closing line.' },
    });
    fireEvent.click(screen.getByTestId('ai-run-action-button'));

    expect(readPrompt(startStream)).toContain('Hello!');
  });

  it('includes an empty document in the write prompt', () => {
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
    fireEvent.click(screen.getByTestId('ai-run-action-button'));

    const prompt = readPrompt(startStream);
    expect(prompt).toContain('Continue writing from the current document context.');
    expect(prompt).toContain('## Current document');
    expect(prompt).toContain('Path: Untitled');
    expect(prompt).toBe(
      buildWritePrompt('Continue writing from the current document context.', 'Untitled', '', null)
    );
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

  it('passes the workspace root and document path into loadAttachmentOptions', async () => {
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
    useWorkspaceStore.getState().setModel(createWorkspaceModel('/workspace/notes'));
    useDocumentStore.setState({ filePath: '/workspace/notes/draft.mdx' });

    render(<AIChatWritePanel workspaceId={WORKSPACE_ID} instructionScope="workspace" />);

    await waitFor(() => {
      expect(loadAttachmentOptions).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        instructionScope: 'workspace',
        workspaceRootPath: '/workspace/notes',
        documentPath: '/workspace/notes/draft.mdx',
      });
    });
  });

  it('passes a workspace root prop when the workspace model is closed', async () => {
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
    useDocumentStore.setState({ filePath: '/workspace/notes/draft.mdx' });

    render(
      <AIChatWritePanel
        workspaceId={WORKSPACE_ID}
        workspaceRootPath="/workspace/notes"
        projectRootPath="/workspace/notes/pkg"
        instructionScope="workspace"
      />
    );

    await waitFor(() => {
      expect(loadAttachmentOptions).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        workspaceRootPath: '/workspace/notes',
        projectRootPath: '/workspace/notes/pkg',
        instructionScope: 'workspace',
        documentPath: '/workspace/notes/draft.mdx',
      });
    });
  });

  it('loads an attached instruction into the write prompt', async () => {
    const session = createSession();
    const instruction = createInstruction();
    const startStream = vi
      .fn<(request: StartStreamRequest) => Promise<void>>()
      .mockResolvedValue(undefined);
    const loadInstruction = vi.fn().mockResolvedValue({
      instruction: {
        metadata: { ...instruction, fileName: 'AGENTS.md' },
        content: 'Follow the house style.',
      },
    });
    installAiBridge({ loadInstruction });
    useDocumentStore.setState({
      filePath: '/notes/draft.mdx',
      content: '# Draft body',
    });
    useAISessionStore.setState({
      selectedSessionId: session.id,
      selectedSession: session,
      selectedSessionContext: {
        sessionId: session.id,
        instructionFile: instruction,
      },
      startStream,
    });

    render(<AIChatWritePanel />);
    fireEvent.click(screen.getByTestId('ai-run-action-button'));

    await waitFor(() => {
      expect(startStream).toHaveBeenCalledTimes(1);
    });
    expect(loadInstruction).toHaveBeenCalledWith(instruction.id);
    const prompt = readPrompt(startStream);
    expect(prompt).toContain('Continue writing from the current document context.');
    expect(prompt).toContain('Path: /notes/draft.mdx');
    expect(prompt).toContain('# Draft body');
    expect(prompt).toContain('File: AGENTS.md');
    expect(prompt).toContain('Follow the house style.');
    expect(loadInstruction.mock.invocationCallOrder[0]).toBeLessThan(
      startStream.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('does not start a stream when the attached instruction cannot be loaded', async () => {
    const session = createSession();
    const instruction = createInstruction();
    const startStream = vi
      .fn<(request: StartStreamRequest) => Promise<void>>()
      .mockResolvedValue(undefined);
    const loadInstruction = vi.fn().mockResolvedValue({ instruction: null });
    installAiBridge({ loadInstruction });
    useAISessionStore.setState({
      selectedSessionId: session.id,
      selectedSession: session,
      selectedSessionContext: {
        sessionId: session.id,
        instructionFile: instruction,
      },
      startStream,
    });

    render(<AIChatWritePanel />);
    fireEvent.click(screen.getByTestId('ai-run-action-button'));

    await waitFor(() => {
      expect(useAISessionStore.getState().error).toBe(INSTRUCTION_LOAD_FAILED_MESSAGE);
    });
    expect(loadInstruction).toHaveBeenCalledWith(instruction.id);
    expect(startStream).not.toHaveBeenCalled();
  });

  it('creates a session from the workspace, connected provider, first model, and open document', async () => {
    const createSession = vi.fn<(request: unknown) => Promise<void>>().mockResolvedValue(undefined);
    const listModels = vi.fn().mockResolvedValue({
      success: true,
      models: [
        { id: MODEL_ID, name: 'Mini', capabilities: ['text-generation'] },
        { id: 'gpt-4o', name: 'Full', capabilities: ['text-generation'] },
      ],
    });
    installAiBridge({ listModels });
    useWorkspaceStore.getState().setModel(createWorkspaceModel());
    useAIProviderStore.setState({
      providers: [createProvider('connected')],
      activeProviderId: PROVIDER_ID,
    });
    useDocumentStore.setState({
      fileId: DOCUMENT_ID as DocumentId,
      filePath: '/notes/draft.mdx',
      content: '# Draft body',
    });
    useAISessionStore.setState({ createSession });

    render(<AIChatWritePanel />);

    expect(screen.getByTestId('ai-create-session-button').hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByTestId('ai-create-session-button'));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        providerId: PROVIDER_ID,
        modelId: MODEL_ID,
        contextDocumentIds: [DOCUMENT_ID],
      });
    });
    expect(listModels).toHaveBeenCalledWith(PROVIDER_ID);
  });

  it('omits a document id that is not a uuid', async () => {
    const createSession = vi.fn<(request: unknown) => Promise<void>>().mockResolvedValue(undefined);
    const listModels = vi.fn().mockResolvedValue({
      success: true,
      models: [{ id: MODEL_ID, name: 'Mini', capabilities: ['text-generation'] }],
    });
    installAiBridge({ listModels });
    useWorkspaceStore.getState().setModel(createWorkspaceModel());
    useAIProviderStore.setState({
      providers: [createProvider('connected')],
      activeProviderId: PROVIDER_ID,
    });
    useDocumentStore.setState({
      fileId: 'local-draft' as DocumentId,
    });
    useAISessionStore.setState({ createSession });

    render(<AIChatWritePanel />);
    fireEvent.click(screen.getByTestId('ai-create-session-button'));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        providerId: PROVIDER_ID,
        modelId: MODEL_ID,
        contextDocumentIds: [],
      });
    });
  });

  it('keeps session creation disabled without a workspace model', () => {
    useAIProviderStore.setState({
      providers: [createProvider('connected')],
      activeProviderId: PROVIDER_ID,
    });

    render(<AIChatWritePanel />);

    expect(screen.getByTestId('ai-create-session-button').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('ai-workspace-required').textContent).toContain(
      'workspace is required'
    );
  });

  it('keeps session creation disabled without a connected provider', () => {
    useWorkspaceStore.getState().setModel(createWorkspaceModel());
    useAIProviderStore.setState({
      providers: [createProvider('disconnected')],
      activeProviderId: PROVIDER_ID,
    });

    render(<AIChatWritePanel />);

    expect(screen.getByTestId('ai-create-session-button').hasAttribute('disabled')).toBe(true);
    expect(screen.queryByTestId('ai-workspace-required')).toBeNull();
  });

  it('leaves an error and skips createSession when no models are listed', async () => {
    const createSession = vi.fn<(request: unknown) => Promise<void>>().mockResolvedValue(undefined);
    const listModels = vi.fn().mockResolvedValue({
      success: false,
      models: [],
      error: { code: 'NO_MODELS', message: 'Provider has no models' },
    });
    installAiBridge({ listModels });
    useWorkspaceStore.getState().setModel(createWorkspaceModel());
    useAIProviderStore.setState({
      providers: [createProvider('connected')],
      activeProviderId: PROVIDER_ID,
    });
    useAISessionStore.setState({ createSession });

    render(<AIChatWritePanel />);
    fireEvent.click(screen.getByTestId('ai-create-session-button'));

    await waitFor(() => {
      expect(useAISessionStore.getState().error).toBe('Provider has no models');
    });
    expect(listModels).toHaveBeenCalledWith(PROVIDER_ID);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('sets an error and skips createSession when the model list is empty', async () => {
    const createSession = vi.fn<(request: unknown) => Promise<void>>().mockResolvedValue(undefined);
    const listModels = vi.fn().mockResolvedValue({ success: true, models: [] });
    installAiBridge({ listModels });
    useWorkspaceStore.getState().setModel(createWorkspaceModel());
    useAIProviderStore.setState({
      providers: [createProvider('connected')],
      activeProviderId: PROVIDER_ID,
    });
    useAISessionStore.setState({ createSession });

    render(<AIChatWritePanel />);
    fireEvent.click(screen.getByTestId('ai-create-session-button'));

    await waitFor(() => {
      expect(useAISessionStore.getState().error).toBe(NO_MODELS_AVAILABLE_MESSAGE);
    });
    expect(createSession).not.toHaveBeenCalled();
  });
});
