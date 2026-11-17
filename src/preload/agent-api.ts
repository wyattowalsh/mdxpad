/**
 * AI agent preload API.
 *
 * Per Constitution III.3: request and response payloads are validated with zod.
 *
 * @module src/preload/agent-api
 */

import { ipcRenderer } from 'electron';
import { z } from 'zod';

import {
  AgentChannels,
  AgentResponseSchema,
  AgentSendMessageRequestSchema,
  AgentStreamEventSchema,
  AgentToolApprovalRequestSchema,
  type AgentResponse,
  type AgentStreamEvent,
} from '@shared/contracts/agent-schemas';
import { validatedInvoke } from './validated-invoke';

const streamListeners = new Set<(event: AgentStreamEvent) => void>();

ipcRenderer.on(AgentChannels.STREAM_EVENT, (_event, data: unknown) => {
  const validated = AgentStreamEventSchema.safeParse(data);
  if (!validated.success) {
    return;
  }
  for (const listener of streamListeners) {
    listener(validated.data);
  }
});

export interface AgentApi {
  sendMessage(request: z.input<typeof AgentSendMessageRequestSchema>): Promise<AgentResponse>;
  approveToolCall(request: { callId: string; approved: boolean }): Promise<AgentResponse>;
  cancel(): Promise<AgentResponse>;
  clear(): Promise<AgentResponse>;
  onStreamEvent(callback: (event: AgentStreamEvent) => void): () => void;
}

export const agentApi: AgentApi = {
  sendMessage: (request) =>
    validatedInvoke(
      AgentChannels.SEND_MESSAGE,
      AgentSendMessageRequestSchema,
      AgentResponseSchema,
      request
    ),

  approveToolCall: (request) =>
    validatedInvoke(
      AgentChannels.APPROVE_TOOL,
      AgentToolApprovalRequestSchema,
      AgentResponseSchema,
      { toolCallId: request.callId, approved: request.approved }
    ),

  cancel: () => validatedInvoke(AgentChannels.CANCEL, null, AgentResponseSchema, undefined),

  clear: () => validatedInvoke(AgentChannels.CLEAR, null, AgentResponseSchema, undefined),

  onStreamEvent: (callback) => {
    streamListeners.add(callback);
    return () => {
      streamListeners.delete(callback);
    };
  },
};
