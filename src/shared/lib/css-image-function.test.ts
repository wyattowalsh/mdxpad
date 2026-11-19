import { describe, expect, it } from 'vitest';

import { replaceCssImageFunctionAddresses } from './css-image-function';

function blocksFile(address: string): boolean {
  return address.includes('file:');
}

describe('replaceCssImageFunctionAddresses', () => {
  it('drops a quoted file from image-set and keeps a remote picture', () => {
    const local = replaceCssImageFunctionAddresses(
      'image-set("file:///etc/passwd" 1x)',
      blocksFile
    );
    expect(local).toBe('image-set(none 1x)');
    expect(local).not.toContain('file:');

    const remote = replaceCssImageFunctionAddresses(
      'image-set("https://example.com/a.png" 1x)',
      blocksFile
    );
    expect(remote).toContain('https://example.com/a.png');
  });

  it('drops a file from image() and leaves ordinary text alone', () => {
    expect(replaceCssImageFunctionAddresses('image("file:///etc/passwd")', blocksFile)).toBe(
      'image(none)'
    );
    expect(replaceCssImageFunctionAddresses('content: "file:///etc/passwd"', blocksFile)).toBe(
      'content: "file:///etc/passwd"'
    );
  });
});