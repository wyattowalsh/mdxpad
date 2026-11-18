/**
 * Recovery ids have to be UUIDs. A file path is not an id.
 * The same path keeps the same id for the life of the window.
 */

import type { DocumentId } from '@shared/types/document';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const idsByPath = new Map<string, DocumentId>();

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function documentIdForPath(filePath: string, currentId?: string | null): DocumentId {
  const existing = idsByPath.get(filePath);
  if (existing) {
    return existing;
  }
  const created = (
    currentId && isUuid(currentId) ? currentId : crypto.randomUUID()
  ) as DocumentId;
  idsByPath.set(filePath, created);
  return created;
}
