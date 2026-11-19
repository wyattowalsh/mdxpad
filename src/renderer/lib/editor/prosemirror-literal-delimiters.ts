/**
 * The markdown serializer escapes every star and underscore. Stars that
 * cannot form emphasis, and underscores in the same position, stay literal.
 * A star that would become emphasis, a list marker, or a rule stays escaped.
 *
 * @module renderer/lib/editor/prosemirror-literal-delimiters
 */

import { collectEmphasis } from '../../../main/services/export-formats/markdown-emphasis';
import { parseMdxContent } from './prosemirror-mdx-parser';

export function emphasisOpen(marks: readonly { type: { name: string } }[]): string {
  let open = '';
  for (const mark of marks) {
    if (mark.type.name === 'bold') {
      open += '**';
    } else if (mark.type.name === 'italic') {
      open += '*';
    }
  }
  return open;
}

function closeEmphasis(open: string): string {
  let close = '';
  for (let index = open.length - 1; index >= 0; index -= 1) {
    close += open[index] ?? '';
  }
  return close;
}

function expectedMarkNames(open: string): string[] {
  const names: string[] = [];
  if (open.includes('**')) {
    names.push('bold');
  }
  if (open.replaceAll('**', '').includes('*')) {
    names.push('italic');
  }
  return names;
}

function emphasisStays(open: string, text: string): boolean {
  const paragraph = parseMdxContent(`${open}${text}${closeEmphasis(open)}\n`)?.firstChild;
  const child = paragraph?.firstChild;
  if (
    paragraph?.type.name !== 'paragraph' ||
    paragraph.childCount !== 1 ||
    child?.isText !== true
  ) {
    return false;
  }
  const names = child.marks.map((mark) => mark.type.name);
  const expected = expectedMarkNames(open);
  return (
    child.text === text &&
    names.length === expected.length &&
    expected.every((name) => names.includes(name))
  );
}

function runNeedsEscape(value: string, index: number): boolean {
  const char = value[index];
  if ((char !== '*' && char !== '_') || (index > 0 && value[index - 1] === char)) {
    return false;
  }
  let end = index;
  while (value[end] === char) {
    end += 1;
  }
  if (index === 0 || end === value.length) {
    return true;
  }
  const before = value[index - 1] ?? '';
  const after = value[end] ?? '';
  const space = (item: string) => item.length === 0 || /\s/.test(item);
  return !space(after) || !space(before);
}

function dropHarmlessEscapes(original: string, escaped: string): string {
  const keep = new Set<number>();
  for (let index = 0; index < original.length; index += 1) {
    if (!runNeedsEscape(original, index)) {
      continue;
    }
    const char = original[index];
    let end = index;
    while (original[end] === char) {
      keep.add(end);
      end += 1;
    }
  }
  let result = '';
  let source = 0;
  for (let index = 0; index < escaped.length; index += 1) {
    const next = escaped[index + 1];
    if (escaped[index] === '\\' && next === original[source] && (next === '*' || next === '_')) {
      if (keep.has(source)) {
        result += '\\';
      }
      continue;
    }
    result += escaped[index] ?? '';
    source += 1;
  }
  return result;
}

function escapeMarkerRun(indent: string, marks: string, tail: string): string {
  let escaped = indent;
  for (const char of marks) {
    escaped += `\\${char}`;
  }
  return escaped + tail;
}

function protectBlockMarkers(line: string): string {
  const rule = /^(\s{0,3})([*_]{3,})(\s*)$/.exec(line);
  const indent = rule?.[1];
  const marks = rule?.[2];
  const tail = rule?.[3];
  if (indent !== undefined && marks !== undefined && tail !== undefined) {
    return escapeMarkerRun(indent, marks, tail);
  }
  return line.replace(/^(\s{0,3})\*(?=[ \t]|$)/, '$1\\*');
}

/** A link label is open when an unescaped `[` has no matching `]`. */
export function linkLabelOpen(value: string): boolean {
  let depth = 0;
  let index = 0;
  while (index < value.length) {
    const char = value[index] ?? '';
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '`') {
      let width = 0;
      while (value[index + width] === '`') {
        width += 1;
      }
      const closer = value.indexOf('`'.repeat(width), index + width);
      index = closer === -1 ? value.length : closer + width;
      continue;
    }
    if (char === '[') {
      depth += 1;
    } else if (char === ']' && depth > 0) {
      depth -= 1;
    }
    index += 1;
  }
  return depth > 0;
}

/** A backslash already in the text is one character, so it is written as `\\`. */
export function relaxPunctuationEscapes(escaped: string, keepBracketEscape = false): string {
  const relaxed = escaped
    .replaceAll('\\\\\\[', '\\\\[')
    .replaceAll('\\\\\\]', '\\\\]')
    .replaceAll('\\\\\\(', '\\\\(')
    .replaceAll('\\\\\\)', '\\\\)');
  const brackets = keepBracketEscape ? relaxed : relaxed.replaceAll(/(?<!\\)\\\]/g, ']');
  return brackets.replaceAll(/(?<!\\)\\\)/g, ')');
}

export function restoreLiteralDelimiters(
  original: string,
  escaped: string,
  startOfLine: boolean,
  emphasis = '',
  strikeLiteral = false
): string {
  if (strikeLiteral) {
    const restored = escaped.replaceAll('\\*', '*').replaceAll('\\_', '_');
    return startOfLine ? protectBlockMarkers(restored) : restored;
  }
  if (collectEmphasis(original).length > 0) {
    return escaped;
  }
  const restored =
    emphasis.length > 0 && emphasisStays(emphasis, original)
      ? escaped.replaceAll('\\*', '*').replaceAll('\\_', '_')
      : dropHarmlessEscapes(original, escaped);
  return startOfLine ? protectBlockMarkers(restored) : restored;
}
