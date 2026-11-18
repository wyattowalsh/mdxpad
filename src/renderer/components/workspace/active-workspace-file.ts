import type { WorkspaceModel } from '@shared/types/workspace';

const pendingSaves = new Set<string>();

function isInsideWorkspaceRoot(rootPath: string, filePath: string): boolean {
  const root = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath;
  if (root.length === 0 || !filePath.startsWith(`${root}/`)) {
    return false;
  }
  const relative = filePath.slice(root.length + 1);
  return relative.length > 0 && !relative.split('/').includes('..');
}

function fileTitle(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  const name = slash === -1 ? filePath : filePath.slice(slash + 1);
  return name.length > 0 ? name : 'Untitled';
}

/**
 * Point the workspace at the open file.
 * Returns null when the file is already active or sits outside the workspace.
 */
export function withActiveWorkspaceFile(
  model: WorkspaceModel,
  filePath: string,
  now = new Date().toISOString(),
  createId: () => string = () => crypto.randomUUID()
): WorkspaceModel | null {
  if (!isInsideWorkspaceRoot(model.workspace.rootPath, filePath)) {
    return null;
  }

  const existing = model.workspace.documents.find((document) => document.filePath === filePath);
  if (existing?.id === model.workspace.activeDocumentId) {
    return null;
  }

  const document = existing ?? {
    id: createId(),
    title: fileTitle(filePath),
    filePath,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  const documents = existing
    ? model.workspace.documents
    : [...model.workspace.documents, document];

  return {
    ...model,
    workspace: {
      ...model.workspace,
      documents,
      activeDocumentId: document.id,
      updatedAt: now,
    },
  };
}

/** Save the open file as the active document once, even if two panels ask together. */
export function scheduleActiveWorkspaceFile(
  model: WorkspaceModel,
  filePath: string,
  save: (model: WorkspaceModel) => Promise<unknown>
): void {
  const key = `${model.workspace.id}\0${filePath}`;
  if (pendingSaves.has(key)) {
    return;
  }
  const next = withActiveWorkspaceFile(model, filePath);
  if (!next) {
    return;
  }
  pendingSaves.add(key);
  void save(next).finally(() => {
    pendingSaves.delete(key);
  });
}
