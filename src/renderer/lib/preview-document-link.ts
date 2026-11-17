import { openFileFromPath } from '@renderer/lib/open-file-from-path';
import { resolveInsideDirectory } from '@renderer/lib/resolve-beside-file';
import { useDocumentStore } from '@renderer/stores/document-store';

const DOCUMENT_EXTENSION = /\.(md|mdx|markdown|txt)$/i;

function documentPathFromHref(href: string): string | null {
  if (href.length === 0 || href.startsWith('#') || href.includes('\0')) {
    return null;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
    return null;
  }
  const pathPart = href.split('#')[0]?.split('?')[0] ?? '';
  let decoded = pathPart;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || !DOCUMENT_EXTENSION.test(decoded)) {
    return null;
  }
  return decoded;
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
  const pathPart = documentPathFromHref(href.trim());
  if (pathPart === null) {
    return null;
  }
  const directory = currentFilePath.slice(0, currentFilePath.lastIndexOf('/'));
  return resolveInsideDirectory(directory, pathPart);
}

export function openPreviewDocumentLink(href: string): void {
  const target = resolvePreviewDocumentLink(useDocumentStore.getState().filePath, href);
  if (target) {
    void openFileFromPath(target);
  }
}
