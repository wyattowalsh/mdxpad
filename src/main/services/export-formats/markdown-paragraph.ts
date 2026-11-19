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

function unclosedCode(text: string): boolean {
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
      return true;
    }
    index = closer + ticks;
  }
  return false;
}

/** Soft-wrapped lines stay one phrase. A hard break starts the next phrase. */
export function paragraphSegments(lines: readonly SourceLine[]): string[] {
  const segments: string[][] = [];
  let current: string[] = [];
  let carried = '';
  for (const line of lines) {
    const insideCode = carried.length > 0 && unclosedCode(carried);
    const base = `${insideCode ? (line.leading ?? '') : ''}${line.text}`;
    const probeBase = carried.length === 0 ? base : `${carried}\n${base}`;
    const suffixInCode = (line.codeSuffix?.length ?? 0) > 0 && unclosedCode(probeBase);
    const body = suffixInCode ? `${base}${line.codeSuffix ?? ''}` : base;
    const probe = carried.length === 0 ? body : `${carried}\n${body}`;
    current.push(body);
    if (line.hardBreak && !unclosedCode(probe)) {
      segments.push(current);
      current = [];
      carried = '';
      continue;
    }
    carried = probe;
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments.map((segment) => segment.join(' '));
}

export { joinParagraphHtml } from './markdown-marks';
