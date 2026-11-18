import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { StaticSiteGenerator } from './static-site-generator';

describe('StaticSiteGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('publishes a heading, bold text, and an ampersand', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-site-'));
    tempDirs.push(root);
    const source = path.join(root, 'note.md');
    const output = path.join(root, 'out');
    await writeFile(source, '# Hello <b>there</b> #\n\n**bold** AT&amp;T\n');

    const result = await new StaticSiteGenerator().generate({
      files: [{ path: source, title: 'Hello' }],
      outputDir: output,
      includeStyles: false,
      includeHighlighting: false,
      generateIndex: false,
    });

    expect(result.success).toBe(true);
    const html = await readFile(path.join(output, 'note.html'), 'utf-8');
    expect(html).toContain('<h1 id="hello-bthereb">Hello <b>there</b></h1>');
    expect(html).not.toContain('there</b> #');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('AT&amp;T');
    expect(html).not.toContain('AT&amp;amp;T');
  });

  it('publishes numbered lists, bullets, and math', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-site-'));
    tempDirs.push(root);
    const source = path.join(root, 'note.md');
    const output = path.join(root, 'out');
    await writeFile(source, '1) one\n\n+ plus\n\nThe area is \\(x^2\\).\n');

    const result = await new StaticSiteGenerator().generate({
      files: [{ path: source, title: 'Note' }],
      outputDir: output,
      includeStyles: true,
      includeHighlighting: false,
      generateIndex: false,
    });

    expect(result.success).toBe(true);
    const html = await readFile(path.join(output, 'note.html'), 'utf-8');
    expect(html).toContain('<ol class="paren"');
    expect(html).toContain('<ul class="plus">');
    expect(html).toContain('border: 1px solid #d1d5db');
    expect(html).toContain('text-align: left');
    expect(html).toContain('ol.paren > li::before');
    expect(html).toContain('class="katex"');
    expect(html).toContain('x^2');
    const css = await readFile(path.join(output, 'styles.css'), 'utf-8');
    expect(css).toContain('border: 1px solid #d1d5db');
    expect(css).toContain('text-align: left');
    expect(css).toContain('ol.paren > li::before');
    expect(css).toContain('ul.plus > li::before');
  });

  it('publishes a mermaid diagram', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-site-'));
    tempDirs.push(root);
    const source = path.join(root, 'diagram.md');
    const output = path.join(root, 'out');
    await writeFile(source, '```mermaid\ngraph TD\n  A-->B\n```\n');

    const result = await new StaticSiteGenerator().generate({
      files: [{ path: source, title: 'Diagram' }],
      outputDir: output,
      includeStyles: false,
      includeHighlighting: false,
      generateIndex: false,
    });

    expect(result.success).toBe(true);
    const html = await readFile(path.join(output, 'diagram.html'), 'utf-8');
    expect(html).toContain('border: 1px solid #d1d5db');
    expect(html).toContain('text-align: left');
    expect(html).toContain('class="mermaid"');
    expect(html).toContain('graph TD');
    expect(html).toContain('cdn.jsdelivr.net/npm/mermaid');
    expect(html).toContain("securityLevel: 'strict'");
  });

  it('gives each page its own file when names slug to the same text', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-site-'));
    tempDirs.push(root);
    const output = path.join(root, 'out');
    const first = path.join(root, 'Hello World.md');
    const second = path.join(root, 'hello-world.md');
    const symbols = path.join(root, '!!!.md');
    await writeFile(first, '# One\n');
    await writeFile(second, '# Two\n');
    await writeFile(symbols, '# Three\n');

    const result = await new StaticSiteGenerator().generate({
      files: [
        { path: first, title: 'One' },
        { path: second, title: 'Two' },
        { path: symbols, title: 'Three' },
      ],
      outputDir: output,
      includeStyles: false,
      includeHighlighting: false,
      generateIndex: true,
    });

    expect(result.success).toBe(true);
    expect(await readFile(path.join(output, 'hello-world.html'), 'utf-8')).toContain('One');
    expect(await readFile(path.join(output, 'hello-world-2.html'), 'utf-8')).toContain('Two');
    expect(await readFile(path.join(output, 'page.html'), 'utf-8')).toContain('Three');
    const index = await readFile(path.join(output, 'index.html'), 'utf-8');
    expect(index).toContain('hello-world-2.html');
    expect(index).toContain('page.html');
  });

  it('copies local images beside the published page', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-site-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-site-out-'));
    tempDirs.push(root, outside);
    const source = path.join(root, 'note.md');
    const output = path.join(root, 'out');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    await mkdir(path.join(root, 'images'));
    await writeFile(path.join(root, 'pixel.png'), png);
    await writeFile(path.join(root, 'images', 'nested.png'), png);
    await writeFile(path.join(root, 'hidden.png'), png);
    await writeFile(path.join(outside, 'secret.png'), png);
    const outsideName = path.basename(outside);
    await writeFile(
      source,
      [
        '![Pixel][pic]',
        '',
        '[pic]: pixel.png',
        '',
        '![Nested](images/nested.png)',
        '',
        '```',
        '![Hidden](hidden.png)',
        '```',
        '',
        `![Out](../${outsideName}/secret.png)`,
      ].join('\n')
    );

    const result = await new StaticSiteGenerator().generate({
      files: [{ path: source, title: 'Note' }],
      outputDir: output,
      includeStyles: false,
      includeHighlighting: false,
      generateIndex: false,
    });

    expect(result.success).toBe(true);
    expect(await readFile(path.join(output, 'pixel.png'))).toEqual(png);
    expect(await readFile(path.join(output, 'images', 'nested.png'))).toEqual(png);
    await expect(readFile(path.join(output, 'hidden.png'))).rejects.toThrow();
    await expect(readFile(path.join(output, 'secret.png'))).rejects.toThrow();
    const html = await readFile(path.join(output, 'note.html'), 'utf-8');
    expect(html).toContain('src="pixel.png"');
    expect(html).toContain('src="images/nested.png"');
  });
});
