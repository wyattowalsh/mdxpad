import { writeFile } from 'node:fs/promises';

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

function chapterToHtml(chapter: EpubChapter): string {
  const lines = chapter.content.split('\n');
  const htmlLines: string[] = [];

  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        htmlLines.push('</code></pre>');
        inCodeBlock = false;
      } else {
        htmlLines.push('<pre><code>');
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      htmlLines.push(escapeHtml(line));
      continue;
    }

    // Sub-headings (h3-h6)
    const headingMatch = /^(#{3,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1]?.length ?? 3;
      htmlLines.push(`<h${level}>${escapeHtml(headingMatch[2] ?? '')}</h${level}>`);
      continue;
    }

    // Empty line = paragraph break
    if (trimmed === '') {
      htmlLines.push('');
      continue;
    }

    // Unordered list item
    const ulMatch = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (ulMatch) {
      htmlLines.push(`<li>${escapeHtml(ulMatch[1] ?? '')}</li>`);
      continue;
    }

    // Regular paragraph
    htmlLines.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  if (inCodeBlock) {
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
