/**
 * Match a file path against saved folder exclude patterns.
 */

import { isAbsolute, relative, sep } from 'node:path';

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pathMatchesExclude(
  root: string,
  filePath: string,
  patterns: readonly string[]
): boolean {
  const rel = relative(root, filePath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return false;
  }
  const segments = rel.split(sep).filter((segment) => segment.length > 0);
  for (const raw of patterns) {
    const pattern = raw.trim();
    if (pattern.length === 0) {
      continue;
    }
    if (pattern.includes('*')) {
      const expression = new RegExp(`^${pattern.split('*').map(escapePattern).join('.*')}$`);
      if (segments.some((segment) => expression.test(segment))) {
        return true;
      }
    } else if (segments.includes(pattern)) {
      return true;
    }
  }
  return false;
}
