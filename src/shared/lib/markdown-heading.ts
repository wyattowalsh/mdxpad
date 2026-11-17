export interface AtxHeading {
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6;
  readonly text: string;
}

const ATX_HEADING = /^(#{1,6})[ \t]+(.*)$/;

function isHeadingDepth(value: number): value is AtxHeading['depth'] {
  return value >= 1 && value <= 6;
}

/** Drop a CommonMark closing hash run, such as the final `#` in `Title #`. */
export function stripAtxClosingHashes(raw: string): string {
  const trimmed = raw.trim();
  if (/^#+$/.test(trimmed)) {
    return '';
  }
  return trimmed.replace(/[ \t]+#+[ \t]*$/, '').trim();
}

/** Read an ATX heading and ignore a closing run of hashes. */
export function parseAtxHeading(line: string): AtxHeading | null {
  const match = ATX_HEADING.exec(line.trim());
  const marks = match?.[1];
  if (!marks || !isHeadingDepth(marks.length)) {
    return null;
  }
  const text = stripAtxClosingHashes(match[2] ?? '');
  if (text.length === 0) {
    return null;
  }
  return { depth: marks.length, text };
}
