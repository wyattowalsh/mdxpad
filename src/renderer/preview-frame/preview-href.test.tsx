import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { A } from './components/typography';
import { isBlockedPreviewHref } from './preview-href';

describe('isBlockedPreviewHref', () => {
  it('blocks file and javascript links', () => {
    expect(isBlockedPreviewHref('file:///etc/passwd')).toBe(true);
    expect(isBlockedPreviewHref(' JavaScript:alert(1)')).toBe(true);
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
});
