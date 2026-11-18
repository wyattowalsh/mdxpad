/**
 * Ask before discarding unsaved editor text.
 * Returns true when the caller should continue.
 */
export function checkDirtyState(): boolean {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }

  return window.confirm('You have unsaved changes. Continue without saving?');
}
