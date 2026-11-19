import { describe, expect, it } from 'vitest';

import { embedEpubImages } from '../epub-images';

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('embedEpubImages', () => {
  it('keeps a picture title when the picture is embedded', async () => {
    const result = await embedEpubImages(`<img src="${PIXEL}" alt="shot" title="Dawn" />`);
    expect(result.html).toContain('alt="shot"');
    expect(result.html).toContain('title="Dawn"');
    await result.cleanup();
  });

  it('keeps a picture title when the picture cannot be embedded', async () => {
    const result = await embedEpubImages('<img src="photo.jpg" alt="Local" title="Sunset" />');
    expect(result.html).toContain('Local');
    expect(result.html).toContain('<em>Sunset</em>');
    expect(result.html).not.toContain('photo.jpg');
    expect(result.warnings).toEqual(['A picture could not be included in the EPUB']);
    await result.cleanup();
  });

  it('escapes a quote inside a picture title', async () => {
    const result = await embedEpubImages(
      `<img src="${PIXEL}" alt="shot" title="Say &quot;hi&quot;" />`
    );
    expect(result.html).toContain('title="Say &quot;hi&quot;"');
    await result.cleanup();
  });
});
