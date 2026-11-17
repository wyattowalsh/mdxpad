import { writeFile } from 'node:fs/promises';

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  AlignmentType,
} from 'docx';

import type { Exporter, ExportOptions, ExportResult } from './types';

type HeadingLevelValue =
  | typeof HeadingLevel.HEADING_1
  | typeof HeadingLevel.HEADING_2
  | typeof HeadingLevel.HEADING_3
  | typeof HeadingLevel.HEADING_4
  | typeof HeadingLevel.HEADING_5
  | typeof HeadingLevel.HEADING_6;

const HEADING_LEVEL_MAP: Record<number, HeadingLevelValue> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function getHeadingLevel(level: number): HeadingLevelValue {
  return HEADING_LEVEL_MAP[level] ?? HeadingLevel.HEADING_6;
}

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
}

export function parseInlineFormatting(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex =
    /(\*\*(.+?)\*\*|(?<![\w])__(.+?)__(?![\w])|`([^`]+)`|\*(.+?)\*|(?<![\w])_(.+?)_(?![\w])|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      segments.push({ text: text.slice(lastIndex, matchIndex) });
    }

    if (match[2] !== undefined) {
      segments.push({ text: match[2], bold: true });
    } else if (match[3] !== undefined) {
      segments.push({ text: match[3], bold: true });
    } else if (match[4] !== undefined) {
      segments.push({ text: match[4], code: true });
    } else if (match[5] !== undefined) {
      segments.push({ text: match[5], italic: true });
    } else if (match[6] !== undefined) {
      segments.push({ text: match[6], italic: true });
    } else if (match[7] !== undefined && match[8] !== undefined) {
      segments.push({ text: match[7], link: match[8] });
    }

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ text });
  }

  return segments;
}

function createTextRuns(segments: InlineSegment[]): (TextRun | ExternalHyperlink)[] {
  return segments.map((segment) => {
    if (segment.link) {
      return new ExternalHyperlink({
        children: [new TextRun({ text: segment.text, style: 'Hyperlink' })],
        link: segment.link,
      });
    }

    const runOptions: Record<string, unknown> = { text: segment.text };
    if (segment.bold) {
      runOptions.bold = true;
    }
    if (segment.italic) {
      runOptions.italics = true;
    }
    if (segment.code) {
      runOptions.font = { name: 'Courier New' };
    }
    return new TextRun(runOptions as ConstructorParameters<typeof TextRun>[0]);
  });
}

function createCodeBlockParagraph(codeLines: string[]): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: codeLines.join('\n'), font: { name: 'Courier New' }, size: 20 }),
    ],
    spacing: { before: 120, after: 120 },
  });
}

function parseLineToParagraph(trimmed: string): Paragraph | undefined {
  const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
  if (headingMatch) {
    const level = headingMatch[1]?.length ?? 1;
    return new Paragraph({
      heading: getHeadingLevel(level),
      children: createTextRuns(parseInlineFormatting(headingMatch[2] ?? '')),
    });
  }

  const ulMatch = /^[-*+]\s+(.+)$/.exec(trimmed);
  if (ulMatch) {
    return new Paragraph({
      bullet: { level: 0 },
      children: createTextRuns(parseInlineFormatting(ulMatch[1] ?? '')),
    });
  }

  const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
  if (olMatch) {
    return new Paragraph({
      numbering: { reference: 'default-numbering', level: 0 },
      children: createTextRuns(parseInlineFormatting(olMatch[1] ?? '')),
    });
  }

  if (/^[-*_]{3,}$/.test(trimmed)) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '---' })],
      spacing: { before: 240, after: 240 },
    });
  }

  return undefined;
}

function parseContentToParagraphs(content: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  const codeLines: string[] = [];

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        paragraphs.push(createCodeBlockParagraph(codeLines));
        codeLines.length = 0;
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed === '') {
      paragraphs.push(new Paragraph({ children: [] }));
      continue;
    }

    const special = parseLineToParagraph(trimmed);
    if (special) {
      paragraphs.push(special);
    } else {
      paragraphs.push(new Paragraph({ children: createTextRuns(parseInlineFormatting(trimmed)) }));
    }
  }

  if (inCodeBlock && codeLines.length > 0) {
    paragraphs.push(createCodeBlockParagraph(codeLines));
  }

  return paragraphs;
}

export class DocxExporter implements Exporter {
  readonly format = 'docx';
  readonly label = 'Word';
  readonly extension = 'docx';
  readonly mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  async export(options: ExportOptions): Promise<ExportResult> {
    const warnings: string[] = [];

    try {
      const title = options.title ?? 'Untitled';
      const author = options.author ?? 'MDXPad';
      const paragraphs = parseContentToParagraphs(options.content);

      const doc = new Document({
        creator: author,
        title,
        description: 'Exported from MDXPad',
        numbering: {
          config: [
            {
              reference: 'default-numbering',
              levels: [
                { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START },
              ],
            },
          ],
        },
        sections: [{ children: paragraphs }],
      });

      const buffer = await Packer.toBuffer(doc);
      await writeFile(options.outputPath, buffer);

      return { ok: true, outputPath: options.outputPath, warnings };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'DOCX export failed',
        warnings,
      };
    }
  }
}
