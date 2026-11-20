/**
 * Remark-math only opens display math when `$$` starts a line.
 * A paragraph that ends with `$$` is the same formula once a later line closes it.
 */

import { displayMathPrefix } from './math-span';
import { PREVIEW_DOLLAR } from './preview-math-dollars';

interface PromotedBlock {
  readonly lines: readonly string[];
  readonly next: number;
}

const QUOTE_LINE = /^\s{0,3}>\s?(.*)$/;
const LIST_ITEM = /^( *)([-*+]|\d+[.)])[ \t]+(.*)$/;

function fenceMarker(line: string): string | null {
  return /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1] ?? null;
}

function closesFence(line: string, marker: string): boolean {
  const char = marker.startsWith('`') ? '`' : '~';
  return new RegExp(`^ {0,3}${char}{${String(marker.length)},}[ \\t]*$`).test(line);
}

function structuralLine(line: string): boolean {
  if (line.trim().length === 0) {
    return false;
  }
  return (
    /^ {0,3}>/.test(line) ||
    /^ {0,3}#{1,6}(?:\s|$)/.test(line) ||
    /^ {0,3}(?:[-*+]|\d+[.)])\s/.test(line) ||
    /^ {0,3}(`{3,}|~{3,}|([-*_])(?:\s*\2){2,})\s*$/.test(line)
  );
}

function plainCloser(lines: readonly string[], start: number): number {
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '$$') {
      return index;
    }
    if (structuralLine(line)) {
      return -1;
    }
  }
  return -1;
}

/** A later `$$` closes `Text $$` when no heading, list, quote, or fence starts first. */
export function displayPrefixCloses(lines: readonly string[], start: number): boolean {
  return plainCloser(lines, start) !== -1;
}

/** A later line that is only `$$` closes a display fence. */
export function displayFenceCloses(lines: readonly string[], start: number): boolean {
  for (let index = start; index < lines.length; index += 1) {
    if ((lines[index] ?? '').trim() === '$$') {
      return true;
    }
  }
  return false;
}

function takePlain(lines: readonly string[], index: number): PromotedBlock | null {
  const line = lines[index] ?? '';
  if (line.startsWith(' ') || line.startsWith('\t') || structuralLine(line)) {
    return null;
  }
  const prefix = displayMathPrefix(line);
  if (prefix === null) {
    return null;
  }
  const closer = plainCloser(lines, index + 1);
  if (closer === -1) {
    return null;
  }
  return {
    lines: [prefix, '', '$$', ...lines.slice(index + 1, closer), '$$'],
    next: closer + 1,
  };
}

function takeQuote(lines: readonly string[], index: number): PromotedBlock | null {
  const line = lines[index] ?? '';
  const match = QUOTE_LINE.exec(line);
  const body = match?.[1] ?? '';
  const prefix = match && !LIST_ITEM.test(body) ? displayMathPrefix(body.trimStart()) : null;
  if (!match || prefix === null) {
    return null;
  }
  const marker = line.slice(0, line.length - body.length);
  const bodyLines: string[] = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const current = lines[cursor] ?? '';
    const quoted = QUOTE_LINE.exec(current);
    const inner = quoted?.[1] ?? '';
    if (!quoted) {
      return null;
    }
    if (inner.trim() === '$$') {
      return {
        lines: [`${marker}${prefix}`, `${marker}$$`, ...bodyLines, current],
        next: cursor + 1,
      };
    }
    bodyLines.push(current);
  }
  return null;
}

function listParts(line: string): { indent: string; opener: string; text: string } | null {
  const match = LIST_ITEM.exec(line.replaceAll('\t', '    '));
  if (!match) {
    return null;
  }
  const text = match[3] ?? '';
  const normalized = line.replaceAll('\t', '    ');
  return {
    indent: ' '.repeat((match[1]?.length ?? 0) + (match[2]?.length ?? 1) + 1),
    opener: normalized.slice(0, normalized.length - text.length),
    text,
  };
}

function takeList(lines: readonly string[], index: number): PromotedBlock | null {
  const parsed = listParts(lines[index] ?? '');
  const prefix = parsed && !/^\[[ xX]\](?:\s|$)/.test(parsed.text) ? displayMathPrefix(parsed.text) : null;
  if (!parsed || prefix === null) {
    return null;
  }
  const body: string[] = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? '';
    if (line.trim().length === 0) {
      body.push(line);
      continue;
    }
    if (!line.startsWith(parsed.indent)) {
      return null;
    }
    if (line.trim() === '$$') {
      return {
        lines: [`${parsed.opener}${prefix}`, `${parsed.indent}$$`, ...body, line],
        next: cursor + 1,
      };
    }
    const lead = displayMathPrefix(line.trim());
    if (lead !== null) {
      return {
        lines: [
          `${parsed.opener}${prefix}`,
          `${parsed.indent}$$`,
          ...body,
          `${parsed.indent}${lead}`,
          `${parsed.indent}$$`,
        ],
        next: cursor + 1,
      };
    }
    body.push(line);
  }
  return null;
}

function promotedBlock(lines: readonly string[], index: number): PromotedBlock | null {
  const line = lines[index] ?? '';
  if (/^\s{0,3}>/.test(line)) {
    return takeQuote(lines, index);
  }
  if (LIST_ITEM.test(line.replaceAll('\t', '    '))) {
    return takeList(lines, index);
  }
  return takePlain(lines, index);
}

/** Rewrite `Text $$` ... `$$` into a paragraph plus a display fence. */
export function promoteTrailingDisplayMath(value: string): string {
  const lines = value.split('\n');
  const out: string[] = [];
  let index = 0;
  let codeFence: string | null = null;
  let mathFence = false;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (codeFence) {
      out.push(line);
      if (closesFence(line, codeFence)) {
        codeFence = null;
      }
      index += 1;
      continue;
    }
    const opened = !mathFence ? fenceMarker(line) : null;
    if (opened) {
      codeFence = opened;
      out.push(line);
      index += 1;
      continue;
    }
    if (line.trim() === '$$') {
      if (!mathFence && !displayFenceCloses(lines, index + 1)) {
        out.push(line.replaceAll('$', PREVIEW_DOLLAR));
        index += 1;
        continue;
      }
      mathFence = !mathFence;
      out.push(line);
      index += 1;
      continue;
    }
    const promoted = mathFence ? null : promotedBlock(lines, index);
    if (promoted) {
      out.push(...promoted.lines);
      index = promoted.next;
      continue;
    }
    out.push(line);
    index += 1;
  }
  return out.join('\n');
}
