import { mkdtemp, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { grantReadCapability, resetFileCapabilities } from './document-capability';
import { inlinePreviewImages } from './inline-preview-images';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('inlinePreviewImages', () => {
  afterEach(() => {
    resetFileCapabilities();
  });

  it('embeds a picture beside an open file and leaves a closed file alone', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-preview-image-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-preview-out-'));
    const source = path.join(root, 'note.md');
    await writeFile(source, '# Note\n');
    await writeFile(path.join(root, 'pixel.png'), PNG);
    await writeFile(path.join(outside, 'secret.png'), PNG);
    const outsideName = path.basename(outside);
    const content = [
      '![Pixel](pixel.png)',
      '',
      '![Also][pic]',
      '',
      '[pic]: pixel.png',
      '',
      `![Out](../${outsideName}/secret.png)`,
    ].join('\n');

    expect(await inlinePreviewImages(content, source)).toBe(content);

    grantReadCapability(source);
    const embedded = await inlinePreviewImages(content, source);
    expect(embedded).toContain('![Pixel](data:image/png;base64,');
    expect(embedded).toContain('![Also](data:image/png;base64,');
    expect(embedded).toContain(`![Out](../${outsideName}/secret.png)`);
    expect(embedded.match(/data:image\/png/g)).toHaveLength(2);
  });
});
