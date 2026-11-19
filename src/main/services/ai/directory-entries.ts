/**
 * Directory reads that stop at a symlink instead of leaving the workspace.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { readFileWithoutFollowingLinks } from '@main/services/file-service';

import { resolveWorkspaceFilePath, WorkspacePathError } from './agent-path';

async function directoryInfo(dir: string): Promise<fs.Stats | null> {
  try {
    return await fs.promises.lstat(dir);
  } catch {
    return null;
  }
}

export async function readRealDirectory(dir: string): Promise<fs.Dirent[] | null> {
  const info = await directoryInfo(dir);
  if (info === null || info.isSymbolicLink() || !info.isDirectory()) {
    return null;
  }
  return fs.promises.readdir(dir, { withFileTypes: true });
}

/** Read a folder the user chose, including when that folder itself is a link. */
export async function readChosenDirectory(dir: string): Promise<fs.Dirent[] | null> {
  const info = await directoryInfo(dir);
  if (info === null) {
    return null;
  }
  if (info.isSymbolicLink()) {
    try {
      const followed = await fs.promises.stat(dir);
      if (!followed.isDirectory()) {
        return null;
      }
    } catch {
      return null;
    }
    return fs.promises.readdir(dir, { withFileTypes: true });
  }
  if (!info.isDirectory()) {
    return null;
  }
  return fs.promises.readdir(dir, { withFileTypes: true });
}

export async function collectMatchingFiles(root: string, query: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string, chosenRoot: boolean): Promise<void> {
    const entries = chosenRoot ? await readChosenDirectory(dir) : await readRealDirectory(dir);
    if (!entries) {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await walk(full, false);
        }
        continue;
      }
      if (entry.name.includes(query)) {
        results.push(full);
      }
    }
  }

  await walk(root, true);
  return results;
}

export async function readWorkspaceFile(workspacePath: string, filePath: string): Promise<string> {
  const resolved = resolveWorkspaceFilePath(workspacePath, filePath);
  const result = await readFileWithoutFollowingLinks(resolved);
  if (!result.ok) {
    const missing = result.error.code === 'NOT_FOUND';
    throw new WorkspacePathError(missing ? 'File not found' : 'Path is outside the workspace');
  }
  return result.value;
}

function sameWorkspaceFile(root: string, requested: string, openPath: string): boolean {
  try {
    return resolveWorkspaceFilePath(root, requested) === resolveWorkspaceFilePath(root, openPath);
  } catch {
    return false;
  }
}

export interface OpenEditorFile {
  readonly path: string;
  readonly content: string;
}

/** Editor text for an open file. Every other path stays on disk. */
export async function readAgentFile(
  workspacePath: string,
  filePath: string,
  openFiles?: readonly OpenEditorFile[]
): Promise<string> {
  for (const openFile of openFiles ?? []) {
    if (sameWorkspaceFile(workspacePath, filePath, openFile.path)) {
      return openFile.content;
    }
  }
  return readWorkspaceFile(workspacePath, filePath);
}
