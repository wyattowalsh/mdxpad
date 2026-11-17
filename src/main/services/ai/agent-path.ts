/**
 * Workspace path jail for agent file tools.
 *
 * @module src/main/services/ai/agent-path
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspacePathError';
  }
}

function leavesRoot(relative: string): boolean {
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

function isInsideRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative.length === 0 || !leavesRoot(relative);
}

function canonicalRoot(workspaceRoot: string): string {
  const resolved = path.resolve(workspaceRoot);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

/**
 * Resolve a requested path inside a workspace root.
 * Rejects absolute escapes and symlink ancestors that leave the root.
 */
export function resolveWorkspaceFilePath(
  workspaceRoot: string,
  requestedPath: string,
  options?: { readonly allowRoot?: boolean }
): string {
  if (workspaceRoot.trim().length === 0) {
    throw new WorkspacePathError('Workspace path is required');
  }

  const root = canonicalRoot(workspaceRoot);
  const candidate = path.resolve(root, requestedPath);
  const relative = path.relative(root, candidate);
  if (relative.length === 0) {
    if (options?.allowRoot !== true) {
      throw new WorkspacePathError('Path is outside the workspace');
    }
    return root;
  }
  if (leavesRoot(relative)) {
    throw new WorkspacePathError('Path is outside the workspace');
  }

  const segments = relative.split(path.sep).filter((segment) => segment.length > 0);
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === undefined || segment === '.' || segment === '..') {
      throw new WorkspacePathError('Path is outside the workspace');
    }
    const next = path.join(current, segment);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(next);
    } catch {
      const missing = path.join(next, ...segments.slice(index + 1));
      if (!isInsideRoot(root, missing)) {
        throw new WorkspacePathError('Path is outside the workspace');
      }
      return missing;
    }
    if (stat.isSymbolicLink()) {
      const real = fs.realpathSync(next);
      if (!isInsideRoot(root, real)) {
        throw new WorkspacePathError('Path is outside the workspace');
      }
      current = real;
      continue;
    }
    current = next;
  }

  return current;
}
