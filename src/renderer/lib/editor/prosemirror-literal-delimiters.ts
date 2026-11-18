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

export function restoreLiteralDelimiters(
  original: string,
  escaped: string,
  startOfLine: boolean,
  emphasis = ''
): string {
  if (collectEmphasis(original).length > 0) {
    return escaped;
  }
  const restored = escaped.replaceAll('\\*', '*').replaceAll('\\_', '_');
  const candidate = startOfLine ? protectBlockMarkers(restored) : restored;
  if (emphasis.length > 0 && !emphasisStays(emphasis, original)) {
    return escaped;
  }
  return candidate;
}
