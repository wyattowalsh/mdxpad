import { writeFile } from 'node:fs/promises';

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

function convertInlineFormatting(raw: string): string {
  const pattern =
    /(\*\*(.+?)\*\*|(?<![\w])__(.+?)__(?![\w])|`([^`]+)`|\*(.+?)\*|(?<![\w])_(.+?)_(?![\w])|\[([^\]]+)\]\(([^)]+)\))/g;
  let result = '';
  let cursor = 0;
  for (const match of raw.matchAll(pattern)) {
    const index = match.index;
    result += escapeLatex(raw.slice(cursor, index));
    if (match[2] !== undefined || match[3] !== undefined) {
      result += wrapLatex('textbf', match[2] ?? match[3] ?? '');
    } else if (match[4] !== undefined) {
      result += wrapLatex('texttt', match[4]);
    } else if (match[5] !== undefined || match[6] !== undefined) {
      result += wrapLatex('textit', match[5] ?? match[6] ?? '');
    } else if (match[7] !== undefined && match[8] !== undefined) {
      result += `\\href{${escapeLatex(match[8])}}{${escapeLatex(match[7])}}`;
    }
    cursor = index + match[0].length;
  }
  return result + escapeLatex(raw.slice(cursor));
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

function closeOpenLists(output: string[], unordered: boolean, ordered: boolean): void {
  if (unordered) {
    output.push('\\end{itemize}');
  }
  if (ordered) {
    output.push('\\end{enumerate}');
  }
}

interface ListState {
  inUnorderedList: boolean;
  inOrderedList: boolean;
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
  closeOpenLists(output, listState.inUnorderedList, listState.inOrderedList);
  listState.inUnorderedList = false;
  listState.inOrderedList = false;
  output.push('\\begin{verbatim}');
  return true;
}

function resetListState(output: string[], listState: ListState): void {
  closeOpenLists(output, listState.inUnorderedList, listState.inOrderedList);
  listState.inUnorderedList = false;
  listState.inOrderedList = false;
}

function processListItem(trimmed: string, output: string[], listState: ListState): boolean {
  const ulMatch = /^[-*+]\s+(.+)$/.exec(trimmed);
  if (ulMatch) {
    if (!listState.inUnorderedList) {
      if (listState.inOrderedList) {
        output.push('\\end{enumerate}');
        listState.inOrderedList = false;
      }
      output.push('\\begin{itemize}');
      listState.inUnorderedList = true;
    }
    output.push(`  \\item ${convertInlineFormatting(ulMatch[1] ?? '')}`);
    return true;
  }

  const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
  if (olMatch) {
    if (!listState.inOrderedList) {
      if (listState.inUnorderedList) {
        output.push('\\end{itemize}');
        listState.inUnorderedList = false;
      }
      output.push('\\begin{enumerate}');
      listState.inOrderedList = true;
    }
    output.push(`  \\item ${convertInlineFormatting(olMatch[1] ?? '')}`);
    return true;
  }

  return false;
}

function processMarkdownLine(trimmed: string, output: string[], listState: ListState): void {
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

  if (processListItem(trimmed, output, listState)) {
    return;
  }

  if (/^[-*_]{3,}$/.test(trimmed)) {
    resetListState(output, listState);
    output.push('\\noindent\\rule{\\textwidth}{0.4pt}');
    return;
  }

  output.push(convertInlineFormatting(trimmed));
}

function contentToLatex(content: string): string {
  const lines = content.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  const listState: ListState = { inUnorderedList: false, inOrderedList: false };

  for (const line of lines) {
    const wasInCodeBlock: boolean = inCodeBlock;
    inCodeBlock = processCodeBlockLine(line, output, inCodeBlock, listState);
    if (wasInCodeBlock !== inCodeBlock) {
      continue;
    }
    if (inCodeBlock) {
      output.push(line);
      continue;
    }
    processMarkdownLine(line.trim(), output, listState);
  }

  if (inCodeBlock) {
    output.push('\\end{verbatim}');
  }
  closeOpenLists(output, listState.inUnorderedList, listState.inOrderedList);

  return output.join('\n');
}

function buildLatexDocument(content: string, options: ExportOptions): string {
  const title = options.title ?? 'Untitled';
  const author = options.author ?? '';

  const preamble = [
    '\\documentclass[11pt]{article}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage{hyperref}',
    '\\usepackage{graphicx}',
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
