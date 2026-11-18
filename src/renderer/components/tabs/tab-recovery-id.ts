/**
 * Stable recovery ids for untitled tabs.
 * A saved file uses its own file id. An untitled tab must not reuse that id.
 */

const recoveryIds = new Map<string, string>();

export function recoveryDocumentId(
  tabId: string,
  createId: () => string = () => crypto.randomUUID()
): string {
  const existing = recoveryIds.get(tabId);
  if (existing) {
    return existing;
  }
  const created = createId();
  recoveryIds.set(tabId, created);
  return created;
}

export function autosaveDocumentId(input: {
  readonly fileId: string | null;
  readonly activeTabId: string | null;
  readonly previousId: string | null;
}): string {
  if (input.fileId) {
    return input.fileId;
  }
  if (input.activeTabId) {
    return recoveryDocumentId(input.activeTabId);
  }
  return input.previousId ?? crypto.randomUUID();
}
