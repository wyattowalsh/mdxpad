import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { StaticSiteGenerator } from './static-site-generator';

describe('StaticSiteGenerator', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('escapes raw HTML in the published page', async () => {
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
    expect(html).toContain('<h1>Hello &lt;b&gt;there&lt;/b&gt;</h1>');
    expect(html).not.toContain('there&lt;/b&gt; #');
    expect(html).toContain('&lt;b&gt;there&lt;/b&gt;');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('AT&amp;T');
    expect(html).not.toContain('AT&amp;amp;T');
    expect(html).not.toContain('<b>there</b>');
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
});
