import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { cn } from '@shared/lib/utils';
import type { AIInstructionScope } from '@shared/contracts/ai-schemas';
import { Button } from '@ui/button';
import { Label } from '@ui/label';
import { Textarea } from '@ui/textarea';
import {
  useAISessionStore,
  selectAttachedInstructionId,
  selectAttachedPromptId,
  selectError,
  selectInstructions,
  selectIsLoading,
  selectIsStreaming,
  selectPrompts,
  selectSelectedSession,
  selectSessions,
  selectStreamText,
} from '@renderer/stores/ai-session-store';
import { selectFeatureFlag, useFeatureFlagsStore } from '@renderer/stores/feature-flags-store';
import { selectFilePath, useDocumentStore } from '@renderer/stores/document-store';
import { selectWorkspaceModel, useWorkspaceStore } from '@renderer/stores/workspace-store';
import { selectActiveProvider, useAIProviderStore } from '@renderer/features/ai-provider/store';
import {
  INSTRUCTION_LOAD_FAILED_MESSAGE,
  WRITE_ACTION_IDS,
  buildAttachmentLoadOptions,
  buildCreateSessionRequest,
  buildWriteActionPrompt,
  documentAfterWrite,
  buildWritePrompt,
  resolveListedModelId,
  type WriteActionId,
  type WriteInstruction,
} from './build-write-prompt';

const WRITE_ACTION_LABELS: Record<WriteActionId, string> = {
  continue: 'Continue writing',
  rewrite: 'Rewrite',
  summarize: 'Summarize',
  custom: 'Custom',
};

const WORKSPACE_REQUIRED_MESSAGE = 'A workspace is required to create a session.';

export interface AIChatWritePanelProps {
  readonly workspaceId?: string;
  readonly workspaceRootPath?: string;
  readonly projectRootPath?: string;
  readonly instructionScope?: AIInstructionScope;
  readonly className?: string;
}

export function AIChatWritePanel({
  workspaceId,
  workspaceRootPath,
  projectRootPath,
  instructionScope,
  className,
}: AIChatWritePanelProps): React.JSX.Element | null {
  const aiFeatureEnabled = useFeatureFlagsStore(selectFeatureFlag('ai'));

  const sessions = useAISessionStore(selectSessions);
  const selectedSession = useAISessionStore(selectSelectedSession);
  const prompts = useAISessionStore(selectPrompts);
  const instructions = useAISessionStore(selectInstructions);
  const attachedPromptId = useAISessionStore(selectAttachedPromptId);
  const attachedInstructionId = useAISessionStore(selectAttachedInstructionId);
  const isLoading = useAISessionStore(selectIsLoading);
  const isStreaming = useAISessionStore(selectIsStreaming);
  const streamText = useAISessionStore(selectStreamText);
  const error = useAISessionStore(selectError);
  const workspaceModel = useWorkspaceStore(selectWorkspaceModel);
  const activeProvider = useAIProviderStore(selectActiveProvider);
  const documentPath = useDocumentStore(selectFilePath);

  const loadSessions = useAISessionStore((state) => state.loadSessions);
  const loadAttachmentOptions = useAISessionStore((state) => state.loadAttachmentOptions);
  const selectSession = useAISessionStore((state) => state.selectSession);
  const attachPrompt = useAISessionStore((state) => state.attachPrompt);
  const attachInstruction = useAISessionStore((state) => state.attachInstruction);
  const createSession = useAISessionStore((state) => state.createSession);
  const setError = useAISessionStore((state) => state.setError);
  const startStream = useAISessionStore((state) => state.startStream);
  const cancelStream = useAISessionStore((state) => state.cancelStream);

  const [writeAction, setWriteAction] = useState<WriteActionId>('continue');
  const [writeInput, setWriteInput] = useState('');

  const attachmentLoadOptions = useMemo(
    () =>
      buildAttachmentLoadOptions({
        workspaceId,
        workspaceRootPath,
        projectRootPath,
        instructionScope,
        workspaceRootPathFromStore: workspaceModel?.workspace.rootPath,
        documentPath,
      }),
    [
      documentPath,
      instructionScope,
      projectRootPath,
      workspaceId,
      workspaceModel,
      workspaceRootPath,
    ]
  );

  useEffect(() => {
    void loadSessions(workspaceId);
    void loadAttachmentOptions(attachmentLoadOptions);
  }, [attachmentLoadOptions, loadAttachmentOptions, loadSessions, workspaceId]);

  const composedPrompt = useMemo(
    () => buildWriteActionPrompt(writeAction, writeInput),
    [writeAction, writeInput]
  );

  const canTriggerWriteAction =
    selectedSession !== null && composedPrompt.length > 0 && !isLoading && !isStreaming;
  const hasSelectedSession = selectedSession !== null;
  const canCreateSession = workspaceModel !== null && activeProvider?.status === 'connected';

  const handleSessionChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextSessionId = event.target.value || null;
      void selectSession(nextSessionId);
    },
    [selectSession]
  );

  const handlePromptChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextPromptId = event.target.value || null;
      void attachPrompt(nextPromptId);
    },
    [attachPrompt]
  );

  const handleInstructionChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextInstructionId = event.target.value || null;
      void attachInstruction(nextInstructionId);
    },
    [attachInstruction]
  );

  const handleWriteActionChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setWriteAction(event.target.value as WriteActionId);
  }, []);

  const handleCreateSession = useCallback(() => {
    const workspaceIdForCreate = useWorkspaceStore.getState().model?.workspace.id;
    const provider = selectActiveProvider(useAIProviderStore.getState());
    if (!workspaceIdForCreate || provider?.status !== 'connected') {
      return;
    }
    const providerId = provider.id;
    const fileId = useDocumentStore.getState().fileId;

    void (async () => {
      try {
        const listed = await window.mdxpad.ai.listModels(providerId);
        const resolution = resolveListedModelId(listed);
        if (!resolution.ok) {
          setError(resolution.error);
          return;
        }
        await createSession(
          buildCreateSessionRequest({
            workspaceId: workspaceIdForCreate,
            providerId,
            modelId: resolution.modelId,
            fileId,
          })
        );
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to list models for the active provider'
        );
      }
    })();
  }, [createSession, setError]);

  const handleRunAction = useCallback(() => {
    if (!canTriggerWriteAction) {
      return;
    }
    const actionText = composedPrompt;
    const instructionId = attachedInstructionId;

    void (async () => {
      let instruction: WriteInstruction | null = null;
      if (instructionId) {
        try {
          const loaded = await window.mdxpad.ai.loadInstruction(instructionId);
          if (loaded.instruction === null) {
            setError(INSTRUCTION_LOAD_FAILED_MESSAGE);
            return;
          }
          instruction = {
            fileName: loaded.instruction.metadata.fileName,
            content: loaded.instruction.content,
          };
        } catch (loadError: unknown) {
          setError(
            loadError instanceof Error ? loadError.message : INSTRUCTION_LOAD_FAILED_MESSAGE
          );
          return;
        }
      }

      const document = useDocumentStore.getState();
      await startStream({
        prompt: buildWritePrompt(
          actionText,
          document.filePath ?? 'Untitled',
          document.content,
          instruction
        ),
      });
    })();
  }, [attachedInstructionId, canTriggerWriteAction, composedPrompt, setError, startStream]);

  const handleCancelAction = useCallback(() => {
    if (!isStreaming) {
      return;
    }
    void cancelStream();
  }, [cancelStream, isStreaming]);

  if (!aiFeatureEnabled) {
    return null;
  }

  return (
    <section
      className={cn('space-y-4 rounded-md border bg-card p-4 text-card-foreground', className)}
      data-testid="ai-chat-write-panel"
    >
      <div className="space-y-2">
        <Label htmlFor="ai-session-select">AI Session</Label>
        <div className="flex items-center gap-2">
          <select
            id="ai-session-select"
            data-testid="ai-session-select"
            className="flex h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={selectedSession?.id ?? ''}
            onChange={handleSessionChange}
            disabled={isLoading}
          >
            <option value="">Select session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.model} · {session.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            data-testid="ai-create-session-button"
            onClick={handleCreateSession}
            disabled={!canCreateSession}
          >
            New session
          </Button>
        </div>
        {workspaceModel === null && (
          <p data-testid="ai-workspace-required" className="text-sm text-muted-foreground">
            {WORKSPACE_REQUIRED_MESSAGE}
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-prompt-select">Prompt file</Label>
          <select
            id="ai-prompt-select"
            data-testid="ai-prompt-select"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={attachedPromptId ?? ''}
            onChange={handlePromptChange}
            disabled={!hasSelectedSession || isLoading}
          >
            <option value="">No prompt</option>
            {prompts.map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-instruction-select">Instruction file</Label>
          <select
            id="ai-instruction-select"
            data-testid="ai-instruction-select"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={attachedInstructionId ?? ''}
            onChange={handleInstructionChange}
            disabled={!hasSelectedSession || isLoading}
          >
            <option value="">No instruction</option>
            {instructions.map((instruction) => (
              <option key={instruction.id} value={instruction.id}>
                {instruction.fileName} ({instruction.scope})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-write-action-select">Write action</Label>
        <select
          id="ai-write-action-select"
          data-testid="ai-write-action-select"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={writeAction}
          onChange={handleWriteActionChange}
          disabled={!hasSelectedSession || isLoading}
        >
          {WRITE_ACTION_IDS.map((action) => (
            <option key={action} value={action}>
              {WRITE_ACTION_LABELS[action]}
            </option>
          ))}
        </select>

        <Textarea
          data-testid="ai-write-input"
          value={writeInput}
          onChange={(event) => {
            setWriteInput(event.target.value);
          }}
          placeholder="Optional context for this action"
          rows={4}
          disabled={!hasSelectedSession || isLoading}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          data-testid="ai-run-action-button"
          onClick={handleRunAction}
          disabled={!canTriggerWriteAction}
        >
          Run Action
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="ai-cancel-action-button"
          onClick={handleCancelAction}
          disabled={!isStreaming}
        >
          Cancel
        </Button>
      </div>

      {error && (
        <p data-testid="ai-error-message" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {streamText && (
        <div className="space-y-2">
          <pre
            data-testid="ai-stream-output"
            className="max-h-48 overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap"
          >
            {streamText}
          </pre>
          {!isStreaming && (
            <Button
              type="button"
              variant="outline"
              data-testid="ai-insert-result-button"
              onClick={() => {
                const document = useDocumentStore.getState();
                document.setContent(documentAfterWrite(writeAction, document.content, streamText));
              }}
            >
              {writeAction === 'rewrite' ? 'Replace document' : 'Insert into document'}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
