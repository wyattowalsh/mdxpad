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
    await writeFile(source, '# Hello <b>there</b>\n\n**bold**\n');

    const result = await new StaticSiteGenerator().generate({
      files: [{ path: source, title: 'Hello' }],
      outputDir: output,
      includeStyles: false,
      includeHighlighting: false,
      generateIndex: false,
    });

    expect(result.success).toBe(true);
    const html = await readFile(path.join(output, 'note.html'), 'utf-8');
    expect(html).toContain('&lt;b&gt;there&lt;/b&gt;');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).not.toContain('<b>there</b>');
  });
});
