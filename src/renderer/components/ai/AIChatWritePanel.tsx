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

const WRITE_ACTION_PROMPTS = {
  continue: 'Continue writing from the current document context.',
  rewrite: 'Rewrite the selected content for clarity and readability.',
  summarize: 'Summarize the selected content into concise key points.',
  custom: '',
} as const;

type WriteActionId = keyof typeof WRITE_ACTION_PROMPTS;

const WRITE_ACTION_LABELS: Record<WriteActionId, string> = {
  continue: 'Continue writing',
  rewrite: 'Rewrite',
  summarize: 'Summarize',
  custom: 'Custom',
};

export interface AIChatWritePanelProps {
  readonly workspaceId?: string;
  readonly workspaceRootPath?: string;
  readonly projectRootPath?: string;
  readonly instructionScope?: AIInstructionScope;
  readonly className?: string;
}

function buildWriteActionPrompt(action: WriteActionId, input: string): string {
  const basePrompt = WRITE_ACTION_PROMPTS[action];
  const trimmedInput = input.trim();
  if (!basePrompt) {
    return trimmedInput;
  }
  return trimmedInput.length > 0 ? `${basePrompt}\n\n${trimmedInput}` : basePrompt;
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

  const loadSessions = useAISessionStore((state) => state.loadSessions);
  const loadAttachmentOptions = useAISessionStore((state) => state.loadAttachmentOptions);
  const selectSession = useAISessionStore((state) => state.selectSession);
  const attachPrompt = useAISessionStore((state) => state.attachPrompt);
  const attachInstruction = useAISessionStore((state) => state.attachInstruction);
  const startStream = useAISessionStore((state) => state.startStream);
  const cancelStream = useAISessionStore((state) => state.cancelStream);

  const [writeAction, setWriteAction] = useState<WriteActionId>('continue');
  const [writeInput, setWriteInput] = useState('');

  const attachmentLoadOptions = useMemo(() => {
    if (!workspaceId && !workspaceRootPath && !projectRootPath && !instructionScope) {
      return undefined;
    }
    return {
      ...(workspaceId ? { workspaceId } : {}),
      ...(workspaceRootPath ? { workspaceRootPath } : {}),
      ...(projectRootPath ? { projectRootPath } : {}),
      ...(instructionScope ? { instructionScope } : {}),
    };
  }, [instructionScope, projectRootPath, workspaceId, workspaceRootPath]);

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

  const handleRunAction = useCallback(() => {
    if (!canTriggerWriteAction) {
      return;
    }
    void startStream({ prompt: composedPrompt });
  }, [canTriggerWriteAction, composedPrompt, startStream]);

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
        <select
          id="ai-session-select"
          data-testid="ai-session-select"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
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
          {Object.keys(WRITE_ACTION_LABELS).map((actionKey) => {
            const action = actionKey as WriteActionId;
            return (
              <option key={action} value={action}>
                {WRITE_ACTION_LABELS[action]}
              </option>
            );
          })}
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
        <pre
          data-testid="ai-stream-output"
          className="max-h-48 overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap"
        >
          {streamText}
        </pre>
      )}
    </section>
  );
}
