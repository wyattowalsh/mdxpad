/**
 * Agent Mode Store
 *
 * Zustand + Immer store managing AI agent conversation state.
 * Tracks messages, tool calls, plan steps, and agent status.
 *
 * @module src/renderer/features/ai-agent/agent-mode-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type {
  AgentMessage,
  AgentToolCall,
  AgentPlanStep,
  AgentStatus,
  AgentStreamEvent,
} from '@shared/contracts/agent-schemas';

// =============================================================================
// STATE
// =============================================================================

export interface AgentModeState {
  messages: AgentMessage[];
  status: AgentStatus;
  planSteps: AgentPlanStep[];
  activeToolCalls: AgentToolCall[];
  error: string | null;
  isListenerBound: boolean;
}

export interface AgentSendContext {
  readonly workspacePath?: string;
  readonly currentFilePath?: string;
}

export interface AgentModeActions {
  sendMessage: (message: string, context?: AgentSendContext) => Promise<void>;
  approveToolCall: (toolCallId: string) => Promise<void>;
  rejectToolCall: (toolCallId: string) => Promise<void>;
  cancel: () => Promise<void>;
  clearConversation: () => void;
  handleStreamEvent: (event: AgentStreamEvent) => void;
  reset: () => void;
}

export type AgentModeStore = AgentModeState & AgentModeActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

function readAgentApi(): NonNullable<Window['mdxpad']['agent']> | null {
  if (typeof window === 'undefined' || !('mdxpad' in window) || !window.mdxpad.agent) {
    return null;
  }
  return window.mdxpad.agent;
}

async function decideToolCall(
  toolCallId: string,
  approved: boolean,
  set: (updater: (draft: AgentModeStore) => void) => void
): Promise<void> {
  try {
    const agent = readAgentApi();
    if (!agent) {
      set((draft) => {
        draft.error = 'Agent is not available';
      });
      return;
    }
    const response = await agent.approveToolCall({ callId: toolCallId, approved });
    if (!response.success) {
      set((draft) => {
        draft.error = response.error?.message ?? 'Write approval was not accepted';
      });
      return;
    }
    set((draft) => {
      const toolCall = draft.activeToolCalls.find((item) => item.id === toolCallId);
      if (toolCall) {
        toolCall.status = approved ? 'approved' : 'rejected';
      }
    });
  } catch (err: unknown) {
    set((draft) => {
      draft.error = err instanceof Error ? err.message : 'Failed to decide the tool call';
    });
  }
}

const INITIAL_STATE: AgentModeState = {
  messages: [],
  status: 'idle',
  planSteps: [],
  activeToolCalls: [],
  error: null,
  isListenerBound: false,
};

// =============================================================================
// STORE
// =============================================================================

export const useAgentModeStore = create<AgentModeStore>()(
  immer((set, _get) => ({
    ...INITIAL_STATE,

    sendMessage: async (message: string, context?: AgentSendContext) => {
      set((draft) => {
        draft.error = null;
        draft.status = 'thinking';
      });

      try {
        const agent = readAgentApi();
        if (!agent) {
          set((draft) => {
            draft.error = 'Agent is not available';
            draft.status = 'error';
          });
          return;
        }
        const response = await agent.sendMessage({
          message,
          ...(context?.workspacePath ? { workspacePath: context.workspacePath } : {}),
          ...(context?.currentFilePath ? { currentFilePath: context.currentFilePath } : {}),
        });
        if (!response.success) {
          set((draft) => {
            draft.error = response.error?.message ?? 'Failed to send message';
            draft.status = 'error';
          });
        }
      } catch (err: unknown) {
        set((draft) => {
          draft.error = err instanceof Error ? err.message : 'Failed to send message';
          draft.status = 'error';
        });
      }
    },

    approveToolCall: async (toolCallId: string) => {
      await decideToolCall(toolCallId, true, set);
    },

    rejectToolCall: async (toolCallId: string) => {
      await decideToolCall(toolCallId, false, set);
    },

    cancel: async () => {
      try {
        if (typeof window !== 'undefined' && 'mdxpad' in window && window.mdxpad.agent) {
          await window.mdxpad.agent.cancel();
        }
        set((draft) => {
          draft.status = 'idle';
        });
      } catch {
        // Cancellation failure is non-critical
      }
    },

    clearConversation: () => {
      if (typeof window !== 'undefined' && 'mdxpad' in window && window.mdxpad.agent) {
        void window.mdxpad.agent.clear();
      }
      set((draft) => {
        draft.messages = [];
        draft.status = 'idle';
        draft.planSteps = [];
        draft.activeToolCalls = [];
        draft.error = null;
      });
    },

    handleStreamEvent: (event: AgentStreamEvent) => {
      set((draft) => {
        switch (event.type) {
          case 'message':
            draft.messages.push(event.message);
            break;
          case 'tool-call':
            draft.activeToolCalls.push(event.toolCall);
            draft.status = 'waiting-for-approval';
            break;
          case 'tool-result': {
            const tc = draft.activeToolCalls.find((t) => t.id === event.toolCallId);
            if (tc) {
              tc.status = 'completed';
              tc.result = event.result;
            }
            break;
          }
          case 'status':
            draft.status = event.status;
            break;
          case 'plan':
            draft.planSteps = event.steps;
            break;
          case 'error':
            draft.error = event.error.message;
            draft.status = 'error';
            break;
          case 'done':
            draft.status = 'idle';
            break;
        }
      });
    },

    reset: () => {
      set(() => ({ ...INITIAL_STATE }));
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectMessages = (state: AgentModeStore): AgentMessage[] => state.messages;
export const selectStatus = (state: AgentModeStore): AgentStatus => state.status;
export const selectPlanSteps = (state: AgentModeStore): AgentPlanStep[] => state.planSteps;
export const selectActiveToolCalls = (state: AgentModeStore): AgentToolCall[] =>
  state.activeToolCalls;
export const selectError = (state: AgentModeStore): string | null => state.error;
export const selectIsThinking = (state: AgentModeStore): boolean => state.status === 'thinking';
export const selectIsExecuting = (state: AgentModeStore): boolean => state.status === 'executing';
export const selectIsWaitingForApproval = (state: AgentModeStore): boolean =>
  state.status === 'waiting-for-approval';
