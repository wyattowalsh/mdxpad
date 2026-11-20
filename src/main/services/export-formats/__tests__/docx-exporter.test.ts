import { spawnSync } from 'node:child_process';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DocxExporter, parseInlineFormatting } from '../docx-exporter';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  lstat: vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' })),
  unlink: vi.fn().mockResolvedValue(undefined),
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

  it('formats an HTML list and a bold wrapper', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '<ul><li>One</li><li>Two</li></ul>\n\n<div>\nHello <b>there</b>\n</div>\n',
      outputPath: '/tmp/html-list.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io,re; xml=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode(); paras=xml.split("<w:p>")[1:]; texts=[" ".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p)).strip() for p in paras]; print("\\n".join(texts)); print("---XML---"); print("bold" if "<w:b" in xml else "plain")',
      ],
      { input: buffer }
    );
    const output = extracted.stdout.toString();
    expect(output).toContain('One');
    expect(output).toContain('Two');
    expect(output).toContain('Hello');
    expect(output).toContain('there');
    expect(output).toContain('bold');
    expect(output).not.toContain('&lt;ul');
    expect(output).not.toContain('&lt;div');
    expect(output).not.toContain('&lt;b');
  });

  it('raises and lowers HTML scripts', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'x<sup>y</sup> and a<sub>b</sub>\n',
      outputPath: '/tmp/scripts.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('w:val="superscript"');
    expect(xml).toContain('w:val="subscript"');
    expect(xml).toContain('y');
    expect(xml).toContain('>b<');
    expect(xml).not.toContain('&lt;sup');
    expect(xml).not.toContain('&lt;sub');
  });

  it('highlights and underlines HTML phrases', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See <mark>hi</mark> and <u>there</u>.\n',
      outputPath: '/tmp/phrase.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('w:highlight');
    expect(xml).toContain('w:val="yellow"');
    expect(xml).toContain('w:u ');
    expect(xml).toContain('hi');
    expect(xml).toContain('there');
    expect(xml).not.toContain('&lt;mark');
    expect(xml).not.toContain('&lt;u');
  });

  it('does not insert an empty paragraph between quoted list items', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '> - one\n>\n> - two\n',
      outputPath: '/tmp/quoted-list-gap.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io,re; xml=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode(); paras=xml.split("<w:p>")[1:]; texts=[" ".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p)).strip() for p in paras]; print("\\n".join(texts))',
      ],
      { input: buffer }
    );
    const texts = extracted.stdout
      .toString()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    expect(texts).toEqual(['one', 'two']);
  });

  it('writes escaped brackets in a link as characters', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '[a\\[b\\]](https://example.com)\n',
      outputPath: '/tmp/escaped-brackets.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io,re; xml=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode(); print("".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", xml)))',
      ],
      { input: buffer }
    );
    const text = extracted.stdout.toString();
    expect(text).toContain('a[b]');
    expect(text).not.toContain('\uE011');
  });

  it('keeps a nested list that starts on the marker line', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- 3. three\n  4. four\n',
      outputPath: '/tmp/nested-marker.docx',
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
    expect(xml).toContain('three');
    expect(xml).toContain('four');
    expect(xml).not.toContain('3. three');
    expect(xml).not.toContain('4. four');
  });

  it('does not link a picture that climbs out of its folder', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '![secret](../secret.png)',
      outputPath: '/tmp/parent-picture.docx',
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
    expect(xml).toContain('secret');
    expect(xml).not.toContain('../secret.png');
    expect(xml).not.toContain('secret.png');
  });

  it('keeps a formula after a literal backslash', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'The value is \\\\$x^2$.',
      outputPath: '/tmp/backslash-math.docx',
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
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('x');
    expect(xml).not.toContain('$x^2$');
  });

  it('keeps code indented inside a quote', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '> ```\n> const x = 1\n> ```\n>\n> after\n',
      outputPath: '/tmp/quote-code.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io,re; xml=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode(); paras=xml.split("<w:p>");\nfor p in paras[1:]:\n t="".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p)).strip();\n ind=re.search(r\'w:left="(\\d+)"\', p);\n print((ind.group(1) if ind else "-") + " " + t)',
      ],
      { input: buffer }
    );
    const lines = extracted.stdout.toString().trim().split('\n');
    expect(lines).toContain('720 const x = 1');
    expect(lines).toContain('720 after');
  });

  it('keeps code inside a list indented', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- alpha\n\n      code line\n\n  ```\n  fence\n  ```\n',
      outputPath: '/tmp/list-code.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io,re; xml=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode(); paras=xml.split("<w:p>");\nfor p in paras[1:]:\n t="".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p)).strip();\n ind=re.search(r\'w:left="(\\d+)"\', p);\n print((ind.group(1) if ind else "-") + " " + t)',
      ],
      { input: buffer }
    );
    const lines = extracted.stdout.toString().trim().split('\n');
    expect(lines).toContain('720 code line');
    expect(lines).toContain('720 fence');
  });

  it('keeps a paragraph after a quote inside a list', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- alpha\n\n  > quote\n\n  after\n',
      outputPath: '/tmp/list-quote.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io,re; xml=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode(); paras=xml.split("<w:p>");\nfor p in paras[1:]:\n t="".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p)).strip();\n ind=re.search(r\'w:left="(\\d+)"\', p);\n print((ind.group(1) if ind else "-") + " " + t)',
      ],
      { input: buffer }
    );
    const lines = extracted.stdout.toString().trim().split('\n');
    expect(lines).toContain('720 quote');
    expect(lines).toContain('720 after');
  });

  it('keeps list paragraphs separate', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- alpha\n\n  beta\n\n  gamma\n',
      outputPath: '/tmp/list-paragraphs.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io,re; xml=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode(); paras=xml.split("<w:p>");\nfor p in paras[1:]:\n t="".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p)).strip();\n if t: print(t)',
      ],
      { input: buffer }
    );
    const lines = extracted.stdout.toString().trim().split('\n');
    expect(lines).toContain('beta');
    expect(lines).toContain('gamma');
    expect(lines).not.toContain('beta gamma');
  });

  it('keeps a paragraph after a nested list indented', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- alpha\n  - nested\n\n  beta\n\n  gamma\n',
      outputPath: '/tmp/nested-paragraph.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io,re; xml=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode(); paras=xml.split("<w:p>");\nfor p in paras[1:]:\n t="".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p));\n print(("IND" if "w:ind" in p else "NO") + " " + t.strip())',
      ],
      { input: buffer }
    );
    const lines = extracted.stdout.toString().trim().split('\n');
    expect(lines).toContain('IND beta');
    expect(lines).toContain('IND gamma');
  });

  it('keeps a display formula that contains a link', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See \\[x and [a](https://example.com) y\\].',
      outputPath: '/tmp/display-link.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/document.xml").decode()); print("---RELS---"); print(z.read("word/_rels/document.xml.rels").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('https://example.com');
    expect(xml).not.toContain('$$');
  });

  it('keeps a formula after a dollar sign in a link', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See [the guide](https://example.com/a$b) and $x^2$.',
      outputPath: '/tmp/dollar-link.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/document.xml").decode()); print("---RELS---"); print(z.read("word/_rels/document.xml.rels").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('https://example.com/a$b');
    expect(xml).toContain('<m:oMath>');
    expect(xml).not.toContain('b) and');
  });

  it('keeps a formula that contains a link', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See \\(x and [a \\)](https://example.com) y\\).',
      outputPath: '/tmp/linked-math.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/document.xml").decode()); print("---RELS---"); print(z.read("word/_rels/document.xml.rels").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('https://example.com');
    expect(xml).not.toContain('$x');
  });

  it('keeps a formula that contains inline code', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See \\(x `y`\\).',
      outputPath: '/tmp/code-math.docx',
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
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('x `y`');
    expect(xml).not.toContain('$x');
  });

  it('keeps a formula inside bold text', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '**See $x^2$ now**',
      outputPath: '/tmp/bold-math.docx',
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
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<w:b/>');
    expect(xml).not.toContain('**');
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
      content: '3. third\n4. fourth',
      outputPath: '/tmp/start.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/document.xml").decode()); print("---NUM---"); print(z.read("word/numbering.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    const [document = '', numbering = ''] = xml.split('---NUM---');
    expect(document).toContain('third');
    expect(document).toContain('fourth');
    expect(document).not.toContain('4. fourth');
    expect(document.match(/<w:numPr>/g)).toHaveLength(2);
    expect(numbering).toContain('w:val="3"');
  });

  it('numbers every ordered item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '1. first\n2. second',
      outputPath: '/tmp/ordered.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('first');
    expect(xml).toContain('second');
    expect(xml).not.toContain('2. second');
    expect(xml.match(/<w:numPr>/g)).toHaveLength(2);
  });

  it('keeps a parenthesis on each ordered item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '1) one\n2) two\n\n0) zero',
      outputPath: '/tmp/paren.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/document.xml").decode()); print("---NUM---"); print(z.read("word/numbering.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    const [document = '', numbering = ''] = xml.split('---NUM---');
    expect(document).toContain('one');
    expect(document).toContain('two');
    expect(document).toContain('zero');
    expect(document).not.toContain('1)');
    expect(document.match(/<w:numPr>/g)).toHaveLength(3);
    expect(numbering).toContain('%1)');
  });

  it('keeps plus and star bullets', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '+ plus\n\n* star\n- dash',
      outputPath: '/tmp/bullets.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('+ ');
    expect(xml).toContain('plus');
    expect(xml).toContain('* ');
    expect(xml).toContain('star');
    expect(xml).toContain('dash');
  });

  it('keeps snake_case as plain text and still emphasizes _words_', () => {
    expect(parseInlineFormatting('use snake_case_name here')).toEqual([
      { text: 'use snake_case_name here' },
    ]);
    expect(parseInlineFormatting('See <mark>hi</mark> now')).toEqual([
      { text: 'See ' },
      { text: 'hi', highlight: true },
      { text: ' now' },
    ]);
    expect(parseInlineFormatting('<u>hi</u>')).toEqual([{ text: 'hi', underline: true }]);
    expect(parseInlineFormatting('x<sup>y</sup> and a<sub>n</sub>')).toEqual([
      { text: 'x' },
      { text: 'y', superScript: true },
      { text: ' and a' },
      { text: 'n', subScript: true },
    ]);
    expect(parseInlineFormatting('`<mark>hi</mark>`')).toEqual([
      { text: '<mark>hi</mark>', code: true },
    ]);
    expect(parseInlineFormatting('~~gone~~')).toEqual([{ text: 'gone', strike: true }]);
    expect(parseInlineFormatting('~~`code`~~')).toEqual([
      { text: 'code', code: true, strike: true },
    ]);
    expect(parseInlineFormatting('`~~not~~`')).toEqual([{ text: '~~not~~', code: true }]);
    expect(parseInlineFormatting('***both***')).toEqual([
      { text: 'both', bold: true, italic: true },
    ]);
    expect(parseInlineFormatting('a * b * c')).toEqual([{ text: 'a * b * c' }]);
    expect(parseInlineFormatting('$a*b*c$')).toEqual([{ text: '$a*b*c$' }]);
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
    expect(parseInlineFormatting('[a `b](no) c`](https://example.com)')).toEqual([
      { text: 'a ', link: 'https://example.com' },
      { text: 'b](no) c', code: true, link: 'https://example.com' },
    ]);
    expect(parseInlineFormatting('[a `b`](https://example.com)')).toEqual([
      { text: 'a ', link: 'https://example.com' },
      { text: 'b', code: true, link: 'https://example.com' },
    ]);
    expect(parseInlineFormatting('**[a `b`](https://example.com)**')).toEqual([
      { text: 'a ', bold: true, link: 'https://example.com' },
      { text: 'b', bold: true, code: true, link: 'https://example.com' },
    ]);
    expect(parseInlineFormatting('**a `code` b**')).toEqual([
      { text: 'a ', bold: true },
      { text: 'code', bold: true, code: true },
      { text: ' b', bold: true },
    ]);
    expect(parseInlineFormatting('**a `b**c` d**')).toEqual([
      { text: 'a ', bold: true },
      { text: 'b**c', bold: true, code: true },
      { text: ' d', bold: true },
    ]);
    expect(parseInlineFormatting('`[docs](https://example.com)`')).toEqual([
      { text: '[docs](https://example.com)', code: true },
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

  it('leaves YAML metadata out of the document', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '---\ntitle: Hello\nauthor: Ada\n---\n\nBody text.\n',
      outputPath: '/tmp/frontmatter.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; xml=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode(); sys.stdout.write(xml)',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('Body text.');
    expect(xml).not.toContain('title: Hello');
    expect(xml).not.toContain('author: Ada');
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

  it('keeps a fence indented under a quoted list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '> - inner\n>     ~~~\n>     **not bold**\n>     ~~~\n',
      outputPath: '/tmp/quoted-fence.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('**not bold**');
    expect(xml).not.toContain('~~~');
    expect(xml).not.toContain('<w:b/>');
    expect(xml).not.toContain('<w:b ');
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

  it('formats a definition list and a key', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '<dl><dt>Term</dt><dd>definition</dd></dl>\n\nPress <kbd>Cmd</kbd> now\n',
      outputPath: '/tmp/html-definition.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; xml=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode(); print(xml)',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('Term');
    expect(xml).toContain('definition');
    expect(xml).toContain('Cmd');
    expect(xml).toContain('<w:b');
    expect(xml).not.toContain('&lt;dl');
    expect(xml).not.toContain('&lt;kbd');
  });

  it('formats an HTML table', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '<table><tr><th>Name</th><th>Value</th></tr><tr><td>A</td><td>1</td></tr></table>\n',
      outputPath: '/tmp/html-table.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
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
    expect(xml).toContain('>A<');
    expect(xml).not.toContain('&lt;table');
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

  it('joins a display formula onto one line', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '$$\n\\frac{a}{b}\n+ c\n$$',
      outputPath: '/tmp/multiline-math.docx',
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
    expect(xml).toContain('<m:f>');
    const texts = [...xml.matchAll(/<m:t[^>]*>([^<]*)<\/m:t>/g)].map((match) => match[1] ?? '');
    expect(texts.join('')).toBe('ab + c');
    expect(texts.every((text) => !text.includes('\n'))).toBe(true);
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

  it('formats an HTML emphasis tag', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Say <em>hello</em> now',
      outputPath: '/tmp/html-em.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('hello');
    expect(xml).toContain('<w:i');
    expect(xml).not.toContain('&lt;em');
  });

  it('breaks a line at an HTML break', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See this.<br>Next',
      outputPath: '/tmp/html-break.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; print(zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())).read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    expect(xml).toContain('<w:br');
    expect(xml).toContain('this.');
    expect(xml).toContain('Next');
    expect(xml).not.toContain('&lt;br');
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

  it('does not point a picture or link at a local file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: [
        '![Secret](/etc/passwd.png)',
        '',
        '[Disk](file:///etc/passwd)',
        '',
        '[Run](javascript:alert(1))',
        '',
        '<img src="file:///etc/passwd" alt="Secret">',
        '',
        '<a href="javascript:alert(1)">Run</a>',
        '',
        '<video poster="/etc/passwd.png"></video>',
      ].join('\n'),
      outputPath: '/tmp/local-file.docx',
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
    const packed = extracted.stdout.toString();
    expect(packed).not.toContain('/etc/passwd');
    expect(packed).not.toContain('file:');
    expect(packed).not.toContain('javascript:');
    expect(packed).toContain('Secret');
    expect(packed).toContain('Disk');
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
    const document = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/document.xml").decode())',
      ],
      { input: buffer }
    );
    expect(document.stdout.toString()).toContain('Docs');
  });

  it('keeps an image title beside the picture', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '![Local](photo.jpg "Sunset")\n\n[![sunset](pixel.png "Dawn")](https://example.com)',
      outputPath: '/tmp/image-title.docx',
    });
    const buffer = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Buffer;
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("word/document.xml").decode()); print("---RELS---"); print(z.read("word/_rels/document.xml.rels").decode())',
      ],
      { input: buffer }
    );
    const xml = extracted.stdout.toString();
    const [document = '', rels = ''] = xml.split('---RELS---');
    expect(document).toContain('Sunset');
    expect(document).toContain('Dawn');
    expect(document).toContain('Local');
    expect(rels).toContain('photo.jpg');
    expect(rels).toContain('https://example.com');
    expect(rels).not.toContain('Sunset');
    expect(rels).not.toContain('Dawn');
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
