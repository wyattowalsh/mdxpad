import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';

import type { AIServices } from '@main/services/ai';
import { AIChannels } from '@shared/ai/ipc-channels';
import { ProviderCapability, type ProviderConfig } from '@shared/ai/types';
import type { AISession } from '@shared/types/root';
import { AISessionChannels, registerSessionHandlers } from '../ai-session-handlers';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const PROVIDER_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const DOCUMENT_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-02-20T10:00:00.000Z';

function createProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: PROVIDER_ID,
    displayName: 'Test Provider',
    type: 'openai',
    isActive: true,
    status: 'connected',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createSession(overrides: Partial<AISession> = {}): AISession {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    provider: PROVIDER_ID,
    model: 'gpt-4o',
    contextDocumentIds: [DOCUMENT_ID],
    startedAt: NOW,
    lastActivityAt: NOW,
    ...overrides,
  };
}

function createMockAIServices(): AIServices {
  return {
    providerService: {
      getProviders: vi.fn().mockResolvedValue([createProvider()]),
      getActiveProvider: vi.fn().mockResolvedValue(createProvider()),
      setActiveProvider: vi.fn().mockResolvedValue(undefined),
    } as unknown as AIServices['providerService'],
    providerSessionService: {
      assertSessionReady: vi.fn().mockResolvedValue({
        provider: createProvider(),
        modelId: 'gpt-4o',
        capabilities: {
          modelId: 'gpt-4o',
          capabilities: new Set([ProviderCapability.TEXT_GENERATION]),
        },
      }),
    } as unknown as AIServices['providerSessionService'],
    aiSessionStorageService: {
      createSession: vi.fn().mockImplementation(async (session: AISession) => session),
      listSessions: vi.fn().mockResolvedValue([createSession()]),
      getSession: vi.fn().mockResolvedValue(createSession()),
      getArchivedSession: vi.fn().mockResolvedValue(null),
      getActiveSession: vi.fn().mockResolvedValue(createSession()),
      restoreSession: vi.fn().mockResolvedValue({
        session: createSession(),
        context: { sessionId: SESSION_ID },
        restoration: {
          resumeCount: 1,
          lastResumedAt: NOW,
          restoredFrom: 'explicit',
        },
      }),
      getSessionRestorationMetadata: vi.fn().mockResolvedValue({
        resumeCount: 0,
        lastResumedAt: null,
      }),
      getSessionPromptContext: vi.fn().mockResolvedValue({ sessionId: SESSION_ID }),
      archiveSession: vi.fn().mockResolvedValue(true),
      upsertPromptFile: vi.fn().mockImplementation(async (prompt) => prompt),
      listPromptFiles: vi.fn().mockResolvedValue([]),
      attachPromptFile: vi.fn().mockResolvedValue({
        sessionId: SESSION_ID,
      }),
      attachInstructionFile: vi.fn().mockResolvedValue({
        sessionId: SESSION_ID,
      }),
    } as unknown as AIServices['aiSessionStorageService'],
    instructionLoaderService: {
      listInstructionFiles: vi.fn().mockResolvedValue([]),
      loadInstructionFile: vi.fn().mockResolvedValue(null),
    } as unknown as AIServices['instructionLoaderService'],
    credentialService: {} as AIServices['credentialService'],
    capabilityService: {} as AIServices['capabilityService'],
    aiService: {} as AIServices['aiService'],
    usageService: {} as AIServices['usageService'],
    onboardingService: {} as AIServices['onboardingService'],
    promptFileLoaderService: {
      discoverPromptFiles: vi.fn().mockResolvedValue([]),
    } as unknown as AIServices['promptFileLoaderService'],
  };
}

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 1,
      mainFrame: { routingId: 10 },
    },
  } as unknown as BrowserWindow;
}

function createAuthorizedInvokeEvent(window: BrowserWindow): IpcMainInvokeEvent {
  return {
    sender: {
      id: window.webContents.id,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: { routingId: window.webContents.mainFrame.routingId },
  } as IpcMainInvokeEvent;
}

function createUnauthorizedInvokeEvent(window: BrowserWindow) {
  return {
    sender: {
      id: window.webContents.id + 1,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: { routingId: window.webContents.mainFrame.routingId + 1 },
  };
}

describe('registerSessionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers all session/prompt/instruction handlers', () => {
    registerSessionHandlers(createMockAIServices(), createMockWindow());

    expect(ipcMain.handle).toHaveBeenCalledWith(
      AISessionChannels.SESSION_CREATE,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AISessionChannels.SESSION_LIST,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AISessionChannels.SESSION_GET,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AISessionChannels.SESSION_ARCHIVE,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AISessionChannels.SESSION_RESTORE,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AISessionChannels.PROMPT_LIST,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AISessionChannels.PROMPT_ATTACH,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AISessionChannels.INSTRUCTION_LIST,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AISessionChannels.INSTRUCTION_LOAD,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AISessionChannels.INSTRUCTION_ATTACH,
      expect.any(Function)
    );
    expect(ipcMain.handle).not.toHaveBeenCalledWith(AIChannels.PROVIDER_LIST, expect.any(Function));
    expect(ipcMain.handle).not.toHaveBeenCalledWith(
      AIChannels.PROVIDER_SET_ACTIVE,
      expect.any(Function)
    );
  });

  it('rejects unauthorized sender for session operations', () => {
    const window = createMockWindow();
    registerSessionHandlers(createMockAIServices(), window);

    const sessionCreateCall = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === AISessionChannels.SESSION_CREATE);
    const sessionCreateHandler = sessionCreateCall?.[1] as
      | ((event: unknown, request: unknown) => Promise<unknown>)
      | undefined;

    expect(sessionCreateHandler).toBeDefined();
    expect(() =>
      sessionCreateHandler!(createUnauthorizedInvokeEvent(window), {
        workspaceId: WORKSPACE_ID,
        providerId: PROVIDER_ID,
        modelId: 'gpt-4o',
      })
    ).toThrow('Unauthorized IPC sender');
  });
});

describe('session handlers', () => {
  let services: AIServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockAIServices();
    handlers = {};
    const window = createMockWindow();
    const authorizedEvent = createAuthorizedInvokeEvent(window);

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (...args: unknown[]) => {
        const request = args.length === 0 ? undefined : args[args.length - 1];
        return handler(authorizedEvent, request);
      };
    });

    registerSessionHandlers(services, window);
  });

  it('creates session using provider session readiness selection', async () => {
    const result = await handlers[AISessionChannels.SESSION_CREATE]!(null, {
      workspaceId: WORKSPACE_ID,
      providerId: PROVIDER_ID,
      modelId: 'gpt-4o',
      contextDocumentIds: [DOCUMENT_ID],
    });

    expect(result.success).toBe(true);
    expect(result.session.workspaceId).toBe(WORKSPACE_ID);
    expect(result.session.provider).toBe(PROVIDER_ID);
    expect(result.session.model).toBe('gpt-4o');
    expect(services.providerSessionService.assertSessionReady).toHaveBeenCalledWith({
      providerId: PROVIDER_ID,
      modelId: 'gpt-4o',
      requiredCapability: ProviderCapability.TEXT_GENERATION,
    });
    expect(services.aiSessionStorageService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        provider: PROVIDER_ID,
        model: 'gpt-4o',
      })
    );
  });

  it('returns archived session when active session is not found', async () => {
    vi.mocked(services.aiSessionStorageService.getSession).mockResolvedValue(null);
    vi.mocked(services.aiSessionStorageService.getArchivedSession).mockResolvedValue({
      session: createSession(),
      endedAt: NOW,
      archivedAt: NOW,
    });

    const result = await handlers[AISessionChannels.SESSION_GET]!(null, {
      sessionId: SESSION_ID,
    });

    expect(result.session?.id).toBe(SESSION_ID);
    expect(services.aiSessionStorageService.getArchivedSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it('includes active session id when listing sessions', async () => {
    vi.mocked(services.aiSessionStorageService.getActiveSession).mockResolvedValue(createSession());

    const result = await handlers[AISessionChannels.SESSION_LIST]!(null, {
      workspaceId: WORKSPACE_ID,
    });

    expect(result.activeSessionId).toBe(SESSION_ID);
    expect(services.aiSessionStorageService.getActiveSession).toHaveBeenCalledWith(WORKSPACE_ID);
  });

  it('restores session with prompt context and restoration metadata', async () => {
    const result = await handlers[AISessionChannels.SESSION_RESTORE]!(null, {
      sessionId: SESSION_ID,
    });

    expect(result).toEqual({
      session: expect.objectContaining({ id: SESSION_ID }),
      context: { sessionId: SESSION_ID },
      restoration: {
        resumeCount: 1,
        lastResumedAt: NOW,
        restoredFrom: 'explicit',
      },
    });
    expect(services.aiSessionStorageService.restoreSession).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
    });
  });

  it('returns not-found error when attaching prompt for unknown session', async () => {
    vi.mocked(services.aiSessionStorageService.attachPromptFile).mockResolvedValue(null);

    const result = await handlers[AISessionChannels.PROMPT_ATTACH]!(null, {
      sessionId: SESSION_ID,
      promptFileId: 'prompt-1',
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'AI session not found',
      },
    });
  });

  it('discovers prompt files from workspace/project context when listing prompts', async () => {
    const discoveredPrompt = {
      id: 'prompt-1',
      kind: 'prompt' as const,
      filePath: '/workspace/.mdxpad/prompts/rewrite.md',
      fileName: 'rewrite.md',
      checksum: 'a'.repeat(64),
      createdAt: NOW,
      updatedAt: NOW,
      title: 'Rewrite',
      variables: ['tone'],
    };
    vi.mocked(services.promptFileLoaderService.discoverPromptFiles).mockResolvedValue([
      discoveredPrompt,
    ]);

    const result = await handlers[AISessionChannels.PROMPT_LIST]!(null, {
      workspaceRootPath: '/workspace',
      projectRootPath: '/workspace/projects/alpha',
    });

    expect(services.promptFileLoaderService.discoverPromptFiles).toHaveBeenCalledWith({
      workspaceRootPath: '/workspace',
      projectRootPath: '/workspace/projects/alpha',
    });
    expect(services.aiSessionStorageService.upsertPromptFile).toHaveBeenCalledWith(
      discoveredPrompt
    );
    expect(result).toEqual({ prompts: [discoveredPrompt] });
  });

  it('lists instructions using discovery context and scope filters', async () => {
    await handlers[AISessionChannels.INSTRUCTION_LIST]!(null, {
      scope: 'workspace',
      projectRootPath: '/Users/test/project',
      workspaceRootPath: '/Users/test/workspace',
      documentPath: '/Users/test/workspace/docs/doc.mdx',
    });

    expect(services.instructionLoaderService.listInstructionFiles).toHaveBeenCalledWith({
      scope: 'workspace',
      projectRootPath: '/Users/test/project',
      workspaceRootPath: '/Users/test/workspace',
      documentPath: '/Users/test/workspace/docs/doc.mdx',
    });
  });

  it('loads instruction file content by id', async () => {
    vi.mocked(services.instructionLoaderService.loadInstructionFile).mockResolvedValue({
      metadata: {
        id: 'instruction-1',
        kind: 'instruction',
        scope: 'workspace',
        filePath: '/Users/test/workspace/AGENTS.md',
        fileName: 'AGENTS.md',
        createdAt: NOW,
        updatedAt: NOW,
      },
      content: 'Follow workspace rules.',
    });

    const result = await handlers[AISessionChannels.INSTRUCTION_LOAD]!(null, {
      instructionFileId: 'instruction-1',
    });

    expect(result.instruction?.metadata.id).toBe('instruction-1');
    expect(result.instruction?.content).toBe('Follow workspace rules.');
  });
});
