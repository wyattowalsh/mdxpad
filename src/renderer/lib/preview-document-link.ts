import path from 'node:path';

import { openFileFromPath } from '@renderer/lib/open-file-from-path';
import { useDocumentStore } from '@renderer/stores/document-store';

const DOCUMENT_EXTENSION = /\.(md|mdx|markdown|txt)$/i;

function isRelativeDocumentHref(href: string): boolean {
  if (href.length === 0 || href.startsWith('#') || href.includes('\0')) {
    return false;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
    return false;
  }
  const pathPart = href.split('#')[0]?.split('?')[0] ?? '';
  return DOCUMENT_EXTENSION.test(pathPart);
}

/**
 * Resolve a preview link to a document beside the open file.
 * Links that leave that folder, or that are not documents, are ignored.
 */
export function resolvePreviewDocumentLink(
  currentFilePath: string | null,
  href: string
): string | null {
  if (currentFilePath?.includes('/') !== true) {
    return null;
  }
  const trimmed = href.trim();
  if (!isRelativeDocumentHref(trimmed)) {
    return null;
  }
  const pathPart = trimmed.split('#')[0]?.split('?')[0] ?? '';
  const directory = currentFilePath.slice(0, currentFilePath.lastIndexOf('/'));
  const resolved = path.resolve(directory, pathPart);
  const relative = path.relative(directory, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

export function openPreviewDocumentLink(href: string): void {
  const target = resolvePreviewDocumentLink(useDocumentStore.getState().filePath, href);
  if (target) {
    void openFileFromPath(target);
  }
}
