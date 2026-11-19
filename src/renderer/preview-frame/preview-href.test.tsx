import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Video } from './components/preview-media';
import { Area, Base, Form, Link } from './components/preview-navigation';
import { A, Img } from './components/typography';
import { confinePreviewElement, confinePreviewProps, isBlockedPreviewHref } from './preview-href';

describe('isBlockedPreviewHref', () => {
  it('blocks file and javascript links', () => {
    expect(isBlockedPreviewHref('file:///etc/passwd')).toBe(true);
    expect(isBlockedPreviewHref(' JavaScript:alert(1)')).toBe(true);
    expect(isBlockedPreviewHref('java\tscript:alert(1)')).toBe(true);
    expect(isBlockedPreviewHref('file\n:///etc/passwd')).toBe(true);
    expect(isBlockedPreviewHref('\0javascript:alert(1)')).toBe(true);
    expect(isBlockedPreviewHref('https://example.com')).toBe(false);
    expect(isBlockedPreviewHref('./note.md')).toBe(false);
    expect(isBlockedPreviewHref('file&#58;///etc/passwd')).toBe(true);
    expect(isBlockedPreviewHref('/etc/passwd')).toBe(true);
    expect(isBlockedPreviewHref('/notes/a.md')).toBe(false);
    expect(isBlockedPreviewHref('data:text/html,hi')).toBe(true);
  });

  it('drops a local file inside a style and keeps alignment', () => {
    const props = confinePreviewProps({
      style: 'background:url(file:///etc/passwd);color:red;text-align:right',
      href: '/notes/a.md',
      src: '/notes/a.md',
    }) as { style: Record<string, string>; href: string; src?: string };
    expect(props.style).toEqual({ background: 'none', color: 'red', textAlign: 'right' });
    expect(props.href).toBe('/notes/a.md');
    expect(props.src).toBeUndefined();
  });

  it('drops a css escape and a nested document', () => {
    const styled = confinePreviewProps({
      style: 'background:url(\\66ile:///etc/passwd);color:red',
    }) as { style: Record<string, string> };
    expect(JSON.stringify(styled.style)).not.toContain('file:');
    expect(styled.style.background).toBe('none');
    expect(styled.style.color).toBe('red');

    const frame = confinePreviewElement('iframe', {
      srcdoc: '<img src="file:///etc/passwd">',
    }) as { srcdoc?: string };
    expect(frame.srcdoc).toBeUndefined();

    const parent = confinePreviewElement('image', { href: '../secret.png' }) as { href?: string };
    expect(parent.href).toBeUndefined();
    const beside = confinePreviewElement('image', { href: './pixel.png' }) as { href?: string };
    expect(beside.href).toBe('./pixel.png');
    const filter = confinePreviewElement('feImage', { href: '../secret.png' }) as { href?: string };
    expect(filter.href).toBeUndefined();
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

  it('does not follow a root path', () => {
    const view = render(<A href="/etc/passwd">Disk</A>);
    const link = view.getByText('Disk').closest('a');
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
    hidden.unmount();

    const rooted = render(<Img src="/etc/passwd.png" alt="Rooted" />);
    expect(rooted.getByRole('img').getAttribute('src')).toBeNull();
    rooted.unmount();

    const parent = render(<Img src="../secret.png" alt="Parent" />);
    expect(parent.getByRole('img').getAttribute('src')).toBeNull();
    parent.unmount();

    const sources = render(
      <Img src="./pixel.png" srcSet="file:///etc/passwd 1x, ./pixel.png 2x" alt="Sources" />
    );
    expect(sources.getByRole('img').getAttribute('srcset')).toBe('./pixel.png 2x');
  });
});

describe('preview video', () => {
  it('drops a file source and keeps a remote source', () => {
    const remote = render(<Video src="https://example.com/clip.mp4" />);
    expect(remote.container.querySelector('video')?.getAttribute('src')).toBe(
      'https://example.com/clip.mp4'
    );
    remote.unmount();

    const local = render(<Video src="file:///etc/passwd" />);
    expect(local.container.querySelector('video')?.getAttribute('src')).toBeNull();
    local.unmount();

    const poster = render(<Video poster="file:///etc/passwd.png" />);
    expect(poster.container.querySelector('video')?.getAttribute('poster')).toBeNull();
  });
});

describe('preview navigation elements', () => {
  it('drops a local file from base, area, form, and link addresses', () => {
    const base = render(<Base href="file:///etc/" />);
    expect(base.container.querySelector('base')?.getAttribute('href')).toBeNull();
    base.unmount();

    const area = render(<Area href="file:///etc/passwd" />);
    expect(area.container.querySelector('area')?.getAttribute('href')).toBeNull();
    area.unmount();

    const form = render(<Form action="javascript:alert(1)" />);
    expect(form.container.querySelector('form')?.getAttribute('action')).toBeNull();
    form.unmount();

    const link = render(<Link href="file:///etc/passwd.css" />);
    expect(link.container.querySelector('link')?.getAttribute('href')).toBeNull();
    link.unmount();

    const documentLink = render(<Link href="/notes/a.md" />);
    expect(documentLink.container.querySelector('link')?.getAttribute('href')).toBe('/notes/a.md');
  });
});
