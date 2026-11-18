/**
 * Recovery files that were written before the manifest could record them.
 */

import { DocumentIdSchema, type DocumentId } from '@shared/contracts/autosave-schemas';

const MANIFEST_FILE = 'manifest.json';

export function orphanRecoveryIds(
  names: readonly string[],
  known: ReadonlySet<string>
): DocumentId[] {
  const ids: DocumentId[] = [];
  for (const name of names) {
    if (!name.endsWith('.json') || name === MANIFEST_FILE) {
      continue;
    }
    const parsed = DocumentIdSchema.safeParse(name.slice(0, -'.json'.length));
    if (parsed.success && !known.has(parsed.data)) {
      ids.push(parsed.data);
    }
  }
  return ids;
}
