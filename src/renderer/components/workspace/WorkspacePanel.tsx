import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@ui/button';
import type { LinkRecord, WorkspaceDocumentId } from '@shared/types/workspace';
import { FILTER_EVENTS } from '@renderer/commands/filter-commands';
import {
  filterBacklinksForQuery,
  selectBacklinksForDocument,
  selectWorkspaceError,
  selectWorkspaceIsLoading,
  selectWorkspaceIsSaving,
  selectWorkspaceLinkSearchQuery,
  selectWorkspaceModel,
  useWorkspaceStore,
} from '@renderer/stores/workspace-store';
import { selectFeatureFlag, useFeatureFlagsStore } from '@renderer/stores/feature-flags-store';
import { ProjectDialog } from './ProjectDialog';
import { WorkspaceFolders } from './WorkspaceFolders';

const EMPTY_BACKLINKS: readonly LinkRecord[] = [];

export interface WorkspacePanelProps {
  readonly rootPath?: string | null;
  readonly activeDocumentId?: WorkspaceDocumentId | null;
  readonly className?: string;
}

export function WorkspacePanel({
  rootPath = null,
  activeDocumentId = null,
  className,
}: WorkspacePanelProps): React.JSX.Element | null {
  const workspaceFeatureEnabled = useFeatureFlagsStore(selectFeatureFlag('workspace'));
  const model = useWorkspaceStore(selectWorkspaceModel);
  const error = useWorkspaceStore(selectWorkspaceError);
  const isLoading = useWorkspaceStore(selectWorkspaceIsLoading);
  const isSaving = useWorkspaceStore(selectWorkspaceIsSaving);
  const linkSearchQuery = useWorkspaceStore(selectWorkspaceLinkSearchQuery);
  const openWorkspace = useWorkspaceStore((state) => state.openWorkspace);
  const getBacklinks = useWorkspaceStore((state) => state.getBacklinks);
  const setLinkSearchQuery = useWorkspaceStore((state) => state.setLinkSearchQuery);
  const clearLinkSearchQuery = useWorkspaceStore((state) => state.clearLinkSearchQuery);

  const rawBacklinks = useWorkspaceStore((state) =>
    activeDocumentId ? selectBacklinksForDocument(activeDocumentId)(state) : EMPTY_BACKLINKS
  );

  const [isProjectDialogOpen, setProjectDialogOpen] = useState(false);
  const backlinkSearchInputRef = useRef<HTMLInputElement | null>(null);
  const loadedRootPath = model?.workspace.rootPath ?? null;
  const workspaceId = model?.workspace.id ?? null;

  useEffect(() => {
    if (!rootPath || loadedRootPath === rootPath) {
      return;
    }
    void openWorkspace({ rootPath });
  }, [rootPath, loadedRootPath, openWorkspace]);

  useEffect(() => {
    if (!workspaceId || !activeDocumentId) {
      return;
    }
    void getBacklinks({ workspaceId, documentId: activeDocumentId });
  }, [workspaceId, activeDocumentId, getBacklinks]);

  useEffect(() => {
    const focusHandler = () => {
      backlinkSearchInputRef.current?.focus();
    };
    const clearHandler = () => {
      clearLinkSearchQuery();
    };

    window.addEventListener(FILTER_EVENTS.focusWorkspaceLinkSearch, focusHandler);
    window.addEventListener(FILTER_EVENTS.clearWorkspaceLinkSearch, clearHandler);
    return () => {
      window.removeEventListener(FILTER_EVENTS.focusWorkspaceLinkSearch, focusHandler);
      window.removeEventListener(FILTER_EVENTS.clearWorkspaceLinkSearch, clearHandler);
    };
  }, [clearLinkSearchQuery]);

  const handleOpenProjectDialog = useCallback(() => {
    setProjectDialogOpen(true);
  }, []);

  const handleCloseProjectDialog = useCallback(() => {
    setProjectDialogOpen(false);
  }, []);

  const handleBacklinkSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setLinkSearchQuery(event.target.value);
    },
    [setLinkSearchQuery]
  );

  const rootPathLabel = useMemo(() => model?.workspace.rootPath ?? rootPath, [model, rootPath]);
  const backlinks = useMemo(
    () => filterBacklinksForQuery(rawBacklinks, linkSearchQuery),
    [rawBacklinks, linkSearchQuery]
  );

  if (!workspaceFeatureEnabled) {
    return null;
  }

  return (
    <section className={className} aria-label="Workspace panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Workspace</h2>
        <Button
          type="button"
          size="sm"
          onClick={handleOpenProjectDialog}
          disabled={!workspaceId || isSaving}
        >
          New Project
        </Button>
      </div>
      <WorkspaceFolders />

      {!rootPathLabel && <p className="text-sm text-muted-foreground">No workspace selected.</p>}

      {rootPathLabel && (
        <div className="mb-4 space-y-1 text-sm">
          <p className="font-medium">{model?.workspace.name ?? 'Loading workspace...'}</p>
          <p className="text-muted-foreground">{rootPathLabel}</p>
        </div>
      )}

      {isLoading && <p className="mb-2 text-sm text-muted-foreground">Loading workspace...</p>}

      {error && (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium">Backlinks</h3>
        <label htmlFor="workspace-backlink-search" className="sr-only">
          Search backlinks
        </label>
        <div className="mb-2 flex items-center gap-2">
          <input
            id="workspace-backlink-search"
            ref={backlinkSearchInputRef}
            type="search"
            value={linkSearchQuery}
            onChange={handleBacklinkSearchChange}
            placeholder="Search backlinks"
            className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
            disabled={!activeDocumentId}
          />
          {linkSearchQuery.length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={clearLinkSearchQuery}>
              Clear
            </Button>
          )}
        </div>
        {!activeDocumentId ? (
          <p className="text-sm text-muted-foreground">Select a document to view backlinks.</p>
        ) : backlinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backlinks yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {backlinks.map((backlink, index) => (
              <li key={`${backlink.sourcePath}-${index}`} className="rounded border px-2 py-1">
                <p>{backlink.sourcePath}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProjectDialog
        isOpen={isProjectDialogOpen}
        workspaceId={workspaceId}
        onClose={handleCloseProjectDialog}
      />
    </section>
  );
}

export default WorkspacePanel;
