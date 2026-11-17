import { writeFile } from 'node:fs/promises';

import { allocateHeadingSlug, headingAnchor, parseAtxHeading } from '@shared/lib/markdown-heading';
import { prepareMarkdownSource } from '@shared/lib/markdown-math';

import { inlineLocalImages } from './export-image';

import { isTableRow, markdownTableToLatex, parseMarkdownTable } from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { closesFence, fenceLanguage, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { readSourceLine } from './markdown-paragraph';
import { isLazyQuoteLine, quoteBody, quoteToLatex } from './markdown-quote';
import { expandAutolinkText, protectAutolinks } from './markdown-autolink';
import { protectEscapes, restoreEscapes } from './markdown-escape';
import { decodeHtmlEntities } from './markdown-entity';
import { linkDestination } from './markdown-link';
import {
  isListContinuation,
  listContentColumn,
  parseListItem,
  type MarkdownListItem,
} from './markdown-list';
import { splitTaskItem, taskItemLatex } from './markdown-task';
import type { Exporter, ExportOptions, ExportResult } from './types';

const LATEX_BACKSLASH = '\uE000';

function escapeLatex(text: string): string {
  return text
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
    .replaceAll(LATEX_BACKSLASH, '\\textbackslash{}');
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

function latexImage(src: string, alt: string): string {
  if (/^https?:\/\//i.test(src)) {
    const label = alt.length > 0 ? formatProtected(alt) : escapeLatex(src);
    return `\\href{${escapeLatex(src)}}{${label}}`;
  }
  const path = src.replaceAll('%', '\\%').replaceAll('}', '');
  return `\\includegraphics{${path}}`;
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
      result += latexImage(path, alt.length > 0 ? alt : path);
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
  item: MarkdownListItem
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
  output.push(`  \\item ${latexListItem(item.text)}`);
}

function latexListItem(text: string): string {
  const task = splitTaskItem(text);
  if (!task) {
    return convertInlineFormatting(text);
  }
  return taskItemLatex(task.checked, convertInlineFormatting(task.body));
}

function processListItem(raw: string, output: string[], listState: ListState): boolean {
  const item = parseListItem(raw);
  if (!item) {
    return false;
  }
  openLatexListItem(output, listState.stack, item);
  return true;
}

function isLatexBoundary(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length === 0 ||
    trimmed.startsWith('\\begin') ||
    trimmed.startsWith('\\end') ||
    trimmed.startsWith('\\item') ||
    trimmed.startsWith('\\noindent') ||
    trimmed.startsWith('\\section') ||
    trimmed.startsWith('\\subsection') ||
    trimmed.startsWith('\\paragraph') ||
    trimmed.startsWith('\\subparagraph')
  );
}

function latexLabeledHeading(
  command: string,
  formatted: string,
  slugSource: string,
  counts: Map<string, number>
): string {
  return `\\${command}{${formatted}}\\label{${allocateHeadingSlug(slugSource, counts)}}`;
}

function takeLatexSetext(output: string[], raw: string, counts: Map<string, number>): boolean {
  const level = setextLevel(raw);
  if (level === null) {
    return false;
  }
  const body: string[] = [];
  while (output.length > 0 && !isLatexBoundary(output[output.length - 1] ?? '')) {
    body.unshift((output.pop() ?? '').replace(/\\\\$/, '').trim());
  }
  if (!body.some((line) => line.length > 0)) {
    output.push(...body);
    return false;
  }
  const command = level === 1 ? 'section' : 'subsection';
  const text = body.filter((line) => line.length > 0).join(' ');
  output.push(latexLabeledHeading(command, text, text, counts));
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

function processMarkdownLine(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>
): void {
  if (takeLatexSetext(output, raw, counts) || takeLatexListBreak(raw, output, listState)) {
    return;
  }
  const source = readSourceLine(raw);
  const trimmed = source.text;
  const heading = parseAtxHeading(trimmed);
  if (heading) {
    resetListState(output, listState);
    const cmd = getHeadingCommand(heading.depth);
    output.push(
      latexLabeledHeading(cmd, convertInlineFormatting(heading.text), heading.text, counts)
    );
    return;
  }

  if (isThematicBreak(trimmed)) {
    resetListState(output, listState);
    output.push('\\noindent\\rule{\\textwidth}{0.4pt}');
    return;
  }

  if (processListItem(raw, output, listState)) {
    listState.column = listContentColumn(raw);
    return;
  }
  if (listState.stack.length > 0 && isListContinuation(raw, listState.column ?? 2)) {
    const last = output[output.length - 1];
    if (last?.includes('\\item ')) {
      output[output.length - 1] = `${last} ${convertInlineFormatting(raw.trim())}`;
      return;
    }
  }

  const formatted = convertInlineFormatting(trimmed);
  output.push(source.hardBreak ? `${formatted}\\\\` : formatted);
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
    quoteLines.push(line.trim());
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
    flushLatexTable(build.output, build.tableLines);
    flushLatexQuote(build.output, build.quoteLines);
    return;
  }
  if (build.fence) {
    build.output.push(line);
    return;
  }
  if (line.trim() === '$$') {
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
    flushLatexQuote(build.output, build.quoteLines);
    resetListState(build.output, build.listState);
    return;
  }
  if (takeLatexQuote(build.output, line.trim(), build.quoteLines)) {
    resetListState(build.output, build.listState);
    return;
  }
  processMarkdownLine(line, build.output, build.listState, build.slugCounts);
}

function contentToLatex(content: string): string {
  const build: LatexBuild = {
    output: [],
    fence: null,
    inDisplayMath: false,
    tableLines: [],
    quoteLines: [],
    listState: { stack: [], break: false, column: null },
    slugCounts: new Map<string, number>(),
  };

  for (const line of expandLinkReferences(prepareMarkdownSource(content)).split('\n')) {
    appendLatexSourceLine(build, line);
  }

  if (build.inDisplayMath) {
    build.output.push('$$');
  }
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
