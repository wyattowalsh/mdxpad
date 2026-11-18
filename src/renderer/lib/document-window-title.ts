/** The text shown in the window title for the open document. */
export function documentWindowTitle(fileName: string, isDirty: boolean): string {
  const name = fileName.trim().length > 0 ? fileName.trim() : 'Untitled';
  return `${isDirty ? '• ' : ''}${name} — MDXPad`;
}
