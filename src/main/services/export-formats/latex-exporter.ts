import { writeRegularFile } from './write-regular-file';

import { allocateHeadingSlug, headingAnchor, parseAtxHeading } from '@shared/lib/markdown-heading';
import { isCurrencySpan } from '@shared/lib/currency-span';
import { prepareMarkdownSource } from '@shared/lib/markdown-math';

import { inlineLocalImages } from './export-image';

import { isTableRow, markdownTableToLatex, parseMarkdownTable } from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { closesFence, fenceLanguage, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { plainFootnoteMarkers } from './markdown-footnote';
import { renderedSegments } from './markdown-marks';
import { readSourceLine, type SourceLine } from './markdown-paragraph';
import { isLazyQuoteLine, quoteBody, quoteMarkerLine, quoteToLatex } from './markdown-quote';
import { protectAutolinks, replaceAutolinks } from './markdown-autolink';
import { findCodeSpan, protectEscapes, restoreEscapes } from './markdown-escape';
import { renderEmphasis } from './markdown-emphasis';
import { decodeHtmlEntities } from './markdown-entity';
import {
  findMarkdownTarget,
  linkDestination,
  linkTitle,
  type MarkdownTarget,
} from './markdown-link';
import {
  isListContinuation,
  listContentColumn,
  parseListItem,
  shouldOpenListItem,
  type ListDelimiter,
  type MarkdownListItem,
} from './markdown-list';
import {
  dedentToColumn,
  listFenceOnMarker,
  listIndentedCode,
  listThematicBreak,
  openListFence,
  readListFenceLine,
  readListQuoteLine,
  readOpenListQuote,
  type ListFenceState,
} from './markdown-list-fence';
import { splitTaskItem, taskItemLatex } from './markdown-task';
import type { Exporter, ExportOptions, ExportResult } from './types';

const LATEX_BACKSLASH = '\uE000';

const SUPERSCRIPT_DIGIT: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

function latexSuperscripts(text: string): string {
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (run) => {
    const digits = run.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (char) => SUPERSCRIPT_DIGIT[char] ?? '');
    return `\\textsuperscript{${digits}}`;
  });
}

function escapeLatex(text: string): string {
  return latexSuperscripts(
    text
      .replaceAll('\\', LATEX_BACKSLASH)
      .replaceAll('&', '\\&')
      .replaceAll('%', '\\%')
      .replaceAll('$', '\\$')
      .replaceAll('#', '\\#')
      .replaceAll('_', '\\_')
      .replaceAll('{', '\\{')
      .replaceAll('}', '\\}')
      .replaceAll('~', '\\textasciitilde{}')
      .replaceAll('^', '\\textasciicircum{}')
      .replaceAll(LATEX_BACKSLASH, '\\textbackslash{}')
  );
}

function wrapLatex(command: string, content: string): string {
  return `\\${command}{${escapeLatex(content)}}`;
}

const MATH_MARK = '\uE001';

function takeMath(raw: string, start: number, delimiter: '$' | '$$'): number {
  const end = raw.indexOf(delimiter, start + delimiter.length);
  if (end === -1) {
    return -1;
  }
  const interior = raw.slice(start + delimiter.length, end);
  if (interior.length === 0 || isCurrencySpan(interior)) {
    return -1;
  }
  return end + delimiter.length;
}

function protectMath(raw: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  let text = '';
  let index = 0;
  let inCode = false;
  while (index < raw.length) {
    if (raw[index] === '`') {
      inCode = !inCode;
      text += '`';
      index += 1;
      continue;
    }
    const delimiter =
      !inCode && raw.startsWith('$$', index) ? '$$' : !inCode && raw[index] === '$' ? '$' : null;
    const end = delimiter === null ? -1 : takeMath(raw, index, delimiter);
    if (delimiter !== null && end !== -1) {
      slots.push(raw.slice(index, end));
      text += `${MATH_MARK}${slots.length - 1}${MATH_MARK}`;
      index = end;
      continue;
    }
    text += raw[index] ?? '';
    index += 1;
  }
  return { text, slots };
}

function restoreMath(formatted: string, slots: readonly string[]): string {
  return formatted.replaceAll(
    new RegExp(`${MATH_MARK}(\\d+)${MATH_MARK}`, 'g'),
    (_match, slotIndex: string) => slots[Number(slotIndex)] ?? ''
  );
}

function convertInlineFormatting(raw: string): string {
  const protectedMath = protectMath(raw);
  return restoreMath(formatInline(protectedMath.text), protectedMath.slots);
}

function latexFilename(src: string): string {
  let value = src;
  try {
    value = decodeURI(src);
  } catch {
    value = src;
  }
  return value.replaceAll('\\', '/').replaceAll('%', '\\%').replaceAll('}', '');
}

function latexImage(src: string, alt: string, title: string | null): string {
  const caption = title ? ` \\textit{${escapeLatex(title)}}` : '';
  if (/^https?:\/\//i.test(src)) {
    const label = alt.length > 0 ? formatProtected(alt) : escapeLatex(src);
    return `\\href{${escapeLatex(src)}}{${label}}${caption}`;
  }
  return `\\includegraphics{${latexFilename(src)}}${caption}`;
}

function restoreLatexAutolinks(
  value: string,
  links: ReturnType<typeof protectAutolinks>['links']
): string {
  return replaceAutolinks(value, links, (link, nested) =>
    nested ? escapeLatex(link.text) : `\\href{${escapeLatex(link.href)}}{${escapeLatex(link.text)}}`
  );
}

function nextRawStrike(raw: string, from: number): number {
  let index = from;
  while (index < raw.length) {
    const code = findCodeSpan(raw, index);
    if (code?.start === index) {
      index = code.end;
      continue;
    }
    if (raw.startsWith('~~', index)) {
      return index;
    }
    index += 1;
  }
  return -1;
}

function nextProtectedBoundary(raw: string, from: number): number {
  for (let index = from; index < raw.length; index += 1) {
    const code = findCodeSpan(raw, index);
    if (code?.start === index || raw.startsWith('~~', index)) {
      return index;
    }
  }
  return raw.length;
}

function formatProtected(raw: string): string {
  let result = '';
  let index = 0;
  while (index < raw.length) {
    const code = findCodeSpan(raw, index);
    if (code?.start === index) {
      result += wrapLatex('texttt', code.text);
      index = code.end;
      continue;
    }
    if (raw.startsWith('~~', index)) {
      const end = nextRawStrike(raw, index + 2);
      if (end !== -1) {
        result += `\\sout{${formatProtected(raw.slice(index + 2, end))}}`;
        index = end + 2;
        continue;
      }
    }
    const next = nextProtectedBoundary(raw, index + 1);
    result += formatInlineMarks(raw.slice(index, next));
    index = next;
  }
  return result;
}

function latexTarget(prefix: string, target: MarkdownTarget): string {
  const before = latexText(prefix);
  if (target.image) {
    const path = linkDestination(decodeHtmlEntities(target.destination));
    const alt = target.label.length > 0 ? target.label : path;
    return before + latexImage(path, alt, linkTitle(decodeHtmlEntities(target.destination)));
  }
  return before + latexHref(target.label, target.destination);
}

function latexText(value: string): string {
  return escapeLatex(decodeHtmlEntities(value)).replaceAll('\\textasciitilde{}', '~');
}

function formatLatexPlain(raw: string): string {
  let result = '';
  let cursor = 0;
  while (cursor < raw.length) {
    const code = findCodeSpan(raw, cursor);
    const target = findMarkdownTarget(raw, cursor);
    const codeAt = code?.start ?? raw.length;
    const targetAt = target?.start ?? raw.length;
    if (code && codeAt <= targetAt) {
      result += latexText(raw.slice(cursor, code.start));
      result += wrapLatex('texttt', code.text);
      cursor = code.end;
      continue;
    }
    if (target) {
      result += latexTarget(raw.slice(cursor, target.start), target);
      cursor = target.end;
      continue;
    }
    return result + latexText(raw.slice(cursor));
  }
  return result;
}

function applyLatexStrike(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (!value.startsWith('~~', index)) {
      result += value[index] ?? '';
      index += 1;
      continue;
    }
    const end = value.indexOf('~~', index + 2);
    if (end === -1) {
      return result + value.slice(index);
    }
    result += `\\sout{${value.slice(index + 2, end)}}`;
    index = end + 2;
  }
  return result;
}

function formatInlineMarks(raw: string): string {
  const emphasized = renderEmphasis(raw, formatLatexPlain, (size, inner) =>
    size === 2 ? `\\textbf{${inner}}` : `\\textit{${inner}}`
  );
  return applyLatexStrike(emphasized).replaceAll('~', '\\textasciitilde{}');
}

function latexHref(label: string, rawHref: string): string {
  const destination = linkDestination(decodeHtmlEntities(rawHref));
  const anchor = headingAnchor(destination);
  if (anchor) {
    return `\\hyperref[${anchor}]{${formatProtected(label)}}`;
  }
  return `\\href{${escapeLatex(destination)}}{${formatProtected(label)}}`;
}

function formatInline(source: string): string {
  const escaped = protectEscapes(source);
  const protectedLinks = protectAutolinks(escaped.text);
  return restoreEscapes(
    restoreLatexAutolinks(formatProtected(protectedLinks.text), protectedLinks.links),
    escaped.chars,
    escapeLatex
  );
}

const HEADING_COMMANDS: Record<number, string> = {
  1: 'section',
  2: 'subsection',
  3: 'subsubsection',
  4: 'paragraph',
  5: 'subparagraph',
  6: 'subparagraph',
};

function getHeadingCommand(level: number): string {
  return HEADING_COMMANDS[level] ?? 'subparagraph';
}

interface LatexListFrame {
  readonly ordered: boolean;
  readonly level: number;
  readonly delimiter: '' | ListDelimiter;
  column: number;
}

function sameLatexList(frame: LatexListFrame, item: MarkdownListItem): boolean {
  return (
    frame.level === item.level &&
    frame.ordered === item.ordered &&
    frame.delimiter === (item.delimiter ?? '')
  );
}

interface ListState {
  stack: LatexListFrame[];
  break: boolean;
  itemLines: SourceLine[];
  column: number | null;
  itemFence: ListFenceState | null;
  itemQuote: string[] | null;
  itemTable: string[] | null;
  itemMath: string[] | null;
  itemCode: string[] | null;
  sealed: boolean;
  paragraphBreak: boolean;
  tailLines: SourceLine[] | null;
}

function closeLatexFrame(output: string[], stack: LatexListFrame[]): void {
  const frame = stack.pop();
  output.push(frame?.ordered ? '\\end{enumerate}' : '\\end{itemize}');
}

function closeLatexLists(output: string[], stack: LatexListFrame[]): void {
  while (stack.length > 0) {
    closeLatexFrame(output, stack);
  }
}

function closeLatexListsTo(output: string[], stack: LatexListFrame[], depth: number): void {
  while (stack.length - 1 > depth) {
    closeLatexFrame(output, stack);
  }
}

function listDepthForIndent(stack: readonly LatexListFrame[], line: string): number {
  const spaces = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
  let depth = stack.length - 1;
  while (depth >= 0 && spaces < (stack[depth]?.column ?? 0)) {
    depth -= 1;
  }
  return depth;
}

function processCodeBlockLine(
  line: string,
  output: string[],
  fence: string | null,
  listState: ListState
): string | null {
  if (fence) {
    if (!closesFence(line, fence)) {
      return fence;
    }
    output.push('\\end{verbatim}');
    return null;
  }
  const marker = openingFence(line);
  if (!marker) {
    return null;
  }
  closeLatexLists(output, listState.stack);
  const language = fenceLanguage(line);
  if (language.length > 0) {
    output.push(`{\\footnotesize\\ttfamily ${escapeLatex(language)}}`);
  }
  output.push('\\begin{verbatim}');
  return marker;
}

function resetListState(output: string[], listState: ListState): void {
  closeLatexLists(output, listState.stack);
}

function latexItemLabel(item: MarkdownListItem): string {
  if (item.delimiter === '+') {
    return '+';
  }
  if (item.delimiter === '*') {
    return '*';
  }
  return '';
}

function openLatexEnvironment(output: string[], item: MarkdownListItem): void {
  output.push(item.ordered ? '\\begin{enumerate}' : '\\begin{itemize}');
  if (!item.ordered || item.delimiter !== ')') {
    return;
  }
  const labels = [
    'labelenumi',
    'labelenumii',
    'labelenumiii',
    'labelenumiv',
    'labelenumv',
    'labelenumvi',
  ];
  const refs = ['theenumi', 'theenumii', 'theenumiii', 'theenumiv', 'theenumv', 'theenumvi'];
  const label = labels[item.level] ?? 'labelenumi';
  const ref = refs[item.level] ?? 'theenumi';
  output.push(`\\renewcommand{\\${label}}{\\${ref})}`);
}

function openLatexListItem(
  output: string[],
  stack: LatexListFrame[],
  item: MarkdownListItem,
  formatted: string,
  column: number
): void {
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (!top || sameLatexList(top, item) || top.level < item.level) {
      break;
    }
    output.push(top.ordered ? '\\end{enumerate}' : '\\end{itemize}');
    stack.pop();
  }
  const top = stack[stack.length - 1];
  if (!top || top.level < item.level) {
    openLatexEnvironment(output, item);
    if (item.ordered && item.start !== 1) {
      const counters = ['enumi', 'enumii', 'enumiii', 'enumiv', 'enumv', 'enumvi'];
      const counter = counters[item.level] ?? 'enumi';
      output.push(`\\setcounter{${counter}}{${item.start - 1}}`);
    }
    stack.push({
      ordered: item.ordered,
      level: item.level,
      column,
      delimiter: item.delimiter ?? '',
    });
  } else if (top.level === item.level) {
    top.column = column;
  }
  const label = latexItemLabel(item);
  output.push(label.length > 0 ? `  \\item[${label}] ${formatted}` : `  \\item ${formatted}`);
}

function renderLatexItem(lines: readonly SourceLine[]): string {
  const first = lines[0] ?? { text: '', hardBreak: false };
  const task = splitTaskItem(first.text);
  const body = task ? [{ text: task.body, hardBreak: first.hardBreak }, ...lines.slice(1)] : lines;
  const formatted = renderedSegments(body)
    .map((text, index) => {
      const piece = convertInlineFormatting(text);
      return index === 0 ? piece : `\\\\\n${piece}`;
    })
    .join('');
  return task ? taskItemLatex(task.checked, formatted) : formatted;
}

function processListItem(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>
): boolean {
  const item = parseListItem(raw);
  if (!item) {
    return false;
  }
  const heading = parseAtxHeading(item.text);
  listState.itemLines = heading
    ? []
    : [{ text: item.text, hardBreak: readSourceLine(raw).hardBreak }];
  listState.paragraphBreak = heading !== null;
  listState.tailLines = null;
  listState.sealed = heading !== null;
  const formatted = heading
    ? latexLabeledHeading(
        getHeadingCommand(heading.depth),
        convertInlineFormatting(heading.text),
        heading.text,
        counts
      )
    : renderLatexItem(listState.itemLines);
  const column = listContentColumn(raw) ?? 2;
  openLatexListItem(output, listState.stack, item, formatted, column);
  listState.column = column;
  return true;
}

function writeLatexTail(output: string[], listState: ListState, raw: string): void {
  const source = readSourceLine(raw);
  if (listState.paragraphBreak || !listState.tailLines) {
    listState.tailLines = [source];
    listState.paragraphBreak = false;
    output.push(renderLatexItem(listState.tailLines));
    return;
  }
  listState.tailLines.push(source);
  output[output.length - 1] = renderLatexItem(listState.tailLines);
}

function latexListFrames(stack: readonly LatexListFrame[]): {
  level: number;
  kind: 'ul' | 'ol';
  delimiter: '' | ListDelimiter;
}[] {
  return stack.map((frame) => ({
    level: frame.level,
    kind: frame.ordered ? 'ol' : 'ul',
    delimiter: frame.delimiter,
  }));
}

function indentedIntoList(raw: string, column: number): boolean {
  const spaces = /^ */.exec(raw.replaceAll('\t', '    '))?.[0].length ?? 0;
  return raw.trim().length > 0 && spaces >= column;
}

function takeLatexListContinuation(raw: string, output: string[], listState: ListState): boolean {
  const column = listState.column ?? 2;
  const marker = parseListItem(raw);
  const joinsMarker =
    marker !== null &&
    !shouldOpenListItem(marker, latexListFrames(listState.stack), listState.break, false) &&
    indentedIntoList(raw, column);
  if (listState.stack.length === 0 || (!isListContinuation(raw, column) && !joinsMarker)) {
    return false;
  }
  if (listState.sealed) {
    output.push(convertInlineFormatting(readSourceLine(raw).text));
    return true;
  }
  if (listState.paragraphBreak || listState.tailLines) {
    writeLatexTail(output, listState, raw);
    return true;
  }
  const last = output[output.length - 1];
  if (!last?.includes('\\item ')) {
    return false;
  }
  listState.itemLines.push(readSourceLine(raw));
  const at = last.lastIndexOf('\\item ');
  const prefix = last.slice(0, at + '\\item '.length);
  output[output.length - 1] = `${prefix}${renderLatexItem(listState.itemLines)}`;
  return true;
}

function latexLabeledHeading(
  command: string,
  formatted: string,
  slugSource: string,
  counts: Map<string, number>
): string {
  return `\\${command}{${formatted}}\\label{${allocateHeadingSlug(slugSource, counts)}}`;
}

function flushLatexProse(output: string[], prose: SourceLine[]): void {
  if (prose.length === 0) {
    return;
  }
  const segments = renderedSegments(prose);
  prose.length = 0;
  segments.forEach((text, index) => {
    const formatted = convertInlineFormatting(text);
    output.push(index < segments.length - 1 ? `${formatted}\\\\` : formatted);
  });
}

function takeLatexSetext(
  output: string[],
  raw: string,
  counts: Map<string, number>,
  prose: SourceLine[]
): boolean {
  const level = setextLevel(raw);
  if (level === null || prose.length === 0) {
    return false;
  }
  const text = prose
    .map((line) => line.text)
    .filter((line) => line.length > 0)
    .join(' ');
  prose.length = 0;
  if (text.length === 0) {
    return false;
  }
  const command = level === 1 ? 'section' : 'subsection';
  output.push(latexLabeledHeading(command, convertInlineFormatting(text), text, counts));
  return true;
}

function returnLatexListItem(raw: string, output: string[], listState: ListState): void {
  const depth = listDepthForIndent(listState.stack, raw);
  if (depth < 0) {
    resetListState(output, listState);
    return;
  }
  closeLatexListsTo(output, listState.stack, depth);
  const frame = listState.stack[depth];
  if (frame) {
    listState.column = frame.column;
  }
  listState.sealed = false;
  listState.itemLines = [];
  listState.paragraphBreak = true;
  listState.tailLines = null;
}

function takeLatexListBreak(raw: string, output: string[], listState: ListState): boolean {
  const source = readSourceLine(raw);
  if (source.text !== '') {
    if (
      listState.break &&
      parseListItem(raw) === null &&
      !isListContinuation(raw, listState.column ?? 2)
    ) {
      returnLatexListItem(raw, output, listState);
    }
    listState.break = false;
    return false;
  }
  if (listState.stack.length > 0) {
    if (!listState.break) {
      listState.break = true;
      listState.paragraphBreak = true;
      listState.tailLines = null;
    }
  } else {
    resetListState(output, listState);
    listState.break = false;
  }
  output.push('');
  return true;
}

function takeLatexHeading(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>,
  prose: SourceLine[]
): boolean {
  const trimmed = readSourceLine(raw).text;
  const heading = parseAtxHeading(trimmed);
  if (heading) {
    flushLatexProse(output, prose);
    resetListState(output, listState);
    const cmd = getHeadingCommand(heading.depth);
    output.push(
      latexLabeledHeading(cmd, convertInlineFormatting(heading.text), heading.text, counts)
    );
    return true;
  }
  if (!isThematicBreak(trimmed)) {
    return false;
  }
  flushLatexProse(output, prose);
  resetListState(output, listState);
  output.push('\\noindent\\rule{\\textwidth}{0.4pt}');
  return true;
}

function takeLatexItemSetext(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>
): boolean {
  if (
    listState.stack.length === 0 ||
    listState.column === null ||
    listState.break ||
    listState.sealed ||
    listState.paragraphBreak ||
    listState.itemLines.length === 0 ||
    listState.itemFence ||
    listState.itemQuote ||
    listState.itemTable ||
    listState.itemMath ||
    listState.itemCode
  ) {
    return false;
  }
  const level = setextLevel(dedentToColumn(raw, listState.column));
  if (level === null) {
    return false;
  }
  const text = listState.itemLines
    .map((item) => item.text)
    .filter((item) => item.length > 0)
    .join(' ');
  if (text.length === 0) {
    return false;
  }
  const last = output[output.length - 1];
  if (!last?.includes('\\item ')) {
    return false;
  }
  const at = last.lastIndexOf('\\item ');
  const command = getHeadingCommand(level);
  output[output.length - 1] =
    `${last.slice(0, at)}\\item ${latexLabeledHeading(command, convertInlineFormatting(text), text, counts)}`;
  listState.itemLines = [];
  listState.sealed = true;
  listState.paragraphBreak = true;
  listState.break = false;
  return true;
}

function takeLatexItemRule(raw: string, output: string[], listState: ListState): boolean {
  if (
    listState.stack.length === 0 ||
    listState.column === null ||
    listState.itemFence ||
    listState.itemQuote ||
    listState.itemTable ||
    listState.itemMath ||
    listState.itemCode ||
    !listThematicBreak(raw, listState.column)
  ) {
    return false;
  }
  output.push('\\noindent\\rule{\\textwidth}{0.4pt}');
  listState.sealed = true;
  listState.paragraphBreak = true;
  listState.break = false;
  return true;
}

function processMarkdownLine(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>,
  prose: SourceLine[]
): void {
  if (takeLatexSetext(output, raw, counts, prose)) {
    return;
  }
  if (readSourceLine(raw).text.length === 0) {
    flushLatexProse(output, prose);
  }
  if (takeLatexListBreak(raw, output, listState)) {
    return;
  }
  if (
    takeLatexItemSetext(raw, output, listState, counts) ||
    takeLatexItemRule(raw, output, listState)
  ) {
    return;
  }
  if (takeLatexHeading(raw, output, listState, counts, prose)) {
    return;
  }
  const source = readSourceLine(raw);
  const marker = parseListItem(raw);
  const openMarker =
    marker !== null &&
    shouldOpenListItem(marker, latexListFrames(listState.stack), listState.break, prose.length > 0);
  if (openMarker) {
    flushLatexProse(output, prose);
  }
  if (openMarker && processListItem(raw, output, listState, counts)) {
    listState.column = listContentColumn(raw);
    openLatexMarkerFence(raw, output, listState);
    return;
  }
  if (takeLatexListContinuation(raw, output, listState)) {
    return;
  }

  prose.push(source);
}

function flushLatexTable(output: string[], tableLines: string[]): void {
  if (tableLines.length === 0) {
    return;
  }
  const lines = tableLines.splice(0, tableLines.length);
  const table = parseMarkdownTable(lines);
  if (!table) {
    for (const line of lines) {
      output.push(convertInlineFormatting(line));
    }
    return;
  }
  output.push(markdownTableToLatex(table, convertInlineFormatting));
}

function flushLatexQuote(
  output: string[],
  quoteLines: string[],
  slugs?: Map<string, number>
): void {
  if (quoteLines.length === 0) {
    return;
  }
  const lines = quoteLines.splice(0, quoteLines.length);
  output.push(quoteToLatex(lines, convertInlineFormatting, slugs));
}

function takeLatexItemQuote(build: LatexBuild, line: string): boolean {
  const list = build.listState;
  if (list.itemFence || build.fence) {
    return false;
  }
  if (list.itemQuote) {
    const text = readListQuoteLine(line, list.column ?? 2);
    if (text === null) {
      build.output.push(quoteToLatex(list.itemQuote, convertInlineFormatting, build.slugCounts));
      list.itemQuote = null;
      list.sealed = true;
      return false;
    }
    list.itemQuote.push(quoteMarkerLine(text));
    return true;
  }
  if (list.stack.length === 0 || list.column === null) {
    return false;
  }
  const opened = readOpenListQuote(line, list.column);
  if (opened === null) {
    return false;
  }
  list.itemQuote = [opened];
  list.break = false;
  return true;
}

function takeLatexQuote(
  output: string[],
  line: string,
  quoteLines: string[],
  slugs?: Map<string, number>
): boolean {
  const body = quoteBody(line);
  if (body !== null) {
    quoteLines.push(quoteMarkerLine(body));
    return true;
  }
  if (quoteLines.length > 0 && isLazyQuoteLine(line)) {
    quoteLines.push(line);
    return true;
  }
  if (quoteLines.length > 0) {
    flushLatexQuote(output, quoteLines, slugs);
  }
  return false;
}

function takeLatexItemCode(build: LatexBuild, line: string): boolean {
  const list = build.listState;
  if (list.itemFence || list.itemQuote || list.itemTable || list.itemMath || build.fence) {
    return false;
  }
  const column = list.column ?? 2;
  if (list.itemCode) {
    if (line.trim().length === 0) {
      list.itemCode.push('');
      return true;
    }
    const body = listIndentedCode(line, column);
    if (body !== null) {
      list.itemCode.push(body);
      return true;
    }
    while (list.itemCode[list.itemCode.length - 1] === '') {
      list.itemCode.pop();
    }
    build.output.push('\\begin{verbatim}', ...list.itemCode, '\\end{verbatim}');
    list.itemCode = null;
    list.sealed = true;
    list.paragraphBreak = true;
    return false;
  }
  if (list.stack.length === 0 || list.column === null) {
    return false;
  }
  const opened = listIndentedCode(line, column);
  if (opened === null) {
    return false;
  }
  list.itemCode = [opened];
  list.break = false;
  return true;
}

function takeLatexItemMath(build: LatexBuild, line: string): boolean {
  const list = build.listState;
  if (list.itemFence || list.itemQuote || list.itemTable || build.fence) {
    return false;
  }
  const column = list.column ?? 2;
  if (list.itemMath) {
    if (line.trim() === '$$') {
      build.output.push('$$', ...list.itemMath, '$$');
      list.itemMath = null;
      list.sealed = true;
      return true;
    }
    list.itemMath.push(dedentToColumn(line, column));
    return true;
  }
  if (list.stack.length === 0 || list.column === null || line.trim() !== '$$') {
    return false;
  }
  if (!isListContinuation(line, column)) {
    return false;
  }
  list.itemMath = [];
  list.break = false;
  return true;
}

function takeLatexItemTable(build: LatexBuild, line: string): boolean {
  const list = build.listState;
  if (list.itemFence || list.itemQuote || build.fence) {
    return false;
  }
  const column = list.column ?? 2;
  if (list.itemTable) {
    if (isListContinuation(line, column) && isTableRow(line.trim())) {
      list.itemTable.push(line.trim());
      return true;
    }
    const rows = list.itemTable;
    list.itemTable = null;
    const table = parseMarkdownTable(rows);
    build.output.push(
      table ? markdownTableToLatex(table, convertInlineFormatting) : rows.join('\n')
    );
    list.sealed = true;
    return false;
  }
  if (list.stack.length === 0 || list.column === null) {
    return false;
  }
  if (!isListContinuation(line, column) || !isTableRow(line.trim())) {
    return false;
  }
  list.itemTable = [line.trim()];
  list.break = false;
  return true;
}

function takeLatexTable(output: string[], line: string, tableLines: string[]): boolean {
  if (isTableRow(line)) {
    tableLines.push(line);
    return true;
  }
  if (tableLines.length > 0) {
    flushLatexTable(output, tableLines);
  }
  return false;
}

interface LatexBuild {
  output: string[];
  prose: SourceLine[];
  fence: string | null;
  inDisplayMath: boolean;
  tableLines: string[];
  quoteLines: string[];
  listState: ListState;
  slugCounts: Map<string, number>;
}

function openLatexMarkerFence(raw: string, output: string[], listState: ListState): void {
  const fence = listFenceOnMarker(raw, listState.column ?? 2);
  listState.sealed = fence !== null;
  listState.itemFence = null;
  if (!fence) {
    return;
  }
  const last = output[output.length - 1];
  if (last?.includes('\\item ')) {
    const at = last.lastIndexOf('\\item ');
    output[output.length - 1] = last.slice(0, at + '\\item '.length).trimEnd();
  }
  listState.itemLines = [];
  listState.itemFence = {
    marker: fence.marker,
    language: fence.language,
    indent: fence.indent,
    lines: [],
  };
}

function writeLatexItemFence(output: string[], fence: ListFenceState): void {
  if (fence.language.length > 0) {
    output.push(`{\\footnotesize\\ttfamily ${escapeLatex(fence.language)}}`);
  }
  output.push('\\begin{verbatim}', ...fence.lines, '\\end{verbatim}');
}

function takeLatexItemFence(build: LatexBuild, line: string): boolean {
  const list = build.listState;
  if (list.itemFence) {
    if (readListFenceLine(list.itemFence, line, list.column ?? 2) === 'closed') {
      writeLatexItemFence(build.output, list.itemFence);
      list.itemFence = null;
      list.sealed = true;
    }
    return true;
  }
  if (list.stack.length === 0 || list.column === null || build.fence) {
    return false;
  }
  const opened = openListFence(line, list.column);
  if (!opened) {
    return false;
  }
  list.itemFence = {
    marker: opened.marker,
    language: opened.language,
    indent: opened.indent,
    lines: [],
  };
  list.break = false;
  return true;
}

function takeLatexDisplay(build: LatexBuild, line: string): boolean {
  if (line.trim() !== '$$' && !build.inDisplayMath) {
    return false;
  }
  if (line.trim() === '$$') {
    flushLatexProse(build.output, build.prose);
    flushLatexTable(build.output, build.tableLines);
    flushLatexQuote(build.output, build.quoteLines, build.slugCounts);
    if (!build.inDisplayMath) {
      resetListState(build.output, build.listState);
    }
    build.output.push('$$');
    build.inDisplayMath = !build.inDisplayMath;
    return true;
  }
  build.output.push(line);
  return true;
}

function appendLatexSourceLine(build: LatexBuild, line: string): void {
  if (takeLatexItemCode(build, line) || takeLatexItemFence(build, line)) {
    return;
  }
  const wasInCodeBlock = build.fence;
  build.fence = processCodeBlockLine(line, build.output, build.fence, build.listState);
  if (wasInCodeBlock !== build.fence) {
    flushLatexProse(build.output, build.prose);
    flushLatexTable(build.output, build.tableLines);
    flushLatexQuote(build.output, build.quoteLines, build.slugCounts);
    return;
  }
  if (build.fence) {
    build.output.push(line);
    return;
  }
  if (takeLatexItemMath(build, line) || takeLatexDisplay(build, line)) {
    return;
  }
  if (takeLatexItemTable(build, line)) {
    return;
  }
  if (takeLatexTable(build.output, line.trim(), build.tableLines)) {
    flushLatexProse(build.output, build.prose);
    flushLatexQuote(build.output, build.quoteLines, build.slugCounts);
    resetListState(build.output, build.listState);
    return;
  }
  if (takeLatexItemQuote(build, line)) {
    return;
  }
  if (takeLatexQuote(build.output, line, build.quoteLines, build.slugCounts)) {
    flushLatexProse(build.output, build.prose);
    resetListState(build.output, build.listState);
    return;
  }
  processMarkdownLine(line, build.output, build.listState, build.slugCounts, build.prose);
}

function emptyListState(): ListState {
  return {
    stack: [],
    break: false,
    itemLines: [],
    column: null,
    itemFence: null,
    itemQuote: null,
    itemTable: null,
    itemMath: null,
    itemCode: null,
    sealed: false,
    paragraphBreak: false,
    tailLines: null,
  };
}

function writeLatexItemQuote(build: LatexBuild): void {
  if (!build.listState.itemQuote) {
    return;
  }
  build.output.push(
    quoteToLatex(build.listState.itemQuote, convertInlineFormatting, build.slugCounts)
  );
}

function contentToLatex(content: string): string {
  const build: LatexBuild = {
    output: [],
    prose: [],
    fence: null,
    inDisplayMath: false,
    tableLines: [],
    quoteLines: [],
    listState: emptyListState(),
    slugCounts: new Map<string, number>(),
  };

  for (const line of plainFootnoteMarkers(expandLinkReferences(prepareMarkdownSource(content))).split(
    '\n'
  )) {
    appendLatexSourceLine(build, line);
  }

  if (build.inDisplayMath) {
    build.output.push('$$');
  }
  flushLatexProse(build.output, build.prose);
  flushLatexTable(build.output, build.tableLines);
  flushLatexQuote(build.output, build.quoteLines, build.slugCounts);
  if (build.fence) {
    build.output.push('\\end{verbatim}');
  }
  if (build.listState.itemFence) {
    writeLatexItemFence(build.output, build.listState.itemFence);
  }
  writeLatexItemQuote(build);
  if (build.listState.itemCode) {
    while (build.listState.itemCode[build.listState.itemCode.length - 1] === '') {
      build.listState.itemCode.pop();
    }
    build.output.push('\\begin{verbatim}', ...build.listState.itemCode, '\\end{verbatim}');
  }
  if (build.listState.itemMath) {
    build.output.push('$$', ...build.listState.itemMath, '$$');
  }
  if (build.listState.itemTable) {
    const table = parseMarkdownTable(build.listState.itemTable);
    build.output.push(
      table
        ? markdownTableToLatex(table, convertInlineFormatting)
        : build.listState.itemTable.join('\n')
    );
  }
  closeLatexLists(build.output, build.listState.stack);

  return build.output.join('\n');
}

const LATEX_CLASSES = new Set(['article', 'report', 'book', 'letter']);
const LATEX_SIZES = new Set(['10pt', '11pt', '12pt']);
const LATEX_PACKAGE = /^[A-Za-z][A-Za-z0-9-]*$/;
const BUILTIN_LATEX_PACKAGES = new Set([
  'inputenc',
  'fontenc',
  'hyperref',
  'amsmath',
  'amssymb',
  'graphicx',
  'ulem',
]);

function latexChoice(
  metadata: Record<string, unknown> | undefined,
  key: string,
  allowed: ReadonlySet<string>,
  fallback: string
): string {
  const value = metadata?.[key];
  return typeof value === 'string' && allowed.has(value) ? value : fallback;
}

function extraLatexPackages(metadata: Record<string, unknown> | undefined): string[] {
  const value = metadata?.packages;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is string =>
      typeof item === 'string' && LATEX_PACKAGE.test(item) && !BUILTIN_LATEX_PACKAGES.has(item)
  );
}

function buildLatexDocument(content: string, options: ExportOptions): string {
  const title = options.title ?? 'Untitled';
  const author = options.author ?? '';
  const metadata = options.metadata;
  const documentClass = latexChoice(metadata, 'documentClass', LATEX_CLASSES, 'article');
  const fontSize = latexChoice(metadata, 'fontSize', LATEX_SIZES, '11pt');

  const preamble = [
    `\\documentclass[${fontSize}]{${documentClass}}`,
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage{hyperref}',
    '\\usepackage{amsmath}',
    '\\usepackage{amssymb}',
    '\\usepackage{graphicx}',
    '\\usepackage[normalem]{ulem}',
    ...extraLatexPackages(metadata).map((name) => `\\usepackage{${name}}`),
    '',
    `\\title{${escapeLatex(title)}}`,
    `\\author{${escapeLatex(author)}}`,
    '\\date{\\today}',
    '',
  ];

  const body = contentToLatex(content);

  return [
    ...preamble,
    '\\begin{document}',
    '\\maketitle',
    '',
    body,
    '',
    '\\end{document}',
    '',
  ].join('\n');
}

export class LatexExporter implements Exporter {
  readonly format = 'latex';
  readonly label = 'LaTeX';
  readonly extension = 'tex';
  readonly mimeType = 'application/x-latex';

  async export(options: ExportOptions): Promise<ExportResult> {
    const warnings: string[] = [];

    try {
      const content = await inlineLocalImages(options.content, options.sourcePath, 'absolute');
      const latex = buildLatexDocument(content, options);
      await writeRegularFile(options.outputPath, latex);
      return { ok: true, outputPath: options.outputPath, warnings };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'LaTeX export failed',
        warnings,
      };
    }
  }
}
