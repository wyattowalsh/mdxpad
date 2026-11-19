import { isCurrencySpan } from '@shared/lib/currency-span';

import { readCodeSpan } from './markdown-escape';
import { readMarkdownTarget } from './markdown-link';

const PUNCTUATION = /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/;

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

function whitespace(char: string): boolean {
  return char.length === 0 || /\s/.test(char);
}

function flanking(
  value: string,
  index: number,
  length: number,
  char: '*' | '_'
): {
  canOpen: boolean;
  canClose: boolean;
} {
  const before = index === 0 ? '' : (value[index - 1] ?? '');
  const after = value[index + length] ?? '';
  const beforePunct = PUNCTUATION.test(before);
  const afterPunct = PUNCTUATION.test(after);
  const left = !whitespace(after) && (!afterPunct || whitespace(before) || beforePunct);
  const right = !whitespace(before) && (!beforePunct || whitespace(after) || afterPunct);
  if (char === '*') {
    return { canOpen: left, canClose: right };
  }
  return {
    canOpen: left && (!right || beforePunct),
    canClose: right && (!left || afterPunct),
  };
}

function readInlineMath(value: string, index: number): number {
  if (index > 0 && value[index - 1] === '\\') {
    return -1;
  }
  const delimiter = value.startsWith('$$', index) ? '$$' : value[index] === '$' ? '$' : '';
  if (delimiter.length === 0) {
    return -1;
  }
  const end = value.indexOf(delimiter, index + delimiter.length);
  if (end === -1) {
    return -1;
  }
  const interior = value.slice(index + delimiter.length, end);
  if (interior.length === 0 || isCurrencySpan(interior)) {
    return -1;
  }
  return end + delimiter.length;
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
