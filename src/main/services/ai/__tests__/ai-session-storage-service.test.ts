import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AISession } from '@shared/types/root';
import type { AIPromptFileMetadata, AIInstructionFileMetadata } from '@shared/types/ai-session';

import { AISessionStorageService } from '../ai-session-storage-service';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-02-20T10:00:00.000Z';

function createSession(overrides: Partial<AISession> = {}): AISession {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    provider: 'provider-1',
    model: 'gpt-4o',
    contextDocumentIds: [DOCUMENT_ID],
    startedAt: NOW,
    lastActivityAt: NOW,
    ...overrides,
  };
}

function createPrompt(overrides: Partial<AIPromptFileMetadata> = {}): AIPromptFileMetadata {
  return {
    id: 'prompt-1',
    kind: 'prompt',
    filePath: '/tmp/prompts/rewrite.md',
    fileName: 'rewrite.md',
    createdAt: NOW,
    updatedAt: NOW,
    title: 'Rewrite Draft',
    variables: ['tone'],
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
    filePath: '/tmp/instructions/workspace.md',
    fileName: 'workspace.md',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('AISessionStorageService', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-ai-session-storage-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('creates, updates, lists, and deletes AI sessions', async () => {
    const service = new AISessionStorageService(tempDir);
    const session = createSession();

    const created = await service.createSession(session);
    expect(created).toEqual(session);
    expect(await service.getSession(session.id)).toEqual(session);

    const updated = await service.updateSession(session.id, {
      model: 'gpt-4.1',
      lastActivityAt: '2026-02-20T11:00:00.000Z',
    });
    expect(updated?.model).toBe('gpt-4.1');

    const listed = await service.listSessions({ workspaceId: session.workspaceId });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(session.id);

    const deleted = await service.deleteSession(session.id);
    expect(deleted).toBe(true);
    expect(await service.getSession(session.id)).toBeNull();
  });

  it('archives sessions and includes archived entries when requested', async () => {
    const service = new AISessionStorageService(tempDir);
    const session = createSession();
    await service.createSession(session);

    const archived = await service.archiveSession(session.id, '2026-02-20T12:00:00.000Z');
    expect(archived).toBe(true);
    expect(await service.getSession(session.id)).toBeNull();

    const archivedRecord = await service.getArchivedSession(session.id);
    expect(archivedRecord?.session.id).toBe(session.id);
    expect(archivedRecord?.endedAt).toBe('2026-02-20T12:00:00.000Z');

    const listedIncludingArchived = await service.listSessions({ includeArchived: true });
    expect(listedIncludingArchived).toHaveLength(1);
    expect(listedIncludingArchived[0]?.id).toBe(session.id);
  });

  it('supports prompt/instruction metadata CRUD and session attachments', async () => {
    const service = new AISessionStorageService(tempDir);
    const session = createSession();
    const prompt = createPrompt();
    const instruction = createInstruction();

    await service.createSession(session);
    await service.upsertPromptFile(prompt);
    await service.upsertInstructionFile(instruction);

    const promptContext = await service.attachPromptFile(session.id, prompt.id);
    expect(promptContext?.promptFile?.id).toBe(prompt.id);

    const instructionContext = await service.attachInstructionFile(session.id, instruction.id);
    expect(instructionContext?.instructionFile?.id).toBe(instruction.id);

    const reloadedContext = await service.getSessionPromptContext(session.id);
    expect(reloadedContext?.promptFile?.title).toBe(prompt.title);
    expect(reloadedContext?.instructionFile?.scope).toBe('workspace');

    const removedPrompt = await service.removePromptFile(prompt.id);
    expect(removedPrompt).toBe(true);
    expect((await service.getSessionPromptContext(session.id))?.promptFile).toBeUndefined();

    const removedInstruction = await service.removeInstructionFile(instruction.id);
    expect(removedInstruction).toBe(true);
    expect((await service.getSessionPromptContext(session.id))?.instructionFile).toBeUndefined();
  });

  it('persists session and attachment state across service instances', async () => {
    const primary = new AISessionStorageService(tempDir);
    const session = createSession();
    const prompt = createPrompt();
    const instruction = createInstruction();

    await primary.createSession(session);
    await primary.upsertPromptFile(prompt);
    await primary.upsertInstructionFile(instruction);
    await primary.attachPromptFile(session.id, prompt.id);
    await primary.attachInstructionFile(session.id, instruction.id);

    const secondary = new AISessionStorageService(tempDir);
    expect(await secondary.listSessions()).toHaveLength(1);
    expect(await secondary.listPromptFiles()).toHaveLength(1);
    expect(await secondary.listInstructionFiles({ scope: 'workspace' })).toHaveLength(1);

    const context = await secondary.getSessionPromptContext(session.id);
    expect(context?.promptFile?.id).toBe(prompt.id);
    expect(context?.instructionFile?.id).toBe(instruction.id);
  });

  it('tracks active sessions and restoration metadata for resume semantics', async () => {
    const service = new AISessionStorageService(tempDir);
    const olderSession = createSession({
      id: '55555555-5555-4555-8555-555555555555',
      lastActivityAt: '2026-02-20T09:00:00.000Z',
    });
    const newerSession = createSession({
      id: '66666666-6666-4666-8666-666666666666',
      lastActivityAt: '2026-02-20T11:00:00.000Z',
    });

    await service.createSession(olderSession);
    await service.createSession(newerSession);

    const activeBeforeRestore = await service.getActiveSession(WORKSPACE_ID);
    expect(activeBeforeRestore?.id).toBe(newerSession.id);

    const restoredFromWorkspace = await service.restoreSession({ workspaceId: WORKSPACE_ID });
    expect(restoredFromWorkspace?.session.id).toBe(newerSession.id);
    expect(restoredFromWorkspace?.restoration.resumeCount).toBe(1);
    expect(restoredFromWorkspace?.restoration.lastResumedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(restoredFromWorkspace?.restoration.restoredFrom).toBe('active');

    const restoredBySessionId = await service.restoreSession({
      sessionId: olderSession.id,
    });
    expect(restoredBySessionId?.session.id).toBe(olderSession.id);
    expect(restoredBySessionId?.restoration.resumeCount).toBe(1);
    expect(restoredBySessionId?.restoration.restoredFrom).toBe('explicit');

    const activeAfterRestore = await service.getActiveSession(WORKSPACE_ID);
    expect(activeAfterRestore?.id).toBe(olderSession.id);

    const restorationMetadata = await service.getSessionRestorationMetadata(olderSession.id);
    expect(restorationMetadata).toEqual({
      resumeCount: 1,
      lastResumedAt: restoredBySessionId?.restoration.lastResumedAt ?? null,
    });
  });

  it('rejects corrupted snapshots when checksum validation fails', async () => {
    const service = new AISessionStorageService(tempDir);
    await service.createSession(createSession());

    const [storageFile] = (await readdir(tempDir)).filter((entry) => entry.endsWith('.json'));
    expect(storageFile).toBeDefined();

    const storagePath = path.join(tempDir, storageFile!);
    const parsed = JSON.parse(await readFile(storagePath, 'utf-8')) as {
      checksum: string;
      payload: unknown;
    };
    parsed.checksum = '0'.repeat(64);
    await writeFile(storagePath, JSON.stringify(parsed, null, 2), 'utf-8');

    const reloaded = new AISessionStorageService(tempDir);
    await expect(reloaded.listSessions()).rejects.toThrow(/checksum/i);
  });
});
