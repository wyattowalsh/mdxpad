/**
 * AI Agent IPC Schemas
 *
 * Zod schemas for validating IPC payloads in the AI agent system.
 * Per Constitution Article III Section 3.3: All payloads validated with zod on both ends.
 *
 * @module src/shared/contracts/agent-schemas
 */

import { z } from 'zod';

// =============================================================================
// AGENT STATUS
// =============================================================================

export const AgentStatusSchema = z.enum([
  'idle',
  'thinking',
  'executing',
  'waiting-for-approval',
  'error',
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

// =============================================================================
// TOOL CALL SCHEMAS
// =============================================================================

export const AgentToolCallSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()),
  status: z.enum(['pending', 'approved', 'rejected', 'completed', 'error']),
  result: z.string().optional(),
  error: z.string().optional(),
});
export type AgentToolCall = z.infer<typeof AgentToolCallSchema>;

// =============================================================================
// MESSAGE SCHEMAS
// =============================================================================

export const AgentMessageRoleSchema = z.enum(['user', 'assistant', 'tool']);

export const AgentMessageSchema = z.object({
  id: z.string(),
  role: AgentMessageRoleSchema,
  content: z.string(),
  toolCalls: z.array(AgentToolCallSchema).optional(),
  timestamp: z.string().datetime(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

// =============================================================================
// PLAN STEP SCHEMAS
// =============================================================================

export const AgentPlanStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'in-progress', 'completed', 'failed']),
});
export type AgentPlanStep = z.infer<typeof AgentPlanStepSchema>;

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

/**
 * Request to send a message to the agent.
 */
export const AgentSendMessageRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  workspacePath: z.string().optional(),
  currentFilePath: z.string().optional(),
  openFileContent: z.string().max(8_000_000).optional(),
});
export type AgentSendMessageRequest = z.infer<typeof AgentSendMessageRequestSchema>;

/**
 * Request to approve or reject a tool call.
 */
export const AgentToolApprovalRequestSchema = z.object({
  toolCallId: z.string(),
  approved: z.boolean(),
});
export type AgentToolApprovalRequest = z.infer<typeof AgentToolApprovalRequestSchema>;

/**
 * Response for agent operations.
 */
export const AgentResponseSchema = z.object({
  success: z.boolean(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// =============================================================================
// STREAMING EVENT SCHEMAS
// =============================================================================

export const AgentStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message'),
    message: AgentMessageSchema,
  }),
  z.object({
    type: z.literal('tool-call'),
    toolCall: AgentToolCallSchema,
  }),
  z.object({
    type: z.literal('tool-result'),
    toolCallId: z.string(),
    result: z.string(),
  }),
  z.object({
    type: z.literal('status'),
    status: AgentStatusSchema,
  }),
  z.object({
    type: z.literal('plan'),
    steps: z.array(AgentPlanStepSchema),
  }),
  z.object({
    type: z.literal('error'),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
  z.object({
    type: z.literal('done'),
  }),
]);
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

// =============================================================================
// IPC CHANNELS
// =============================================================================

export const AgentChannels = {
  SEND_MESSAGE: 'mdxpad:agent:send-message',
  APPROVE_TOOL: 'mdxpad:agent:approve-tool',
  CANCEL: 'mdxpad:agent:cancel',
  CLEAR: 'mdxpad:agent:clear',
  STREAM_EVENT: 'mdxpad:agent:stream-event',
} as const;

export type AgentChannel = (typeof AgentChannels)[keyof typeof AgentChannels];
