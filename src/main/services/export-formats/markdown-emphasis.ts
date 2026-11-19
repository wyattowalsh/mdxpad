import { flanking } from '@shared/lib/emphasis-flank';
import { mathDelimiterAt, mathSpanEnd } from '@shared/lib/math-span';

import { readCodeSpan } from './markdown-escape';
import { linkedDollarSpan } from './markdown-linked-math';
import { readMarkdownTarget } from './markdown-link';

export { canOpenEmphasis, canOpenStrikethrough } from '@shared/lib/emphasis-flank';

interface DelimiterRun {
  char: '*' | '_';
  start: number;
  length: number;
  canOpen: boolean;
  canClose: boolean;
}

export interface EmphasisMatch {
  readonly start: number;
  readonly end: number;
  readonly size: 1 | 2;
}

function readInlineMath(value: string, index: number): number {
  const delimiter = mathDelimiterAt(value, index);
  return delimiter === null ? -1 : mathSpanEnd(value, index, delimiter);
}

function collectRuns(value: string): DelimiterRun[] {
  const runs: DelimiterRun[] = [];
  let index = 0;
  while (index < value.length) {
    const code = value[index] === '`' ? readCodeSpan(value, index) : null;
    if (code) {
      index = code.end;
      continue;
    }
    const mathEnd = value[index] === '$' ? readInlineMath(value, index) : -1;
    if (mathEnd !== -1) {
      index = mathEnd;
      continue;
    }
    const linked = value[index] === '$' ? linkedDollarSpan(value, index) : null;
    if (linked) {
      index = linked.end;
      continue;
    }
    if (value[index] === '!' || value[index] === '[') {
      const link = readMarkdownTarget(value, index);
      if (link?.start === index) {
        index = link.end;
        continue;
      }
    }
    const char = value[index];
    if (char === '*' || char === '_') {
      let length = 1;
      while (value[index + length] === char) {
        length += 1;
      }
      const sides = flanking(value, index, length, char);
      runs.push({ char, start: index, length, ...sides });
      index += length;
      continue;
    }
    index += 1;
  }
  return runs;
}

function canMatch(open: DelimiterRun, close: DelimiterRun): boolean {
  if (open.char !== close.char || !open.canOpen || open.length === 0 || close.length === 0) {
    return false;
  }
  const mixed = open.canClose || close.canOpen;
  const sum = open.length + close.length;
  return !mixed || sum % 3 !== 0 || (open.length % 3 === 0 && close.length % 3 === 0);
}

function matchRuns(runs: readonly DelimiterRun[]): EmphasisMatch[] {
  const stack: DelimiterRun[] = [];
  const found: EmphasisMatch[] = [];
  for (const run of runs) {
    if (run.canClose) {
      let index = stack.length - 1;
      while (index >= 0 && run.length > 0) {
        const open = stack[index];
        if (!open || !canMatch(open, run)) {
          index -= 1;
          continue;
        }
        const size: 1 | 2 = open.length >= 2 && run.length >= 2 ? 2 : 1;
        found.push({ start: open.start + open.length - size, end: run.start + size, size });
        open.length -= size;
        run.start += size;
        run.length -= size;
        stack.splice(index + 1, stack.length - index - 1);
        if (open.length === 0) {
          stack.splice(index, 1);
          index -= 1;
        }
      }
    }
    if (run.length > 0 && run.canOpen) {
      stack.push(run);
    }
  }
  return found;
}

function outermost(matches: readonly EmphasisMatch[], from: number, to: number): EmphasisMatch[] {
  return matches
    .filter((match) => match.start >= from && match.end <= to)
    .filter(
      (match) =>
        !matches.some(
          (other) =>
            other !== match &&
            other.start <= match.start &&
            other.end >= match.end &&
            other.start >= from &&
            other.end <= to
        )
    )
    .sort((left, right) => left.start - right.start);
}

function renderRange(
  value: string,
  from: number,
  to: number,
  matches: readonly EmphasisMatch[],
  renderText: (text: string) => string,
  wrap: (size: 1 | 2, inner: string) => string
): string {
  let html = '';
  let cursor = from;
  for (const match of outermost(matches, from, to)) {
    html += renderText(value.slice(cursor, match.start));
    const inner = renderRange(
      value,
      match.start + match.size,
      match.end - match.size,
      matches,
      renderText,
      wrap
    );
    html += wrap(match.size, inner);
    cursor = match.end;
  }
  return html + renderText(value.slice(cursor, to));
}

export function collectEmphasis(value: string): EmphasisMatch[] {
  return matchRuns(collectRuns(value));
}

export function outerEmphasisMatches(
  matches: readonly EmphasisMatch[],
  from: number,
  to: number
): EmphasisMatch[] {
  return outermost(matches, from, to);
}

function htmlWrap(size: 1 | 2, inner: string): string {
  return size === 2 ? `<strong>${inner}</strong>` : `<em>${inner}</em>`;
}

/** Render CommonMark emphasis, leaving code spans and links for the text renderer. */
export function renderEmphasis(
  value: string,
  renderText: (text: string) => string,
  wrap: (size: 1 | 2, inner: string) => string = htmlWrap
): string {
  const matches = collectEmphasis(value);
  if (matches.length === 0) {
    return renderText(value);
  }
  return renderRange(value, 0, value.length, matches, renderText, wrap);
}
