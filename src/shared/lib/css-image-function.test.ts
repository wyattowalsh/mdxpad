import { describe, expect, it } from 'vitest';

import { cssValueHasBlockedAddress, replaceCssImageFunctionAddresses } from './css-image-function';

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

  it('finds a blocked address inside a paint value', () => {
    const blocked = (address: string): boolean => address.includes('file:') || address.includes('..');
    expect(cssValueHasBlockedAddress('url(../secret.svg#a)', blocked)).toBe(true);
    expect(cssValueHasBlockedAddress('url(#local)', blocked)).toBe(false);
    expect(cssValueHasBlockedAddress('red', blocked)).toBe(false);
    expect(cssValueHasBlockedAddress('image-set("file:///etc/passwd" 1x)', blocked)).toBe(true);
  });

  it('drops a file from src() and keeps a remote font', () => {
    expect(replaceCssImageFunctionAddresses('src("file:///etc/passwd")', blocksFile)).toBe(
      'src(none)'
    );
    expect(
      replaceCssImageFunctionAddresses('src("https://example.com/a.woff")', blocksFile)
    ).toContain('https://example.com/a.woff');
    expect(cssValueHasBlockedAddress('src("../secret.woff")', (address) => address.includes('..'))).toBe(
      true
    );
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