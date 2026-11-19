/**
 * Directory reads that stop at a symlink instead of leaving the workspace.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { readFileWithoutFollowingLinks } from '@main/services/file-service';

import { resolveWorkspaceFilePath, WorkspacePathError } from './agent-path';

export async function readRealDirectory(dir: string): Promise<fs.Dirent[] | null> {
  let info: fs.Stats;
  try {
    info = await fs.promises.lstat(dir);
  } catch {
    return null;
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    return null;
  }
  return fs.promises.readdir(dir, { withFileTypes: true });
}

export async function collectMatchingFiles(root: string, query: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readRealDirectory(dir);
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
          await walk(full);
        }
        continue;
      }
      if (entry.name.includes(query)) {
        results.push(full);
      }
    }
  }

  await walk(root);
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
    return (
      resolveWorkspaceFilePath(root, requested) === resolveWorkspaceFilePath(root, openPath)
    );
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
