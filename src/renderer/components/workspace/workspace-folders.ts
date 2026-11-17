/**
 * Map workspace projects to the multi-root folder list and choose a folder
 * with the native directory dialog.
 */

import type { Project, WorkspaceModel } from '@shared/types/workspace';
import type { WorkspaceFolder } from './MultiRootPanel';

const EXCLUDE_STORAGE_KEY = 'mdxpad:workspace-folder-excludes';

function excludeStorageKey(workspaceId: string, folderPath: string): string {
  return `${workspaceId}\n${folderPath}`;
}

function readExcludeStore(): Record<string, unknown> {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(EXCLUDE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function readFolderExcludes(workspaceId: string, folderPath: string): readonly string[] {
  const value = readExcludeStore()[excludeStorageKey(workspaceId, folderPath)];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export function writeFolderExcludes(
  workspaceId: string,
  folderPath: string,
  patterns: readonly string[]
): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const store = readExcludeStore();
  store[excludeStorageKey(workspaceId, folderPath)] = patterns;
  localStorage.setItem(EXCLUDE_STORAGE_KEY, JSON.stringify(store));
}

export function folderName(folderPath: string): string {
  const parts = folderPath.split('/').filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? folderPath;
}

export function foldersFromWorkspace(
  workspaceId: string,
  rootPath: string,
  rootName: string,
  projects: readonly Pick<Project, 'rootPath' | 'name'>[],
  _revision = 0
): WorkspaceFolder[] {
  const folders: WorkspaceFolder[] = [
    {
      path: rootPath,
      name: rootName,
      excludePatterns: readFolderExcludes(workspaceId, rootPath),
    },
  ];
  for (const project of projects) {
    if (folders.some((folder) => folder.path === project.rootPath)) {
      continue;
    }
    folders.push({
      path: project.rootPath,
      name: project.name,
      excludePatterns: readFolderExcludes(workspaceId, project.rootPath),
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
