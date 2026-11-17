import { openingFence } from './markdown-fence';
import { readHtmlBlock } from './markdown-html';
import { parseListItem } from './markdown-list';

const QUOTE_LINE = /^\s{0,3}>\s?(.*)$/;

/** A following line that stays inside an open quote, such as a wrapped sentence. */
export function isLazyQuoteLine(line: string): boolean {
  if (line.trim().length === 0 || openingFence(line) !== null || parseListItem(line) !== null) {
    return false;
  }
  if (/^ {0,3}#{1,6}(?:\s|$)/.test(line)) {
    return false;
  }
  return readHtmlBlock([line], 0) === null;
}

export function quoteBody(line: string): string | null {
  const match = QUOTE_LINE.exec(line);
  if (!match) {
    return null;
  }
  return match[1] ?? '';
}

function quoteParts(
  lines: readonly string[],
  renderParagraph: (paragraph: readonly string[]) => string,
  renderNested: (nested: readonly string[]) => string
): string {
  const parts: string[] = [];
  let paragraph: string[] = [];
  let nested: string[] = [];
  const flushParagraph = (): void => {
    if (paragraph.length === 0) {
      return;
    }
    parts.push(renderParagraph(paragraph));
    paragraph = [];
  };
  const flushNested = (): void => {
    if (nested.length === 0) {
      return;
    }
    parts.push(renderNested(nested));
    nested = [];
  };
  for (const line of lines) {
    const inner = quoteBody(line);
    if (inner !== null) {
      flushParagraph();
      nested.push(inner);
      continue;
    }
    flushNested();
    if (line.length > 0) {
      paragraph.push(line);
    } else {
      flushParagraph();
    }
  }
  flushNested();
  flushParagraph();
  return parts.join('\n');
}

export function quoteToHtml(
  lines: readonly string[],
  renderLine: (line: string) => string
): string {
  const body = quoteParts(
    lines,
    (paragraph) => paragraph.map((line) => `<p>${renderLine(line)}</p>`).join('\n'),
    (nested) => quoteToHtml(nested, renderLine)
  );
  return `<blockquote>\n${body}\n</blockquote>`;
}

export function quoteToLatex(
  lines: readonly string[],
  renderLine: (line: string) => string
): string {
  const body = quoteParts(
    lines,
    (paragraph) => paragraph.map((line) => renderLine(line)).join('\n\n'),
    (nested) => quoteToLatex(nested, renderLine)
  );
  return `\\begin{quote}\n${body}\n\\end{quote}`;
}

export function quoteLineDepth(line: string): { depth: number; text: string } {
  let depth = 1;
  let text = line;
  let inner = quoteBody(text);
  while (inner !== null) {
    depth += 1;
    text = inner;
    inner = quoteBody(text);
  }
  return { depth, text };
}
