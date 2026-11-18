import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AIPromptFileMetadata,
  AIInstructionFileMetadata,
  AISessionPromptContext,
} from '@shared/contracts/ai-schemas';
import type { AISession } from '@shared/types/root';
import {
  useAISessionStore,
  selectSelectedSessionContext,
  selectStreamStatus,
} from './ai-session-store';

interface StreamChunkEvent {
  streamId: string;
  chunk: string;
  isComplete: boolean;
}

interface StreamCompleteEvent {
  streamId: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface StreamErrorEvent {
  streamId: string;
  error: {
    code: string;
    message: string;
  };
}

const streamChunkListeners = new Set<(event: StreamChunkEvent) => void>();
const streamCompleteListeners = new Set<(event: StreamCompleteEvent) => void>();
const streamErrorListeners = new Set<(event: StreamErrorEvent) => void>();

const mockAIApi = {
  createSession: vi.fn(),
  listSessions: vi.fn(),
  getSession: vi.fn(),
  restoreSession: vi.fn(),
  archiveSession: vi.fn(),
  listPrompts: vi.fn(),
  attachPrompt: vi.fn(),
  listInstructions: vi.fn(),
  attachInstruction: vi.fn(),
  generateStream: vi.fn(),
  cancelStream: vi.fn(),
  onStreamChunk: vi.fn((listener: (event: StreamChunkEvent) => void) => {
    streamChunkListeners.add(listener);
    return () => streamChunkListeners.delete(listener);
  }),
  onStreamComplete: vi.fn((listener: (event: StreamCompleteEvent) => void) => {
    streamCompleteListeners.add(listener);
    return () => streamCompleteListeners.delete(listener);
  }),
  onStreamError: vi.fn((listener: (event: StreamErrorEvent) => void) => {
    streamErrorListeners.add(listener);
    return () => streamErrorListeners.delete(listener);
  }),
};

const DEFAULT_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const DEFAULT_PROVIDER_ID = '22222222-2222-4222-8222-222222222222';
const DEFAULT_SESSION_ID = '33333333-3333-4333-8333-333333333333';
const DEFAULT_STREAM_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-02-20T10:00:00.000Z';

function createSession(overrides: Partial<AISession> = {}): AISession {
  return {
    id: DEFAULT_SESSION_ID,
    workspaceId: DEFAULT_WORKSPACE_ID,
    provider: DEFAULT_PROVIDER_ID,
    model: 'gpt-4o',
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
    createdAt: NOW,
    updatedAt: NOW,
    title: 'Rewrite',
    variables: [],
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

function emitStreamChunk(event: StreamChunkEvent): void {
  for (const listener of streamChunkListeners) {
    listener(event);
  }
}

function emitStreamComplete(event: StreamCompleteEvent): void {
  for (const listener of streamCompleteListeners) {
    listener(event);
  }
}

describe('useAISessionStore', () => {
  beforeEach(() => {
    useAISessionStore.getState().reset();
    vi.clearAllMocks();
    streamChunkListeners.clear();
    streamCompleteListeners.clear();
    streamErrorListeners.clear();

    (
      globalThis as unknown as {
        window: { mdxpad: { ai: typeof mockAIApi } };
      }
    ).window = {
      mdxpad: {
        ai: mockAIApi,
      },
    };
  });

  it('creates a session and selects it', async () => {
    const session = createSession();
    mockAIApi.createSession.mockResolvedValue({ success: true, session });

    await useAISessionStore.getState().createSession({
      workspaceId: DEFAULT_WORKSPACE_ID,
      providerId: DEFAULT_PROVIDER_ID,
      modelId: 'gpt-4o',
      contextDocumentIds: [],
    });

    const state = useAISessionStore.getState();
    expect(state.sessions).toEqual([session]);
    expect(state.selectedSessionId).toBe(session.id);
    expect(state.selectedSession).toEqual(session);
    expect(state.selectedSessionContext).toEqual({ sessionId: session.id });
    expect(state.error).toBeNull();
  });

  it('loads attachment options for prompt and instruction selection', async () => {
    const prompt = createPrompt();
    const instruction = createInstruction();
    mockAIApi.listPrompts.mockResolvedValue({ prompts: [prompt] });
    mockAIApi.listInstructions.mockResolvedValue({ instructions: [instruction] });

    await useAISessionStore.getState().loadAttachmentOptions({
      workspaceId: DEFAULT_WORKSPACE_ID,
      instructionScope: 'workspace',
    });

    const state = useAISessionStore.getState();
    expect(mockAIApi.listPrompts).toHaveBeenCalledWith({ workspaceId: DEFAULT_WORKSPACE_ID });
    expect(mockAIApi.listInstructions).toHaveBeenCalledWith({
      workspaceId: DEFAULT_WORKSPACE_ID,
      scope: 'workspace',
    });
    expect(state.prompts).toEqual([prompt]);
    expect(state.instructions).toEqual([instruction]);
  });

  it('forwards workspaceRootPath and documentPath when loading attachment options', async () => {
    mockAIApi.listPrompts.mockResolvedValue({ prompts: [] });
    mockAIApi.listInstructions.mockResolvedValue({ instructions: [] });

    await useAISessionStore.getState().loadAttachmentOptions({
      workspaceId: DEFAULT_WORKSPACE_ID,
      workspaceRootPath: '/workspace/notes',
      projectRootPath: '/workspace/notes/pkg',
      documentPath: '/workspace/notes/draft.mdx',
    });

    expect(mockAIApi.listPrompts).toHaveBeenCalledWith({
      workspaceId: DEFAULT_WORKSPACE_ID,
      workspaceRootPath: '/workspace/notes',
      projectRootPath: '/workspace/notes/pkg',
    });
    expect(mockAIApi.listInstructions).toHaveBeenCalledWith({
      workspaceId: DEFAULT_WORKSPACE_ID,
      workspaceRootPath: '/workspace/notes',
      projectRootPath: '/workspace/notes/pkg',
      documentPath: '/workspace/notes/draft.mdx',
    });
  });

  it('attaches prompt and instruction to the selected session', async () => {
    const session = createSession();
    const prompt = createPrompt();
    const instruction = createInstruction();
    const promptContext: AISessionPromptContext = {
      sessionId: session.id,
      promptFile: prompt,
    };
    const fullContext: AISessionPromptContext = {
      sessionId: session.id,
      promptFile: prompt,
      instructionFile: instruction,
    };

    useAISessionStore.setState({
      sessions: [session],
      selectedSessionId: session.id,
      selectedSession: session,
    });

    mockAIApi.attachPrompt.mockResolvedValue({ success: true, context: promptContext });
    mockAIApi.attachInstruction.mockResolvedValue({ success: true, context: fullContext });

    await useAISessionStore.getState().attachPrompt(prompt.id);
    await useAISessionStore.getState().attachInstruction(instruction.id);

    const state = useAISessionStore.getState();
    expect(selectSelectedSessionContext(state)).toEqual(fullContext);
  });

  it('restores the active session when loading sessions', async () => {
    const session = createSession();
    const prompt = createPrompt();
    const restoredContext: AISessionPromptContext = {
      sessionId: session.id,
      promptFile: prompt,
    };
    mockAIApi.listSessions.mockResolvedValue({
      sessions: [session],
      activeSessionId: session.id,
    });
    mockAIApi.restoreSession.mockResolvedValue({
      session,
      context: restoredContext,
      restoration: {
        resumeCount: 2,
        lastResumedAt: NOW,
        restoredFrom: 'active',
      },
    });

    await useAISessionStore.getState().loadSessions(DEFAULT_WORKSPACE_ID);

    const state = useAISessionStore.getState();
    expect(mockAIApi.listSessions).toHaveBeenCalledWith({ workspaceId: DEFAULT_WORKSPACE_ID });
    expect(mockAIApi.restoreSession).toHaveBeenCalledWith({ sessionId: session.id });
    expect(state.selectedSessionId).toBe(session.id);
    expect(state.selectedSessionContext).toEqual(restoredContext);
    expect(state.selectedSessionRestoration).toEqual({
      resumeCount: 2,
      lastResumedAt: NOW,
      restoredFrom: 'active',
    });
  });

  it('keeps the AI session that was opened last', async () => {
    const older = createSession();
    const newer = createSession({ id: '55555555-5555-4555-8555-555555555555' });
    let finishOld: (value: { session: AISession }) => void = () => undefined;
    mockAIApi.restoreSession
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockResolvedValueOnce({ session: newer });

    const first = useAISessionStore.getState().selectSession(older.id);
    const second = useAISessionStore.getState().selectSession(newer.id);
    await second;
    finishOld({ session: older });
    await first;

    expect(useAISessionStore.getState().selectedSessionId).toBe(newer.id);
    expect(useAISessionStore.getState().isLoading).toBe(false);
  });

  it('keeps a session created while an older list is in flight', async () => {
    const created = createSession({ id: '55555555-5555-4555-8555-555555555555' });
    let finishList: (value: { sessions: AISession[]; activeSessionId: null }) => void = () =>
      undefined;
    mockAIApi.listSessions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishList = resolve;
        })
    );
    mockAIApi.createSession.mockResolvedValue({ success: true, session: created });

    const pending = useAISessionStore.getState().loadSessions(DEFAULT_WORKSPACE_ID);
    await useAISessionStore.getState().createSession({
      workspaceId: DEFAULT_WORKSPACE_ID,
      providerId: DEFAULT_PROVIDER_ID,
      modelId: 'gpt-4o',
      contextDocumentIds: [],
    });
    finishList({ sessions: [], activeSessionId: null });
    await pending;

    expect(useAISessionStore.getState().sessions.map((session) => session.id)).toEqual([
      created.id,
    ]);
  });

  it('tracks stream lifecycle from start to completion', async () => {
    const session = createSession();
    const prompt = createPrompt({
      modelSelection: {
        providerId: DEFAULT_PROVIDER_ID,
        modelId: 'claude-3-5-sonnet',
      },
      systemPrompt: 'You are concise.',
    });
    const sessionContext: AISessionPromptContext = {
      sessionId: session.id,
      promptFile: prompt,
    };

    useAISessionStore.setState({
      sessions: [session],
      selectedSessionId: session.id,
      selectedSession: session,
      selectedSessionContext: sessionContext,
      sessionContexts: {
        [session.id]: sessionContext,
      },
    });

    mockAIApi.generateStream.mockResolvedValue({
      success: true,
      streamId: DEFAULT_STREAM_ID,
    });

    await useAISessionStore.getState().startStream({
      prompt: 'Summarize this document',
    });

    expect(mockAIApi.generateStream).toHaveBeenCalledWith({
      prompt: 'Summarize this document',
      modelId: 'claude-3-5-sonnet',
      systemPrompt: 'You are concise.',
    });
    expect(selectStreamStatus(useAISessionStore.getState())).toBe('streaming');

    emitStreamChunk({
      streamId: DEFAULT_STREAM_ID,
      chunk: 'Hello ',
      isComplete: false,
    });
    emitStreamChunk({
      streamId: DEFAULT_STREAM_ID,
      chunk: 'world',
      isComplete: false,
    });
    emitStreamComplete({
      streamId: DEFAULT_STREAM_ID,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
    });

    const state = useAISessionStore.getState();
    expect(state.stream.text).toBe('Hello world');
    expect(state.stream.usage?.totalTokens).toBe(30);
    expect(state.isStreaming).toBe(false);
    expect(selectStreamStatus(state)).toBe('completed');
  });

  it('sets stream error when stream initialization fails', async () => {
    const session = createSession();
    useAISessionStore.setState({
      sessions: [session],
      selectedSessionId: session.id,
      selectedSession: session,
    });

    mockAIApi.generateStream.mockResolvedValue({
      success: false,
      error: {
        code: 'NO_PROVIDER',
        message: 'No active provider',
      },
    });

    await useAISessionStore.getState().startStream({
      prompt: 'Summarize this document',
    });

    const state = useAISessionStore.getState();
    expect(selectStreamStatus(state)).toBe('error');
    expect(state.stream.error).toBe('No active provider');
    expect(state.isStreaming).toBe(false);
  });
});
