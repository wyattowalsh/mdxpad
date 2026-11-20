/**
 * Column positions for tabs in Markdown block structure.
 * A tab advances to the next multiple of four, and a quote marker
 * already occupies a column before that tab is measured.
 */

const TAB = 0x09;
const SPACE = 0x20;
const GREATER = 0x3e;

interface MarkedLine {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly shift: number;
  readonly columns: number;
  readonly base: number;
}

interface PeeledQuotes {
  readonly line: MarkedLine;
  readonly depth: number;
  readonly lead: string;
  readonly indentHasTab: boolean;
}

export interface QuotedCode {
  readonly prefix: string;
  readonly body: string;
}

export interface ListMarkerCode {
  readonly marker: string;
  readonly column: number;
  readonly body: string;
  readonly removed: number;
}

function markLine(text: string): MarkedLine {
  let shift = 0;
  let columns = 0;
  while (shift < text.length) {
    const code = text.charCodeAt(shift);
    if (code === SPACE) {
      columns += 1;
    } else if (code === TAB) {
      columns += 4 - (columns % 4);
    } else {
      break;
    }
    shift += 1;
  }
  return { text, start: 0, end: text.length, shift, columns, base: 0 };
}

function peelOne(line: MarkedLine): MarkedLine | null {
  if (line.columns >= 4) {
    return null;
  }
  let pos = line.start + line.shift;
  if (pos >= line.end || line.text.charCodeAt(pos) !== GREATER) {
    return null;
  }
  pos += 1;
  let initial = line.columns + 1;
  let adjustTab = false;
  let spaceAfter = false;
  const next = line.text.charCodeAt(pos);
  if (next === SPACE) {
    pos += 1;
    initial += 1;
    spaceAfter = true;
  } else if (next === TAB) {
    spaceAfter = true;
    if ((line.base + initial) % 4 === 3) {
      pos += 1;
      initial += 1;
    } else {
      adjustTab = true;
    }
  }
  const contentStart = pos;
  let offset = initial;
  while (pos < line.end) {
    const code = line.text.charCodeAt(pos);
    if (code === TAB) {
      offset += 4 - ((offset + line.base + (adjustTab ? 1 : 0)) % 4);
    } else if (code === SPACE) {
      offset += 1;
    } else {
      break;
    }
    pos += 1;
  }
  return {
    text: line.text,
    start: contentStart,
    end: line.end,
    shift: pos - contentStart,
    columns: offset - initial,
    base: line.columns + 1 + (spaceAfter ? 1 : 0),
  };
}

function peelQuotes(text: string): PeeledQuotes {
  const lead = /^ {0,3}/.exec(text)?.[0] ?? '';
  let line = markLine(text);
  let depth = 0;
  let indentHasTab = false;
  let seen = 0;
  while (line.columns < 4) {
    const next = peelOne(line);
    if (!next) {
      break;
    }
    if (text.slice(seen, next.start + next.shift).includes('\t')) {
      indentHasTab = true;
    }
    seen = next.start + next.shift;
    line = next;
    depth += 1;
  }
  return { line, depth, lead, indentHasTab };
}

function codeText(line: MarkedLine, indent: number): string | null {
  if (line.columns < indent || line.start + line.shift >= line.end) {
    return null;
  }
  let lineIndent = 0;
  let first = line.start;
  while (first < line.end && lineIndent < indent) {
    const code = line.text.charCodeAt(first);
    if (code === TAB) {
      lineIndent += 4 - ((lineIndent + line.base) % 4);
    } else if (code === SPACE) {
      lineIndent += 1;
    } else if (first - line.start < line.shift) {
      lineIndent += 1;
    } else {
      break;
    }
    first += 1;
  }
  const extra = lineIndent > indent ? ' '.repeat(lineIndent - indent) : '';
  return extra + line.text.slice(first, line.end);
}

/** Drop a leading column count, leaving a tab that starts after that indent unchanged. */
export function dedentColumns(line: string, count: number): string {
  let index = 0;
  let column = 0;
  while (index < line.length && column < count) {
    const code = line.charCodeAt(index);
    if (code === TAB) {
      const width = 4 - (column % 4);
      if (column + width > count) {
        return `${' '.repeat(column + width - count)}${line.slice(index + 1)}`;
      }
      column += width;
    } else if (code === SPACE) {
      column += 1;
    } else {
      return line.slice(index);
    }
    index += 1;
  }
  return line.slice(index);
}

function leadingColumns(line: string): number {
  let column = 0;
  for (const char of line) {
    const code = char.charCodeAt(0);
    if (code === SPACE) {
      column += 1;
    } else if (code === TAB) {
      column += 4 - (column % 4);
    } else {
      break;
    }
  }
  return column;
}

/** The text of an indented code line once `minimum` columns have been removed. */
export function indentedBlockBody(line: string, minimum: number): string | null {
  if (line.trim().length === 0 || leadingColumns(line) < minimum) {
    return null;
  }
  return dedentColumns(line, minimum);
}

/** Indented code after one or more quote markers, measured from the marker column. */
export function quotedIndentedCode(text: string): QuotedCode | null {
  const peeled = peelQuotes(text);
  if (peeled.depth === 0 || peeled.line.columns < 4) {
    return null;
  }
  const body = codeText(peeled.line, 4);
  if (body === null || body.trim().length === 0) {
    return null;
  }
  return { prefix: `${peeled.lead}${'> '.repeat(peeled.depth)}`, body };
}

/** A quote whose indent tab is not a code block, written back with the marker column removed. */
export function quoteTabParagraph(text: string): string | null {
  if (!text.includes('\t')) {
    return null;
  }
  const peeled = peelQuotes(text);
  if (!peeled.indentHasTab || peeled.depth === 0) {
    return null;
  }
  const content = text.slice(peeled.line.start + peeled.line.shift, peeled.line.end);
  return `${peeled.lead}${'> '.repeat(peeled.depth)}${content}`;
}

function markerEnd(text: string, pos: number): number {
  const code = text.charCodeAt(pos);
  if (code === 0x2d || code === 0x2b || code === 0x2a) {
    return pos + 1;
  }
  if (code < 0x30 || code > 0x39) {
    return -1;
  }
  let cursor = pos;
  while (cursor < text.length && text.charCodeAt(cursor) >= 0x30 && text.charCodeAt(cursor) <= 0x39) {
    if (cursor - pos >= 9) {
      return -1;
    }
    cursor += 1;
  }
  const closer = text.charCodeAt(cursor);
  return closer === 0x2e || closer === 0x29 ? cursor + 1 : -1;
}

function skipMarkerSpace(text: string, pos: number, offset: number, base: number): { pos: number; offset: number } | null {
  let cursor = pos;
  let column = offset;
  let moved = false;
  while (cursor < text.length) {
    const code = text.charCodeAt(cursor);
    if (code === TAB) {
      column += 4 - ((column + base) % 4);
    } else if (code === SPACE) {
      column += 1;
    } else {
      break;
    }
    moved = true;
    cursor += 1;
  }
  return moved && cursor < text.length ? { pos: cursor, offset: column } : null;
}

function listCodeFrom(line: MarkedLine): ListMarkerCode | null {
  if (line.columns >= 4) {
    return null;
  }
  const markerStart = line.start + line.shift;
  const posAfterMarker = markerEnd(line.text, markerStart);
  if (posAfterMarker < 0) {
    return null;
  }
  const after = line.text.charCodeAt(posAfterMarker);
  if (after !== SPACE && after !== TAB) {
    return null;
  }
  const initial = line.columns + posAfterMarker - markerStart;
  const spaced = skipMarkerSpace(line.text, posAfterMarker, initial, line.base);
  if (!spaced || spaced.offset - initial <= 4) {
    return null;
  }
  const column = initial + 1;
  const body = codeText(
    {
      text: line.text,
      start: line.start,
      end: line.end,
      shift: spaced.pos - line.start,
      columns: spaced.offset,
      base: line.base,
    },
    column + 4
  );
  if (body === null) {
    return null;
  }
  const marker = `${' '.repeat(line.columns)}${line.text.slice(markerStart, posAfterMarker)}`;
  return { marker, column, body, removed: column + 4 };
}

/** A list marker whose following tab is wide enough to open a code block. */
export function listMarkerCode(text: string): ListMarkerCode | null {
  return listCodeFrom(markLine(text));
}

export interface QuoteListFence {
  readonly opener: string;
  readonly prefix: string;
  readonly body: string;
  readonly removed: number;
}

/** A quoted list marker that opens with a tab wide enough for code. */
export function quoteListFence(text: string): QuoteListFence | null {
  const peeled = peelQuotes(text);
  if (peeled.depth === 0) {
    return null;
  }
  const found = listCodeFrom(peeled.line);
  if (!found) {
    return null;
  }
  const prefix = `${peeled.lead}${'> '.repeat(peeled.depth)}`;
  return { opener: `${prefix}${found.marker} \`\`\``, prefix, body: found.body, removed: found.removed };
}

function fenceToken(lines: readonly string[]): string {
  let longest = 0;
  for (const line of lines) {
    for (const run of line.match(/`+/g) ?? []) {
      longest = Math.max(longest, run.length);
    }
  }
  return '`'.repeat(Math.max(3, longest + 1));
}

/** Another line of a quoted list's code block. Null when the block has ended. */
export function quoteListCodeLine(text: string, prefix: string, removed: number): string | null {
  if (text === prefix || text === prefix.trimEnd()) {
    return '';
  }
  const peeled = peelQuotes(text);
  const sameQuote = `${peeled.lead}${'> '.repeat(peeled.depth)}` === prefix;
  if (!sameQuote || peeled.depth === 0) {
    return null;
  }
  return codeText(peeled.line, removed);
}

/** The finished quoted list fence, including every code line gathered so far. */
export function renderQuoteListFence(openerMarker: string, prefix: string, bodies: readonly string[]): string[] {
  const token = fenceToken(bodies);
  const opener = openerMarker.replace(/`{3,}$/, token);
  return [opener, ...bodies.map((body) => `${prefix}${body}`), `${prefix}${token}`];
}
