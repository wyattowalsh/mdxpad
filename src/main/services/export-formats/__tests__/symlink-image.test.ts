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
    const html = [
      '<img src="alias.png" alt="Secret">',
      '<img src="escape/secret.png" alt="Secret">',
      '<img src="pixel.png" alt="Ok">',
      '<img src="https://example.com/a.png" alt="Remote">',
    ].join('\n');
    const htmlKept = omitLocalMarkdownTargets(html, source);
    expect(htmlKept).not.toContain('alias.png');
    expect(htmlKept).not.toContain('escape/secret.png');
    expect(htmlKept).toContain('<img src="pixel.png" alt="Ok">');
    expect(htmlKept).toContain('https://example.com/a.png');
    expect(htmlKept).toContain('Secret');
    const fenced = '```html\n<img src="alias.png" alt="Secret">\n```\n';
    expect(omitLocalMarkdownTargets(fenced, source)).toContain('alias.png');
    const media = [
      '<video src="alias.png" poster="pixel.png"></video>',
      '<audio src="escape/secret.png"></audio>',
      '<source src="alias.png">',
      '<img src="pixel.png" srcset="alias.png 1x, https://example.com/a.png 2x" alt="Ok">',
      '<svg><use href="alias.png"></use></svg>',
    ].join('\n');
    const mediaKept = omitLocalMarkdownTargets(media, source);
    expect(mediaKept).not.toContain('src="alias.png"');
    expect(mediaKept).not.toContain('escape/secret.png');
    expect(mediaKept).not.toContain('href="alias.png"');
    expect(mediaKept).toContain('poster="pixel.png"');
    expect(mediaKept).toContain('src="pixel.png"');
    expect(mediaKept).toContain('https://example.com/a.png');
    const styled = [
      '<div style="background: url(alias.png)">x</div>',
      '<style>body { background: url(alias.png); }</style>',
      '<style>',
      'body { background: url(escape/secret.png); }',
      '</style>',
      '<svg><feImage href="alias.png"></feImage></svg>',
      '<div style="background: url(pixel.png)"></div>',
      '<div style="background: url(https://example.com/a.png)"></div>',
    ].join('\n');
    const styledKept = omitLocalMarkdownTargets(styled, source);
    expect(styledKept).not.toContain('alias.png');
    expect(styledKept).not.toContain('escape/secret.png');
    expect(styledKept).toContain('url(pixel.png)');
    expect(styledKept).toContain('https://example.com/a.png');
    const fencedStyle = '```css\nbody { background: url(alias.png); }\n```\n';
    expect(omitLocalMarkdownTargets(fencedStyle, source)).toContain('alias.png');
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
