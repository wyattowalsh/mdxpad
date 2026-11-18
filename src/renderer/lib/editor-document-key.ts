/** Identity for the document currently shown in the editor. */
export function editorDocumentKey(filePath: string | null, activeTabId: string | null): string {
  if (filePath) {
    return filePath;
  }
  if (activeTabId) {
    return `untitled:${activeTabId}`;
  }
  return 'untitled:new';
}
