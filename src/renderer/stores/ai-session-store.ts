import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { castDraft } from 'immer';
import type {
  AIPromptFileMetadata,
  AIInstructionFileMetadata,
  AISessionPromptContext,
  AIInstructionScope,
  AIInstructionListRequest,
  AISessionCreateRequest,
  AISessionRestorationMetadata,
} from '@shared/contracts/ai-schemas';
import type { AISession } from '@shared/types/root';
import { editorDocumentKey } from '../lib/editor-document-key';
import { recordLocalTelemetryEvent } from '../lib/telemetry/local-telemetry';
import { useDocumentStore } from './document-store';
import { useTabStore } from './tab-store';

export { editorDocumentKey };

export type AIStreamStatus =
  | 'idle'
  | 'starting'
  | 'streaming'
  | 'completed'
  | 'canceling'
  | 'error';

export interface AIStreamState {
  status: AIStreamStatus;
  streamId: string | null;
  documentKey: string | null;
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
  error: string | null;
}

export interface AISessionState {
  sessions: AISession[];
  selectedSessionId: string | null;
  selectedSession: AISession | null;
  selectedSessionRestoration: AISessionRestorationMetadata | null;
  sessionContexts: Record<string, AISessionPromptContext>;
  selectedSessionContext: AISessionPromptContext | null;
  prompts: AIPromptFileMetadata[];
  instructions: AIInstructionFileMetadata[];
  stream: AIStreamState;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
}

export interface LoadAttachmentOptions {
  workspaceId?: string;
  workspaceRootPath?: string;
  projectRootPath?: string;
  instructionScope?: AIInstructionScope;
  documentPath?: string;
}

export interface StartStreamRequest {
  prompt: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AISessionStoreActions {
  loadSessions: (workspaceId?: string) => Promise<void>;
  createSession: (request: AISessionCreateRequest) => Promise<void>;
  selectSession: (sessionId: string | null) => Promise<void>;
  archiveSession: (sessionId?: string) => Promise<void>;
  loadAttachmentOptions: (options?: LoadAttachmentOptions) => Promise<void>;
  attachPrompt: (promptFileId: string | null) => Promise<void>;
  attachInstruction: (instructionFileId: string | null) => Promise<void>;
  startStream: (request: StartStreamRequest) => Promise<void>;
  cancelStream: () => Promise<void>;
  clearStream: () => void;
  setError: (message: string) => void;
  clearError: () => void;
  reset: () => void;
}

export type AISessionStore = AISessionState & AISessionStoreActions;

const INITIAL_STREAM_STATE: AIStreamState = {
  status: 'idle',
  streamId: null,
  documentKey: null,
  text: '',
  usage: null,
  error: null,
};

const INITIAL_AI_SESSION_STATE: AISessionState = {
  sessions: [],
  selectedSessionId: null,
  selectedSession: null,
  selectedSessionRestoration: null,
  sessionContexts: {},
  selectedSessionContext: null,
  prompts: [],
  instructions: [],
  stream: INITIAL_STREAM_STATE,
  isLoading: false,
  isStreaming: false,
  error: null,
};

interface StreamChunkEvent {
  streamId: string;
  chunk: string;
  isComplete: boolean;
}

interface StreamCompleteEvent {
  streamId: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface StreamErrorEvent {
  streamId: string;
  error: {
    message: string;
  };
}

let sessionListRequestId = 0;
let sessionSelectRequestId = 0;
let streamListenersBound = false;
let removeChunkListener: (() => void) | null = null;
let removeCompleteListener: (() => void) | null = null;
let removeErrorListener: (() => void) | null = null;

function toDefaultContext(sessionId: string): AISessionPromptContext {
  return { sessionId };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function getResponseErrorMessage(error: { message: string } | undefined, fallback: string): string {
  return error?.message ?? fallback;
}

function toInstructionListRequest(
  options: LoadAttachmentOptions
): AIInstructionListRequest | undefined {
  if (
    !options.workspaceId &&
    !options.instructionScope &&
    !options.projectRootPath &&
    !options.workspaceRootPath &&
    !options.documentPath
  ) {
    return undefined;
  }

  return {
    ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
    ...(options.instructionScope ? { scope: options.instructionScope } : {}),
    ...(options.projectRootPath ? { projectRootPath: options.projectRootPath } : {}),
    ...(options.workspaceRootPath ? { workspaceRootPath: options.workspaceRootPath } : {}),
    ...(options.documentPath ? { documentPath: options.documentPath } : {}),
  };
}

function omitRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.entries(record).reduce<Record<string, T>>((next, [entryKey, value]) => {
    if (entryKey !== key) {
      next[entryKey] = value;
    }
    return next;
  }, {});
}

function unbindStreamListeners(): void {
  removeChunkListener?.();
  removeCompleteListener?.();
  removeErrorListener?.();
  removeChunkListener = null;
  removeCompleteListener = null;
  removeErrorListener = null;
  streamListenersBound = false;
}

function bindStreamListeners(
  set: (recipe: (state: AISessionStore) => void) => void,
  get: () => AISessionStore
): void {
  if (streamListenersBound) {
    return;
  }

  removeChunkListener = window.mdxpad.ai.onStreamChunk((event: StreamChunkEvent) => {
    if (get().stream.streamId !== event.streamId) {
      return;
    }

    set((draft) => {
      if (draft.stream.streamId !== event.streamId) {
        return;
      }

      draft.stream.text += event.chunk;
      draft.stream.status = event.isComplete ? 'completed' : 'streaming';
      if (event.isComplete) {
        draft.isStreaming = false;
      }
    });
  });

  removeCompleteListener = window.mdxpad.ai.onStreamComplete((event: StreamCompleteEvent) => {
    if (get().stream.streamId !== event.streamId) {
      return;
    }

    set((draft) => {
      if (draft.stream.streamId !== event.streamId) {
        return;
      }

      draft.stream.status = 'completed';
      draft.stream.usage = event.usage;
      draft.isStreaming = false;
    });
    recordLocalTelemetryEvent('ai', 'stream-complete', 'succeeded', {
      details: {
        totalTokens: event.usage.totalTokens,
      },
    });
  });

  removeErrorListener = window.mdxpad.ai.onStreamError((event: StreamErrorEvent) => {
    if (get().stream.streamId !== event.streamId) {
      return;
    }

    set((draft) => {
      if (draft.stream.streamId !== event.streamId) {
        return;
      }

      draft.stream.status = 'error';
      draft.stream.error = event.error.message;
      draft.isStreaming = false;
    });
    recordLocalTelemetryEvent('ai', 'stream-error', 'failed', {
      details: {
        reason: event.error.message,
      },
    });
  });

  streamListenersBound = true;
}

function buildStreamRequest(
  request: StartStreamRequest,
  context: AISessionPromptContext | null
): StartStreamRequest {
  const fallbackModelId = context?.promptFile?.modelSelection?.modelId;
  const fallbackSystemPrompt = context?.promptFile?.systemPrompt;

  return {
    ...request,
    ...(request.modelId ? {} : fallbackModelId ? { modelId: fallbackModelId } : {}),
    ...(request.systemPrompt
      ? {}
      : fallbackSystemPrompt
        ? { systemPrompt: fallbackSystemPrompt }
        : {}),
  };
}

export const useAISessionStore = create<AISessionStore>()(
  immer((set, get) => ({
    ...INITIAL_AI_SESSION_STATE,

    loadSessions: async (workspaceId?: string) => {
      const requestId = ++sessionListRequestId;
      const selectGeneration = sessionSelectRequestId;
      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const response = await window.mdxpad.ai.listSessions(
          workspaceId ? { workspaceId } : undefined
        );
        if (requestId !== sessionListRequestId) {
          return;
        }
        const activeSessionIdToRestore = response.activeSessionId ?? null;

        set((draft) => {
          draft.sessions = response.sessions;

          if (draft.selectedSessionId) {
            const selected =
              response.sessions.find((session) => session.id === draft.selectedSessionId) ?? null;
            draft.selectedSession = selected;
            if (selected) {
              draft.selectedSessionContext = castDraft(
                draft.sessionContexts[selected.id] ?? toDefaultContext(selected.id)
              );
            } else {
              draft.selectedSessionId = null;
              draft.selectedSessionContext = null;
              draft.selectedSessionRestoration = null;
            }
          }

          draft.isLoading = false;
        });

        if (
          activeSessionIdToRestore !== null &&
          get().selectedSessionId === null &&
          selectGeneration === sessionSelectRequestId
        ) {
          await get().selectSession(activeSessionIdToRestore);
        }
      } catch (error) {
        if (requestId !== sessionListRequestId) {
          return;
        }
        set((draft) => {
          draft.error = getErrorMessage(error, 'Failed to load AI sessions');
          draft.isLoading = false;
        });
      }
    },

    createSession: async (request) => {
      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });
      recordLocalTelemetryEvent('ai', 'create-session', 'started');

      try {
        const response = await window.mdxpad.ai.createSession(request);
        if (response.success && response.session) {
          const session = response.session;
          sessionListRequestId += 1;
          set((draft) => {
            draft.sessions = [
              session,
              ...draft.sessions.filter((existingSession) => existingSession.id !== session.id),
            ];
            draft.selectedSessionId = session.id;
            draft.selectedSession = session;
            const context = toDefaultContext(session.id);
            draft.sessionContexts[session.id] = castDraft(context);
            draft.selectedSessionContext = castDraft(context);
            draft.selectedSessionRestoration = null;
            draft.isLoading = false;
          });
          recordLocalTelemetryEvent('ai', 'create-session', 'succeeded');
          return;
        }

        set((draft) => {
          draft.error = getResponseErrorMessage(response.error, 'Failed to create AI session');
          draft.isLoading = false;
        });
        recordLocalTelemetryEvent('ai', 'create-session', 'failed', {
          details: {
            code: response.error?.code ?? 'UNKNOWN',
          },
        });
      } catch (error) {
        set((draft) => {
          draft.error = getErrorMessage(error, 'Failed to create AI session');
          draft.isLoading = false;
        });
        recordLocalTelemetryEvent('ai', 'create-session', 'failed', {
          details: { code: 'EXCEPTION' },
        });
      }
    },

    selectSession: async (sessionId) => {
      if (sessionId === null) {
        sessionSelectRequestId += 1;
        set((draft) => {
          draft.selectedSessionId = null;
          draft.selectedSession = null;
          draft.selectedSessionContext = null;
          draft.selectedSessionRestoration = null;
          draft.stream = { ...INITIAL_STREAM_STATE };
          draft.isStreaming = false;
        });
        return;
      }

      const requestId = ++sessionSelectRequestId;
      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const response = await window.mdxpad.ai.restoreSession({ sessionId });
        if (requestId !== sessionSelectRequestId) {
          return;
        }
        if (response.session) {
          const session = response.session;
          set((draft) => {
            draft.selectedSessionId = session.id;
            draft.selectedSession = session;
            const context =
              response.context ?? draft.sessionContexts[session.id] ?? toDefaultContext(session.id);
            draft.sessionContexts[session.id] = castDraft(context);
            draft.selectedSessionContext = castDraft(context);
            draft.selectedSessionRestoration = response.restoration ?? null;
            draft.isLoading = false;
          });
          return;
        }

        set((draft) => {
          draft.selectedSessionId = null;
          draft.selectedSession = null;
          draft.selectedSessionContext = null;
          draft.selectedSessionRestoration = null;
          draft.error = 'AI session not found';
          draft.isLoading = false;
        });
      } catch (error) {
        if (requestId !== sessionSelectRequestId) {
          return;
        }
        set((draft) => {
          draft.error = getErrorMessage(error, 'Failed to load AI session');
          draft.isLoading = false;
        });
      }
    },

    archiveSession: async (sessionId) => {
      const targetSessionId = sessionId ?? get().selectedSessionId;
      if (!targetSessionId) {
        set((draft) => {
          draft.error = 'Select an AI session first';
        });
        return;
      }

      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const response = await window.mdxpad.ai.archiveSession({
          sessionId: targetSessionId,
          endedAt: new Date().toISOString(),
        });

        if (response.success) {
          sessionListRequestId += 1;
          set((draft) => {
            draft.sessions = draft.sessions.filter((session) => session.id !== targetSessionId);
            draft.sessionContexts = omitRecordKey(draft.sessionContexts, targetSessionId);
            if (draft.selectedSessionId === targetSessionId) {
              draft.selectedSessionId = null;
              draft.selectedSession = null;
              draft.selectedSessionContext = null;
              draft.selectedSessionRestoration = null;
              draft.stream = { ...INITIAL_STREAM_STATE };
              draft.isStreaming = false;
            }
            draft.isLoading = false;
          });
          return;
        }

        set((draft) => {
          draft.error = getResponseErrorMessage(response.error, 'Failed to archive AI session');
          draft.isLoading = false;
        });
      } catch (error) {
        set((draft) => {
          draft.error = getErrorMessage(error, 'Failed to archive AI session');
          draft.isLoading = false;
        });
      }
    },

    loadAttachmentOptions: async (options = {}) => {
      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const [promptResponse, instructionResponse] = await Promise.all([
          window.mdxpad.ai.listPrompts(
            options.workspaceId || options.workspaceRootPath || options.projectRootPath
              ? {
                  ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
                  ...(options.workspaceRootPath
                    ? { workspaceRootPath: options.workspaceRootPath }
                    : {}),
                  ...(options.projectRootPath ? { projectRootPath: options.projectRootPath } : {}),
                }
              : undefined
          ),
          window.mdxpad.ai.listInstructions(toInstructionListRequest(options)),
        ]);

        set((draft) => {
          draft.prompts = castDraft(promptResponse.prompts);
          draft.instructions = castDraft(instructionResponse.instructions);
          draft.isLoading = false;
        });
      } catch (error) {
        set((draft) => {
          draft.error = getErrorMessage(error, 'Failed to load AI attachments');
          draft.isLoading = false;
        });
      }
    },

    attachPrompt: async (promptFileId) => {
      const sessionId = get().selectedSessionId;
      if (!sessionId) {
        set((draft) => {
          draft.error = 'Select an AI session first';
        });
        return;
      }

      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const response = await window.mdxpad.ai.attachPrompt({ sessionId, promptFileId });
        if (response.success) {
          set((draft) => {
            const context =
              response.context ?? draft.sessionContexts[sessionId] ?? toDefaultContext(sessionId);
            draft.sessionContexts[sessionId] = castDraft(context);
            if (draft.selectedSessionId === sessionId) {
              draft.selectedSessionContext = castDraft(context);
            }
            draft.isLoading = false;
          });
          return;
        }

        set((draft) => {
          draft.error = getResponseErrorMessage(response.error, 'Failed to attach prompt file');
          draft.isLoading = false;
        });
      } catch (error) {
        set((draft) => {
          draft.error = getErrorMessage(error, 'Failed to attach prompt file');
          draft.isLoading = false;
        });
      }
    },

    attachInstruction: async (instructionFileId) => {
      const sessionId = get().selectedSessionId;
      if (!sessionId) {
        set((draft) => {
          draft.error = 'Select an AI session first';
        });
        return;
      }

      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });

      try {
        const response = await window.mdxpad.ai.attachInstruction({
          sessionId,
          instructionFileId,
        });
        if (response.success) {
          set((draft) => {
            const context =
              response.context ?? draft.sessionContexts[sessionId] ?? toDefaultContext(sessionId);
            draft.sessionContexts[sessionId] = castDraft(context);
            if (draft.selectedSessionId === sessionId) {
              draft.selectedSessionContext = castDraft(context);
            }
            draft.isLoading = false;
          });
          return;
        }

        set((draft) => {
          draft.error = getResponseErrorMessage(
            response.error,
            'Failed to attach instruction file'
          );
          draft.isLoading = false;
        });
      } catch (error) {
        set((draft) => {
          draft.error = getErrorMessage(error, 'Failed to attach instruction file');
          draft.isLoading = false;
        });
      }
    },

    startStream: async (request) => {
      const sessionId = get().selectedSessionId;
      if (!sessionId) {
        set((draft) => {
          draft.error = 'Select an AI session first';
        });
        recordLocalTelemetryEvent('ai', 'start-stream', 'failed', {
          details: { code: 'SESSION_REQUIRED' },
        });
        return;
      }

      bindStreamListeners(set, get);

      const streamRequest = buildStreamRequest(request, get().selectedSessionContext);

      set((draft) => {
        draft.stream = {
          ...INITIAL_STREAM_STATE,
          status: 'starting',
          documentKey: editorDocumentKey(
            useDocumentStore.getState().filePath,
            useTabStore.getState().activeTabId
          ),
        };
        draft.isStreaming = true;
        draft.error = null;
      });
      recordLocalTelemetryEvent('ai', 'start-stream', 'started');

      try {
        const response = await window.mdxpad.ai.generateStream(streamRequest);
        const streamId = response.streamId;
        if (response.success && streamId) {
          set((draft) => {
            draft.stream.status = 'streaming';
            draft.stream.streamId = streamId;
            draft.stream.error = null;
            draft.isStreaming = true;
          });
          recordLocalTelemetryEvent('ai', 'start-stream', 'succeeded');
          return;
        }

        unbindStreamListeners(); // Prevent listener leak on stream init failure
        set((draft) => {
          draft.stream.status = 'error';
          draft.stream.error = getResponseErrorMessage(response.error, 'Failed to start stream');
          draft.isStreaming = false;
        });
        recordLocalTelemetryEvent('ai', 'start-stream', 'failed', {
          details: {
            code: response.error?.code ?? 'START_FAILED',
          },
        });
      } catch (error) {
        unbindStreamListeners(); // Prevent listener leak on stream start failure
        set((draft) => {
          draft.stream.status = 'error';
          draft.stream.error = getErrorMessage(error, 'Failed to start stream');
          draft.isStreaming = false;
        });
        recordLocalTelemetryEvent('ai', 'start-stream', 'failed', {
          details: { code: 'EXCEPTION' },
        });
      }
    },

    cancelStream: async () => {
      const streamId = get().stream.streamId;
      if (!streamId) {
        return;
      }

      set((draft) => {
        draft.stream.status = 'canceling';
        draft.stream.error = null;
      });
      recordLocalTelemetryEvent('ai', 'cancel-stream', 'started');

      try {
        const response = await window.mdxpad.ai.cancelStream(streamId);
        if (response.success) {
          set((draft) => {
            draft.stream = { ...INITIAL_STREAM_STATE };
            draft.isStreaming = false;
          });
          recordLocalTelemetryEvent('ai', 'cancel-stream', 'succeeded');
          return;
        }

        set((draft) => {
          draft.stream.status = 'error';
          draft.stream.error = getResponseErrorMessage(response.error, 'Failed to cancel stream');
          draft.isStreaming = false;
        });
        recordLocalTelemetryEvent('ai', 'cancel-stream', 'failed', {
          details: {
            code: response.error?.code ?? 'CANCEL_FAILED',
          },
        });
      } catch (error) {
        set((draft) => {
          draft.stream.status = 'error';
          draft.stream.error = getErrorMessage(error, 'Failed to cancel stream');
          draft.isStreaming = false;
        });
        recordLocalTelemetryEvent('ai', 'cancel-stream', 'failed', {
          details: { code: 'EXCEPTION' },
        });
      }
    },

    clearStream: () =>
      set((draft) => {
        draft.stream = { ...INITIAL_STREAM_STATE };
        draft.isStreaming = false;
      }),

    setError: (message) => {
      set((draft) => {
        draft.error = message;
      });
    },

    clearError: () =>
      set((draft) => {
        draft.error = null;
      }),

    reset: () => {
      sessionListRequestId += 1;
      sessionSelectRequestId += 1;
      unbindStreamListeners();
      set((draft) => {
        draft.sessions = [];
        draft.selectedSessionId = null;
        draft.selectedSession = null;
        draft.selectedSessionRestoration = null;
        draft.sessionContexts = {};
        draft.selectedSessionContext = null;
        draft.prompts = [];
        draft.instructions = [];
        draft.stream = { ...INITIAL_STREAM_STATE };
        draft.isLoading = false;
        draft.isStreaming = false;
        draft.error = null;
      });
    },
  }))
);

export const selectSessions = (state: AISessionStore): AISession[] => state.sessions;
export const selectSelectedSession = (state: AISessionStore): AISession | null =>
  state.selectedSession;
export const selectSelectedSessionRestoration = (
  state: AISessionStore
): AISessionRestorationMetadata | null => state.selectedSessionRestoration;
export const selectSelectedSessionContext = (
  state: AISessionStore
): AISessionPromptContext | null => state.selectedSessionContext;
export const selectPrompts = (state: AISessionStore): AIPromptFileMetadata[] => state.prompts;
export const selectInstructions = (state: AISessionStore): AIInstructionFileMetadata[] =>
  state.instructions;
export const selectAttachedPromptId = (state: AISessionStore): string | null =>
  state.selectedSessionContext?.promptFile?.id ?? null;
export const selectAttachedInstructionId = (state: AISessionStore): string | null =>
  state.selectedSessionContext?.instructionFile?.id ?? null;
export const selectStreamStatus = (state: AISessionStore): AIStreamStatus => state.stream.status;
export const selectStreamText = (state: AISessionStore): string => state.stream.text;
export const selectIsLoading = (state: AISessionStore): boolean => state.isLoading;
export const selectIsStreaming = (state: AISessionStore): boolean => state.isStreaming;
export const selectError = (state: AISessionStore): string | null => state.error;
