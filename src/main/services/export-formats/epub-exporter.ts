import { writeRegularFile } from './write-regular-file';

import { stripLeadingFrontmatter } from '@shared/lib/frontmatter';
import { allocateHeadingSlug, headingTag, parseAtxHeading } from '@shared/lib/markdown-heading';
import { prepareMarkdownSource } from '@shared/lib/markdown-math';
import { displayFenceCloses, displayPrefixCloses } from '@shared/lib/promote-display-math';
import { displayMathPrefix } from '@shared/lib/math-span';

import { embedEpubImages } from './epub-images';
import { inlineLocalImages } from './export-image';
import { omitLocalMarkdownTargets } from './omit-local-markdown-targets';
import { renderDisplayMathBlock, renderMarkdownInline } from './markdown-inline-html';
import {
  isTableRow,
  markdownTableToHtml,
  parseMarkdownTable,
  TABLE_CELL_CSS,
} from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { readHtmlBlock } from './markdown-html';
import { sanitizeExportedHtml } from './markdown-export-address';
import { CODE_HIGHLIGHT_CSS, renderFencedCode } from './markdown-code';
import { advanceFence, closesFence, fenceLanguage, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { htmlFootnoteMarkers } from './markdown-footnote';
import { joinParagraphHtml, readSourceLine, type SourceLine } from './markdown-paragraph';
import {
  continuesQuote,
  storedQuoteLine,
  takeQuoteContinuation,
  quoteBody,
  quoteFenceOpen,
  quoteHoldsDelimiter,
  quoteToHtml,
} from './markdown-quote';
import {
  closeHtmlLists,
  continuesList,
  LIST_MARKER_CSS,
  isListContinuation,
  listContentColumn,
  parseListItem,
  pushHtmlListItem,
  proseStillOpen,
  shouldOpenListItem,
  type HtmlListFrame,
  type MarkdownListItem,
} from './markdown-list';
import {
  breakListParagraph,
  continueOpenList,
  finishListItemFence,
  openListItem,
  openWithNestedMarkers,
  resetListItem,
  takeListItemCode,
  takeListItemFence,
  takeListItemAtx,
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
  return splitExpandedChapters(
    expandLinkReferences(prepareMarkdownSource(content, { preserveHtml: true }))
  );
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
  let fence: string | null = null;

  for (const line of lines) {
    const nextFence = advanceFence(line, fence);
    const fenced = fence !== null || nextFence !== null;
    const heading = fenced ? null : parseAtxHeading(line);
    fence = nextFence;
    const leading = line.length - line.trimStart().length;
    if (heading && heading.depth <= 2 && leading < 2) {
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
  laterLines: readonly string[];
  laterIndex: number;
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
    state.quoteLines.push(storedQuoteLine(state.quoteLines, line));
    return true;
  }
  if (takeQuoteContinuation(state.quoteLines, line)) {
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
    if (state.tableLines.length === 0 && continuesQuote(state.quoteLines, line)) {
      return false;
    }
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

function epubDisplayStaysText(state: EpubLineState, line: string, prefix: string | null): boolean {
  if (state.displayMath) {
    return false;
  }
  if (prefix !== null) {
    return !displayPrefixCloses(state.laterLines, state.laterIndex);
  }
  return (
    line.trim() === '$$' &&
    !quoteHoldsDelimiter(state.quoteLines, line) &&
    !displayFenceCloses(state.laterLines, state.laterIndex)
  );
}

function consumeEpubDisplayMath(htmlLines: string[], line: string, state: EpubLineState): boolean {
  if (state.fence) {
    return false;
  }
  if (takeListItemMath(state, line, renderMarkdownInline, state.lists.length > 0)) {
    return true;
  }
  const quoted = quoteBody(line) !== null || quoteBody(line.trimStart()) !== null;
  const prefix = !quoted && parseListItem(line) === null ? displayMathPrefix(line) : null;
  if (epubDisplayStaysText(state, line, prefix)) {
    return false;
  }
  if (prefix !== null && !state.displayMath) {
    state.paragraph.push({ text: prefix, hardBreak: false });
    flushEpubParagraph(htmlLines, state);
    flushEpubTable(htmlLines, state);
    flushEpubQuote(htmlLines, state);
    closeEpubList(htmlLines, state);
    state.displayMath = [];
    return true;
  }
  if (prefix !== null && state.displayMath) {
    state.displayMath.push(prefix);
    htmlLines.push(renderDisplayMathBlock(state.displayMath));
    state.displayMath = null;
    return true;
  }
  const trimmed = line.trim();
  if (trimmed === '$$') {
    if (!state.displayMath && quoteHoldsDelimiter(state.quoteLines, line)) {
      return false;
    }
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
  const line = lines[index] ?? '';
  if (
    state.lists.length > 0 &&
    state.listColumn !== null &&
    isListContinuation(line, state.listColumn)
  ) {
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
  htmlLines.push(sanitizeExportedHtml(block.html));
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

function takeEpubItemStructure(line: string, state: EpubLineState): boolean {
  const open = state.lists.length > 0;
  const heading = (level: number, text: string): string => epubHeading(state, level, text);
  return (
    takeListItemCode(state, line, renderMarkdownInline, open) ||
    takeListItemSetext(state, line, heading, open) ||
    takeListItemRule(state, line, renderMarkdownInline, open) ||
    takeListItemAtx(state, line, renderMarkdownInline, heading, open)
  );
}

function appendEpubLine(htmlLines: string[], line: string, state: EpubLineState): void {
  if (takeEpubItemStructure(line, state)) {
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
  if (quoteFenceOpen(state.quoteLines)) {
    state.quoteLines.push(storedQuoteLine(state.quoteLines, line));
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
    if (state.lists.length > 0) {
      if (!state.listBreak) {
        breakListParagraph(state, renderMarkdownInline);
        state.listBreak = true;
      }
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
  if (openWithNestedMarkers(htmlLines, state.lists, state, raw, item, renderMarkdownInline)) {
    return;
  }
  const heading = parseAtxHeading(item.text);
  const column = listContentColumn(raw) ?? 2;
  if (heading) {
    resetListItem(state);
    state.listColumn = column;
    state.loose = true;
    state.itemHtml = epubHeading(state, heading.depth, heading.text);
    pushHtmlListItem(htmlLines, state.lists, item, state.itemHtml, column, state.listBreak);
    state.loose = state.lists[state.lists.length - 1]?.loose === true;
    return;
  }
  const separated = state.listBreak;
  const html = openListItem(
    state,
    raw,
    item.text,
    readSourceLine(raw).hardBreak,
    listContentColumn(raw) ?? 2,
    renderMarkdownInline
  );
  pushHtmlListItem(htmlLines, state.lists, item, html, listContentColumn(raw) ?? 2, separated);
  state.loose = state.lists[state.lists.length - 1]?.loose === true;
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
  const proseOpen = proseStillOpen(
    state.paragraph.length > 0,
    state.listBreak,
    state.listLines.some((line) => line.text.trim().length > 0)
  );
  if (item && shouldOpenListItem(item, state.lists, state.listBreak, proseOpen)) {
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

const CHECKED_TASK = '<input type="checkbox" disabled checked />';
const OPEN_TASK = '<input type="checkbox" disabled />';

function epubTaskBoxes(html: string): string {
  return html.replaceAll(CHECKED_TASK, '☑').replaceAll(OPEN_TASK, '☐');
}

function epubChapterFilename(index: number): string {
  return `chapter-${index}.xhtml`;
}

function linkEpubAnchors(chapters: { filename: string; content: string }[]): void {
  const idFile = new Map<string, string>();
  for (const chapter of chapters) {
    for (const match of chapter.content.matchAll(/\sid="([^"]+)"/g)) {
      const id = match[1];
      if (id && !idFile.has(id)) {
        idFile.set(id, chapter.filename);
      }
    }
  }
  for (const chapter of chapters) {
    chapter.content = chapter.content.replace(/href="#([^"]+)"/g, (full, id: string) => {
      const file = idFile.get(id);
      return file && file !== chapter.filename ? `href="${file}#${id}"` : full;
    });
  }
}

function writeChapterLines(
  htmlLines: string[],
  lines: readonly string[],
  state: EpubLineState
): void {
  state.laterLines = lines;
  for (let index = 0; index < lines.length; index += 1) {
    state.laterIndex = index + 1;
    const htmlEnd = consumeEpubHtml(htmlLines, lines, index, state);
    if (htmlEnd !== null) {
      index = htmlEnd;
      continue;
    }
    appendEpubLine(htmlLines, lines[index] ?? '', state);
  }
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
    laterLines: [],
    laterIndex: 0,
    tableLines: [],
    quoteLines: [],
    paragraph: [],
    slugCounts: slugs,
  };
  writeChapterLines(htmlLines, chapter.content.split('\n'), state);
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
  return epubTaskBoxes(
    `<style>${CODE_HIGHLIGHT_CSS}${LIST_MARKER_CSS}${TABLE_CELL_CSS}</style>\n${htmlFootnoteMarkers(htmlLines.join('\n'))}`
  );
}

const EPUB_LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function epubLanguage(metadata: Record<string, unknown> | undefined): string | undefined {
  const value = metadata?.language;
  return typeof value === 'string' && EPUB_LANGUAGE.test(value) ? value : undefined;
}

function epubCover(metadata: Record<string, unknown> | undefined): string | undefined {
  const value = metadata?.coverUrl;
  if (typeof value !== 'string' || !value.startsWith('https://')) {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function renderEpubBuffer(
  options: {
    readonly title: string;
    readonly author: string;
    readonly metadata?: Record<string, unknown>;
  },
  chapters: readonly { title: string; filename: string; content: string }[]
): Promise<Buffer> {
  const epubGen = await import('epub-gen-memory');
  const lang = epubLanguage(options.metadata);
  const cover = epubCover(options.metadata);
  const epubBuffer = await epubGen.default(
    {
      title: options.title,
      author: options.author,
      ...(lang ? { lang } : {}),
      ...(cover ? { cover } : {}),
    },
    chapters.map((chapter) => ({
      title: chapter.title,
      filename: chapter.filename,
      content: chapter.content,
    }))
  );
  return epubBuffer instanceof Buffer ? epubBuffer : Buffer.from(epubBuffer);
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
      const inlined = await inlineLocalImages(
        stripLeadingFrontmatter(options.content),
        options.sourcePath,
        'document'
      );
      const content = omitLocalMarkdownTargets(inlined, options.sourcePath);
      const split = splitIntoChapters(content);

      const epubContent = await Promise.all(
        split.chapters.map(async (chapter, index) => {
          const images = await embedEpubImages(chapterToHtml(chapter, split.slugs));
          warnings.push(...images.warnings);
          return {
            title: chapter.title,
            filename: epubChapterFilename(index),
            content: images.html,
            cleanup: images.cleanup,
          };
        })
      );
      linkEpubAnchors(epubContent);

      let buffer: Buffer;
      try {
        buffer = await renderEpubBuffer(
          options.metadata ? { title, author, metadata: options.metadata } : { title, author },
          epubContent
        );
      } finally {
        await Promise.all(epubContent.map(async (chapter) => chapter.cleanup()));
      }
      await writeRegularFile(options.outputPath, buffer);

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
