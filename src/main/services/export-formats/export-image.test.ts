import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { DocxExporter } from './docx-exporter';
import { inlineLocalImages } from './export-image';
import { markdownToPdfHtml } from './pdf-exporter';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

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
