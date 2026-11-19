import { randomUUID } from 'node:crypto';
import { constants as fsConstants, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

import { atomicWrite } from '@shared/lib/atomic-write';
import { ensureRealDirectory } from './ensure-real-directory';
import type {
  CollaborationAddCommentRequest,
  CollaborationAddCommentResponse,
  CollaborationAddSuggestionRequest,
  CollaborationAddSuggestionResponse,
  CollaborationApplySuggestionRequest,
  CollaborationApplySuggestionResponse,
  CollaborationListResponse,
  CollaborationResolveThreadRequest,
  CollaborationResolveThreadResponse,
  CollaborationSuggestion,
  CollaborationThread,
} from '@shared/contracts/platform-schemas';

interface CollaborationDocumentState {
  threads: CollaborationThread[];
  suggestions: CollaborationSuggestion[];
}

function freshDocumentState(): CollaborationDocumentState {
  return { threads: [], suggestions: [] };
}

function getDefaultBaseDir(): string {
  return path.join(app.getPath('userData'), 'collaboration');
}

async function ensureDirectory(dir: string): Promise<void> {
  await ensureRealDirectory(dir);
}

async function readDocumentFile(filePath: string): Promise<CollaborationDocumentState> {
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile()) {
      return freshDocumentState();
    }
    const content = await handle.readFile({ encoding: 'utf8' });
    const parsed = JSON.parse(content) as Partial<CollaborationDocumentState>;
    return {
      threads: parsed.threads ?? [],
      suggestions: parsed.suggestions ?? [],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ELOOP' || code === 'EINVAL' || code === 'EPERM') {
      return freshDocumentState();
    }
    throw error;
  } finally {
    await handle?.close();
  }
}

export class CollaborationService {
  private readonly baseDir: string;

  public constructor(baseDir: string = getDefaultBaseDir()) {
    this.baseDir = baseDir;
  }

  private getDocumentPath(documentId: string): string {
    return path.join(this.baseDir, `${documentId}.json`);
  }

  private async readDocumentState(documentId: string): Promise<CollaborationDocumentState> {
    await ensureDirectory(this.baseDir);
    return readDocumentFile(this.getDocumentPath(documentId));
  }

  private async writeDocumentState(
    documentId: string,
    state: CollaborationDocumentState
  ): Promise<void> {
    await ensureDirectory(this.baseDir);
    await atomicWrite(this.getDocumentPath(documentId), JSON.stringify(state, null, 2));
  }

  public async list(documentId: string): Promise<CollaborationListResponse> {
    return this.readDocumentState(documentId);
  }

  public async addComment(
    request: CollaborationAddCommentRequest
  ): Promise<CollaborationAddCommentResponse> {
    const state = await this.readDocumentState(request.documentId);
    const now = Date.now();

    const nextMessage = {
      id: randomUUID(),
      author: request.author,
      message: request.message,
      createdAt: now,
    };

    const threadId = request.threadId ?? randomUUID();
    let thread = state.threads.find((candidate) => candidate.id === threadId);
    if (!thread) {
      thread = {
        id: threadId,
        documentId: request.documentId,
        anchor: request.anchor,
        state: 'open',
        messages: [],
        updatedAt: now,
      };
      state.threads.push(thread);
    }

    thread.messages.push(nextMessage);
    thread.updatedAt = now;
    if (thread.state !== 'open') {
      thread.state = 'open';
    }

    await this.writeDocumentState(request.documentId, state);
    return { thread };
  }

  public async resolveThread(
    request: CollaborationResolveThreadRequest
  ): Promise<CollaborationResolveThreadResponse> {
    const state = await this.readDocumentState(request.documentId);
    const thread = state.threads.find((candidate) => candidate.id === request.threadId);
    if (!thread) {
      throw new Error(`Thread ${request.threadId} was not found`);
    }

    thread.state = request.resolved ? 'resolved' : 'open';
    thread.updatedAt = Date.now();
    await this.writeDocumentState(request.documentId, state);
    return { thread };
  }

  public async addSuggestion(
    request: CollaborationAddSuggestionRequest
  ): Promise<CollaborationAddSuggestionResponse> {
    const state = await this.readDocumentState(request.documentId);
    const now = Date.now();
    const suggestion: CollaborationSuggestion = {
      id: randomUUID(),
      documentId: request.documentId,
      anchor: request.anchor,
      patch: request.patch,
      rationale: request.rationale,
      author: request.author,
      baseChecksum: request.baseChecksum,
      state: 'open',
      createdAt: now,
      updatedAt: now,
    };

    state.suggestions.push(suggestion);
    await this.writeDocumentState(request.documentId, state);
    return { suggestion };
  }

  public async applySuggestion(
    request: CollaborationApplySuggestionRequest
  ): Promise<CollaborationApplySuggestionResponse> {
    const state = await this.readDocumentState(request.documentId);
    const suggestion = state.suggestions.find((candidate) => candidate.id === request.suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion ${request.suggestionId} was not found`);
    }

    const outdated = suggestion.baseChecksum !== request.currentChecksum;
    suggestion.state = outdated ? 'outdated' : 'accepted';
    suggestion.updatedAt = Date.now();
    await this.writeDocumentState(request.documentId, state);

    return {
      ok: !outdated,
      outdated,
      applied: false,
      suggestion,
    };
  }
}
