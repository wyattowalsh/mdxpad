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

/** Remove emphasis and link markers so a heading slug matches its visible words. */
export function stripHeadingMarkup(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}

/** Slug used by editor anchor checks, preview headings, and exported HTML. */
export function headingSlug(value: string): string {
  const normalized = stripHeadingMarkup(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/_/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'section';
}

/** Return the next unique slug, using `intro`, then `intro-1`. */
export function allocateHeadingSlug(value: string, counts: Map<string, number>): string {
  const base = headingSlug(value);
  const seen = counts.get(base) ?? 0;
  counts.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen}`;
}

export function headingTag(depth: number, innerHtml: string, slug: string): string {
  return `<h${depth} id="${slug}">${innerHtml}</h${depth}>`;
}

/** The slug inside a `#intro` link, when it can be used as a heading label. */
export function headingAnchor(destination: string): string | null {
  const fragment = destination.startsWith('#') ? destination.slice(1) : '';
  return /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(fragment) ? fragment : null;
}

/** The heading id a `#Two` or `#Hello World` link should open. */
export function normalizedHeadingFragment(destination: string): string | null {
  const trimmed = destination.trim();
  if (!trimmed.startsWith('#')) {
    return null;
  }
  let fragment = trimmed.slice(1);
  try {
    fragment = decodeURIComponent(fragment);
  } catch {
    return null;
  }
  if (fragment.length === 0) {
    return null;
  }
  return headingSlug(fragment);
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
