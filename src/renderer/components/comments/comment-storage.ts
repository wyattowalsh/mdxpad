/**
 * Remember comment threads for a saved file.
 */

import type { CommentThread } from '@renderer/stores/comments-store';

const STORAGE_KEY = 'mdxpad:comment-threads';

function isThread(value: unknown): value is CommentThread {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.anchorFrom === 'number' &&
    typeof record.anchorTo === 'number' &&
    typeof record.resolved === 'boolean' &&
    typeof record.createdAt === 'number' &&
    Array.isArray(record.messages)
  );
}

function readStore(): Record<string, unknown> {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

export function readCommentThreads(filePath: string): CommentThread[] {
  const value = readStore()[filePath];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isThread);
}

export function writeCommentThreads(filePath: string, threads: readonly CommentThread[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const store = readStore();
  store[filePath] = threads;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
