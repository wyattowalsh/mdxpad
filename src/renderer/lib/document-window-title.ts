/** The text shown in the window title for the open document. */
export function documentWindowTitle(
  fileName: string,
  isDirty: boolean,
  fileMissing = false
): string {
  const name = fileName.trim().length > 0 ? fileName.trim() : 'Untitled';
  if (fileMissing) {
    return `${name} (deleted) — MDXPad`;
  }
  return `${isDirty ? '• ' : ''}${name} — MDXPad`;
}
