/**
 * AI Session API Module - Exposes session/prompt/instruction operations to renderer.
 *
 * All methods use validated invoke pattern with shared AI contracts for
 * request/response validation on both ends.
 */

import { z } from 'zod';

// Re-export for backward compatibility with existing consumers
export { AISessionChannels } from '@shared/contracts/ai-schemas';

import {
  AISessionChannels,
  AISessionCreateRequestSchema,
  AISessionCreateResponseSchema,
  AISessionListRequestSchema,
  AISessionListResponseSchema,
  AISessionGetRequestSchema,
  AISessionGetResponseSchema,
  AISessionArchiveRequestSchema,
  AISessionArchiveResponseSchema,
  AISessionRestoreRequestSchema,
  AISessionRestoreResponseSchema,
  AIPromptListRequestSchema,
  AIPromptListResponseSchema,
  AIPromptAttachRequestSchema,
  AIPromptAttachResponseSchema,
  AIInstructionListRequestSchema,
  AIInstructionListResponseSchema,
  AIInstructionLoadRequestSchema,
  AIInstructionLoadResponseSchema,
  AIInstructionAttachRequestSchema,
  AIInstructionAttachResponseSchema,
} from '@shared/contracts/ai-schemas';
import { validatedInvoke } from './validated-invoke';

export interface AISessionApi {
  createSession(
    request: z.infer<typeof AISessionCreateRequestSchema>
  ): Promise<z.infer<typeof AISessionCreateResponseSchema>>;
  listSessions(
    request?: z.infer<typeof AISessionListRequestSchema>
  ): Promise<z.infer<typeof AISessionListResponseSchema>>;
  getSession(sessionId: string): Promise<z.infer<typeof AISessionGetResponseSchema>>;
  archiveSession(
    request: z.infer<typeof AISessionArchiveRequestSchema>
  ): Promise<z.infer<typeof AISessionArchiveResponseSchema>>;
  restoreSession(
    request: z.infer<typeof AISessionRestoreRequestSchema>
  ): Promise<z.infer<typeof AISessionRestoreResponseSchema>>;
  listPrompts(
    request?: z.infer<typeof AIPromptListRequestSchema>
  ): Promise<z.infer<typeof AIPromptListResponseSchema>>;
  attachPrompt(
    request: z.infer<typeof AIPromptAttachRequestSchema>
  ): Promise<z.infer<typeof AIPromptAttachResponseSchema>>;
  listInstructions(
    request?: z.infer<typeof AIInstructionListRequestSchema>
  ): Promise<z.infer<typeof AIInstructionListResponseSchema>>;
  loadInstruction(
    instructionFileId: string
  ): Promise<z.infer<typeof AIInstructionLoadResponseSchema>>;
  attachInstruction(
    request: z.infer<typeof AIInstructionAttachRequestSchema>
  ): Promise<z.infer<typeof AIInstructionAttachResponseSchema>>;
}

export const aiSessionApi: AISessionApi = {
  createSession: (request) =>
    validatedInvoke(
      AISessionChannels.SESSION_CREATE,
      AISessionCreateRequestSchema,
      AISessionCreateResponseSchema,
      request
    ),

  listSessions: (request) =>
    validatedInvoke(
      AISessionChannels.SESSION_LIST,
      AISessionListRequestSchema,
      AISessionListResponseSchema,
      request ?? {}
    ),

  getSession: (sessionId) =>
    validatedInvoke(
      AISessionChannels.SESSION_GET,
      AISessionGetRequestSchema,
      AISessionGetResponseSchema,
      { sessionId }
    ),

  archiveSession: (request) =>
    validatedInvoke(
      AISessionChannels.SESSION_ARCHIVE,
      AISessionArchiveRequestSchema,
      AISessionArchiveResponseSchema,
      request
    ),

  restoreSession: (request) =>
    validatedInvoke(
      AISessionChannels.SESSION_RESTORE,
      AISessionRestoreRequestSchema,
      AISessionRestoreResponseSchema,
      request
    ),

  listPrompts: (request) =>
    validatedInvoke(
      AISessionChannels.PROMPT_LIST,
      AIPromptListRequestSchema,
      AIPromptListResponseSchema,
      request ?? {}
    ),

  attachPrompt: (request) =>
    validatedInvoke(
      AISessionChannels.PROMPT_ATTACH,
      AIPromptAttachRequestSchema,
      AIPromptAttachResponseSchema,
      request
    ),

  listInstructions: (request) =>
    validatedInvoke(
      AISessionChannels.INSTRUCTION_LIST,
      AIInstructionListRequestSchema,
      AIInstructionListResponseSchema,
      request ?? {}
    ),

  loadInstruction: (instructionFileId) =>
    validatedInvoke(
      AISessionChannels.INSTRUCTION_LOAD,
      AIInstructionLoadRequestSchema,
      AIInstructionLoadResponseSchema,
      { instructionFileId }
    ),

  attachInstruction: (request) =>
    validatedInvoke(
      AISessionChannels.INSTRUCTION_ATTACH,
      AIInstructionAttachRequestSchema,
      AIInstructionAttachResponseSchema,
      request
    ),
};
