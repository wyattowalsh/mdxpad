/**
 * The markdown serializer escapes every star and underscore. Stars that
 * cannot form emphasis, and underscores in the same position, stay literal.
 * A star that would become emphasis, a list marker, or a rule stays escaped.
 *
 * @module renderer/lib/editor/prosemirror-literal-delimiters
 */

import { collectEmphasis } from '../../../main/services/export-formats/markdown-emphasis';

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
  startOfLine: boolean
): string {
  if (collectEmphasis(original).length > 0) {
    return escaped;
  }
  const restored = escaped.replaceAll('\\*', '*').replaceAll('\\_', '_');
  return startOfLine ? protectBlockMarkers(restored) : restored;
}
