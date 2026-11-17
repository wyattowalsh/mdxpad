import { writeFile } from 'node:fs/promises';

import { renderMarkdownInline } from './markdown-inline-html';
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

type EpubListKind = 'ul' | 'ol';

function closeEpubList(htmlLines: string[], list: EpubListKind | null): null {
  if (list === 'ul') {
    htmlLines.push('</ul>');
  } else if (list === 'ol') {
    htmlLines.push('</ol>');
  }
  return null;
}

function appendEpubLine(
  htmlLines: string[],
  line: string,
  state: { inCode: boolean; list: EpubListKind | null }
): void {
  const trimmed = line.trim();
  if (trimmed.startsWith('```')) {
    state.list = closeEpubList(htmlLines, state.list);
    htmlLines.push(state.inCode ? '</code></pre>' : '<pre><code>');
    state.inCode = !state.inCode;
    return;
  }
  if (state.inCode) {
    htmlLines.push(escapeHtml(line));
    return;
  }
  const headingMatch = /^(#{3,6})\s+(.+)$/.exec(trimmed);
  if (headingMatch) {
    state.list = closeEpubList(htmlLines, state.list);
    const level = headingMatch[1]?.length ?? 3;
    htmlLines.push(`<h${level}>${renderMarkdownInline(headingMatch[2] ?? '')}</h${level}>`);
    return;
  }
  if (trimmed === '') {
    state.list = closeEpubList(htmlLines, state.list);
    htmlLines.push('');
    return;
  }
  const item = /^([-*+]|\d+\.)\s+(.+)$/.exec(trimmed);
  if (item) {
    const kind: EpubListKind = item[1]?.endsWith('.') ? 'ol' : 'ul';
    if (state.list !== kind) {
      state.list = closeEpubList(htmlLines, state.list);
      htmlLines.push(kind === 'ul' ? '<ul>' : '<ol>');
      state.list = kind;
    }
    htmlLines.push(`<li>${renderMarkdownInline(item[2] ?? '')}</li>`);
    return;
  }
  state.list = closeEpubList(htmlLines, state.list);
  htmlLines.push(`<p>${renderMarkdownInline(trimmed)}</p>`);
}

function chapterToHtml(chapter: EpubChapter): string {
  const htmlLines: string[] = [];
  const state = { inCode: false, list: null as EpubListKind | null };
  for (const line of chapter.content.split('\n')) {
    appendEpubLine(htmlLines, line, state);
  }
  state.list = closeEpubList(htmlLines, state.list);
  if (state.inCode) {
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
