import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/dialog';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import {
  selectWorkspaceError,
  selectWorkspaceIsSaving,
  useWorkspaceStore,
} from '@renderer/stores/workspace-store';

export interface ProjectDialogProps {
  readonly isOpen: boolean;
  readonly workspaceId: string | null;
  readonly onClose: () => void;
}

export function ProjectDialog({
  isOpen,
  workspaceId,
  onClose,
}: ProjectDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');

  const isSaving = useWorkspaceStore(selectWorkspaceIsSaving);
  const error = useWorkspaceStore(selectWorkspaceError);
  const createProject = useWorkspaceStore((state) => state.createProject);
  const clearError = useWorkspaceStore((state) => state.clearError);

  const isSubmitDisabled = useMemo(
    () =>
      workspaceId === null || name.trim().length === 0 || rootPath.trim().length === 0 || isSaving,
    [workspaceId, name, rootPath, isSaving]
  );

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setRootPath('');
      clearError();
    }
  }, [isOpen, clearError]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!workspaceId) {
        return;
      }

      const response = await createProject({
        workspaceId,
        name: name.trim(),
        rootPath: rootPath.trim(),
        documentIds: [],
        activeDocumentId: null,
      });

      if (response.ok) {
        setName('');
        setRootPath('');
        onClose();
      }
    },
    [workspaceId, createProject, name, rootPath, onClose]
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="workspace-project-dialog">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>Create a workspace project rooted at a folder path.</DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-project-name">Project name</Label>
            <Input
              id="workspace-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-project-root-path">Project root path</Label>
            <Input
              id="workspace-project-root-path"
              value={rootPath}
              onChange={(event) => setRootPath(event.target.value)}
              placeholder="/path/to/project"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {isSaving ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectDialog;
