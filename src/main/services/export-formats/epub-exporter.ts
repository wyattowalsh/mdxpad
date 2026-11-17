import { writeFile } from 'node:fs/promises';

import { allocateHeadingSlug, headingTag, parseAtxHeading } from '@shared/lib/markdown-heading';
import { normalizeTexMath } from '@shared/lib/markdown-math';

import { inlineLocalImages } from './export-image';
import { renderDisplayMathBlock, renderMarkdownInline } from './markdown-inline-html';
import { isTableRow, markdownTableToHtml, parseMarkdownTable } from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { readHtmlBlock } from './markdown-html';
import { closesFence, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { joinParagraphHtml, readSourceLine, type SourceLine } from './markdown-paragraph';
import { isLazyQuoteLine, quoteBody, quoteToHtml } from './markdown-quote';
import {
  closeHtmlLists,
  appendHtmlListText,
  isListContinuation,
  listContentColumn,
  parseListItem,
  pushHtmlListItem,
  type HtmlListFrame,
} from './markdown-list';
import { listItemHtml } from './markdown-task';
import type { Exporter, ExportOptions, ExportResult } from './types';

interface EpubChapter {
  title: string;
  content: string;
  slug: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function splitIntoChapters(content: string): {
  chapters: EpubChapter[];
  slugs: Map<string, number>;
} {
  return splitExpandedChapters(expandLinkReferences(normalizeTexMath(content)));
}

function splitExpandedChapters(content: string): {
  chapters: EpubChapter[];
  slugs: Map<string, number>;
} {
  const chapters: EpubChapter[] = [];
  const slugs = new Map<string, number>();
  const lines = content.split('\n');
  let currentTitle = 'Introduction';
  let currentSlug: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = parseAtxHeading(line);
    if (heading && heading.depth <= 2) {
      // Save previous chapter if it has content
      if (currentLines.length > 0 || chapters.length === 0) {
        chapters.push({
          title: currentTitle,
          content: currentLines.join('\n'),
          slug: currentSlug,
        });
      }
      currentSlug = allocateHeadingSlug(heading.text, slugs);
      currentTitle = heading.text;
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
      slug: currentSlug,
    });
  }

  // Filter out empty-only chapters, but keep at least one
  const nonEmpty = chapters.filter((ch) => ch.content.trim().length > 0);
  const kept =
    nonEmpty.length > 0
      ? nonEmpty
      : [chapters[0] ?? { title: 'Untitled', content: '', slug: null }];
  return { chapters: kept, slugs };
}

interface EpubLineState {
  fence: string | null;
  lists: HtmlListFrame[];
  displayMath: string[] | null;
  tableLines: string[];
  quoteLines: string[];
  paragraph: SourceLine[];
  listBreak: boolean;
  listColumn: number | null;
  slugCounts: Map<string, number>;
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
  if (state.quoteLines.length > 0 && isLazyQuoteLine(line)) {
    state.quoteLines.push(line.trim());
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

function consumeEpubHtml(
  htmlLines: string[],
  lines: readonly string[],
  index: number,
  state: EpubLineState
): number {
  if (state.fence || state.displayMath) {
    return index;
  }
  const block = readHtmlBlock(lines, index);
  if (!block) {
    return index;
  }
  flushEpubParagraph(htmlLines, state);
  flushEpubTable(htmlLines, state);
  flushEpubQuote(htmlLines, state);
  closeHtmlLists(htmlLines, state.lists);
  htmlLines.push(block.html);
  return block.nextIndex;
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
  htmlLines.push(epubHeading(state, level, text));
  return true;
}

function takeEpubListBreak(htmlLines: string[], raw: string, state: EpubLineState): boolean {
  const trimmed = raw.trim();
  if (trimmed === '') {
    flushEpubParagraph(htmlLines, state);
    if (state.lists.length > 0 && !state.listBreak) {
      state.listBreak = true;
    } else {
      closeHtmlLists(htmlLines, state.lists);
      state.listBreak = false;
      htmlLines.push('');
    }
    return true;
  }
  if (
    state.listBreak &&
    parseListItem(raw) === null &&
    !isListContinuation(raw, state.listColumn ?? 2)
  ) {
    closeHtmlLists(htmlLines, state.lists);
    htmlLines.push('');
  }
  state.listBreak = false;
  return false;
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
  const heading = parseAtxHeading(trimmed);
  if (heading && heading.depth >= 3) {
    flushEpubParagraph(htmlLines, state);
    closeHtmlLists(htmlLines, state.lists);
    htmlLines.push(epubHeading(state, heading.depth, heading.text));
    return;
  }
  if (takeEpubListBreak(htmlLines, raw, state)) {
    return;
  }
  const item = parseListItem(raw);
  if (item) {
    flushEpubParagraph(htmlLines, state);
    pushHtmlListItem(htmlLines, state.lists, item, listItemHtml(item.text, renderMarkdownInline));
    state.listColumn = listContentColumn(raw);
    return;
  }
  if (
    state.lists.length > 0 &&
    isListContinuation(raw, state.listColumn ?? 2) &&
    appendHtmlListText(htmlLines, renderMarkdownInline(raw.trim()))
  ) {
    return;
  }
  closeHtmlLists(htmlLines, state.lists);
  state.paragraph.push(readSourceLine(raw));
}

function epubHeading(state: EpubLineState, depth: number, text: string): string {
  return headingTag(depth, renderMarkdownInline(text), allocateHeadingSlug(text, state.slugCounts));
}

function chapterToHtml(chapter: EpubChapter, slugs: Map<string, number>): string {
  const htmlLines: string[] = [];
  if (chapter.slug) {
    htmlLines.push(`<a id="${chapter.slug}"></a>`);
  }
  const state: EpubLineState = {
    fence: null,
    lists: [],
    listBreak: false,
    listColumn: null,
    displayMath: null,
    tableLines: [],
    quoteLines: [],
    paragraph: [],
    slugCounts: slugs,
  };
  const lines = chapter.content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const htmlEnd = consumeEpubHtml(htmlLines, lines, index, state);
    if (htmlEnd > index) {
      index = htmlEnd;
      continue;
    }
    appendEpubLine(htmlLines, lines[index] ?? '', state);
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
      const content = await inlineLocalImages(options.content, options.sourcePath, 'data-url');
      const split = splitIntoChapters(content);

      const epubContent = split.chapters.map((chapter) => ({
        title: chapter.title,
        content: chapterToHtml(chapter, split.slugs),
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
