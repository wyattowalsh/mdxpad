/**
 * Map workspace projects to the multi-root folder list and choose a folder
 * with the native directory dialog.
 */

import type { Project, WorkspaceModel } from '@shared/types/workspace';
import type { WorkspaceFolder } from './MultiRootPanel';

export function folderName(folderPath: string): string {
  const parts = folderPath.split('/').filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? folderPath;
}

export function foldersFromWorkspace(
  rootPath: string,
  rootName: string,
  projects: readonly Pick<Project, 'rootPath' | 'name'>[]
): WorkspaceFolder[] {
  const folders: WorkspaceFolder[] = [{ path: rootPath, name: rootName, excludePatterns: [] }];
  for (const project of projects) {
    if (folders.some((folder) => folder.path === project.rootPath)) {
      continue;
    }
    folders.push({
      path: project.rootPath,
      name: project.name,
      excludePatterns: [],
    });
  }
  return folders;
}

export function projectsInFolderOrder(
  model: WorkspaceModel,
  folders: readonly { readonly path: string }[]
): Project[] {
  const byPath = new Map(model.projects.map((project) => [project.rootPath, project]));
  const ordered: Project[] = [];
  for (const folder of folders) {
    const project = byPath.get(folder.path);
    if (project && !ordered.includes(project)) {
      ordered.push(project);
    }
  }
  for (const project of model.projects) {
    if (!ordered.includes(project)) {
      ordered.push(project);
    }
  }
  return ordered;
}

export function withoutProjectFolder(
  model: WorkspaceModel,
  folderPath: string
): WorkspaceModel | null {
  if (folderPath === model.workspace.rootPath) {
    return null;
  }
  const projects = model.projects.filter((project) => project.rootPath !== folderPath);
  if (projects.length === model.projects.length) {
    return null;
  }
  return { ...model, projects };
}

export async function chooseWorkspaceFolder(): Promise<string | null> {
  const share =
    typeof window !== 'undefined' && 'mdxpad' in window ? window.mdxpad.share : undefined;
  if (!share) {
    return null;
  }
  const result = await share.chooseDirectory();
  if (result.canceled || result.path === null) {
    return null;
  }
  return result.path;
}
