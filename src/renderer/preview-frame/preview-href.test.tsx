import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { A, Img } from './components/typography';
import { isBlockedPreviewHref } from './preview-href';

describe('isBlockedPreviewHref', () => {
  it('blocks file and javascript links', () => {
    expect(isBlockedPreviewHref('file:///etc/passwd')).toBe(true);
    expect(isBlockedPreviewHref(' JavaScript:alert(1)')).toBe(true);
    expect(isBlockedPreviewHref('java\tscript:alert(1)')).toBe(true);
    expect(isBlockedPreviewHref('file\n:///etc/passwd')).toBe(true);
    expect(isBlockedPreviewHref('\0javascript:alert(1)')).toBe(true);
    expect(isBlockedPreviewHref('https://example.com')).toBe(false);
    expect(isBlockedPreviewHref('./note.md')).toBe(false);
  });
});

describe('preview anchor', () => {
  it('does not follow a file link', () => {
    const view = render(<A href="file:///etc/passwd">Disk</A>);
    const link = view.getByText('Disk').closest('a');
    expect(link).toBeInstanceOf(HTMLAnchorElement);
    expect(link?.getAttribute('href')).toBeNull();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not follow a javascript link with a tab in the scheme', () => {
    const view = render(<A href={'java\tscript:alert(1)'}>Run</A>);
    const link = view.getByText('Run').closest('a');
    expect(link?.getAttribute('href')).toBeNull();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('preview image', () => {
  it('keeps a picture beside the document and drops a file image', () => {
    const local = render(<Img src="./pixel.png" alt="Pixel" />);
    expect(local.getByRole('img').getAttribute('src')).toBe('./pixel.png');
    local.unmount();

    const disk = render(<Img src="file:///etc/passwd" alt="Secret" />);
    expect(disk.getByRole('img').getAttribute('src')).toBeNull();
    disk.unmount();

    const hidden = render(<Img src={'file\n:///etc/passwd'} alt="Hidden" />);
    expect(hidden.getByRole('img').getAttribute('src')).toBeNull();
  });
});
