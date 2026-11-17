import { writeFile } from 'node:fs/promises';

import { isTableRow, markdownTableToLatex, parseMarkdownTable } from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { expandLinkReferences } from './markdown-reference';
import { readSourceLine } from './markdown-paragraph';
import { quoteBody, quoteToLatex } from './markdown-quote';
import { expandAutolinkText, protectAutolinks } from './markdown-autolink';
import { linkDestination } from './markdown-link';
import { parseListItem, type MarkdownListItem } from './markdown-list';
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
    return `\\href{${escapeLatex(src)}}{${escapeLatex(alt)}}`;
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

function formatInline(source: string): string {
  const protectedLinks = protectAutolinks(source);
  const raw = protectedLinks.text;
  const pattern =
    /(\*\*(.+?)\*\*|(?<![\w])__(.+?)__(?![\w])|`([^`]+)`|\*(.+?)\*|(?<![\w])_(.+?)_(?![\w])|\[([^\]]+)\]\(([^)]+)\)|~~(.+?)~~)/g;
  let result = '';
  let cursor = 0;
  for (const match of raw.matchAll(pattern)) {
    const index = match.index;
    const image =
      match[7] !== undefined && match[8] !== undefined && index > 0 && raw[index - 1] === '!';
    result += escapeLatex(raw.slice(cursor, image ? index - 1 : index));
    if (image) {
      const alt = match[7] ?? '';
      const src = match[8] ?? '';
      const path = linkDestination(src);
      result += latexImage(path, alt.length > 0 ? alt : path);
    } else if (match[2] !== undefined || match[3] !== undefined) {
      result += wrapLatex('textbf', match[2] ?? match[3] ?? '');
    } else if (match[4] !== undefined) {
      result += wrapLatex('texttt', match[4]);
    } else if (match[5] !== undefined || match[6] !== undefined) {
      result += wrapLatex('textit', match[5] ?? match[6] ?? '');
    } else if (match[7] !== undefined && match[8] !== undefined) {
      result += `\\href{${escapeLatex(linkDestination(match[8]))}}{${escapeLatex(match[7])}}`;
    } else if (match[9] !== undefined) {
      result += `\\sout{${escapeLatex(match[9])}}`;
    }
    cursor = index + match[0].length;
  }
  return restoreLatexAutolinks(result + escapeLatex(raw.slice(cursor)), protectedLinks.links);
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
  inCodeBlock: boolean,
  listState: ListState
): boolean {
  if (!line.trimStart().startsWith('```')) {
    return inCodeBlock;
  }
  if (inCodeBlock) {
    output.push('\\end{verbatim}');
    return false;
  }
  closeLatexLists(output, listState.stack);
  output.push('\\begin{verbatim}');
  return true;
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

function processMarkdownLine(raw: string, output: string[], listState: ListState): void {
  const source = readSourceLine(raw);
  const trimmed = source.text;
  if (trimmed === '') {
    resetListState(output, listState);
    output.push('');
    return;
  }

  const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
  if (headingMatch) {
    resetListState(output, listState);
    const cmd = getHeadingCommand(headingMatch[1]?.length ?? 1);
    output.push(`\\${cmd}{${convertInlineFormatting(headingMatch[2] ?? '')}}`);
    return;
  }

  if (isThematicBreak(trimmed)) {
    resetListState(output, listState);
    output.push('\\noindent\\rule{\\textwidth}{0.4pt}');
    return;
  }

  if (processListItem(raw, output, listState)) {
    return;
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
  inCodeBlock: boolean;
  inDisplayMath: boolean;
  tableLines: string[];
  quoteLines: string[];
  listState: ListState;
}

function appendLatexSourceLine(build: LatexBuild, line: string): void {
  const wasInCodeBlock = build.inCodeBlock;
  build.inCodeBlock = processCodeBlockLine(line, build.output, build.inCodeBlock, build.listState);
  if (wasInCodeBlock !== build.inCodeBlock) {
    flushLatexTable(build.output, build.tableLines);
    flushLatexQuote(build.output, build.quoteLines);
    return;
  }
  if (build.inCodeBlock) {
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
  processMarkdownLine(line, build.output, build.listState);
}

function contentToLatex(content: string): string {
  const build: LatexBuild = {
    output: [],
    inCodeBlock: false,
    inDisplayMath: false,
    tableLines: [],
    quoteLines: [],
    listState: { stack: [] },
  };

  for (const line of expandLinkReferences(content).split('\n')) {
    appendLatexSourceLine(build, line);
  }

  if (build.inDisplayMath) {
    build.output.push('$$');
  }
  flushLatexTable(build.output, build.tableLines);
  flushLatexQuote(build.output, build.quoteLines);
  if (build.inCodeBlock) {
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
      const latex = buildLatexDocument(options.content, options);
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
