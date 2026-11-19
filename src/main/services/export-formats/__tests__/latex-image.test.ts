import { mkdtemp, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { LatexExporter } from '../latex-exporter';

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

describe('LaTeX local images', () => {
  it('uses the real path of a picture whose name contains a space', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-latex-image-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-latex-out-'));
    const source = path.join(root, 'note.md');
    await writeFile(path.join(root, 'my photo.png'), PNG);
    await writeFile(path.join(outside, 'secret.png'), PNG);
    const outsideName = path.basename(outside);

    const result = await new LatexExporter().export({
      content: ['![Space](<my photo.png>)', '', `![Out](../${outsideName}/secret.png)`].join('\n'),
      outputPath: path.join(root, 'out.tex'),
      sourcePath: source,
    });

    expect(result.ok).toBe(true);
    const { writeFile: recorded } = await import('node:fs/promises');
    const written = (recorded as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    const photo = path.join(root, 'my photo.png').split(path.sep).join('/');
    expect(written).toContain(`\\includegraphics{${photo}}`);
    expect(written).not.toContain('%20');
    expect(written).toContain('Out');
    expect(written).not.toContain('secret.png');
    expect(written).not.toContain('\\includegraphics{../');
  });

  it('keeps an underscore in a picture name', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-latex-image-'));
    const source = path.join(root, 'note.md');
    await writeFile(path.join(root, 'my_photo.png'), PNG);

    const result = await new LatexExporter().export({
      content: '![Shot](my_photo.png)',
      outputPath: path.join(root, 'out.tex'),
      sourcePath: source,
    });

    expect(result.ok).toBe(true);
    const { writeFile: recorded } = await import('node:fs/promises');
    const written = (recorded as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    const photo = path.join(root, 'my_photo.png').split(path.sep).join('/');
    expect(written).toContain(`\\includegraphics{\\detokenize{${photo}}}`);
  });
});
