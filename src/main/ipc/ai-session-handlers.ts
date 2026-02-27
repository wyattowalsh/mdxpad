import { randomUUID } from 'node:crypto';
import { ipcMain, type BrowserWindow } from 'electron';

import type { AIServices } from '@main/services/ai';
import { ProviderCapability } from '@shared/ai/types';
import * as schemas from '@shared/contracts/ai-schemas';
import { AISessionChannels } from '@shared/contracts/ai-schemas';

// Re-export for backward compatibility with existing consumers
export { AISessionChannels };
import type { AIPromptFileMetadata } from '@shared/types/ai-session';
import type { AISession } from '@shared/types/root';

import { toErrorResponse } from './ai-handler-utils';
import { assertAuthorizedIpcSender } from './ipc-sender-authorization';

const SESSION_NOT_FOUND_ERROR = {
  code: 'SESSION_NOT_FOUND',
  message: 'AI session not found',
} as const;

function registerAuthorizedHandler(
  channel: string,
  window: BrowserWindow,
  handler: (request: unknown) => Promise<unknown>
): void {
  ipcMain.handle(channel, (event, request) => {
    assertAuthorizedIpcSender(event, window, channel);
    return handler(request);
  });
}

async function handleSessionCreate(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AISessionCreateResponse> {
  try {
    const request = schemas.AISessionCreateRequestSchema.parse(rawRequest);
    const selection = await services.providerSessionService.assertSessionReady({
      providerId: request.providerId,
      modelId: request.modelId,
      requiredCapability: ProviderCapability.TEXT_GENERATION,
    });
    const now = new Date().toISOString();

    const session: AISession = {
      id: randomUUID(),
      workspaceId: request.workspaceId,
      provider: selection.provider.id,
      model: selection.modelId,
      contextDocumentIds: request.contextDocumentIds,
      startedAt: now,
      lastActivityAt: now,
    };
    const createdSession = await services.aiSessionStorageService.createSession(session);

    return schemas.AISessionCreateResponseSchema.parse({
      success: true,
      session: createdSession,
    });
  } catch (error) {
    return schemas.AISessionCreateResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

async function handleSessionList(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AISessionListResponse> {
  try {
    const request = schemas.AISessionListRequestSchema.parse(rawRequest ?? {});
    const sessions = await services.aiSessionStorageService.listSessions({
      ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
    });
    const activeSession = await services.aiSessionStorageService.getActiveSession(
      request.workspaceId
    );

    return schemas.AISessionListResponseSchema.parse({
      sessions,
      activeSessionId: activeSession?.id ?? null,
    });
  } catch {
    return schemas.AISessionListResponseSchema.parse({
      sessions: [],
      activeSessionId: null,
    });
  }
}

async function handleSessionGet(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AISessionGetResponse> {
  try {
    const request = schemas.AISessionGetRequestSchema.parse(rawRequest);
    const session = await services.aiSessionStorageService.getSession(request.sessionId);
    if (session) {
      const [context, restoration] = await Promise.all([
        services.aiSessionStorageService.getSessionPromptContext(session.id),
        services.aiSessionStorageService.getSessionRestorationMetadata(session.id),
      ]);
      return schemas.AISessionGetResponseSchema.parse({
        session,
        ...(context ? { context } : {}),
        ...(restoration ? { restoration } : {}),
      });
    }

    const archived = await services.aiSessionStorageService.getArchivedSession(request.sessionId);
    if (!archived?.session) {
      return schemas.AISessionGetResponseSchema.parse({ session: null });
    }
    const [context, restoration] = await Promise.all([
      services.aiSessionStorageService.getSessionPromptContext(archived.session.id),
      services.aiSessionStorageService.getSessionRestorationMetadata(archived.session.id),
    ]);
    return schemas.AISessionGetResponseSchema.parse({
      session: archived.session,
      ...(context ? { context } : {}),
      ...(restoration ? { restoration } : {}),
    });
  } catch {
    return schemas.AISessionGetResponseSchema.parse({ session: null });
  }
}

async function handleSessionRestore(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AISessionRestoreResponse> {
  try {
    const request = schemas.AISessionRestoreRequestSchema.parse(rawRequest ?? {});
    const restored = await services.aiSessionStorageService.restoreSession({
      ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
      ...(request.sessionId ? { sessionId: request.sessionId } : {}),
    });
    if (!restored) {
      return schemas.AISessionRestoreResponseSchema.parse({ session: null });
    }

    return schemas.AISessionRestoreResponseSchema.parse(restored);
  } catch {
    return schemas.AISessionRestoreResponseSchema.parse({ session: null });
  }
}

async function handleSessionArchive(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AISessionArchiveResponse> {
  try {
    const request = schemas.AISessionArchiveRequestSchema.parse(rawRequest);
    const archived = await services.aiSessionStorageService.archiveSession(
      request.sessionId,
      request.endedAt
    );

    if (!archived) {
      return schemas.AISessionArchiveResponseSchema.parse({
        success: false,
        error: SESSION_NOT_FOUND_ERROR,
      });
    }

    return schemas.AISessionArchiveResponseSchema.parse({ success: true });
  } catch (error) {
    return schemas.AISessionArchiveResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

async function handlePromptList(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AIPromptListResponse> {
  try {
    const request = schemas.AIPromptListRequestSchema.parse(rawRequest ?? {});
    const hasDiscoveryContext =
      request.workspaceRootPath !== undefined || request.projectRootPath !== undefined;

    if (hasDiscoveryContext) {
      const prompts = await services.promptFileLoaderService.discoverPromptFiles({
        ...(request.workspaceRootPath ? { workspaceRootPath: request.workspaceRootPath } : {}),
        ...(request.projectRootPath ? { projectRootPath: request.projectRootPath } : {}),
      });

      for (const prompt of prompts) {
        await services.aiSessionStorageService.upsertPromptFile(prompt as AIPromptFileMetadata);
      }

      return schemas.AIPromptListResponseSchema.parse({ prompts });
    }

    const prompts = await services.aiSessionStorageService.listPromptFiles();

    return schemas.AIPromptListResponseSchema.parse({ prompts });
  } catch {
    return schemas.AIPromptListResponseSchema.parse({ prompts: [] });
  }
}

async function handlePromptAttach(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AIPromptAttachResponse> {
  try {
    const request = schemas.AIPromptAttachRequestSchema.parse(rawRequest);
    const context = await services.aiSessionStorageService.attachPromptFile(
      request.sessionId,
      request.promptFileId
    );

    if (!context) {
      return schemas.AIPromptAttachResponseSchema.parse({
        success: false,
        error: SESSION_NOT_FOUND_ERROR,
      });
    }

    return schemas.AIPromptAttachResponseSchema.parse({
      success: true,
      context,
    });
  } catch (error) {
    return schemas.AIPromptAttachResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

async function handleInstructionList(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AIInstructionListResponse> {
  try {
    const request = schemas.AIInstructionListRequestSchema.parse(rawRequest ?? {});
    const instructions = await services.instructionLoaderService.listInstructionFiles({
      ...(request.scope ? { scope: request.scope } : {}),
      ...(request.projectRootPath ? { projectRootPath: request.projectRootPath } : {}),
      ...(request.workspaceRootPath ? { workspaceRootPath: request.workspaceRootPath } : {}),
      ...(request.documentPath ? { documentPath: request.documentPath } : {}),
    });

    return schemas.AIInstructionListResponseSchema.parse({
      instructions,
    });
  } catch {
    return schemas.AIInstructionListResponseSchema.parse({ instructions: [] });
  }
}

async function handleInstructionLoad(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AIInstructionLoadResponse> {
  try {
    const request = schemas.AIInstructionLoadRequestSchema.parse(rawRequest);
    const instruction = await services.instructionLoaderService.loadInstructionFile(
      request.instructionFileId
    );

    return schemas.AIInstructionLoadResponseSchema.parse({
      instruction,
    });
  } catch {
    return schemas.AIInstructionLoadResponseSchema.parse({ instruction: null });
  }
}

async function handleInstructionAttach(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AIInstructionAttachResponse> {
  try {
    const request = schemas.AIInstructionAttachRequestSchema.parse(rawRequest);
    const context = await services.aiSessionStorageService.attachInstructionFile(
      request.sessionId,
      request.instructionFileId
    );

    if (!context) {
      return schemas.AIInstructionAttachResponseSchema.parse({
        success: false,
        error: SESSION_NOT_FOUND_ERROR,
      });
    }

    return schemas.AIInstructionAttachResponseSchema.parse({
      success: true,
      context,
    });
  } catch (error) {
    return schemas.AIInstructionAttachResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

export function registerSessionHandlers(services: AIServices, window: BrowserWindow): void {
  registerAuthorizedHandler(AISessionChannels.SESSION_CREATE, window, (request) =>
    handleSessionCreate(services, request)
  );
  registerAuthorizedHandler(AISessionChannels.SESSION_LIST, window, (request) =>
    handleSessionList(services, request)
  );
  registerAuthorizedHandler(AISessionChannels.SESSION_GET, window, (request) =>
    handleSessionGet(services, request)
  );
  registerAuthorizedHandler(AISessionChannels.SESSION_ARCHIVE, window, (request) =>
    handleSessionArchive(services, request)
  );
  registerAuthorizedHandler(AISessionChannels.SESSION_RESTORE, window, (request) =>
    handleSessionRestore(services, request)
  );
  registerAuthorizedHandler(AISessionChannels.PROMPT_LIST, window, (request) =>
    handlePromptList(services, request)
  );
  registerAuthorizedHandler(AISessionChannels.PROMPT_ATTACH, window, (request) =>
    handlePromptAttach(services, request)
  );
  registerAuthorizedHandler(AISessionChannels.INSTRUCTION_LIST, window, (request) =>
    handleInstructionList(services, request)
  );
  registerAuthorizedHandler(AISessionChannels.INSTRUCTION_LOAD, window, (request) =>
    handleInstructionLoad(services, request)
  );
  registerAuthorizedHandler(AISessionChannels.INSTRUCTION_ATTACH, window, (request) =>
    handleInstructionAttach(services, request)
  );
}
