import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { DocxExporter } from './docx-exporter';
import { EpubExporter } from './epub-exporter';
import { LatexExporter } from './latex-exporter';
import type { Exporter } from './types';

describe('export output links', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function linkedOutput(name: string): Promise<{ output: string; secret: string }> {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-export-link-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-export-secret-'));
    dirs.push(root, outside);
    const secret = path.join(outside, name);
    const output = path.join(root, name);
    await writeFile(secret, 'secret');
    await symlink(secret, output);
    return { output, secret };
  }

  async function expectRealExport(
    exporter: Exporter,
    name: string,
    readable: boolean
  ): Promise<void> {
    const { output, secret } = await linkedOutput(name);
    const result = await exporter.export({
      content: '# Note\n\nBody',
      title: 'Note',
      outputPath: output,
    });

    expect(result.ok).toBe(true);
    expect(await readFile(secret, 'utf8')).toBe('secret');
    expect((await lstat(output)).isSymbolicLink()).toBe(false);
    const written = await readFile(output);
    expect(written.equals(Buffer.from('secret'))).toBe(false);
    if (readable) {
      expect(written.toString('utf8')).toContain('Note');
    } else {
      expect(written.subarray(0, 2).toString('utf8')).toBe('PK');
    }
  }

  it('writes a LaTeX export in place of a link', async () => {
    await expectRealExport(new LatexExporter(), 'note.tex', true);
  });

  it('writes a DOCX export in place of a link', async () => {
    await expectRealExport(new DocxExporter(), 'note.docx', false);
  });

  it('writes an EPUB export in place of a link', async () => {
    await expectRealExport(new EpubExporter(), 'note.epub', false);
  });
});
