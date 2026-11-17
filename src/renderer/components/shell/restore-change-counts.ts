import { diffLines } from 'diff';

/** Lines a restore will bring back, and lines it will remove from the current document. */
export function restoreChangeCounts(
  current: string,
  version: string
): { restored: number; removed: number } {
  let restored = 0;
  let removed = 0;
  for (const change of diffLines(current, version)) {
    const lines = change.count;
    if (change.added) {
      restored += lines;
    }
    if (change.removed) {
      removed += lines;
    }
  }
  return { restored, removed };
}
