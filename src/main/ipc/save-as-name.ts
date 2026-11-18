import * as path from 'node:path';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx', '.markdown']);

/**
 * Name shown in the Save As dialog.
 * A suggested document becomes `name-recovered.ext`. An ordinary save stays `untitled.mdx`.
 */
export function saveAsDefaultPath(suggestedName?: string): string {
  const trimmed = suggestedName?.trim() ?? '';
  if (trimmed.length === 0) {
    return 'untitled.mdx';
  }

  const base = path.basename(trimmed);
  if (base.length === 0 || base === '.' || base === '..') {
    return 'untitled-recovered.mdx';
  }

  const parsed = path.parse(base);
  const stem = parsed.name.trim().length > 0 ? parsed.name.trim() : 'untitled';
  const extension = MARKDOWN_EXTENSIONS.has(parsed.ext.toLowerCase()) ? parsed.ext : '.mdx';
  return `${stem}-recovered${extension}`;
}
