/**
 * A `$...$` formula that contains a markdown link.
 * The ordinary closer stops at the link so a price cannot swallow it.
 * A formula that starts with a price still stops there.
 */

import { isCurrencySpan } from '@shared/lib/currency-span';

import { readCodeSpan } from './markdown-escape';
import { readMarkdownTarget } from './markdown-link';
import { mathDelimiterAt } from './markdown-math-span';

export type LinkedDollarPart =
  | { readonly kind: 'math'; readonly tex: string }
  | { readonly kind: 'link'; readonly text: string };

export interface LinkedDollarSpan {
  readonly end: number;
  readonly parts: readonly LinkedDollarPart[];
}

function escapedDollar(raw: string, index: number): boolean {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && raw[cursor] === '\\'; cursor -= 1) {
    count += 1;
  }
  return count % 2 === 1;
}

function pushMath(parts: LinkedDollarPart[], tex: string): void {
  if (tex.length > 0) {
    parts.push({ kind: 'math', tex });
  }
}

function finishLinkedDollar(
  raw: string,
  mathStart: number,
  cursor: number,
  parts: LinkedDollarPart[]
): LinkedDollarSpan {
  pushMath(parts, raw.slice(mathStart, cursor));
  return { end: cursor + 1, parts };
}

/** The `$...$` span at `index` when a link sits inside it, otherwise null. */
export function linkedDollarSpan(raw: string, index: number): LinkedDollarSpan | null {
  if (mathDelimiterAt(raw, index) !== '$') {
    return null;
  }
  const parts: LinkedDollarPart[] = [];
  let cursor = index + 1;
  let sawLink = false;
  let mathStart = index + 1;
  while (cursor < raw.length) {
    const code = readCodeSpan(raw, cursor);
    if (code) {
      if (raw.slice(cursor, code.end).includes('$')) {
        return null;
      }
      cursor = code.end;
      continue;
    }
    const link = readMarkdownTarget(raw, cursor);
    if (link?.start === cursor) {
      if (!sawLink && isCurrencySpan(raw.slice(index + 1, cursor))) {
        return null;
      }
      pushMath(parts, raw.slice(mathStart, cursor));
      parts.push({ kind: 'link', text: raw.slice(link.start, link.end) });
      sawLink = true;
      cursor = link.end;
      mathStart = cursor;
      continue;
    }
    if (raw[cursor] === '$' && !escapedDollar(raw, cursor)) {
      return sawLink ? finishLinkedDollar(raw, mathStart, cursor, parts) : null;
    }
    cursor += raw[cursor] === '\\' ? 2 : 1;
  }
  return null;
}
