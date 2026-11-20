import { mathDelimiterAt, mathSpanEnd } from '@shared/lib/math-span';

export interface SourceLine {
  readonly text: string;
  readonly hardBreak: boolean;
  readonly leading?: string;
  readonly codeSuffix?: string;
}

function sourceLine(
  text: string,
  hardBreak: boolean,
  leading: string,
  codeSuffix: string
): SourceLine {
  return {
    text,
    hardBreak,
    ...(leading.length > 0 ? { leading } : {}),
    ...(codeSuffix.length > 0 ? { codeSuffix } : {}),
  };
}

function trailingSlashes(line: string): number {
  let slashes = 0;
  for (let index = line.length - 1; index >= 0 && line[index] === '\\'; index -= 1) {
    slashes += 1;
  }
  return slashes;
}

/** A list continuation with the item indent removed and any extra spaces kept. */
export function readListContinuation(line: string, column: number): SourceLine {
  const expanded = line.replaceAll('\t', '    ');
  const spaces = /^ */.exec(expanded)?.[0].length ?? 0;
  return readSourceLine(expanded.slice(Math.min(spaces, Math.max(0, column))));
}

/** Read a Markdown line, keeping a hard break made with two spaces or one backslash. */
export function readSourceLine(line: string): SourceLine {
  const leading = /^ */.exec(line)?.[0] ?? '';
  const core = line.slice(leading.length);
  const spaces = / *$/.exec(core)?.[0] ?? '';
  if (spaces.length >= 2) {
    return sourceLine(core.slice(0, -spaces.length), true, leading, spaces);
  }
  if (trailingSlashes(core) % 2 === 1) {
    return sourceLine(core.slice(0, -1).trim(), true, leading, '\\');
  }
  return sourceLine(line.trim(), false, leading, spaces);
}

function codeSpanCovers(text: string, position: number): boolean {
  let index = 0;
  while (index < text.length) {
    if (text[index] === '\\') {
      index += 2;
      continue;
    }
    if (text[index] !== '`') {
      index += 1;
      continue;
    }
    let ticks = 0;
    while (text[index + ticks] === '`') {
      ticks += 1;
    }
    const closer = text.indexOf('`'.repeat(ticks), index + ticks);
    if (closer === -1) {
      index += ticks;
      continue;
    }
    const end = closer + ticks;
    if (index < position && end > position) {
      return true;
    }
    index = end;
  }
  return false;
}

function mathCovers(text: string, position: number): boolean {
  let index = 0;
  while (index < text.length && index <= position) {
    const delimiter = mathDelimiterAt(text, index);
    if (delimiter !== null) {
      const end = mathSpanEnd(text, index, delimiter);
      if (end !== -1) {
        if (index < position && end > position) {
          return true;
        }
        index = end;
        continue;
      }
    }
    index += text[index] === '\\' ? 2 : 1;
  }
  return false;
}

function rawLine(line: SourceLine): string {
  return `${line.leading ?? ''}${line.text}${line.codeSuffix ?? ''}`;
}

/** Soft-wrapped lines stay one phrase. A hard break starts the next phrase. */
export function paragraphSegments(lines: readonly SourceLine[]): string[] {
  const raw = lines.map((line) => rawLine(line)).join('\n');
  const segments: string[][] = [];
  let current: string[] = [];
  let offset = 0;
  for (const line of lines) {
    const end = offset + rawLine(line).length;
    const covered = line.hardBreak && (codeSpanCovers(raw, end) || mathCovers(raw, end));
    const continued = offset > 0 && codeSpanCovers(raw, offset - 1);
    const suffix = covered ? (line.codeSuffix ?? '') : '';
    const leading = continued ? (line.leading ?? '') : '';
    current.push(`${leading}${line.text}${suffix}`);
    offset = end + 1;
    if (line.hardBreak && !covered) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments.map((segment) => segment.join(' '));
}

export { joinParagraphHtml } from './markdown-marks';
