import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import * as os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { DocxExporter } from '../docx-exporter';
import { LatexExporter } from '../latex-exporter';
import { omitLocalMarkdownTargets } from '../omit-local-markdown-targets';

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    writeFile: vi.fn(actual.writeFile),
  };
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function sourceWithSymlink(): Promise<{ root: string; source: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-symlink-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-symlink-out-'));
  await writeFile(path.join(outside, 'secret.png'), PNG);
  await writeFile(path.join(root, 'pixel.png'), PNG);
  await symlink(path.join(outside, 'secret.png'), path.join(root, 'alias.png'));
  await symlink(outside, path.join(root, 'escape'));
  return { root, source: path.join(root, 'note.md') };
}

describe('pictures that leave the source folder through a symlink', () => {
  it('drops the symlink and keeps a real picture in the folder', async () => {
    const { root, source } = await sourceWithSymlink();
    const content = [
      '![Secret](alias.png)',
      '![Secret](escape/secret.png)',
      `![Secret](${path.join(root, 'alias.png')})`,
      '![Ok](pixel.png)',
      '![Remote](https://example.com/a.png)',
    ].join('\n');
    const kept = omitLocalMarkdownTargets(content, source);
    expect(kept).not.toContain('alias.png');
    expect(kept).not.toContain('escape/secret.png');
    expect(kept).toContain('![Ok](pixel.png)');
    expect(kept).toContain('https://example.com/a.png');
    expect(kept).toContain('Secret');
  });

  it('does not hand a symlink to LaTeX', async () => {
    const { root, source } = await sourceWithSymlink();
    const outputPath = path.join(root, 'out.tex');
    const result = await new LatexExporter().export({
      content: '![Secret](alias.png)\n\n![Ok](pixel.png)\n',
      outputPath,
      sourcePath: source,
    });
    expect(result.ok).toBe(true);
    const { writeFile: recorded } = await import('node:fs/promises');
    const written = (recorded as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('alias.png');
    expect(written).toContain('pixel.png');
    expect(written).toContain('Secret');
  });

  it('does not link a symlink from Word', async () => {
    const { root, source } = await sourceWithSymlink();
    const outputPath = path.join(root, 'out.docx');
    const result = await new DocxExporter().export({
      content: '![Secret](alias.png)\n\n![Ok](pixel.png)\n',
      outputPath,
      sourcePath: source,
    });
    expect(result.ok).toBe(true);
    const extracted = spawnSync('python3', [
      '-c',
      `import zipfile; z=zipfile.ZipFile(${JSON.stringify(outputPath)}); print(z.read("word/_rels/document.xml.rels").decode()); print(z.read("word/document.xml").decode())`,
    ]);
    const xml = extracted.stdout.toString();
    expect(xml).not.toContain('alias.png');
    expect(xml).toContain('Secret');
    expect(xml).toContain('Ok');
  });
});
