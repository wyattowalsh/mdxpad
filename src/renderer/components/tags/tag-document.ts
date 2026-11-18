/**
 * Tags follow the open document, including an untitled tab.
 */

export function tagDocumentKey(filePath: string | null, activeTabId: string | null): string | null {
  if (filePath) {
    return filePath;
  }
  if (activeTabId) {
    return `untitled:${activeTabId}`;
  }
  return null;
}
