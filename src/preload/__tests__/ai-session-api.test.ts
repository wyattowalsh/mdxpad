import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockValidatedInvoke = vi.fn();

vi.mock('../validated-invoke', () => ({
  validatedInvoke: (...args: unknown[]) => mockValidatedInvoke(...args),
}));

import { AISessionChannels, aiSessionApi } from '../ai-session-api';

describe('aiSessionApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a session', async () => {
    const request = {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      providerId: '22222222-2222-4222-8222-222222222222',
      modelId: 'gpt-4o',
      contextDocumentIds: [],
    };
    mockValidatedInvoke.mockResolvedValue({ success: true });

    await aiSessionApi.createSession(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      AISessionChannels.SESSION_CREATE,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('lists sessions with default request payload', async () => {
    mockValidatedInvoke.mockResolvedValue({ sessions: [] });

    await aiSessionApi.listSessions();

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      AISessionChannels.SESSION_LIST,
      expect.any(Object),
      expect.any(Object),
      {}
    );
  });

  it('gets a session by id', async () => {
    const sessionId = '33333333-3333-4333-8333-333333333333';
    mockValidatedInvoke.mockResolvedValue({ session: null });

    await aiSessionApi.getSession(sessionId);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      AISessionChannels.SESSION_GET,
      expect.any(Object),
      expect.any(Object),
      { sessionId }
    );
  });

  it('restores a session by id', async () => {
    const request = {
      sessionId: '33333333-3333-4333-8333-333333333333',
    };
    mockValidatedInvoke.mockResolvedValue({ session: null });

    await aiSessionApi.restoreSession(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      AISessionChannels.SESSION_RESTORE,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('archives a session', async () => {
    const request = {
      sessionId: '33333333-3333-4333-8333-333333333333',
      endedAt: '2026-02-20T12:00:00.000Z',
    };
    mockValidatedInvoke.mockResolvedValue({ success: true });

    await aiSessionApi.archiveSession(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      AISessionChannels.SESSION_ARCHIVE,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('lists prompt files with default request payload', async () => {
    mockValidatedInvoke.mockResolvedValue({ prompts: [] });

    await aiSessionApi.listPrompts();

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      AISessionChannels.PROMPT_LIST,
      expect.any(Object),
      expect.any(Object),
      {}
    );
  });

  it('attaches a prompt file', async () => {
    const request = {
      sessionId: '33333333-3333-4333-8333-333333333333',
      promptFileId: 'prompt-1',
    };
    mockValidatedInvoke.mockResolvedValue({ success: true });

    await aiSessionApi.attachPrompt(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      AISessionChannels.PROMPT_ATTACH,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('lists instruction files with default request payload', async () => {
    mockValidatedInvoke.mockResolvedValue({ instructions: [] });

    await aiSessionApi.listInstructions();

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      AISessionChannels.INSTRUCTION_LIST,
      expect.any(Object),
      expect.any(Object),
      {}
    );
  });

  it('attaches an instruction file', async () => {
    const request = {
      sessionId: '33333333-3333-4333-8333-333333333333',
      instructionFileId: 'instruction-1',
    };
    mockValidatedInvoke.mockResolvedValue({ success: true });

    await aiSessionApi.attachInstruction(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      AISessionChannels.INSTRUCTION_ATTACH,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('loads an instruction file by id', async () => {
    const instructionFileId = 'instruction-1';
    mockValidatedInvoke.mockResolvedValue({ instruction: null });

    await aiSessionApi.loadInstruction(instructionFileId);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      AISessionChannels.INSTRUCTION_LOAD,
      expect.any(Object),
      expect.any(Object),
      { instructionFileId }
    );
  });
});
