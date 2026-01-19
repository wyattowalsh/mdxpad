/**
 * AI Provider Abstraction Layer IPC Channel Definitions
 *
 * Type-safe IPC channel contracts for the AI provider system.
 * Per Constitution III.3: max 10 top-level channels, mdxpad:<domain>:<action> naming
 *
 * @module src/shared/ai/ipc-channels
 */

import type { IpcMainInvokeEvent, IpcRendererEvent } from 'electron';
import type { z } from 'zod';
import type {
  ProviderListResponseSchema, AddProviderRequestSchema, AddProviderResponseSchema,
  UpdateProviderRequestSchema, UpdateProviderResponseSchema,
  RemoveProviderRequestSchema, RemoveProviderResponseSchema,
  SetActiveProviderRequestSchema, SetActiveProviderResponseSchema,
  ValidateProviderRequestSchema, ValidateProviderResponseSchema,
  SetCredentialRequestSchema, SetCredentialResponseSchema,
  HasCredentialRequestSchema, HasCredentialResponseSchema,
  ClearCredentialRequestSchema, ClearCredentialResponseSchema,
  GenerateTextRequestSchema, GenerateTextResponseSchema,
  GenerateStreamRequestSchema, StreamInitResponseSchema,
  StreamChunkSchema, StreamCompleteSchema, StreamErrorSchema,
  GenerateEmbedRequestSchema, GenerateEmbedResponseSchema,
  GenerateImageRequestSchema, GenerateImageResponseSchema,
  QueryUsageRequestSchema, QueryUsageResponseSchema,
  ExportUsageRequestSchema, ExportUsageResponseSchema,
  ClearUsageRequestSchema, ClearUsageResponseSchema,
  GetCapabilityRequestSchema, GetCapabilityResponseSchema,
  ListModelsRequestSchema, ListModelsResponseSchema,
  RefreshCapabilityRequestSchema, RefreshCapabilityResponseSchema,
} from './schemas';

// =============================================================================
// CHANNEL CONSTANTS (6 domains, under 10 limit per Constitution III.3)
// =============================================================================

export const AIChannels = {
  // Provider Management (invoke/handle)
  PROVIDER_LIST: 'mdxpad:ai:provider:list',
  PROVIDER_ADD: 'mdxpad:ai:provider:add',
  PROVIDER_UPDATE: 'mdxpad:ai:provider:update',
  PROVIDER_REMOVE: 'mdxpad:ai:provider:remove',
  PROVIDER_SET_ACTIVE: 'mdxpad:ai:provider:set-active',
  PROVIDER_VALIDATE: 'mdxpad:ai:provider:validate',
  // Credential Management (invoke/handle)
  CREDENTIAL_SET: 'mdxpad:ai:credential:set',
  CREDENTIAL_HAS: 'mdxpad:ai:credential:has',
  CREDENTIAL_CLEAR: 'mdxpad:ai:credential:clear',
  // AI Generation (invoke/handle)
  GENERATE_TEXT: 'mdxpad:ai:generate:text',
  GENERATE_STREAM: 'mdxpad:ai:generate:stream',
  GENERATE_EMBED: 'mdxpad:ai:generate:embed',
  GENERATE_IMAGE: 'mdxpad:ai:generate:image',
  // Usage Statistics (invoke/handle)
  USAGE_QUERY: 'mdxpad:ai:usage:query',
  USAGE_EXPORT: 'mdxpad:ai:usage:export',
  USAGE_CLEAR: 'mdxpad:ai:usage:clear',
  // Capability Detection (invoke/handle)
  CAPABILITY_GET: 'mdxpad:ai:capability:get',
  CAPABILITY_LIST_MODELS: 'mdxpad:ai:capability:list-models',
  CAPABILITY_REFRESH: 'mdxpad:ai:capability:refresh',
  // Streaming Events (send/on pattern - main to renderer)
  STREAM_CHUNK: 'mdxpad:ai:stream:chunk',
  STREAM_COMPLETE: 'mdxpad:ai:stream:complete',
  STREAM_ERROR: 'mdxpad:ai:stream:error',
} as const;

/** Type representing any AI channel name */
export type AIChannel = (typeof AIChannels)[keyof typeof AIChannels];

/** Type representing invoke/handle channels (exclude streaming) */
export type AIInvokeChannel = Exclude<
  AIChannel,
  typeof AIChannels.STREAM_CHUNK | typeof AIChannels.STREAM_COMPLETE | typeof AIChannels.STREAM_ERROR
>;

/** Type representing send/on streaming channels */
export type AIStreamChannel =
  | typeof AIChannels.STREAM_CHUNK
  | typeof AIChannels.STREAM_COMPLETE
  | typeof AIChannels.STREAM_ERROR;

// =============================================================================
// TYPE-SAFE API DEFINITIONS
// =============================================================================

/** Maps channel names to their request/response types */
export interface AIProviderApi {
  [AIChannels.PROVIDER_LIST]: {
    request: void;
    response: z.infer<typeof ProviderListResponseSchema>;
  };
  [AIChannels.PROVIDER_ADD]: {
    request: z.infer<typeof AddProviderRequestSchema>;
    response: z.infer<typeof AddProviderResponseSchema>;
  };
  [AIChannels.PROVIDER_UPDATE]: {
    request: z.infer<typeof UpdateProviderRequestSchema>;
    response: z.infer<typeof UpdateProviderResponseSchema>;
  };
  [AIChannels.PROVIDER_REMOVE]: {
    request: z.infer<typeof RemoveProviderRequestSchema>;
    response: z.infer<typeof RemoveProviderResponseSchema>;
  };
  [AIChannels.PROVIDER_SET_ACTIVE]: {
    request: z.infer<typeof SetActiveProviderRequestSchema>;
    response: z.infer<typeof SetActiveProviderResponseSchema>;
  };
  [AIChannels.PROVIDER_VALIDATE]: {
    request: z.infer<typeof ValidateProviderRequestSchema>;
    response: z.infer<typeof ValidateProviderResponseSchema>;
  };
  [AIChannels.CREDENTIAL_SET]: {
    request: z.infer<typeof SetCredentialRequestSchema>;
    response: z.infer<typeof SetCredentialResponseSchema>;
  };
  [AIChannels.CREDENTIAL_HAS]: {
    request: z.infer<typeof HasCredentialRequestSchema>;
    response: z.infer<typeof HasCredentialResponseSchema>;
  };
  [AIChannels.CREDENTIAL_CLEAR]: {
    request: z.infer<typeof ClearCredentialRequestSchema>;
    response: z.infer<typeof ClearCredentialResponseSchema>;
  };
  [AIChannels.GENERATE_TEXT]: {
    request: z.infer<typeof GenerateTextRequestSchema>;
    response: z.infer<typeof GenerateTextResponseSchema>;
  };
  [AIChannels.GENERATE_STREAM]: {
    request: z.infer<typeof GenerateStreamRequestSchema>;
    response: z.infer<typeof StreamInitResponseSchema>;
  };
  [AIChannels.GENERATE_EMBED]: {
    request: z.infer<typeof GenerateEmbedRequestSchema>;
    response: z.infer<typeof GenerateEmbedResponseSchema>;
  };
  [AIChannels.GENERATE_IMAGE]: {
    request: z.infer<typeof GenerateImageRequestSchema>;
    response: z.infer<typeof GenerateImageResponseSchema>;
  };
  [AIChannels.USAGE_QUERY]: {
    request: z.infer<typeof QueryUsageRequestSchema>;
    response: z.infer<typeof QueryUsageResponseSchema>;
  };
  [AIChannels.USAGE_EXPORT]: {
    request: z.infer<typeof ExportUsageRequestSchema>;
    response: z.infer<typeof ExportUsageResponseSchema>;
  };
  [AIChannels.USAGE_CLEAR]: {
    request: z.infer<typeof ClearUsageRequestSchema>;
    response: z.infer<typeof ClearUsageResponseSchema>;
  };
  [AIChannels.CAPABILITY_GET]: {
    request: z.infer<typeof GetCapabilityRequestSchema>;
    response: z.infer<typeof GetCapabilityResponseSchema>;
  };
  [AIChannels.CAPABILITY_LIST_MODELS]: {
    request: z.infer<typeof ListModelsRequestSchema>;
    response: z.infer<typeof ListModelsResponseSchema>;
  };
  [AIChannels.CAPABILITY_REFRESH]: {
    request: z.infer<typeof RefreshCapabilityRequestSchema>;
    response: z.infer<typeof RefreshCapabilityResponseSchema>;
  };
}

/** Streaming channel payload types (send/on pattern from main to renderer) */
export interface AIStreamApi {
  [AIChannels.STREAM_CHUNK]: z.infer<typeof StreamChunkSchema>;
  [AIChannels.STREAM_COMPLETE]: z.infer<typeof StreamCompleteSchema>;
  [AIChannels.STREAM_ERROR]: z.infer<typeof StreamErrorSchema>;
}

// =============================================================================
// TYPE HELPERS
// =============================================================================

/** Extract request type for a specific channel */
export type AIRequestType<C extends AIInvokeChannel> = C extends keyof AIProviderApi
  ? AIProviderApi[C]['request']
  : never;

/** Extract response type for a specific channel */
export type AIResponseType<C extends AIInvokeChannel> = C extends keyof AIProviderApi
  ? AIProviderApi[C]['response']
  : never;

/** Extract payload type for a streaming channel */
export type AIStreamPayload<C extends AIStreamChannel> = C extends keyof AIStreamApi
  ? AIStreamApi[C]
  : never;

// =============================================================================
// TYPED INVOKE/HANDLE HELPERS
// =============================================================================

/** Type for renderer-side invoke: ipcRenderer.invoke */
export type TypedInvoke = <C extends AIInvokeChannel>(
  channel: C,
  ...args: AIRequestType<C> extends void ? [] : [AIRequestType<C>]
) => Promise<AIResponseType<C>>;

/** Type for main-side handler: ipcMain.handle */
export type TypedHandler<C extends AIInvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: AIRequestType<C> extends void ? [] : [AIRequestType<C>]
) => Promise<AIResponseType<C>>;

/** Type for main-side stream sender: webContents.send */
export type TypedSend<C extends AIStreamChannel> = (payload: AIStreamPayload<C>) => void;

/** Type for renderer-side stream listener: ipcRenderer.on */
export type TypedListener<C extends AIStreamChannel> = (
  event: IpcRendererEvent,
  payload: AIStreamPayload<C>
) => void;

// =============================================================================
// CHANNEL REGISTRY
// =============================================================================

/** Registry entry for an invoke/handle channel */
export interface ChannelRegistryEntry<C extends AIInvokeChannel> {
  readonly channel: C;
  readonly description: string;
}

/** Registry entry for a streaming channel */
export interface StreamChannelRegistryEntry<C extends AIStreamChannel> {
  readonly channel: C;
  readonly description: string;
  readonly direction: 'main-to-renderer';
}

/** Complete channel registry for handler registration */
export const AIChannelRegistry = {
  providerList: { channel: AIChannels.PROVIDER_LIST, description: 'List all configured AI providers' },
  providerAdd: { channel: AIChannels.PROVIDER_ADD, description: 'Add a new AI provider' },
  providerUpdate: { channel: AIChannels.PROVIDER_UPDATE, description: 'Update an AI provider' },
  providerRemove: { channel: AIChannels.PROVIDER_REMOVE, description: 'Remove an AI provider' },
  providerSetActive: { channel: AIChannels.PROVIDER_SET_ACTIVE, description: 'Set the active AI provider' },
  providerValidate: { channel: AIChannels.PROVIDER_VALIDATE, description: 'Validate AI provider credentials' },
  credentialSet: { channel: AIChannels.CREDENTIAL_SET, description: 'Store a credential securely' },
  credentialHas: { channel: AIChannels.CREDENTIAL_HAS, description: 'Check if a credential exists' },
  credentialClear: { channel: AIChannels.CREDENTIAL_CLEAR, description: 'Remove a credential' },
  generateText: { channel: AIChannels.GENERATE_TEXT, description: 'Generate text (non-streaming)' },
  generateStream: { channel: AIChannels.GENERATE_STREAM, description: 'Generate text with streaming' },
  generateEmbed: { channel: AIChannels.GENERATE_EMBED, description: 'Generate text embeddings' },
  generateImage: { channel: AIChannels.GENERATE_IMAGE, description: 'Generate an image' },
  usageQuery: { channel: AIChannels.USAGE_QUERY, description: 'Query usage statistics' },
  usageExport: { channel: AIChannels.USAGE_EXPORT, description: 'Export usage data' },
  usageClear: { channel: AIChannels.USAGE_CLEAR, description: 'Clear usage history' },
  capabilityGet: { channel: AIChannels.CAPABILITY_GET, description: 'Get model capabilities' },
  capabilityListModels: { channel: AIChannels.CAPABILITY_LIST_MODELS, description: 'List available models' },
  capabilityRefresh: { channel: AIChannels.CAPABILITY_REFRESH, description: 'Refresh capability cache' },
} as const satisfies Record<string, ChannelRegistryEntry<AIInvokeChannel>>;

/** Streaming channel registry */
export const AIStreamRegistry = {
  streamChunk: { channel: AIChannels.STREAM_CHUNK, description: 'Stream chunk event', direction: 'main-to-renderer' as const },
  streamComplete: { channel: AIChannels.STREAM_COMPLETE, description: 'Stream completion event', direction: 'main-to-renderer' as const },
  streamError: { channel: AIChannels.STREAM_ERROR, description: 'Stream error event', direction: 'main-to-renderer' as const },
} as const satisfies Record<string, StreamChannelRegistryEntry<AIStreamChannel>>;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/** Get all invoke/handle channel names for handler registration */
export function getInvokeChannels(): readonly AIInvokeChannel[] {
  return Object.values(AIChannelRegistry).map((entry) => entry.channel);
}

/** Get all streaming channel names */
export function getStreamChannels(): readonly AIStreamChannel[] {
  return Object.values(AIStreamRegistry).map((entry) => entry.channel);
}

/** Check if a channel is an AI provider channel */
export function isAIChannel(channel: string): channel is AIChannel {
  return channel.startsWith('mdxpad:ai:');
}

/** Check if a channel is an invoke/handle channel */
export function isInvokeChannel(channel: string): channel is AIInvokeChannel {
  return isAIChannel(channel) &&
    channel !== AIChannels.STREAM_CHUNK &&
    channel !== AIChannels.STREAM_COMPLETE &&
    channel !== AIChannels.STREAM_ERROR;
}

/** Check if a channel is a streaming channel */
export function isStreamChannel(channel: string): channel is AIStreamChannel {
  return channel === AIChannels.STREAM_CHUNK ||
    channel === AIChannels.STREAM_COMPLETE ||
    channel === AIChannels.STREAM_ERROR;
}
