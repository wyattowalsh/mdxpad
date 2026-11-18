/**
 * Heading level and table-of-contents options for Word export.
 */

import { advanceFence } from './markdown-fence';

const HEADING = /^(#{1,6})([ \t]+\S.*)$/;

export function docxHeadingBase(metadata: Record<string, unknown> | undefined): number {
  const value = metadata?.headingBaseLevel;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return 1;
  }
  return Math.min(6, Math.max(1, value));
}

export function docxWantsToc(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.includeToc === true;
}

function mapOutsideFences(content: string, mapLine: (line: string) => string): string {
  let fence: string | null = null;
  return content
    .split('\n')
    .map((line) => {
      const next = advanceFence(line, fence);
      const boundary = fence !== next;
      const inside = fence !== null;
      fence = next;
      return inside || boundary ? line : mapLine(line);
    })
    .join('\n');
}

export function shiftDocxHeadings(content: string, baseLevel: number): string {
  if (baseLevel <= 1) {
    return content;
  }
  const add = baseLevel - 1;
  return mapOutsideFences(content, (line) => {
    const match = HEADING.exec(line);
    const marks = match?.[1];
    const rest = match?.[2];
    if (!marks || !rest) {
      return line;
    }
    return `${'#'.repeat(Math.min(6, marks.length + add))}${rest}`;
  });
}

export function docxTocEntries(content: string): string[] {
  const entries: string[] = [];
  mapOutsideFences(content, (line) => {
    const match = HEADING.exec(line);
    const text = match?.[2]?.trim();
    if (text) {
      entries.push(text);
    }
    return line;
  });
  return entries;
}
