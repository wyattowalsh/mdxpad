import { spawnSync } from 'node:child_process';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DocxExporter, parseInlineFormatting } from '../docx-exporter';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('parseInlineFormatting', () => {
  it('keeps an image title with the picture', () => {
    const segments = parseInlineFormatting('![A photo](photo.jpg "Sunset")');
    expect(segments).toContainEqual(
      expect.objectContaining({ image: 'photo.jpg', title: 'Sunset' })
    );
  });
});

describe('DocxExporter', () => {
  let exporter: DocxExporter;

  beforeEach(() => {
    exporter = new DocxExporter();
    vi.clearAllMocks();
  });

  it('keeps a hard break inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- Stay  \n  put',
      outputPath: '/tmp/list-break.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('Stay');
    expect(xml).toContain('<w:br/>');
    expect(xml).toContain('put');
  });

  it('keeps an ordered list start number', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '3. third',
      outputPath: '/tmp/start.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('3.');
    expect(xml).toContain('third');
  });

  it('keeps snake_case as plain text and still emphasizes _words_', () => {
    expect(parseInlineFormatting('use snake_case_name here')).toEqual([
      { text: 'use snake_case_name here' },
    ]);
    expect(parseInlineFormatting('~~gone~~')).toEqual([{ text: 'gone', strike: true }]);
    expect(parseInlineFormatting('***both***')).toEqual([
      { text: 'both', bold: true, italic: true },
    ]);
    expect(parseInlineFormatting('a * b * c')).toEqual([{ text: 'a * b * c' }]);
    expect(parseInlineFormatting('***foo** bar*')).toEqual([
      { text: 'foo', bold: true, italic: true },
      { text: ' bar', italic: true },
    ]);
    expect(parseInlineFormatting('_foo_bar_')).toEqual([{ text: 'foo_bar', italic: true }]);
    expect(parseInlineFormatting('**bold *inner* text**')).toEqual([
      { text: 'bold ', bold: true },
      { text: 'inner', bold: true, italic: true },
      { text: ' text', bold: true },
    ]);
    expect(parseInlineFormatting('**[docs](https://example.com)**')).toEqual([
      { text: 'docs', link: 'https://example.com', bold: true },
    ]);
    expect(parseInlineFormatting('[**docs**](https://example.com)')).toEqual([
      { text: 'docs', bold: true, link: 'https://example.com' },
    ]);
    expect(parseInlineFormatting('![A photo](photo.jpg)')).toEqual([
      { text: 'A photo', image: 'photo.jpg' },
    ]);
    expect(parseInlineFormatting('[![alt](a.png)](https://example.com)')).toEqual([
      { text: 'alt', image: 'a.png', link: 'https://example.com' },
    ]);
    expect(parseInlineFormatting('Use `` a`b `` here')).toEqual([
      { text: 'Use ' },
      { text: 'a`b', code: true },
      { text: ' here' },
    ]);
    expect(parseInlineFormatting('this is _italic_ text')).toEqual([
      { text: 'this is ' },
      { text: 'italic', italic: true },
      { text: ' text' },
    ]);
  });

  it('has correct metadata', () => {
    expect(exporter.format).toBe('docx');
    expect(exporter.label).toBe('Word');
    expect(exporter.extension).toBe('docx');
    expect(exporter.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  it('exports a simple document successfully', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '# Hello\n\nWorld',
      title: 'Test Doc',
      author: 'Test Author',
      outputPath: '/tmp/test.docx',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(true);
    expect(result.outputPath).toBe('/tmp/test.docx');
    expect(writeFile).toHaveBeenCalledOnce();
    expect(result.warnings).toEqual([]);
  });

  it('writes a buffer to the output path', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '# Title\n\nParagraph text.',
      outputPath: '/tmp/output.docx',
    };

    await exporter.export(options);

    const args = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args?.[0]).toBe('/tmp/output.docx');
    // The docx package produces a Buffer
    expect(Buffer.isBuffer(args?.[1])).toBe(true);
  });

  it('handles headings, lists, and code blocks', async () => {
    const { writeFile } = await import('node:fs/promises');
    const content = [
      '# Heading 1',
      '## Heading 2',
      '',
      'A paragraph.',
      '',
      '- Item one',
      '- Item two',
      '',
      '1. First',
      '2. Second',
      '',
      '```',
      'code block',
      '```',
    ].join('\n');

    const options: ExportOptions = {
      content,
      outputPath: '/tmp/full.docx',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(true);
    expect(writeFile).toHaveBeenCalledOnce();
  });

  it('handles inline formatting (bold, italic, code, links)', async () => {
    const options: ExportOptions = {
      content: '**bold** *italic* `code` [link](http://example.com)',
      outputPath: '/tmp/inline.docx',
    };

    const result = await exporter.export(options);
    expect(result.ok).toBe(true);
  });

  it('decodes a character reference outside code', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Say AT&amp;T.\n\n`AT&amp;T`',
      outputPath: '/tmp/entity.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('Say AT&amp;T.');
    expect(xml).toContain('AT&amp;amp;T');
  });

  it('bookmarks a heading and links back to it', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '# Intro\n\nSee [the start](#intro).',
      outputPath: '/tmp/anchor.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('w:name="intro"');
    expect(xml).toContain('w:anchor="intro"');
    expect(xml).toContain('the start');
  });

  it('keeps a setext heading inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n  ---\n  after\n',
      outputPath: '/tmp/list-setext.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('w:val="Heading2"');
    expect(xml).toContain('item');
    expect(xml).toContain('after');
    expect(xml).not.toContain('---');
  });

  it('keeps a horizontal rule inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  ---\n\n  after\n',
      outputPath: '/tmp/list-rule.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml.indexOf('>item<')).toBeLessThan(xml.indexOf('<w:pBdr>'));
    expect(xml.indexOf('<w:pBdr>')).toBeLessThan(xml.indexOf('>after<'));
    expect(xml).not.toContain('---');
  });

  it('keeps indented code inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n      const x = 1\n\n  after\n',
      outputPath: '/tmp/list-indent.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml.indexOf('>item<')).toBeLessThan(xml.indexOf('const x = 1'));
    expect(xml.indexOf('const x = 1')).toBeLessThan(xml.indexOf('>after<'));
    expect(xml).not.toContain('  const x = 1');
  });

  it('keeps display math inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  $$\n  a < b\n  $$\n\n  after\n',
      outputPath: '/tmp/list-math.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml.indexOf('>item<')).toBeLessThan(xml.indexOf('a &lt; b'));
    expect(xml.indexOf('a &lt; b')).toBeLessThan(xml.indexOf('>after<'));
    expect(xml).not.toContain('  a &lt; b');
  });

  it('keeps a table inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  | A | B |\n  | --- | --- |\n  | 1 | 2 |\n\n  after\n',
      outputPath: '/tmp/list-table.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml.indexOf('>item<')).toBeLessThan(xml.indexOf('>A<'));
    expect(xml.indexOf('>A<')).toBeLessThan(xml.indexOf('>1<'));
    expect(xml.indexOf('>1<')).toBeLessThan(xml.indexOf('>after<'));
  });

  it('keeps a block quote inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  > quoted\n  > line\n',
      outputPath: '/tmp/list-quote.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml.indexOf('>item<')).toBeLessThan(xml.indexOf('quoted'));
    expect(xml).toContain('line');
    expect(xml).not.toContain('item &gt; quoted');
  });

  it('keeps a fenced block inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  ```js\n  const x = 1\n  ```\n\n  after\n',
      outputPath: '/tmp/list-code.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml.indexOf('>item<')).toBeLessThan(xml.indexOf('>const<'));
    expect(xml.indexOf('>const<')).toBeLessThan(xml.indexOf('>after<'));
    expect(xml).not.toContain('```');
  });

  it('colors a fenced TypeScript block', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '```ts\nconst answer = 1;\n```',
      outputPath: '/tmp/code-color.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('const');
    expect(xml).toContain('answer');
    expect(xml).toContain('w:val="7C3AED"');
  });

  it('drops a closing hash run from a heading', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '# Title #\n\n# Hash#',
      outputPath: '/tmp/closing-hash.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('Title');
    expect(xml).toContain('Hash#');
    expect(xml).not.toContain('Title #');
  });

  it('indents a nested block quote further', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '> outer\n> > inner',
      outputPath: '/tmp/nested-quote.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('w:left="720"');
    expect(xml).toContain('w:left="1440"');
    expect(xml).toContain('inner');
    expect(xml).not.toContain('&gt; inner');
  });

  it('joins wrapped quote lines and writes a quoted list', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '> hello\n> there\n>\n> - one\n> - two',
      outputPath: '/tmp/wrapped-quote.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('hello there');
    expect(xml).not.toContain('hello there one');
    expect(xml).toContain('one');
    expect(xml).toContain('two');
    expect(xml).not.toContain('- one');
  });

  it('indents a block quote', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '> Keep this',
      outputPath: '/tmp/quote.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('Keep this');
    expect(xml).toContain('<w:ind');
    expect(xml).not.toContain('&gt; Keep this');
  });

  it('writes a task checkbox', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- [x] done\n- [ ] todo',
      outputPath: '/tmp/tasks.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('☑');
    expect(xml).toContain('☐');
    expect(xml).toContain('done');
    expect(xml).not.toContain('[x]');
  });

  it('writes a markdown table', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '| Name | Value |\n| --- | --- |\n| A | 1 |',
      outputPath: '/tmp/table.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('Name');
    expect(xml).toContain('Value');
  });

  it('aligns a table column and keeps an escaped pipe', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '| Item | Amount |\n| --- | ---: |\n| A \\| B | 2 |',
      outputPath: '/tmp/aligned-table.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('A | B');
    expect(xml).toContain('w:val="right"');
  });

  it('writes a formula as a Word equation and leaves a price as text', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See $x^2$ and $5 and $10.\n$$\n\\frac{a}{b}\n$$',
      outputPath: '/tmp/math.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('<m:sSup');
    expect(xml).toContain('<m:f>');
    expect(xml).toContain('$5 and $10');
    expect(xml).not.toContain('$x^2$');
  });

  it('returns error on write failure', async () => {
    const { writeFile } = await import('node:fs/promises');
    (writeFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('permission denied'));

    const result = await exporter.export({
      content: '# Test',
      outputPath: '/tmp/fail.docx',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('permission denied');
  });

  it('handles empty content', async () => {
    const result = await exporter.export({
      content: '',
      outputPath: '/tmp/empty.docx',
    });

    expect(result.ok).toBe(true);
  });

  it('keeps a later paragraph inside the parent item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- parent\n\n  - child\n\n  more\n',
      outputPath: '/tmp/nested-more.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    const more = xml.split(/<w:p[ >]/).find((paragraph) => paragraph.includes('>more<'));
    expect(xml.indexOf('>child<')).toBeLessThan(xml.indexOf('>more<'));
    expect(more).toContain('w:left="720"');
    expect(more).not.toContain('w:ilvl');
  });

  it('ends a nested list before a column-zero line', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- parent\n\n  - child\n\nbaz\n',
      outputPath: '/tmp/nested-ended.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    const ended = xml.split(/<w:p[ >]/).find((paragraph) => paragraph.includes('>baz<'));
    expect(xml.indexOf('>child<')).toBeLessThan(xml.indexOf('>baz<'));
    expect(ended).not.toContain('w:ind');
    expect(ended).not.toContain('w:ilvl');
  });

  it('keeps indented code inside a quote', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '>     const x = 1\n',
      outputPath: '/tmp/quote-code.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    expect(extracted.stdout.toString()).toContain('const x = 1');
  });

  it('nests a child list under its parent', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- parent\n  - child',
      outputPath: '/tmp/nested.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('parent');
    expect(xml).toContain('child');
    expect(xml).toContain('w:val="1"');
  });

  it('keeps an escaped asterisk literal', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '\\*not italic\\*',
      outputPath: '/tmp/escape.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('*not italic*');
    expect(xml).not.toContain('<w:i');
  });

  it('links an autolink', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See <https://example.com>',
      outputPath: '/tmp/auto.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/_rels/document.xml.rels").decode())',
      ],
      { input: buffer }
    );
    expect(extracted.stdout.toString()).toContain('https://example.com');
  });

  it('keeps parentheses inside a link address', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '[wiki](https://en.wikipedia.org/wiki/Markdown_(markup))',
      outputPath: '/tmp/paren.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/_rels/document.xml.rels").decode())',
      ],
      { input: buffer }
    );
    expect(extracted.stdout.toString()).toContain(
      'https://en.wikipedia.org/wiki/Markdown_(markup)'
    );
  });

  it('keeps a wrapped list item together', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n  continued',
      outputPath: '/tmp/list-wrap.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    expect(extracted.stdout.toString()).toContain('item continued');
  });

  it('starts a new paragraph after a blank line in a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  second\n  line\n',
      outputPath: '/tmp/list-paragraph.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('>item<');
    expect(xml).toContain('>second line<');
    expect(xml).not.toContain('item second');
  });

  it('keeps a bold link bold', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '**[docs](https://example.com)**',
      outputPath: '/tmp/bold-link.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/document.xml").decode()); print(z.read("word/_rels/document.xml.rels").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('docs');
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('https://example.com');
  });

  it('keeps a link title out of the address', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See [docs](https://example.com "Docs")',
      outputPath: '/tmp/title.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/_rels/document.xml.rels").decode())',
      ],
      { input: buffer }
    );
    const rels = extracted.stdout.toString();
    expect(rels).toContain('https://example.com');
    expect(rels).not.toContain('Docs');
  });

  it('resolves a reference link', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See [the docs][guide].\n\n[guide]: https://example.com',
      outputPath: '/tmp/ref.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/document.xml").decode()); print(z.read("word/_rels/document.xml.rels").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('the docs');
    expect(xml).toContain('https://example.com');
    expect(xml).not.toContain('[guide]:');
  });

  it('keeps a wrapped paragraph and a hard break', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Hello\nworld\n\nStay  \nput',
      outputPath: '/tmp/wrap.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    const chunks = xml.split('<w:p');
    expect(chunks.some((chunk) => chunk.includes('Hello') && chunk.includes('world'))).toBe(true);
    expect(chunks.some((chunk) => chunk.includes('Stay') && chunk.includes('<w:br'))).toBe(true);
  });

  it('renders a setext heading', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Title\n===',
      outputPath: '/tmp/setext.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('Title');
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).not.toContain('===');
  });

  it('draws a horizontal rule', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Above\n\n* * *\n\nBelow',
      outputPath: '/tmp/hr.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('<w:pBdr>');
    expect(xml).toContain('Above');
    expect(xml).toContain('Below');
    expect(xml).not.toContain('* * *');
  });
});
