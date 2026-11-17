import { writeFile } from 'node:fs/promises';

import { allocateHeadingSlug, headingAnchor, parseAtxHeading } from '@shared/lib/markdown-heading';
import { prepareMarkdownSource } from '@shared/lib/markdown-math';

import { inlineLocalImages } from './export-image';

import { isTableRow, markdownTableToLatex, parseMarkdownTable } from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { closesFence, fenceLanguage, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { renderedSegments } from './markdown-marks';
import { readSourceLine, type SourceLine } from './markdown-paragraph';
import { isLazyQuoteLine, quoteBody, quoteToLatex } from './markdown-quote';
import { expandAutolinkText, protectAutolinks } from './markdown-autolink';
import { protectEscapes, restoreEscapes } from './markdown-escape';
import { decodeHtmlEntities } from './markdown-entity';
import { linkDestination, linkTitle } from './markdown-link';
import {
  isListContinuation,
  listContentColumn,
  parseListItem,
  type MarkdownListItem,
} from './markdown-list';
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

function isCurrencySpan(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (/\d/.test(trimmed) && /^[\d\s.,:;]+$/.test(trimmed)) {
    return true;
  }
  return /\s/.test(value) && /[A-Za-z]{2,}/.test(trimmed) && !/[\\^_{}=+*/<>]/.test(value);
}

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

function latexImage(src: string, alt: string, title: string | null): string {
  const caption = title ? ` \\textit{${escapeLatex(title)}}` : '';
  if (/^https?:\/\//i.test(src)) {
    const label = alt.length > 0 ? formatProtected(alt) : escapeLatex(src);
    return `\\href{${escapeLatex(src)}}{${label}}${caption}`;
  }
  const path = src.replaceAll('%', '\\%').replaceAll('}', '');
  return `\\includegraphics{${path}}${caption}`;
}

function restoreLatexAutolinks(
  value: string,
  links: ReturnType<typeof protectAutolinks>['links']
): string {
  return expandAutolinkText(value, links)
    .map((part) =>
      part.href ? `\\href{${escapeLatex(part.href)}}{${escapeLatex(part.text)}}` : part.text
    )
    .join('');
}

const INLINE_PATTERN =
  '(\\*\\*\\*(.+?)\\*\\*\\*|(?<![\\w])___(.+?)___(?![\\w])|\\*\\*(.+?)\\*\\*|(?<![\\w])__(.+?)__(?![\\w])|`([^`]+)`|\\*([^*]*(?:\\*\\*[^*]*)*)\\*|(?<![\\w])_([^_]*(?:__[^_]*)*)_(?![\\w])|\\[([^\\]]+)\\]\\(((?:[^()]|\\([^()]*\\))+)\\)|~~(.+?)~~)';

function formatProtected(raw: string): string {
  let result = '';
  let cursor = 0;
  for (const match of raw.matchAll(new RegExp(INLINE_PATTERN, 'g'))) {
    const index = match.index;
    const image =
      match[9] !== undefined && match[10] !== undefined && index > 0 && raw[index - 1] === '!';
    result += escapeLatex(decodeHtmlEntities(raw.slice(cursor, image ? index - 1 : index)));
    if (image) {
      const alt = match[9] ?? '';
      const src = match[10] ?? '';
      const path = linkDestination(decodeHtmlEntities(src));
      result += latexImage(path, alt.length > 0 ? alt : path, linkTitle(decodeHtmlEntities(src)));
    } else if (match[2] !== undefined || match[3] !== undefined) {
      result += `\\textbf{\\textit{${formatProtected(match[2] ?? match[3] ?? '')}}}`;
    } else if (match[4] !== undefined || match[5] !== undefined) {
      result += `\\textbf{${formatProtected(match[4] ?? match[5] ?? '')}}`;
    } else if (match[6] !== undefined) {
      result += wrapLatex('texttt', match[6]);
    } else if (match[7] !== undefined || match[8] !== undefined) {
      result += `\\textit{${formatProtected(match[7] ?? match[8] ?? '')}}`;
    } else if (match[9] !== undefined && match[10] !== undefined) {
      result += latexHref(match[9], match[10]);
    } else if (match[11] !== undefined) {
      result += `\\sout{${formatProtected(match[11])}}`;
    }
    cursor = index + match[0].length;
  }
  return result + escapeLatex(decodeHtmlEntities(raw.slice(cursor)));
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
}

interface ListState {
  stack: LatexListFrame[];
  break: boolean;
  itemLines: SourceLine[];
  column: number | null;
}

function closeLatexLists(output: string[], stack: LatexListFrame[]): void {
  while (stack.length > 0) {
    const frame = stack.pop();
    output.push(frame?.ordered ? '\\end{enumerate}' : '\\end{itemize}');
  }
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

function openLatexListItem(
  output: string[],
  stack: LatexListFrame[],
  item: MarkdownListItem,
  formatted: string
): void {
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (
      !top ||
      (top.level === item.level && top.ordered === item.ordered) ||
      top.level < item.level
    ) {
      break;
    }
    output.push(top.ordered ? '\\end{enumerate}' : '\\end{itemize}');
    stack.pop();
  }
  const top = stack[stack.length - 1];
  if (!top || top.level < item.level) {
    output.push(item.ordered ? '\\begin{enumerate}' : '\\begin{itemize}');
    if (item.ordered && item.start > 1) {
      const counters = ['enumi', 'enumii', 'enumiii', 'enumiv', 'enumv', 'enumvi'];
      const counter = counters[item.level] ?? 'enumi';
      output.push(`\\setcounter{${counter}}{${item.start - 1}}`);
    }
    stack.push({ ordered: item.ordered, level: item.level });
  }
  output.push(`  \\item ${formatted}`);
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

function processListItem(raw: string, output: string[], listState: ListState): boolean {
  const item = parseListItem(raw);
  if (!item) {
    return false;
  }
  listState.itemLines = [{ text: item.text, hardBreak: readSourceLine(raw).hardBreak }];
  openLatexListItem(output, listState.stack, item, renderLatexItem(listState.itemLines));
  return true;
}

function takeLatexListContinuation(raw: string, output: string[], listState: ListState): boolean {
  if (listState.stack.length === 0 || !isListContinuation(raw, listState.column ?? 2)) {
    return false;
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

function takeLatexListBreak(raw: string, output: string[], listState: ListState): boolean {
  const source = readSourceLine(raw);
  if (source.text !== '') {
    if (
      listState.break &&
      parseListItem(raw) === null &&
      !isListContinuation(raw, listState.column ?? 2)
    ) {
      resetListState(output, listState);
    }
    listState.break = false;
    return false;
  }
  if (listState.stack.length > 0 && !listState.break) {
    listState.break = true;
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
  if (takeLatexHeading(raw, output, listState, counts, prose)) {
    return;
  }
  const source = readSourceLine(raw);
  if (parseListItem(raw)) {
    flushLatexProse(output, prose);
  }
  if (processListItem(raw, output, listState)) {
    listState.column = listContentColumn(raw);
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

function flushLatexQuote(output: string[], quoteLines: string[]): void {
  if (quoteLines.length === 0) {
    return;
  }
  const lines = quoteLines.splice(0, quoteLines.length);
  output.push(quoteToLatex(lines, convertInlineFormatting));
}

function takeLatexQuote(output: string[], line: string, quoteLines: string[]): boolean {
  const body = quoteBody(line);
  if (body !== null) {
    quoteLines.push(body);
    return true;
  }
  if (quoteLines.length > 0 && isLazyQuoteLine(line)) {
    quoteLines.push(line);
    return true;
  }
  if (quoteLines.length > 0) {
    flushLatexQuote(output, quoteLines);
  }
  return false;
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

function appendLatexSourceLine(build: LatexBuild, line: string): void {
  const wasInCodeBlock = build.fence;
  build.fence = processCodeBlockLine(line, build.output, build.fence, build.listState);
  if (wasInCodeBlock !== build.fence) {
    flushLatexProse(build.output, build.prose);
    flushLatexTable(build.output, build.tableLines);
    flushLatexQuote(build.output, build.quoteLines);
    return;
  }
  if (build.fence) {
    build.output.push(line);
    return;
  }
  if (line.trim() === '$$') {
    flushLatexProse(build.output, build.prose);
    flushLatexTable(build.output, build.tableLines);
    flushLatexQuote(build.output, build.quoteLines);
    if (!build.inDisplayMath) {
      resetListState(build.output, build.listState);
    }
    build.output.push('$$');
    build.inDisplayMath = !build.inDisplayMath;
    return;
  }
  if (build.inDisplayMath) {
    build.output.push(line);
    return;
  }
  if (takeLatexTable(build.output, line.trim(), build.tableLines)) {
    flushLatexProse(build.output, build.prose);
    flushLatexQuote(build.output, build.quoteLines);
    resetListState(build.output, build.listState);
    return;
  }
  if (takeLatexQuote(build.output, line, build.quoteLines)) {
    flushLatexProse(build.output, build.prose);
    resetListState(build.output, build.listState);
    return;
  }
  processMarkdownLine(line, build.output, build.listState, build.slugCounts, build.prose);
}

function contentToLatex(content: string): string {
  const build: LatexBuild = {
    output: [],
    prose: [],
    fence: null,
    inDisplayMath: false,
    tableLines: [],
    quoteLines: [],
    listState: { stack: [], break: false, itemLines: [], column: null },
    slugCounts: new Map<string, number>(),
  };

  for (const line of expandLinkReferences(prepareMarkdownSource(content)).split('\n')) {
    appendLatexSourceLine(build, line);
  }

  if (build.inDisplayMath) {
    build.output.push('$$');
  }
  flushLatexProse(build.output, build.prose);
  flushLatexTable(build.output, build.tableLines);
  flushLatexQuote(build.output, build.quoteLines);
  if (build.fence) {
    build.output.push('\\end{verbatim}');
  }
  closeLatexLists(build.output, build.listState.stack);

  return build.output.join('\n');
}

function buildLatexDocument(content: string, options: ExportOptions): string {
  const title = options.title ?? 'Untitled';
  const author = options.author ?? '';

  const preamble = [
    '\\documentclass[11pt]{article}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage{hyperref}',
    '\\usepackage{amsmath}',
    '\\usepackage{amssymb}',
    '\\usepackage{graphicx}',
    '\\usepackage[normalem]{ulem}',
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
      await writeFile(options.outputPath, latex, 'utf-8');
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
