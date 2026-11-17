import { writeFile } from 'node:fs/promises';

import { allocateHeadingSlug, headingTag, parseAtxHeading } from '@shared/lib/markdown-heading';
import { prepareMarkdownSource } from '@shared/lib/markdown-math';

import { inlineLocalImages } from './export-image';
import { renderDisplayMathBlock, renderMarkdownInline } from './markdown-inline-html';
import { isTableRow, markdownTableToHtml, parseMarkdownTable } from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { readHtmlBlock } from './markdown-html';
import { CODE_HIGHLIGHT_CSS, renderFencedCode } from './markdown-code';
import { closesFence, fenceLanguage, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { joinParagraphHtml, readSourceLine, type SourceLine } from './markdown-paragraph';
import { isLazyQuoteLine, quoteBody, quoteMarkerLine, quoteToHtml } from './markdown-quote';
import {
  closeHtmlLists,
  continuesList,
  isListContinuation,
  listContentColumn,
  parseListItem,
  pushHtmlListItem,
  type HtmlListFrame,
  type MarkdownListItem,
} from './markdown-list';
import {
  breakListParagraph,
  continueOpenList,
  finishListItemFence,
  openListItem,
  resetListItem,
  takeListItemCode,
  takeListItemFence,
  takeListItemRule,
  takeListItemSetext,
  takeListItemMath,
  takeListItemQuote,
  takeListItemTable,
} from './markdown-list-fence';
import type { Exporter, ExportOptions, ExportResult } from './types';

interface EpubChapter {
  title: string;
  content: string;
  slug: string | null;
}

function splitIntoChapters(content: string): {
  chapters: EpubChapter[];
  slugs: Map<string, number>;
} {
  return splitExpandedChapters(expandLinkReferences(prepareMarkdownSource(content)));
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
  fence: { marker: string; language: string; lines: string[] } | null;
  lists: HtmlListFrame[];
  displayMath: string[] | null;
  tableLines: string[];
  quoteLines: string[];
  paragraph: SourceLine[];
  listBreak: boolean;
  listLines: SourceLine[];
  listColumn: number | null;
  itemHtml: string;
  itemFence: { marker: string; language: string; indent: number; lines: string[] } | null;
  itemQuote: string[] | null;
  itemTable: string[] | null;
  itemMath: string[] | null;
  itemCode: string[] | null;
  loose: boolean;
  parts: string[];
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
  htmlLines.push(quoteToHtml(lines, renderMarkdownInline, state.slugCounts));
}

function consumeEpubQuote(htmlLines: string[], line: string, state: EpubLineState): boolean {
  if (takeListItemQuote(state, line, renderMarkdownInline, state.lists.length > 0)) {
    return true;
  }
  const body = quoteBody(line);
  if (body !== null) {
    flushEpubParagraph(htmlLines, state);
    closeEpubList(htmlLines, state);
    flushEpubTable(htmlLines, state);
    state.quoteLines.push(quoteMarkerLine(body));
    return true;
  }
  if (state.quoteLines.length > 0 && isLazyQuoteLine(line)) {
    state.quoteLines.push(line);
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

function consumeEpubTable(htmlLines: string[], line: string, state: EpubLineState): boolean {
  if (takeListItemTable(state, line, renderMarkdownInline, state.lists.length > 0)) {
    return true;
  }
  const trimmed = line.trim();
  if (isTableRow(trimmed)) {
    flushEpubParagraph(htmlLines, state);
    closeEpubList(htmlLines, state);
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
  if (takeListItemMath(state, line, renderMarkdownInline, state.lists.length > 0)) {
    return true;
  }
  const trimmed = line.trim();
  if (trimmed === '$$') {
    flushEpubParagraph(htmlLines, state);
    flushEpubTable(htmlLines, state);
    flushEpubQuote(htmlLines, state);
    closeEpubList(htmlLines, state);
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
): number | null {
  if (state.fence || state.displayMath) {
    return null;
  }
  const block = readHtmlBlock(lines, index);
  if (!block) {
    return null;
  }
  flushEpubParagraph(htmlLines, state);
  flushEpubTable(htmlLines, state);
  flushEpubQuote(htmlLines, state);
  closeEpubList(htmlLines, state);
  htmlLines.push(block.html);
  return block.nextIndex;
}

function closeEpubList(htmlLines: string[], state: EpubLineState): void {
  finishListItemFence(state, renderMarkdownInline);
  closeHtmlLists(htmlLines, state.lists);
  state.listColumn = null;
  state.itemHtml = '';
  state.listLines = [];
  state.itemFence = null;
  state.itemQuote = null;
  state.itemTable = null;
  state.itemMath = null;
  state.itemCode = null;
}

function appendEpubLine(htmlLines: string[], line: string, state: EpubLineState): void {
  if (
    takeListItemCode(state, line, renderMarkdownInline, state.lists.length > 0) ||
    takeListItemSetext(
      state,
      line,
      (level, text) => epubHeading(state, level, text),
      state.lists.length > 0
    ) ||
    takeListItemRule(state, line, renderMarkdownInline, state.lists.length > 0)
  ) {
    return;
  }
  if (takeListItemFence(state, line, renderMarkdownInline, state.lists.length > 0)) {
    return;
  }
  if (state.fence) {
    if (closesFence(line, state.fence.marker)) {
      htmlLines.push(renderFencedCode(state.fence.language, state.fence.lines));
      state.fence = null;
    } else {
      state.fence.lines.push(line);
    }
    return;
  }
  const marker = openingFence(line);
  if (marker) {
    flushEpubParagraph(htmlLines, state);
    flushEpubTable(htmlLines, state);
    flushEpubQuote(htmlLines, state);
    closeEpubList(htmlLines, state);
    state.fence = { marker, language: fenceLanguage(line), lines: [] };
    return;
  }
  if (consumeEpubDisplayMath(htmlLines, line, state)) {
    return;
  }
  if (consumeEpubTable(htmlLines, line, state)) {
    return;
  }
  if (consumeEpubQuote(htmlLines, line, state)) {
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
  closeEpubList(htmlLines, state);
  htmlLines.push(epubHeading(state, level, text));
  return true;
}

function takeEpubListBreak(htmlLines: string[], raw: string, state: EpubLineState): boolean {
  const trimmed = raw.trim();
  if (trimmed === '') {
    flushEpubParagraph(htmlLines, state);
    if (state.lists.length > 0 && !state.listBreak) {
      breakListParagraph(state, renderMarkdownInline);
      state.listBreak = true;
    } else {
      closeEpubList(htmlLines, state);
      state.listBreak = false;
      htmlLines.push('');
    }
    return true;
  }
  if (
    state.listBreak &&
    parseListItem(raw) === null &&
    !isListContinuation(raw, state.listColumn ?? 2) &&
    !continuesList(state.lists, raw)
  ) {
    closeEpubList(htmlLines, state);
    state.listBreak = false;
    htmlLines.push('');
  }
  return false;
}

function startEpubListItem(
  htmlLines: string[],
  state: EpubLineState,
  raw: string,
  item: MarkdownListItem
): void {
  const heading = parseAtxHeading(item.text);
  const column = listContentColumn(raw) ?? 2;
  if (heading) {
    resetListItem(state);
    state.listColumn = column;
    state.loose = true;
    state.itemHtml = epubHeading(state, heading.depth, heading.text);
    pushHtmlListItem(htmlLines, state.lists, item, state.itemHtml, column);
    return;
  }
  const html = openListItem(
    state,
    raw,
    item.text,
    readSourceLine(raw).hardBreak,
    listContentColumn(raw) ?? 2,
    renderMarkdownInline
  );
  pushHtmlListItem(htmlLines, state.lists, item, html, listContentColumn(raw) ?? 2);
}

function continueEpubListItem(htmlLines: string[], state: EpubLineState, raw: string): boolean {
  return continueOpenList(htmlLines, state.lists, state, raw, renderMarkdownInline);
}

function appendEpubFlow(htmlLines: string[], raw: string, state: EpubLineState): void {
  const trimmed = raw.trim();
  if (takeEpubSetext(htmlLines, raw, state)) {
    return;
  }
  if (isThematicBreak(trimmed)) {
    flushEpubParagraph(htmlLines, state);
    closeEpubList(htmlLines, state);
    htmlLines.push('<hr />');
    return;
  }
  const heading = parseAtxHeading(trimmed);
  if (heading && heading.depth >= 3) {
    flushEpubParagraph(htmlLines, state);
    closeEpubList(htmlLines, state);
    htmlLines.push(epubHeading(state, heading.depth, heading.text));
    return;
  }
  if (takeEpubListBreak(htmlLines, raw, state)) {
    return;
  }
  const item = parseListItem(raw);
  if (item) {
    flushEpubParagraph(htmlLines, state);
    startEpubListItem(htmlLines, state, raw, item);
    return;
  }
  if (continueEpubListItem(htmlLines, state, raw)) {
    return;
  }
  closeEpubList(htmlLines, state);
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
    listLines: [],
    listColumn: null,
    itemHtml: '',
    itemFence: null,
    itemQuote: null,
    itemTable: null,
    itemMath: null,
    itemCode: null,
    loose: false,
    parts: htmlLines,
    displayMath: null,
    tableLines: [],
    quoteLines: [],
    paragraph: [],
    slugCounts: slugs,
  };
  const lines = chapter.content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const htmlEnd = consumeEpubHtml(htmlLines, lines, index, state);
    if (htmlEnd !== null) {
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
  closeEpubList(htmlLines, state);
  if (state.fence) {
    htmlLines.push(renderFencedCode(state.fence.language, state.fence.lines));
  }
  return `<style>${CODE_HIGHLIGHT_CSS}</style>\n${htmlLines.join('\n')}`;
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
