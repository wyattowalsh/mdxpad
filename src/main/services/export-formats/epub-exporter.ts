import { writeFile } from 'node:fs/promises';

import { renderDisplayMathBlock, renderMarkdownInline } from './markdown-inline-html';
import { isTableRow, markdownTableToHtml, parseMarkdownTable } from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { closesFence, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { joinParagraphHtml, readSourceLine, type SourceLine } from './markdown-paragraph';
import { quoteBody, quoteToHtml } from './markdown-quote';
import {
  closeHtmlLists,
  parseListItem,
  pushHtmlListItem,
  type HtmlListFrame,
} from './markdown-list';
import { listItemHtml } from './markdown-task';
import type { Exporter, ExportOptions, ExportResult } from './types';

interface EpubChapter {
  title: string;
  content: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function splitIntoChapters(content: string): EpubChapter[] {
  return splitExpandedChapters(expandLinkReferences(content));
}

function splitExpandedChapters(content: string): EpubChapter[] {
  const chapters: EpubChapter[] = [];
  const lines = content.split('\n');
  let currentTitle = 'Introduction';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = /^(#{1,2})\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      // Save previous chapter if it has content
      if (currentLines.length > 0 || chapters.length === 0) {
        chapters.push({
          title: currentTitle,
          content: currentLines.join('\n'),
        });
      }
      currentTitle = headingMatch[2] ?? 'Untitled';
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  // Push final chapter
  if (currentLines.length > 0 || chapters.length === 0) {
    chapters.push({
      title: currentTitle,
      content: currentLines.join('\n'),
    });
  }

  // Filter out empty-only chapters, but keep at least one
  const nonEmpty = chapters.filter((ch) => ch.content.trim().length > 0);
  return nonEmpty.length > 0 ? nonEmpty : [chapters[0] ?? { title: 'Untitled', content: '' }];
}

interface EpubLineState {
  fence: string | null;
  lists: HtmlListFrame[];
  displayMath: string[] | null;
  tableLines: string[];
  quoteLines: string[];
  paragraph: SourceLine[];
}

function flushEpubParagraph(htmlLines: string[], state: EpubLineState): void {
  if (state.paragraph.length === 0) {
    return;
  }
  const lines = state.paragraph.splice(0, state.paragraph.length);
  htmlLines.push(`<p>${joinParagraphHtml(lines, renderMarkdownInline)}</p>`);
}

function flushEpubQuote(htmlLines: string[], state: EpubLineState): void {
  if (state.quoteLines.length === 0) {
    return;
  }
  const lines = state.quoteLines.splice(0, state.quoteLines.length);
  htmlLines.push(quoteToHtml(lines, renderMarkdownInline));
}

function consumeEpubQuote(htmlLines: string[], line: string, state: EpubLineState): boolean {
  const body = quoteBody(line);
  if (body !== null) {
    flushEpubParagraph(htmlLines, state);
    closeHtmlLists(htmlLines, state.lists);
    flushEpubTable(htmlLines, state);
    state.quoteLines.push(body);
    return true;
  }
  if (state.quoteLines.length > 0) {
    flushEpubQuote(htmlLines, state);
  }
  return false;
}

function flushEpubTable(htmlLines: string[], state: EpubLineState): void {
  if (state.tableLines.length === 0) {
    return;
  }
  const lines = state.tableLines.splice(0, state.tableLines.length);
  const table = parseMarkdownTable(lines);
  if (!table) {
    for (const line of lines) {
      htmlLines.push(`<p>${renderMarkdownInline(line)}</p>`);
    }
    return;
  }
  htmlLines.push(markdownTableToHtml(table, renderMarkdownInline));
}

function consumeEpubTable(htmlLines: string[], trimmed: string, state: EpubLineState): boolean {
  if (isTableRow(trimmed)) {
    flushEpubParagraph(htmlLines, state);
    closeHtmlLists(htmlLines, state.lists);
    state.tableLines.push(trimmed);
    return true;
  }
  if (state.tableLines.length > 0) {
    flushEpubTable(htmlLines, state);
  }
  return false;
}

function consumeEpubDisplayMath(htmlLines: string[], line: string, state: EpubLineState): boolean {
  if (state.fence) {
    return false;
  }
  const trimmed = line.trim();
  if (trimmed === '$$') {
    flushEpubParagraph(htmlLines, state);
    flushEpubTable(htmlLines, state);
    flushEpubQuote(htmlLines, state);
    closeHtmlLists(htmlLines, state.lists);
    if (state.displayMath) {
      htmlLines.push(renderDisplayMathBlock(state.displayMath));
      state.displayMath = null;
    } else {
      state.displayMath = [];
    }
    return true;
  }
  if (state.displayMath) {
    state.displayMath.push(line);
    return true;
  }
  return false;
}

function appendEpubLine(htmlLines: string[], line: string, state: EpubLineState): void {
  if (state.fence) {
    if (closesFence(line, state.fence)) {
      htmlLines.push('</code></pre>');
      state.fence = null;
    } else {
      htmlLines.push(escapeHtml(line));
    }
    return;
  }
  const marker = openingFence(line);
  if (marker) {
    flushEpubParagraph(htmlLines, state);
    flushEpubTable(htmlLines, state);
    flushEpubQuote(htmlLines, state);
    closeHtmlLists(htmlLines, state.lists);
    htmlLines.push('<pre><code>');
    state.fence = marker;
    return;
  }
  const trimmed = line.trim();
  if (consumeEpubDisplayMath(htmlLines, line, state)) {
    return;
  }
  if (consumeEpubTable(htmlLines, trimmed, state)) {
    return;
  }
  if (consumeEpubQuote(htmlLines, trimmed, state)) {
    return;
  }
  appendEpubFlow(htmlLines, line, state);
}

function takeEpubSetext(htmlLines: string[], raw: string, state: EpubLineState): boolean {
  const level = setextLevel(raw);
  if (level === null || state.paragraph.length === 0) {
    return false;
  }
  const text = state.paragraph.map((line) => line.text).join(' ');
  state.paragraph.length = 0;
  closeHtmlLists(htmlLines, state.lists);
  htmlLines.push(`<h${level}>${renderMarkdownInline(text)}</h${level}>`);
  return true;
}

function appendEpubFlow(htmlLines: string[], raw: string, state: EpubLineState): void {
  const trimmed = raw.trim();
  if (takeEpubSetext(htmlLines, raw, state)) {
    return;
  }
  if (isThematicBreak(trimmed)) {
    flushEpubParagraph(htmlLines, state);
    closeHtmlLists(htmlLines, state.lists);
    htmlLines.push('<hr />');
    return;
  }
  const headingMatch = /^(#{3,6})\s+(.+)$/.exec(trimmed);
  if (headingMatch) {
    flushEpubParagraph(htmlLines, state);
    closeHtmlLists(htmlLines, state.lists);
    const level = headingMatch[1]?.length ?? 3;
    htmlLines.push(`<h${level}>${renderMarkdownInline(headingMatch[2] ?? '')}</h${level}>`);
    return;
  }
  if (trimmed === '') {
    flushEpubParagraph(htmlLines, state);
    closeHtmlLists(htmlLines, state.lists);
    htmlLines.push('');
    return;
  }
  const item = parseListItem(raw);
  if (item) {
    flushEpubParagraph(htmlLines, state);
    pushHtmlListItem(htmlLines, state.lists, item, listItemHtml(item.text, renderMarkdownInline));
    return;
  }
  closeHtmlLists(htmlLines, state.lists);
  state.paragraph.push(readSourceLine(raw));
}

function chapterToHtml(chapter: EpubChapter): string {
  const htmlLines: string[] = [];
  const state: EpubLineState = {
    fence: null,
    lists: [],
    displayMath: null,
    tableLines: [],
    quoteLines: [],
    paragraph: [],
  };
  for (const line of chapter.content.split('\n')) {
    appendEpubLine(htmlLines, line, state);
  }
  if (state.displayMath) {
    htmlLines.push(renderDisplayMathBlock(state.displayMath));
  }
  flushEpubParagraph(htmlLines, state);
  flushEpubTable(htmlLines, state);
  flushEpubQuote(htmlLines, state);
  closeHtmlLists(htmlLines, state.lists);
  if (state.fence) {
    htmlLines.push('</code></pre>');
  }
  return htmlLines.join('\n');
}

export class EpubExporter implements Exporter {
  readonly format = 'epub';
  readonly label = 'EPUB';
  readonly extension = 'epub';
  readonly mimeType = 'application/epub+zip';

  async export(options: ExportOptions): Promise<ExportResult> {
    const warnings: string[] = [];

    try {
      const title = options.title ?? 'Untitled';
      const author = options.author ?? 'MDXPad';
      const chapters = splitIntoChapters(options.content);

      const epubContent = chapters.map((chapter) => ({
        title: chapter.title,
        content: chapterToHtml(chapter),
      }));

      const epubGen = await import('epub-gen-memory');
      const epubCreate = epubGen.default;

      const epubBuffer = await epubCreate({ title, author }, epubContent);

      const buffer = epubBuffer instanceof Buffer ? epubBuffer : Buffer.from(epubBuffer);
      await writeFile(options.outputPath, buffer);

      return {
        ok: true,
        outputPath: options.outputPath,
        warnings,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'EPUB export failed';
      return {
        ok: false,
        error: message,
        warnings,
      };
    }
  }
}
