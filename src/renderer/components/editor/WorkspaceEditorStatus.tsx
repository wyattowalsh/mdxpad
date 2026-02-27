import { memo, useCallback, useMemo } from 'react';
import { cn } from '@shared/lib/utils';
import type { LinkRecord, WorkspaceDocumentId, WorkspaceModel } from '@shared/types/workspace';
import { selectFilePath, useDocumentStore } from '@renderer/stores/document-store';
import {
  selectBacklinksForDocument,
  selectWorkspaceError,
  selectWorkspaceIsLoading,
  selectWorkspaceIsSaving,
  selectWorkspaceModel,
  useWorkspaceStore,
} from '@renderer/stores/workspace-store';
import { selectFeatureFlag, useFeatureFlagsStore } from '@renderer/stores/feature-flags-store';

const EMPTY_BACKLINKS: LinkRecord[] = [];

export interface WorkspaceEditorStatusProps {
  readonly className?: string;
}

function findActiveWorkspaceDocumentId(
  model: WorkspaceModel | null,
  filePath: string | null
): WorkspaceDocumentId | null {
  if (!model) {
    return null;
  }

  if (filePath) {
    const matchedDocument = model.workspace.documents.find(
      (document) => document.filePath === filePath
    );
    if (matchedDocument) {
      return matchedDocument.id;
    }
  }

  return model.workspace.activeDocumentId;
}

function findProjectNameForDocument(
  model: WorkspaceModel | null,
  documentId: WorkspaceDocumentId | null
): string | null {
  if (!model || !documentId) {
    return null;
  }

  const project = model.projects.find(
    (candidate) =>
      candidate.activeDocumentId === documentId || candidate.documentIds.includes(documentId)
  );
  return project?.name ?? null;
}

function WorkspaceEditorStatusComponent({
  className,
}: WorkspaceEditorStatusProps): React.JSX.Element | null {
  const workspaceFeatureEnabled = useFeatureFlagsStore(selectFeatureFlag('workspace'));
  const model = useWorkspaceStore(selectWorkspaceModel);
  const error = useWorkspaceStore(selectWorkspaceError);
  const isLoading = useWorkspaceStore(selectWorkspaceIsLoading);
  const isSaving = useWorkspaceStore(selectWorkspaceIsSaving);
  const getBacklinks = useWorkspaceStore((state) => state.getBacklinks);
  const clearError = useWorkspaceStore((state) => state.clearError);
  const filePath = useDocumentStore(selectFilePath);

  const activeDocumentId = useMemo(
    () => findActiveWorkspaceDocumentId(model, filePath),
    [model, filePath]
  );
  const projectName = useMemo(
    () => findProjectNameForDocument(model, activeDocumentId),
    [model, activeDocumentId]
  );
  const workspaceId = model?.workspace.id ?? null;

  const backlinks = useWorkspaceStore((state) =>
    activeDocumentId ? selectBacklinksForDocument(activeDocumentId)(state) : EMPTY_BACKLINKS
  );

  const canRefreshBacklinks = workspaceId !== null && activeDocumentId !== null && !isLoading;
  const hasWorkspaceContext =
    workspaceFeatureEnabled && (model !== null || error !== null || isLoading || isSaving);

  const statusLabel = useMemo(() => {
    if (error) {
      return 'Workspace error';
    }
    if (isLoading) {
      return 'Loading workspace';
    }
    if (isSaving) {
      return 'Saving workspace';
    }
    return 'Workspace ready';
  }, [error, isLoading, isSaving]);

  const projectLabel = useMemo(() => {
    if (!model) {
      return 'No active workspace';
    }
    if (!activeDocumentId) {
      return 'No active document';
    }
    return projectName ?? 'Unassigned';
  }, [model, activeDocumentId, projectName]);
  const backlinkLabel = useMemo(
    () => `${backlinks.length} backlink${backlinks.length === 1 ? '' : 's'}`,
    [backlinks.length]
  );

  const handleRefreshBacklinks = useCallback(() => {
    if (!canRefreshBacklinks || !workspaceId || !activeDocumentId) {
      return;
    }

    void getBacklinks({
      workspaceId,
      documentId: activeDocumentId,
    });
  }, [canRefreshBacklinks, workspaceId, activeDocumentId, getBacklinks]);

  const handleDismissError = useCallback(() => {
    clearError();
  }, [clearError]);

  if (!hasWorkspaceContext) {
    return null;
  }

  return (
    <div
      className={cn(
        'h-7 border-t border-border bg-muted/40 px-3',
        'flex items-center justify-between gap-3 text-xs text-muted-foreground',
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="workspace-editor-status"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground"
          data-testid="workspace-editor-status-label"
        >
          {statusLabel}
        </span>
        {model && (
          <span className="truncate" data-testid="workspace-editor-workspace-name">
            {model.workspace.name}
          </span>
        )}
        <span className="truncate" data-testid="workspace-editor-project-context">
          Project: {projectLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span data-testid="workspace-editor-backlink-count">{backlinkLabel}</span>
        <button
          type="button"
          onClick={handleRefreshBacklinks}
          disabled={!canRefreshBacklinks}
          className={cn(
            'rounded border border-border px-2 py-0.5 text-xs transition-colors',
            'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
          )}
          data-testid="workspace-editor-refresh-backlinks"
        >
          Refresh backlinks
        </button>
        {error && (
          <>
            <span className="truncate text-destructive" data-testid="workspace-editor-error">
              {error.message}
            </span>
            <button
              type="button"
              onClick={handleDismissError}
              className="rounded border border-destructive/30 px-2 py-0.5 text-destructive hover:bg-destructive/10"
              data-testid="workspace-editor-dismiss-error"
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export const WorkspaceEditorStatus = memo(WorkspaceEditorStatusComponent);
WorkspaceEditorStatus.displayName = 'WorkspaceEditorStatus';
