import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { z } from 'zod';

import {
  AIInstructionFileMetadataSchema,
  AIInstructionScopeSchema,
  AISessionRestorationMetadataSchema,
  AIPromptFileMetadataSchema,
} from '@shared/contracts/ai-schemas';
import { atomicWrite } from '@shared/lib/atomic-write';
import { computeChecksum } from '@shared/lib/checksum';
import { AISessionSchema, type AISession } from '@shared/types/root';
import type {
  AIInstructionFileMetadata,
  AIPromptFileMetadata,
  AISessionPromptContext,
} from '@shared/types/ai-session';

const STORAGE_FILE_NAME = 'ai-session-storage.json';
const STORAGE_VERSION = 1;

const SessionAttachmentSchema = z.object({
  promptFileId: z.string().min(1).optional(),
  instructionFileId: z.string().min(1).optional(),
});
type SessionAttachment = z.infer<typeof SessionAttachmentSchema>;

const ArchivedAISessionSchema = z.object({
  session: AISessionSchema,
  endedAt: z.string().datetime(),
  archivedAt: z.string().datetime(),
});
export type ArchivedAISession = z.infer<typeof ArchivedAISessionSchema>;

const SessionRestorationRecordSchema = AISessionRestorationMetadataSchema.omit({
  restoredFrom: true,
});
type SessionRestorationRecord = z.infer<typeof SessionRestorationRecordSchema>;

const SessionStoragePayloadSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  sessions: z.record(AISessionSchema),
  archivedSessions: z.record(ArchivedAISessionSchema),
  promptFiles: z.record(AIPromptFileMetadataSchema),
  instructionFiles: z.record(AIInstructionFileMetadataSchema),
  sessionContexts: z.record(SessionAttachmentSchema),
  activeWorkspaceSessions: z.record(z.string().uuid()).default({}),
  sessionRestorations: z.record(SessionRestorationRecordSchema).default({}),
});
type SessionStoragePayload = z.infer<typeof SessionStoragePayloadSchema>;

const SessionStorageSnapshotSchema = z.object({
  checksum: z.string().length(64),
  payload: SessionStoragePayloadSchema,
});
type SessionStorageSnapshot = z.infer<typeof SessionStorageSnapshotSchema>;

const SessionListOptionsSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  includeArchived: z.boolean().optional(),
});
export type SessionListOptions = z.infer<typeof SessionListOptionsSchema>;

const SessionUpdateSchema = AISessionSchema.pick({
  provider: true,
  model: true,
  contextDocumentIds: true,
  lastActivityAt: true,
}).partial();
export type SessionUpdate = z.infer<typeof SessionUpdateSchema>;

const InstructionListOptionsSchema = z.object({
  scope: AIInstructionScopeSchema.optional(),
});
export type InstructionListOptions = z.infer<typeof InstructionListOptionsSchema>;

const ArchiveInputSchema = z.object({
  endedAt: z.string().datetime(),
});

const RestoreSessionOptionsSchema = z
  .object({
    workspaceId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
  })
  .refine((value) => value.workspaceId !== undefined || value.sessionId !== undefined, {
    message: 'workspaceId or sessionId is required',
  });
export type RestoreSessionOptions = z.infer<typeof RestoreSessionOptionsSchema>;

type RestorationSource = 'active' | 'explicit';

type SessionRestorationMetadata = z.infer<typeof SessionRestorationRecordSchema>;

export interface RestoredAISession {
  session: AISession;
  context: AISessionPromptContext;
  restoration: z.infer<typeof AISessionRestorationMetadataSchema>;
}

function getDefaultBaseDir(): string {
  return path.join(app.getPath('userData'), 'ai');
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

function isNotFoundError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') {
    return JSON.stringify(input);
  }
  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([key, value]) => `${JSON.stringify(key)}:${stableStringify(value)}`)
    .join(',')}}`;
}

function createEmptyPayload(): SessionStoragePayload {
  return {
    version: STORAGE_VERSION,
    sessions: {},
    archivedSessions: {},
    promptFiles: {},
    instructionFiles: {},
    sessionContexts: {},
    activeWorkspaceSessions: {},
    sessionRestorations: {},
  };
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function removeRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([entryKey]) => entryKey !== key)
  ) as Record<string, T>;
}

function clearPromptAttachment(attachment: SessionAttachment): SessionAttachment {
  return attachment.instructionFileId ? { instructionFileId: attachment.instructionFileId } : {};
}

function clearInstructionAttachment(attachment: SessionAttachment): SessionAttachment {
  return attachment.promptFileId ? { promptFileId: attachment.promptFileId } : {};
}

function isAttachmentEmpty(attachment: SessionAttachment): boolean {
  return attachment.promptFileId === undefined && attachment.instructionFileId === undefined;
}

function computePayloadChecksum(payload: SessionStoragePayload): string {
  return computeChecksum(stableStringify(payload));
}

function sortSessionsByLastActivity(sessions: AISession[]): AISession[] {
  return sessions.sort(
    (left, right) => Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt)
  );
}

function sortByUpdatedAt<T extends { updatedAt: string }>(items: T[]): T[] {
  return items.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function createInitialRestorationRecord(): SessionRestorationRecord {
  return {
    resumeCount: 0,
    lastResumedAt: null,
  };
}

function toRestorationMetadata(
  record: SessionRestorationRecord,
  source?: RestorationSource
): z.infer<typeof AISessionRestorationMetadataSchema> {
  return AISessionRestorationMetadataSchema.parse({
    resumeCount: record.resumeCount,
    lastResumedAt: record.lastResumedAt,
    ...(source ? { restoredFrom: source } : {}),
  });
}

export interface IAISessionStorageService {
  createSession(session: AISession): Promise<AISession>;
  getSession(sessionId: string): Promise<AISession | null>;
  updateSession(sessionId: string, updates: SessionUpdate): Promise<AISession | null>;
  deleteSession(sessionId: string): Promise<boolean>;
  listSessions(options?: SessionListOptions): Promise<AISession[]>;
  getActiveSession(workspaceId?: string): Promise<AISession | null>;
  restoreSession(options: RestoreSessionOptions): Promise<RestoredAISession | null>;
  getSessionRestorationMetadata(sessionId: string): Promise<SessionRestorationMetadata | null>;
  archiveSession(sessionId: string, endedAt: string): Promise<boolean>;
  getArchivedSession(sessionId: string): Promise<ArchivedAISession | null>;
  upsertPromptFile(promptFile: AIPromptFileMetadata): Promise<AIPromptFileMetadata>;
  getPromptFile(promptFileId: string): Promise<AIPromptFileMetadata | null>;
  listPromptFiles(): Promise<AIPromptFileMetadata[]>;
  removePromptFile(promptFileId: string): Promise<boolean>;
  upsertInstructionFile(
    instructionFile: AIInstructionFileMetadata
  ): Promise<AIInstructionFileMetadata>;
  getInstructionFile(instructionFileId: string): Promise<AIInstructionFileMetadata | null>;
  listInstructionFiles(options?: InstructionListOptions): Promise<AIInstructionFileMetadata[]>;
  removeInstructionFile(instructionFileId: string): Promise<boolean>;
  attachPromptFile(
    sessionId: string,
    promptFileId: string | null
  ): Promise<AISessionPromptContext | null>;
  attachInstructionFile(
    sessionId: string,
    instructionFileId: string | null
  ): Promise<AISessionPromptContext | null>;
  getSessionPromptContext(sessionId: string): Promise<AISessionPromptContext | null>;
}

export class AISessionStorageService implements IAISessionStorageService {
  private readonly storagePath: string;
  private cachedState: SessionStoragePayload | null = null;
  private mutationQueue: Promise<void> = Promise.resolve();

  public constructor(baseDir: string = getDefaultBaseDir()) {
    this.storagePath = path.join(baseDir, STORAGE_FILE_NAME);
  }

  public async createSession(session: AISession): Promise<AISession> {
    const validated = AISessionSchema.parse(session);
    return this.mutateState((state) => {
      state.sessions[validated.id] = validated;
      state.activeWorkspaceSessions[validated.workspaceId] = validated.id;
      state.sessionRestorations[validated.id] ??= createInitialRestorationRecord();
      if (state.archivedSessions[validated.id]) {
        state.archivedSessions = removeRecordKey(state.archivedSessions, validated.id);
      }
      return cloneValue(validated);
    });
  }

  public async getSession(sessionId: string): Promise<AISession | null> {
    const state = await this.readState();
    const session = state.sessions[sessionId];
    return session ? cloneValue(session) : null;
  }

  public async updateSession(sessionId: string, updates: SessionUpdate): Promise<AISession | null> {
    const validatedUpdates = SessionUpdateSchema.parse(updates);
    return this.mutateState((state) => {
      const current = state.sessions[sessionId];
      if (!current) {
        return null;
      }
      const updated = {
        ...current,
        ...validatedUpdates,
        id: current.id,
        workspaceId: current.workspaceId,
        startedAt: current.startedAt,
      } as AISession;
      state.sessions[sessionId] = updated;
      return cloneValue(updated);
    });
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    return this.mutateState((state) => {
      const hadActive = state.sessions[sessionId] !== undefined;
      const hadArchived = state.archivedSessions[sessionId] !== undefined;
      const activeWorkspaceId = Object.entries(state.activeWorkspaceSessions).find(
        ([, activeSessionId]) => activeSessionId === sessionId
      )?.[0];

      if (hadActive) {
        state.sessions = removeRecordKey(state.sessions, sessionId);
      }
      if (hadArchived) {
        state.archivedSessions = removeRecordKey(state.archivedSessions, sessionId);
      }
      if (state.sessionContexts[sessionId]) {
        state.sessionContexts = removeRecordKey(state.sessionContexts, sessionId);
      }
      if (state.sessionRestorations[sessionId]) {
        state.sessionRestorations = removeRecordKey(state.sessionRestorations, sessionId);
      }
      if (activeWorkspaceId) {
        state.activeWorkspaceSessions = removeRecordKey(
          state.activeWorkspaceSessions,
          activeWorkspaceId
        );
      }

      return hadActive || hadArchived;
    });
  }

  public async listSessions(options: SessionListOptions = {}): Promise<AISession[]> {
    const validatedOptions = SessionListOptionsSchema.parse(options);
    const state = await this.readState();

    const activeSessions = Object.values(state.sessions);
    const archivedSessions = validatedOptions.includeArchived
      ? Object.values(state.archivedSessions).map((entry) => entry.session)
      : [];

    const combined = [...activeSessions, ...archivedSessions].filter((session) =>
      validatedOptions.workspaceId ? session.workspaceId === validatedOptions.workspaceId : true
    );

    return sortSessionsByLastActivity(combined).map((session) => cloneValue(session));
  }

  public async getActiveSession(workspaceId?: string): Promise<AISession | null> {
    const state = await this.readState();
    const activeSessionId = this.resolveActiveSessionId(state, workspaceId);
    if (!activeSessionId) {
      return null;
    }

    const session = state.sessions[activeSessionId];
    return session ? cloneValue(session) : null;
  }

  public async restoreSession(options: RestoreSessionOptions): Promise<RestoredAISession | null> {
    const validatedOptions = RestoreSessionOptionsSchema.parse(options);

    return this.mutateState((state) => {
      const sessionId =
        validatedOptions.sessionId ??
        this.resolveActiveSessionId(state, validatedOptions.workspaceId);
      if (!sessionId) {
        return null;
      }

      const currentSession = state.sessions[sessionId];
      if (!currentSession) {
        return null;
      }

      const resumedAt = new Date().toISOString();
      const updatedSession: AISession = {
        ...currentSession,
        lastActivityAt: resumedAt,
      };
      state.sessions[sessionId] = updatedSession;
      state.activeWorkspaceSessions[updatedSession.workspaceId] = sessionId;

      const currentRestoration =
        state.sessionRestorations[sessionId] ?? createInitialRestorationRecord();
      const nextRestoration: SessionRestorationMetadata = {
        resumeCount: currentRestoration.resumeCount + 1,
        lastResumedAt: resumedAt,
      };
      state.sessionRestorations[sessionId] = nextRestoration;

      const source: RestorationSource = validatedOptions.sessionId ? 'explicit' : 'active';
      return {
        session: cloneValue(updatedSession),
        context: this.buildPromptContext(state, sessionId),
        restoration: toRestorationMetadata(nextRestoration, source),
      };
    });
  }

  public async getSessionRestorationMetadata(
    sessionId: string
  ): Promise<SessionRestorationMetadata | null> {
    const state = await this.readState();
    if (!this.hasAnySession(state, sessionId)) {
      return null;
    }
    return cloneValue(state.sessionRestorations[sessionId] ?? createInitialRestorationRecord());
  }

  public async archiveSession(sessionId: string, endedAt: string): Promise<boolean> {
    const validatedEndedAt = ArchiveInputSchema.parse({ endedAt }).endedAt;
    return this.mutateState((state) => {
      const session = state.sessions[sessionId];
      if (!session) {
        return false;
      }

      state.archivedSessions[sessionId] = {
        session,
        endedAt: validatedEndedAt,
        archivedAt: new Date().toISOString(),
      };
      state.sessions = removeRecordKey(state.sessions, sessionId);
      if (state.activeWorkspaceSessions[session.workspaceId] === sessionId) {
        state.activeWorkspaceSessions = removeRecordKey(
          state.activeWorkspaceSessions,
          session.workspaceId
        );
      }
      return true;
    });
  }

  public async getArchivedSession(sessionId: string): Promise<ArchivedAISession | null> {
    const state = await this.readState();
    const archived = state.archivedSessions[sessionId];
    return archived ? cloneValue(archived) : null;
  }

  public async upsertPromptFile(promptFile: AIPromptFileMetadata): Promise<AIPromptFileMetadata> {
    const validated = AIPromptFileMetadataSchema.parse(promptFile);
    return this.mutateState((state) => {
      state.promptFiles[validated.id] = validated;
      return cloneValue(validated) as AIPromptFileMetadata;
    });
  }

  public async getPromptFile(promptFileId: string): Promise<AIPromptFileMetadata | null> {
    const state = await this.readState();
    const promptFile = state.promptFiles[promptFileId];
    return promptFile ? (cloneValue(promptFile) as AIPromptFileMetadata) : null;
  }

  public async listPromptFiles(): Promise<AIPromptFileMetadata[]> {
    const state = await this.readState();
    return sortByUpdatedAt(Object.values(state.promptFiles)).map(
      (prompt) => cloneValue(prompt) as AIPromptFileMetadata
    );
  }

  public async removePromptFile(promptFileId: string): Promise<boolean> {
    return this.mutateState((state) => {
      if (!state.promptFiles[promptFileId]) {
        return false;
      }

      state.promptFiles = removeRecordKey(state.promptFiles, promptFileId);
      for (const [sessionId, attachment] of Object.entries(state.sessionContexts)) {
        if (attachment.promptFileId !== promptFileId) {
          continue;
        }

        const nextAttachment = clearPromptAttachment(attachment);
        if (isAttachmentEmpty(nextAttachment)) {
          state.sessionContexts = removeRecordKey(state.sessionContexts, sessionId);
          continue;
        }
        state.sessionContexts[sessionId] = nextAttachment;
      }
      return true;
    });
  }

  public async upsertInstructionFile(
    instructionFile: AIInstructionFileMetadata
  ): Promise<AIInstructionFileMetadata> {
    const validated = AIInstructionFileMetadataSchema.parse(instructionFile);
    return this.mutateState((state) => {
      state.instructionFiles[validated.id] = validated;
      return cloneValue(validated) as AIInstructionFileMetadata;
    });
  }

  public async getInstructionFile(
    instructionFileId: string
  ): Promise<AIInstructionFileMetadata | null> {
    const state = await this.readState();
    const instructionFile = state.instructionFiles[instructionFileId];
    return instructionFile ? (cloneValue(instructionFile) as AIInstructionFileMetadata) : null;
  }

  public async listInstructionFiles(
    options: InstructionListOptions = {}
  ): Promise<AIInstructionFileMetadata[]> {
    const validatedOptions = InstructionListOptionsSchema.parse(options);
    const state = await this.readState();
    const filtered = Object.values(state.instructionFiles).filter((instruction) =>
      validatedOptions.scope ? instruction.scope === validatedOptions.scope : true
    );
    return sortByUpdatedAt(filtered).map(
      (instruction) => cloneValue(instruction) as AIInstructionFileMetadata
    );
  }

  public async removeInstructionFile(instructionFileId: string): Promise<boolean> {
    return this.mutateState((state) => {
      if (!state.instructionFiles[instructionFileId]) {
        return false;
      }

      state.instructionFiles = removeRecordKey(state.instructionFiles, instructionFileId);
      for (const [sessionId, attachment] of Object.entries(state.sessionContexts)) {
        if (attachment.instructionFileId !== instructionFileId) {
          continue;
        }

        const nextAttachment = clearInstructionAttachment(attachment);
        if (isAttachmentEmpty(nextAttachment)) {
          state.sessionContexts = removeRecordKey(state.sessionContexts, sessionId);
          continue;
        }
        state.sessionContexts[sessionId] = nextAttachment;
      }
      return true;
    });
  }

  public async attachPromptFile(
    sessionId: string,
    promptFileId: string | null
  ): Promise<AISessionPromptContext | null> {
    return this.mutateState((state) => {
      if (!this.hasAnySession(state, sessionId)) {
        return null;
      }
      if (promptFileId !== null && !state.promptFiles[promptFileId]) {
        throw new Error(`Prompt file ${promptFileId} was not found`);
      }

      const current = state.sessionContexts[sessionId] ?? {};
      const nextAttachment =
        promptFileId === null ? clearPromptAttachment(current) : { ...current, promptFileId };
      this.saveSessionAttachment(state, sessionId, nextAttachment);
      return this.buildPromptContext(state, sessionId);
    });
  }

  public async attachInstructionFile(
    sessionId: string,
    instructionFileId: string | null
  ): Promise<AISessionPromptContext | null> {
    return this.mutateState((state) => {
      if (!this.hasAnySession(state, sessionId)) {
        return null;
      }
      if (instructionFileId !== null && !state.instructionFiles[instructionFileId]) {
        throw new Error(`Instruction file ${instructionFileId} was not found`);
      }

      const current = state.sessionContexts[sessionId] ?? {};
      const nextAttachment =
        instructionFileId === null
          ? clearInstructionAttachment(current)
          : { ...current, instructionFileId };
      this.saveSessionAttachment(state, sessionId, nextAttachment);
      return this.buildPromptContext(state, sessionId);
    });
  }

  public async getSessionPromptContext(sessionId: string): Promise<AISessionPromptContext | null> {
    const state = await this.readState();
    if (!this.hasAnySession(state, sessionId)) {
      return null;
    }
    return this.buildPromptContext(state, sessionId);
  }

  private async readState(): Promise<SessionStoragePayload> {
    if (this.cachedState) {
      return this.cachedState;
    }
    this.cachedState = await this.loadState();
    return this.cachedState;
  }

  private async loadState(): Promise<SessionStoragePayload> {
    await ensureDirectory(path.dirname(this.storagePath));
    try {
      const raw = await fs.readFile(this.storagePath, 'utf-8');
      const parsed = SessionStorageSnapshotSchema.parse(JSON.parse(raw) as unknown);
      const expectedChecksum = computePayloadChecksum(parsed.payload);
      if (expectedChecksum !== parsed.checksum) {
        throw new Error('AI session storage checksum mismatch');
      }
      return parsed.payload;
    } catch (error) {
      if (isNotFoundError(error)) {
        return createEmptyPayload();
      }
      throw error;
    }
  }

  private async mutateState<T>(
    mutator: (state: SessionStoragePayload) => T | Promise<T>
  ): Promise<T> {
    const run = async (): Promise<T> => {
      const state = await this.readState();
      const result = await mutator(state);
      await this.persistState(state);
      return result;
    };

    const queued = this.mutationQueue.then(run, run);
    this.mutationQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued;
  }

  private async persistState(state: SessionStoragePayload): Promise<void> {
    await ensureDirectory(path.dirname(this.storagePath));
    const snapshot: SessionStorageSnapshot = {
      checksum: computePayloadChecksum(state),
      payload: state,
    };
    await atomicWrite(this.storagePath, JSON.stringify(snapshot, null, 2));
  }

  private resolveActiveSessionId(
    state: SessionStoragePayload,
    workspaceId?: string
  ): string | null {
    if (workspaceId) {
      const activeSessionId = state.activeWorkspaceSessions[workspaceId];
      if (activeSessionId && state.sessions[activeSessionId]) {
        return activeSessionId;
      }

      const fallbackSession = sortSessionsByLastActivity(
        Object.values(state.sessions).filter((session) => session.workspaceId === workspaceId)
      )[0];
      return fallbackSession?.id ?? null;
    }

    const mappedActiveSessions = Object.values(state.activeWorkspaceSessions)
      .map((sessionId) => state.sessions[sessionId])
      .filter((session): session is AISession => session !== undefined);
    const mappedLatest = sortSessionsByLastActivity(mappedActiveSessions)[0];
    if (mappedLatest) {
      return mappedLatest.id;
    }

    return sortSessionsByLastActivity(Object.values(state.sessions))[0]?.id ?? null;
  }

  private hasAnySession(state: SessionStoragePayload, sessionId: string): boolean {
    return (
      state.sessions[sessionId] !== undefined || state.archivedSessions[sessionId] !== undefined
    );
  }

  private saveSessionAttachment(
    state: SessionStoragePayload,
    sessionId: string,
    attachment: SessionAttachment
  ): void {
    if (isAttachmentEmpty(attachment)) {
      if (state.sessionContexts[sessionId]) {
        state.sessionContexts = removeRecordKey(state.sessionContexts, sessionId);
      }
      return;
    }
    state.sessionContexts[sessionId] = attachment;
  }

  private buildPromptContext(
    state: SessionStoragePayload,
    sessionId: string
  ): AISessionPromptContext {
    const attachment = state.sessionContexts[sessionId];
    const promptFile = attachment?.promptFileId
      ? state.promptFiles[attachment.promptFileId]
      : undefined;
    const instructionFile = attachment?.instructionFileId
      ? state.instructionFiles[attachment.instructionFileId]
      : undefined;

    return {
      sessionId,
      ...(promptFile ? { promptFile: cloneValue(promptFile) as AIPromptFileMetadata } : {}),
      ...(instructionFile
        ? { instructionFile: cloneValue(instructionFile) as AIInstructionFileMetadata }
        : {}),
    } as AISessionPromptContext;
  }
}
