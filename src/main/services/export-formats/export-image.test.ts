import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { DocxExporter } from './docx-exporter';
import { copyPublishedImages, inlineLocalImages } from './export-image';
import { markdownToPdfHtml } from './pdf-exporter';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('copyPublishedImages', () => {
  it('does not write a published image through a link', async () => {
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-src-'));
    const output = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-out-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-secret-'));
    const source = path.join(sourceDir, 'note.md');
    const secret = path.join(outside, 'secret.png');
    await mkdir(path.join(sourceDir, 'images'));
    await writeFile(path.join(sourceDir, 'pixel.png'), PNG);
    await writeFile(path.join(sourceDir, 'images', 'nested.png'), PNG);
    await writeFile(secret, Buffer.from('secret'));
    await symlink(secret, path.join(output, 'pixel.png'));
    await symlink(outside, path.join(output, 'images'));

    await copyPublishedImages(
      '![In](pixel.png)\n\n![Nested](images/nested.png)\n',
      source,
      output
    );

    expect(await readFile(secret, 'utf8')).toBe('secret');
    await expect(readFile(path.join(outside, 'nested.png'))).rejects.toThrow();
  });

  it('does not copy a source image that is a link', async () => {
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-src-link-'));
    const output = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-out-link-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-secret-link-'));
    const source = path.join(sourceDir, 'note.md');
    const secret = path.join(outside, 'secret.png');
    await writeFile(secret, Buffer.from('secret'));
    await symlink(secret, path.join(sourceDir, 'pixel.png'));

    await copyPublishedImages('![In](pixel.png)\n', source, output);

    expect(await readFile(secret, 'utf8')).toBe('secret');
    await expect(readFile(path.join(output, 'pixel.png'))).rejects.toThrow();
  });
});

describe('inlineLocalImages', () => {
  it('embeds an image beside the source and leaves one outside that folder', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-image-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-image-out-'));
    const source = path.join(root, 'note.md');
    await writeFile(path.join(root, 'pixel.png'), PNG);
    await writeFile(path.join(outside, 'secret.png'), PNG);
    const outsideName = path.basename(outside);
    const content = [
      '![In](pixel.png)',
      '',
      '```',
      '![In](pixel.png)',
      '```',
      '',
      `![Out](../${outsideName}/secret.png)`,
    ].join('\n');

    const inlined = await inlineLocalImages(content, source, 'data-url');

    expect(inlined).toContain('![In](data:image/png;base64,');
    expect(inlined).toContain('```\n![In](pixel.png)\n```');
    expect(inlined).toContain(`![Out](../${outsideName}/secret.png)`);
    expect(inlined.match(/data:image\/png/g)).toHaveLength(1);
    expect(markdownToPdfHtml(inlined)).toContain('<img src="data:image/png;base64,');
  });

  it('does not embed an image that is a link', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-image-link-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-image-link-out-'));
    const source = path.join(root, 'note.md');
    const secret = path.join(outside, 'secret.png');
    await writeFile(secret, Buffer.from('secret'));
    await symlink(secret, path.join(root, 'pixel.png'));

    const inlined = await inlineLocalImages('![In](pixel.png)', source, 'data-url');

    expect(inlined).toBe('![In](pixel.png)');
    expect(await readFile(secret, 'utf8')).toBe('secret');
  });

  it('embeds an image whose file name contains a space', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-image-space-'));
    const source = path.join(root, 'note.md');
    await writeFile(path.join(root, 'my photo.png'), PNG);
    const inlined = await inlineLocalImages(
      '![Alt](<my photo.png>)\n\n<img src="my photo.png">',
      source,
      'data-url'
    );

    expect(inlined).toMatch(/!\[[^\]]*\]\(data:image\/png;base64,[A-Za-z0-9+/=]+\)/);
    expect(inlined).toMatch(/<img src="data:image\/png;base64,[A-Za-z0-9+/=]+">/);
    expect(inlined).not.toContain('photo.png>');
  });

  it('points Pandoc at a local picture and leaves one outside the folder', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-image-resource-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-image-resource-out-'));
    const source = path.join(root, 'note.md');
    await writeFile(path.join(root, 'my photo.png'), PNG);
    await writeFile(path.join(root, 'photo.webp'), Buffer.from('RIFFwebp'));
    await writeFile(path.join(outside, 'secret.png'), PNG);
    const outsideName = path.basename(outside);
    const rewritten = await inlineLocalImages(
      [
        '![Space](<my photo.png>)',
        '',
        '![Web](photo.webp)',
        '',
        `![Out](../${outsideName}/secret.png)`,
      ].join('\n'),
      source,
      'resource'
    );
    const photo = path.join(root, 'my photo.png').split(path.sep).join('/');
    const web = path.join(root, 'photo.webp').split(path.sep).join('/');

    expect(rewritten).toContain(`![Space](<${photo}>)`);
    expect(rewritten).toContain(`![Web](${web})`);
    expect(rewritten).toContain(`![Out](../${outsideName}/secret.png)`);
  });

  it('embeds a WebP and an SVG in a document and leaves them for Word', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-image-web-'));
    const source = path.join(root, 'note.md');
    await writeFile(path.join(root, 'photo.webp'), Buffer.from('RIFFwebp'));
    await writeFile(path.join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const content = '![Photo](photo.webp)\n\n![Icon](icon.svg)\n';

    const document = await inlineLocalImages(content, source, 'document');
    const word = await inlineLocalImages(content, source, 'data-url');

    expect(document).toContain('![Photo](data:image/webp;base64,');
    expect(document).toContain('![Icon](data:image/svg+xml;base64,');
    expect(markdownToPdfHtml(document)).toContain('src="data:image/webp;base64,');
    expect(markdownToPdfHtml(document)).toContain('src="data:image/svg+xml;base64,');
    expect(word).toContain('![Photo](photo.webp)');
    expect(word).toContain('![Icon](icon.svg)');
    expect(word).not.toContain('data:image/webp');
    expect(word).not.toContain('data:image/svg');
  });

  it('embeds a referenced WebP and leaves one inside a code fence', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-image-ref-'));
    const source = path.join(root, 'note.md');
    await writeFile(path.join(root, 'photo.webp'), Buffer.from('RIFFwebp'));
    const content = [
      '![Photo][pic]',
      '',
      '[pic]: photo.webp "Sunset"',
      '',
      '```',
      '![Photo][pic]',
      '```',
      '',
      '- item',
      '',
      '    ![Also][pic]',
    ].join('\n');

    const document = await inlineLocalImages(content, source, 'document');
    const html = markdownToPdfHtml(document);

    expect(document).toContain('![Photo](data:image/webp;base64,');
    expect(document).toContain('"Sunset"');
    expect(document).toContain('```\n![Photo][pic]\n```');
    expect(document).toContain('![Also](data:image/webp;base64,');
    expect(html).toContain('src="data:image/webp;base64,');
    expect(html).toContain('title="Sunset"');
    expect(html).toContain('![Photo][pic]');
  });

  it('stores that image inside a Word document', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-image-docx-'));
    const source = path.join(root, 'note.md');
    const output = path.join(root, 'out.docx');
    await writeFile(path.join(root, 'pixel.png'), PNG);
    const result = await new DocxExporter().export({
      content: '![In](pixel.png)',
      outputPath: output,
      sourcePath: source,
    });
    expect(result.ok).toBe(true);
    const extracted = spawnSync(
      'python3',
      [
        '-c',
        'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print("\\n".join(z.namelist()))',
        output,
      ],
      { encoding: 'utf8' }
    );
    expect(extracted.stdout).toContain('word/media/');
  });
});
