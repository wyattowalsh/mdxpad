/**
 * AI IPC contracts for provider/session/prompt/instruction/stream operations.
 *
 * Reuses existing AI base schemas from src/shared/ai/schemas.ts.
 */

import { z } from 'zod';

// ============================================================================
// AI Session IPC Channel Constants (single source of truth)
// ============================================================================

export const AISessionChannels = {
  SESSION_CREATE: 'mdxpad:ai:session:create',
  SESSION_LIST: 'mdxpad:ai:session:list',
  SESSION_GET: 'mdxpad:ai:session:get',
  SESSION_ARCHIVE: 'mdxpad:ai:session:archive',
  SESSION_RESTORE: 'mdxpad:ai:session:restore',
  PROMPT_LIST: 'mdxpad:ai:prompt:list',
  PROMPT_ATTACH: 'mdxpad:ai:prompt:attach',
  INSTRUCTION_LIST: 'mdxpad:ai:instruction:list',
  INSTRUCTION_LOAD: 'mdxpad:ai:instruction:load',
  INSTRUCTION_ATTACH: 'mdxpad:ai:instruction:attach',
} as const;

import {
  ErrorObjectSchema,
  GenerateStreamRequestSchema,
  ProviderCapabilitySchema,
  ProviderListResponseSchema,
  ProviderTypeSchema,
  SidecarConfigSchema,
  SidecarConfigureRequestSchema,
  SidecarLifecycleStatusResponseSchema,
  SidecarStatusRequestSchema,
  SetActiveProviderRequestSchema,
  SetActiveProviderResponseSchema,
  StreamCancelRequestSchema,
  StreamCancelResponseSchema,
  StreamChunkSchema,
  StreamCompleteSchema,
  StreamErrorSchema,
  StreamInitResponseSchema,
} from '../ai/schemas';
import { AISessionSchema } from '../types/root';

// ============================================================================
// Provider contracts
// ============================================================================

export const AIProviderListRequestSchema = z.void();
export type AIProviderListRequest = z.infer<typeof AIProviderListRequestSchema>;

export const AIProviderListResponseSchema = ProviderListResponseSchema;
export type AIProviderListResponse = z.infer<typeof AIProviderListResponseSchema>;

export const AIProviderSetActiveRequestSchema = SetActiveProviderRequestSchema;
export type AIProviderSetActiveRequest = z.infer<typeof AIProviderSetActiveRequestSchema>;

export const AIProviderSetActiveResponseSchema = SetActiveProviderResponseSchema;
export type AIProviderSetActiveResponse = z.infer<typeof AIProviderSetActiveResponseSchema>;

export const AISidecarConfigSchema = SidecarConfigSchema;
export type AISidecarConfig = z.infer<typeof AISidecarConfigSchema>;

export const AISidecarConfigureRequestSchema = SidecarConfigureRequestSchema;
export type AISidecarConfigureRequest = z.infer<typeof AISidecarConfigureRequestSchema>;

export const AISidecarStatusRequestSchema = SidecarStatusRequestSchema;
export type AISidecarStatusRequest = z.infer<typeof AISidecarStatusRequestSchema>;

export const AISidecarLifecycleStatusResponseSchema = SidecarLifecycleStatusResponseSchema;
export type AISidecarLifecycleStatusResponse = z.infer<typeof AISidecarLifecycleStatusResponseSchema>;

// ============================================================================
// Session contracts
// ============================================================================

export const AISessionCreateRequestSchema = z.object({
  workspaceId: AISessionSchema.shape.workspaceId,
  providerId: z.string().uuid(),
  modelId: AISessionSchema.shape.model,
  contextDocumentIds: AISessionSchema.shape.contextDocumentIds.default([]),
});
export type AISessionCreateRequest = z.infer<typeof AISessionCreateRequestSchema>;

export const AISessionCreateResponseSchema = z.object({
  success: z.boolean(),
  session: AISessionSchema.optional(),
  error: ErrorObjectSchema.optional(),
});
export type AISessionCreateResponse = z.infer<typeof AISessionCreateResponseSchema>;

export const AISessionListRequestSchema = z.object({
  workspaceId: AISessionSchema.shape.workspaceId.optional(),
});
export type AISessionListRequest = z.infer<typeof AISessionListRequestSchema>;

export const AISessionListResponseSchema = z.object({
  sessions: z.array(AISessionSchema),
  activeSessionId: AISessionSchema.shape.id.nullable().default(null),
});
export type AISessionListResponse = z.infer<typeof AISessionListResponseSchema>;

export const AISessionGetRequestSchema = z.object({
  sessionId: AISessionSchema.shape.id,
});
export type AISessionGetRequest = z.infer<typeof AISessionGetRequestSchema>;

export const AISessionRestorationMetadataSchema = z.object({
  resumeCount: z.number().int().nonnegative(),
  lastResumedAt: z.string().datetime().nullable(),
  restoredFrom: z.enum(['active', 'explicit']).optional(),
});
export type AISessionRestorationMetadata = z.infer<typeof AISessionRestorationMetadataSchema>;

export const AISessionGetResponseSchema = z.object({
  session: AISessionSchema.nullable(),
  context: z.lazy(() => AISessionPromptContextSchema).optional(),
  restoration: AISessionRestorationMetadataSchema.optional(),
});
export type AISessionGetResponse = z.infer<typeof AISessionGetResponseSchema>;

export const AISessionArchiveRequestSchema = z.object({
  sessionId: AISessionSchema.shape.id,
  endedAt: z.string().datetime(),
});
export type AISessionArchiveRequest = z.infer<typeof AISessionArchiveRequestSchema>;

export const AISessionArchiveResponseSchema = z.object({
  success: z.boolean(),
  error: ErrorObjectSchema.optional(),
});
export type AISessionArchiveResponse = z.infer<typeof AISessionArchiveResponseSchema>;

export const AISessionRestoreRequestSchema = z
  .object({
    workspaceId: AISessionSchema.shape.workspaceId.optional(),
    sessionId: AISessionSchema.shape.id.optional(),
  })
  .refine((value) => value.workspaceId !== undefined || value.sessionId !== undefined, {
    message: 'workspaceId or sessionId is required',
  });
export type AISessionRestoreRequest = z.infer<typeof AISessionRestoreRequestSchema>;

// ============================================================================
// Prompt + Instruction metadata contracts
// ============================================================================

export const AIFileMetadataSchema = z.object({
  id: z.string().min(1),
  filePath: z.string().min(1),
  fileName: z.string().min(1),
  checksum: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AIFileMetadata = z.infer<typeof AIFileMetadataSchema>;

export const AISessionModelSelectionSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  providerType: ProviderTypeSchema.optional(),
  capabilities: z.array(ProviderCapabilitySchema).optional(),
});
export type AISessionModelSelection = z.infer<typeof AISessionModelSelectionSchema>;

export const AIInstructionScopeSchema = z.enum(['global', 'workspace', 'document']);
export type AIInstructionScope = z.infer<typeof AIInstructionScopeSchema>;

export const AIInstructionFileMetadataSchema = AIFileMetadataSchema.extend({
  kind: z.literal('instruction'),
  scope: AIInstructionScopeSchema,
  appliesToDocumentIds: z.array(z.string().uuid()).optional(),
  version: z.string().optional(),
});
export type AIInstructionFileMetadata = z.infer<typeof AIInstructionFileMetadataSchema>;

export const AIPromptFileMetadataSchema = AIFileMetadataSchema.extend({
  kind: z.literal('prompt'),
  title: z.string().min(1),
  description: z.string().optional(),
  variables: z.array(z.string()).default([]),
  systemPrompt: z.string().optional(),
  modelSelection: AISessionModelSelectionSchema.partial().optional(),
});
export type AIPromptFileMetadata = z.infer<typeof AIPromptFileMetadataSchema>;

export const AISessionPromptContextSchema = z.object({
  sessionId: AISessionSchema.shape.id,
  promptFile: AIPromptFileMetadataSchema.optional(),
  instructionFile: AIInstructionFileMetadataSchema.optional(),
});
export type AISessionPromptContext = z.infer<typeof AISessionPromptContextSchema>;

export const AISessionRestoreResponseSchema = z.object({
  session: AISessionSchema.nullable(),
  context: AISessionPromptContextSchema.optional(),
  restoration: AISessionRestorationMetadataSchema.optional(),
});
export type AISessionRestoreResponse = z.infer<typeof AISessionRestoreResponseSchema>;

// ============================================================================
// Prompt operations
// ============================================================================

export const AIPromptListRequestSchema = z.object({
  workspaceId: AISessionSchema.shape.workspaceId.optional(),
  workspaceRootPath: z.string().min(1).optional(),
  projectRootPath: z.string().min(1).optional(),
});
export type AIPromptListRequest = z.infer<typeof AIPromptListRequestSchema>;

export const AIPromptListResponseSchema = z.object({
  prompts: z.array(AIPromptFileMetadataSchema),
});
export type AIPromptListResponse = z.infer<typeof AIPromptListResponseSchema>;

export const AIPromptAttachRequestSchema = z.object({
  sessionId: AISessionSchema.shape.id,
  promptFileId: z.string().min(1).nullable(),
});
export type AIPromptAttachRequest = z.infer<typeof AIPromptAttachRequestSchema>;

export const AIPromptAttachResponseSchema = z.object({
  success: z.boolean(),
  context: AISessionPromptContextSchema.optional(),
  error: ErrorObjectSchema.optional(),
});
export type AIPromptAttachResponse = z.infer<typeof AIPromptAttachResponseSchema>;

// ============================================================================
// Instruction operations
// ============================================================================

export const AIInstructionListRequestSchema = z.object({
  workspaceId: AISessionSchema.shape.workspaceId.optional(),
  scope: AIInstructionScopeSchema.optional(),
  projectRootPath: z.string().min(1).optional(),
  workspaceRootPath: z.string().min(1).optional(),
  documentPath: z.string().min(1).optional(),
});
export type AIInstructionListRequest = z.infer<typeof AIInstructionListRequestSchema>;

export const AIInstructionListResponseSchema = z.object({
  instructions: z.array(AIInstructionFileMetadataSchema),
});
export type AIInstructionListResponse = z.infer<typeof AIInstructionListResponseSchema>;

export const AIInstructionLoadRequestSchema = z.object({
  instructionFileId: z.string().min(1),
});
export type AIInstructionLoadRequest = z.infer<typeof AIInstructionLoadRequestSchema>;

export const AIInstructionContentSchema = z.object({
  metadata: AIInstructionFileMetadataSchema,
  content: z.string(),
});
export type AIInstructionContent = z.infer<typeof AIInstructionContentSchema>;

export const AIInstructionLoadResponseSchema = z.object({
  instruction: AIInstructionContentSchema.nullable(),
});
export type AIInstructionLoadResponse = z.infer<typeof AIInstructionLoadResponseSchema>;

export const AIInstructionAttachRequestSchema = z.object({
  sessionId: AISessionSchema.shape.id,
  instructionFileId: z.string().min(1).nullable(),
});
export type AIInstructionAttachRequest = z.infer<typeof AIInstructionAttachRequestSchema>;

export const AIInstructionAttachResponseSchema = z.object({
  success: z.boolean(),
  context: AISessionPromptContextSchema.optional(),
  error: ErrorObjectSchema.optional(),
});
export type AIInstructionAttachResponse = z.infer<typeof AIInstructionAttachResponseSchema>;

// ============================================================================
// Stream operations
// ============================================================================

export const AIStreamStartRequestSchema = GenerateStreamRequestSchema.extend({
  sessionId: AISessionSchema.shape.id,
  promptFileId: z.string().min(1).optional(),
  instructionFileId: z.string().min(1).optional(),
});
export type AIStreamStartRequest = z.infer<typeof AIStreamStartRequestSchema>;

export const AIStreamStartResponseSchema = StreamInitResponseSchema;
export type AIStreamStartResponse = z.infer<typeof AIStreamStartResponseSchema>;

export const AIStreamCancelRequestSchema = StreamCancelRequestSchema;
export type AIStreamCancelRequest = z.infer<typeof AIStreamCancelRequestSchema>;

export const AIStreamCancelResponseSchema = StreamCancelResponseSchema;
export type AIStreamCancelResponse = z.infer<typeof AIStreamCancelResponseSchema>;

export const AIStreamChunkEventSchema = StreamChunkSchema;
export type AIStreamChunkEvent = z.infer<typeof AIStreamChunkEventSchema>;

export const AIStreamCompleteEventSchema = StreamCompleteSchema;
export type AIStreamCompleteEvent = z.infer<typeof AIStreamCompleteEventSchema>;

export const AIStreamErrorEventSchema = StreamErrorSchema;
export type AIStreamErrorEvent = z.infer<typeof AIStreamErrorEventSchema>;

export const AIStreamEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('chunk'),
    payload: AIStreamChunkEventSchema,
  }),
  z.object({
    event: z.literal('complete'),
    payload: AIStreamCompleteEventSchema,
  }),
  z.object({
    event: z.literal('error'),
    payload: AIStreamErrorEventSchema,
  }),
]);
export type AIStreamEvent = z.infer<typeof AIStreamEventSchema>;
