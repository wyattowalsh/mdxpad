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

const QUOTE_LINE = /^( {0,3}(?:>[ \t]?)+)(.*)$/;

function quoteParts(line: string): { marker: string; body: string } | null {
  const match = QUOTE_LINE.exec(line);
  if (!match) {
    return null;
  }
  return { marker: match[1] ?? '', body: match[2] ?? '' };
}
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
  const quotedList = takeQuotedList(lines, index);
  const opener = quoteParts(lines[index] ?? '');
  if (quotedList || (opener !== null && LIST_ITEM.test(opener.body))) {
    return quotedList;
  }
  const prefix = opener ? displayMathPrefix(opener.body.trimStart()) : null;
  if (!opener || prefix === null) {
    return null;
  }
  const bodyLines: string[] = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const current = lines[cursor] ?? '';
    const quoted = quoteParts(current);
    if (!quoted) {
      return null;
    }
    if (quoted.body.trim() === '$$') {
      return {
        lines: [`${opener.marker}${prefix}`, `${opener.marker}$$`, ...bodyLines, current],
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

function fencedList(
  parsed: { opener: string; indent: string },
  prefix: string,
  body: readonly string[],
  tail: readonly string[]
): string[] {
  const head = prefix.length > 0 ? `${parsed.opener}${prefix}` : parsed.opener.trimEnd();
  const open = prefix.length > 0 ? [head] : [head, ''];
  return [...open, `${parsed.indent}$$`, ...body, ...tail];
}

function listPrefix(text: string): string | null {
  const task = /^(\[[ xX]\][ \t]+)(.*)$/.exec(text);
  const body = task?.[2] ?? text;
  if (!task && text.trim() === '$$') {
    return '';
  }
  const prefix = displayMathPrefix(body);
  if (prefix === null) {
    return null;
  }
  return task ? `${task[1]}${prefix}` : prefix;
}

function takeList(lines: readonly string[], index: number): PromotedBlock | null {
  const parsed = listParts(lines[index] ?? '');
  const prefix = parsed ? listPrefix(parsed.text) : null;
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
      return { lines: fencedList(parsed, prefix, body, [line]), next: cursor + 1 };
    }
    const lead = displayMathPrefix(line.trim());
    if (lead !== null) {
      return {
        lines: fencedList(parsed, prefix, body, [`${parsed.indent}${lead}`, `${parsed.indent}$$`]),
        next: cursor + 1,
      };
    }
    body.push(line);
  }
  return null;
}

function takeQuotedList(lines: readonly string[], index: number): PromotedBlock | null {
  const opener = quoteParts(lines[index] ?? '');
  if (!opener || !LIST_ITEM.test(opener.body)) {
    return null;
  }
  const virtual = [opener.body];
  const origins = [index];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const quoted = quoteParts(lines[cursor] ?? '');
    if (!quoted) {
      break;
    }
    virtual.push(quoted.body);
    origins.push(cursor);
  }
  const promoted = takeList(virtual, 0);
  const origin = promoted ? origins[promoted.next - 1] : undefined;
  if (!promoted || origin === undefined) {
    return null;
  }
  return {
    lines: promoted.lines.map((item) => `${opener.marker}${item}`),
    next: origin + 1,
  };
}

function continuesList(lines: readonly string[], index: number, indent: string): boolean {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const line = (lines[cursor] ?? '').replaceAll('\t', '    ');
    if (line.trim().length === 0) {
      continue;
    }
    const parsed = listParts(line);
    if (parsed?.indent === indent) {
      return true;
    }
    const lineIndent = /^( *)/.exec(line)?.[1] ?? '';
    if (lineIndent.length >= indent.length) {
      continue;
    }
    return false;
  }
  return false;
}

function takeIndented(lines: readonly string[], index: number): PromotedBlock | null {
  const line = (lines[index] ?? '').replaceAll('\t', '    ');
  const match = /^( +)(\S.*)$/.exec(line);
  const indent = match?.[1] ?? '';
  const text = match?.[2] ?? '';
  const prefix = match && !LIST_ITEM.test(line) ? displayMathPrefix(text) : null;
  if (!match || prefix === null || !continuesList(lines, index, indent)) {
    return null;
  }
  const body: string[] = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const current = (lines[cursor] ?? '').replaceAll('\t', '    ');
    if (current.trim().length === 0) {
      body.push(lines[cursor] ?? '');
      continue;
    }
    if (!current.startsWith(indent)) {
      return null;
    }
    const rest = current.slice(indent.length);
    if (rest.trim() === '$$') {
      return {
        lines: [`${indent}${prefix}`, `${indent}$$`, ...body, lines[cursor] ?? ''],
        next: cursor + 1,
      };
    }
    const lead = displayMathPrefix(rest.trim());
    if (lead !== null) {
      return {
        lines: [`${indent}${prefix}`, `${indent}$$`, ...body, `${indent}${lead}`, `${indent}$$`],
        next: cursor + 1,
      };
    }
    body.push(lines[cursor] ?? '');
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
  return takeIndented(lines, index) ?? takePlain(lines, index);
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
