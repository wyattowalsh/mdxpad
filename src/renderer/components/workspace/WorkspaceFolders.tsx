/**
 * Workspace folder list backed by the open workspace model.
 */

import { useCallback, useMemo, useState } from 'react';

import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import { MultiRootPanel } from './MultiRootPanel';
import {
  folderName,
  foldersFromWorkspace,
  projectsInFolderOrder,
  withoutProjectFolder,
  writeFolderExcludes,
} from './workspace-folders';

export function WorkspaceFolders(): React.JSX.Element {
  const model = useWorkspaceStore((state) => state.model);
  const [excludeRevision, setExcludeRevision] = useState(0);
  const folders = useMemo(() => {
    if (!model) {
      return [];
    }
    return foldersFromWorkspace(
      model.workspace.id,
      model.workspace.rootPath,
      model.workspace.name,
      model.projects,
      excludeRevision
    );
  }, [excludeRevision, model]);

  const handleAddFolder = useCallback((folderPath: string) => {
    const current = useWorkspaceStore.getState().model;
    if (!current) {
      void useWorkspaceStore.getState().openWorkspace({ rootPath: folderPath });
      return;
    }
    if (current.projects.some((project) => project.rootPath === folderPath)) {
      return;
    }
    if (current.workspace.rootPath === folderPath) {
      return;
    }
    void useWorkspaceStore.getState().createProject({
      workspaceId: current.workspace.id,
      name: folderName(folderPath),
      rootPath: folderPath,
      documentIds: [],
      activeDocumentId: null,
    });
  }, []);

  const handleRemoveFolder = useCallback((folderPath: string) => {
    const current = useWorkspaceStore.getState().model;
    if (!current) {
      return;
    }
    const next = withoutProjectFolder(current, folderPath);
    if (!next) {
      return;
    }
    void useWorkspaceStore.getState().saveWorkspace({ model: next });
  }, []);

  const handleReorderFolders = useCallback((nextFolders: readonly { path: string }[]) => {
    const current = useWorkspaceStore.getState().model;
    if (!current) {
      return;
    }
    void useWorkspaceStore.getState().saveWorkspace({
      model: { ...current, projects: projectsInFolderOrder(current, nextFolders) },
    });
  }, []);

  return (
    <MultiRootPanel
      folders={folders}
      onAddFolder={handleAddFolder}
      onRemoveFolder={handleRemoveFolder}
      onReorderFolders={handleReorderFolders}
      onUpdateFolder={(folderPath, updates) => {
        const current = useWorkspaceStore.getState().model;
        if (!current || !updates.excludePatterns) {
          return;
        }
        writeFolderExcludes(current.workspace.id, folderPath, updates.excludePatterns);
        setExcludeRevision((revision) => revision + 1);
      }}
    />
  );
}
