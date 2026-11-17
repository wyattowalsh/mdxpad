import { paragraphSegments, type SourceLine } from './markdown-paragraph';

/** Separates hard-break phrases while inline marks are still open. */
export const HARD_BREAK = '\uE011';

interface Frame {
  readonly marker: string;
  readonly start: number;
  readonly inner: number;
}

interface MarkSpan {
  readonly start: number;
  readonly end: number;
  readonly open: string;
  readonly close: string;
  readonly innerStart: number;
  readonly innerEnd: number;
}

const MARKERS = ['~~', '***', '___', '**', '__', '*', '_'];

function backtickRun(text: string, index: number): string | null {
  if (text[index] !== '`' || text[index - 1] === '`') {
    return null;
  }
  let end = index + 1;
  while (text[end] === '`') {
    end += 1;
  }
  return text.slice(index, end);
}

function markerAt(text: string, index: number, opening: boolean): string | null {
  const ticks = backtickRun(text, index);
  if (ticks) {
    return ticks;
  }
  for (const marker of MARKERS) {
    const longer = `${marker}${marker[0] ?? ''}`;
    if (!text.startsWith(marker, index) || text.startsWith(longer, index)) {
      continue;
    }
    const edge = opening ? text[index - 1] : text[index + marker.length];
    if (marker.startsWith('_') && edge !== undefined && /\w/.test(edge)) {
      continue;
    }
    return marker;
  }
  return null;
}

function readParen(text: string, openParen: number): { dest: string; end: number } | null {
  if (text[openParen] !== '(') {
    return null;
  }
  let depth = 1;
  let cursor = openParen + 1;
  while (cursor < text.length && depth > 0) {
    if (text[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (text[cursor] === '(') {
      depth += 1;
    } else if (text[cursor] === ')') {
      depth -= 1;
    }
    if (depth > 0) {
      cursor += 1;
    }
  }
  return depth === 0 ? { dest: text.slice(openParen + 1, cursor), end: cursor + 1 } : null;
}

function insideCode(frames: readonly Frame[]): boolean {
  return frames.some((frame) => frame.marker.includes('`'));
}

function closeLink(text: string, index: number, frame: Frame, spans: MarkSpan[]): number {
  const destination = readParen(text, index + 1);
  if (!destination) {
    return index;
  }
  const inner = text.slice(frame.inner, index);
  if (inner.includes(HARD_BREAK) || destination.dest.includes(HARD_BREAK)) {
    spans.push({
      start: frame.start,
      end: destination.end,
      open: text.slice(frame.start, frame.inner),
      close: `](${destination.dest.replaceAll(HARD_BREAK, '')})`,
      innerStart: frame.inner,
      innerEnd: index,
    });
  }
  return destination.end;
}

function closeMark(text: string, index: number, frames: Frame[], spans: MarkSpan[]): number {
  const top = frames[frames.length - 1];
  if (!top) {
    return index;
  }
  if (top.marker === 'link') {
    if (!text.startsWith('](', index)) {
      return index;
    }
    const end = closeLink(text, index, top, spans);
    if (end > index) {
      frames.pop();
    }
    return end;
  }
  if (insideCode(frames) && !top.marker.includes('`')) {
    return index;
  }
  const marker = markerAt(text, index, false);
  if (marker !== top.marker) {
    return index;
  }
  if (text.slice(top.inner, index).includes(HARD_BREAK)) {
    spans.push({
      start: top.start,
      end: index + marker.length,
      open: marker,
      close: marker,
      innerStart: top.inner,
      innerEnd: index,
    });
  }
  frames.pop();
  return index + marker.length;
}

function openMark(text: string, index: number, frames: Frame[]): number {
  if (insideCode(frames) || text.startsWith('](', index)) {
    return index;
  }
  if (text[index] === '[') {
    const bang = text[index - 1] === '!' && text[index - 2] !== '\\';
    frames.push({ marker: 'link', start: bang ? index - 1 : index, inner: index + 1 });
    return index + 1;
  }
  const marker = markerAt(text, index, true);
  if (!marker) {
    return index;
  }
  frames.push({ marker, start: index, inner: index + marker.length });
  return index + marker.length;
}

function collectSpans(text: string): MarkSpan[] {
  const frames: Frame[] = [];
  const spans: MarkSpan[] = [];
  let index = 0;
  while (index < text.length) {
    if (text.startsWith(HARD_BREAK, index)) {
      index += HARD_BREAK.length;
      continue;
    }
    if (text[index] === '\\') {
      index += 2;
      continue;
    }
    const closed = closeMark(text, index, frames, spans);
    if (closed > index) {
      index = closed;
      continue;
    }
    const opened = openMark(text, index, frames);
    index = opened > index ? opened : index + 1;
  }
  return spans;
}

function smallestSpan(spans: readonly MarkSpan[]): MarkSpan | null {
  return spans.reduce<MarkSpan | null>((best, span) => {
    if (!best || span.end - span.start < best.end - best.start) {
      return span;
    }
    return best;
  }, null);
}

function applySpan(text: string, span: MarkSpan): string {
  const parts = text.slice(span.innerStart, span.innerEnd).split(HARD_BREAK);
  const joined = parts
    .map((part) => (part.length === 0 ? '' : `${span.open}${part}${span.close}`))
    .join(HARD_BREAK);
  return text.slice(0, span.start) + joined + text.slice(span.end);
}

/** Close and reopen inline marks around a hard break so each phrase formats. */
export function reopenInlineMarks(text: string): string {
  let current = text;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const span = smallestSpan(collectSpans(current));
    if (!span) {
      return current;
    }
    const next = applySpan(current, span);
    if (next === current) {
      return current;
    }
    current = next;
  }
  return current;
}

/** Soft-wrapped lines stay one phrase. Hard breaks reopen marks on each phrase. */
export function renderedSegments(lines: readonly SourceLine[]): string[] {
  if (lines.length === 0) {
    return [];
  }
  return reopenInlineMarks(paragraphSegments(lines).join(HARD_BREAK)).split(HARD_BREAK);
}

export function joinParagraphHtml(
  lines: readonly SourceLine[],
  render: (text: string) => string
): string {
  return renderedSegments(lines)
    .map((text) => render(text))
    .join('<br />');
}
