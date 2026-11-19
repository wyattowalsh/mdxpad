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
    expect(isBlockedPreviewHref('java\fscript:alert(1)')).toBe(true);
    expect(isBlockedPreviewHref('java&#12;script:alert(1)')).toBe(true);
    expect(isBlockedPreviewHref('\0javascript:alert(1)')).toBe(true);
    expect(isBlockedPreviewHref('https://example.com')).toBe(false);
    expect(isBlockedPreviewHref('./note.md')).toBe(false);
    expect(isBlockedPreviewHref('file&#58;///etc/passwd')).toBe(true);
    expect(isBlockedPreviewHref('&#106avascript:alert(1)')).toBe(true);
    expect(isBlockedPreviewHref('file&#58///etc/passwd')).toBe(true);
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
    const objectStyle = confinePreviewProps({
      style: {
        backgroundImage: 'url(file:///etc/passwd)',
        color: 'red',
        textAlign: 'right',
        opacity: 0.5,
      },
    }) as { style: Record<string, unknown> };
    expect(objectStyle.style.backgroundImage).toBe('none');
    expect(objectStyle.style.color).toBe('red');
    expect(objectStyle.style.textAlign).toBe('right');
    expect(objectStyle.style.opacity).toBe(0.5);
    expect(JSON.stringify(objectStyle.style)).not.toContain('file:');
    const imageSet = confinePreviewProps({
      style: { backgroundImage: 'image-set("file:///etc/passwd" 1x)' },
    }) as { style: Record<string, string> };
    expect(imageSet.style.backgroundImage).not.toContain('file:');
    const injected = confinePreviewProps({
      className: 'note',
      dangerouslySetInnerHTML: { __html: '<img src="file:///etc/passwd">' },
    }) as { className?: string; dangerouslySetInnerHTML?: unknown };
    expect(injected.className).toBe('note');
    expect(injected.dangerouslySetInnerHTML).toBeUndefined();
    const form = confinePreviewProps({ formAction: '../secret.md' }) as { formAction?: string };
    expect(form.formAction).toBeUndefined();
    const filter = confinePreviewElement('filter', { href: '../secret.svg' }) as { href?: string };
    expect(filter.href).toBeUndefined();
    const mask = confinePreviewElement('mask', { href: '../secret.svg' }) as { href?: string };
    expect(mask.href).toBeUndefined();
    const clip = confinePreviewElement('clipPath', { href: '../secret.svg' }) as { href?: string };
    expect(clip.href).toBeUndefined();
    const animate = confinePreviewElement('animate', { href: '../secret.svg' }) as { href?: string };
    expect(animate.href).toBeUndefined();
    const upperSet = confinePreviewProps({
      style: { backgroundImage: 'IMAGE-SET("file:///etc/passwd" 1x)', color: 'red' },
    }) as { style: Record<string, string> };
    expect(JSON.stringify(upperSet.style)).not.toContain('file:');
    expect(upperSet.style.color).toBe('red');
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

    const numeric = confinePreviewProps({
      style: 'background:url(&#102ile:///etc/passwd);color:red',
    }) as { style: Record<string, string> };
    expect(JSON.stringify(numeric.style)).not.toContain('file:');
    expect(numeric.style.background).toBe('none');

    const set = confinePreviewElement('style', {
      children: 'body{background:image-set("file:///etc/passwd" 1x);color:red}',
    }) as { children: string };
    expect(set.children).not.toContain('file:');
    expect(set.children).toContain('color:red');

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

  it('drops a local file from an svg paint attribute', () => {
    const painted = confinePreviewElement('rect', {
      filter: 'url(../secret.svg#a)',
      fill: 'url(#local)',
      clipPath: 'url(file:///etc/passwd)',
      markerStart: 'url(../secret.svg#m)',
      stroke: 'red',
    }) as { filter?: string; fill: string; clipPath?: string; markerStart?: string; stroke: string };
    expect(painted.filter).toBeUndefined();
    expect(painted.clipPath).toBeUndefined();
    expect(painted.markerStart).toBeUndefined();
    expect(painted.fill).toBe('url(#local)');
    expect(painted.stroke).toBe('red');
    const font = confinePreviewElement('style', {
      children: '@font-face{font-family:x;src:src("../secret.woff")}',
    }) as { children: string };
    expect(font.children).not.toContain('secret');
    expect(font.children).toContain('font-family:x');
    const fontBackground = confinePreviewProps({
      style: "background:src('../secret.png');color:red",
    }) as { style: Record<string, string> };
    expect(JSON.stringify(fontBackground.style)).not.toContain('secret');
    expect(fontBackground.style.color).toBe('red');

    const escaped = confinePreviewElement('rect', {
      filter: '\\75rl(file:///etc/passwd)',
    }) as { filter?: string };
    expect(escaped.filter).toBeUndefined();
  });

  it('drops a parent file from a base, a stylesheet, a refresh, and an image source set', () => {
    const base = confinePreviewElement('base', { href: '../' }) as { href?: string };
    expect(base.href).toBeUndefined();
    const remoteBase = confinePreviewElement('base', { href: 'https://example.com/' }) as {
      href?: string;
    };
    expect(remoteBase.href).toBeUndefined();

    const sheet = confinePreviewElement('link', {
      rel: 'stylesheet',
      href: '../secret.css',
    }) as { href?: string };
    expect(sheet.href).toBeUndefined();
    const localSheet = confinePreviewElement('link', {
      rel: 'stylesheet',
      href: './local.css',
    }) as { href?: string };
    expect(localSheet.href).toBe('./local.css');

    const refresh = confinePreviewElement('meta', {
      httpEquiv: 'refresh',
      content: '0;url=file:///etc/passwd',
    }) as { content?: string };
    expect(refresh.content).toBeUndefined();
    const parentRefresh = confinePreviewElement('meta', {
      'http-equiv': 'refresh',
      content: '0; url=../secret.html',
    }) as { content?: string };
    expect(parentRefresh.content).toBeUndefined();
    const remoteRefresh = confinePreviewElement('meta', {
      httpEquiv: 'refresh',
      content: '0;url=https://example.com',
    }) as { content?: string };
    expect(remoteRefresh.content).toBe('0;url=https://example.com');

    const area = confinePreviewElement('area', { href: '../secret.png' }) as { href?: string };
    expect(area.href).toBeUndefined();
    const note = confinePreviewElement('a', { href: '../notes/a.md' }) as { href?: string };
    expect(note.href).toBe('../notes/a.md');

    const animated = confinePreviewElement('animate', {
      attributeName: 'href',
      to: 'file:///etc/passwd',
    }) as { to?: string };
    expect(animated.to).toBeUndefined();
    const parentPaint = confinePreviewElement('animate', {
      attributeName: 'filter',
      to: 'url(../secret.svg)',
    }) as { to?: string };
    expect(parentPaint.to).toBeUndefined();
    const width = confinePreviewElement('animate', { attributeName: 'width', to: '100' }) as {
      to?: string;
    };
    expect(width.to).toBe('100');
    const localPaint = confinePreviewElement('set', {
      attributeName: 'fill',
      to: 'url(#local)',
    }) as { to?: string };
    expect(localPaint.to).toBe('url(#local)');
    const ping = confinePreviewElement('a', {
      ping: 'file:///etc/passwd https://example.com/t',
      href: 'https://example.com',
    }) as { ping?: string; href?: string };
    expect(ping.ping).toBe('https://example.com/t');
    expect(ping.href).toBe('https://example.com');
    const relativePing = confinePreviewElement('a', { ping: '../secret' }) as { ping?: string };
    expect(relativePing.ping).toBeUndefined();
    const description = confinePreviewElement('img', {
      alt: 'x',
      longDesc: 'file:///etc/passwd',
    }) as { longDesc?: string };
    expect(description.longDesc).toBeUndefined();

    const sources = confinePreviewElement('img', {
      alt: 'pic',
      imageSrcSet: 'file:///etc/passwd 1x, https://example.com/a.png 2x',
    }) as { imageSrcSet?: string };
    expect(sources.imageSrcSet).toBe('https://example.com/a.png 2x');
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
  it('drops a file hidden by a tab inside a css url', () => {
    const styled = confinePreviewProps({
      style: 'background:url(file:\t///etc/passwd);color:red',
    }) as { style: Record<string, string> };
    expect(JSON.stringify(styled.style)).not.toContain('file:');
    expect(JSON.stringify(styled.style)).not.toContain('passwd');
    expect(styled.style.color).toBe('red');
    const formFeed = confinePreviewProps({
      style: 'background:url(file:\f///etc/passwd);color:blue',
    }) as { style: Record<string, string> };
    expect(JSON.stringify(formFeed.style)).not.toContain('file:');
    expect(JSON.stringify(formFeed.style)).not.toContain('passwd');
    expect(formFeed.style.color).toBe('blue');
    const climbed = confinePreviewElement('use', { href: '..\f/secret.svg' }) as { href?: string };
    expect(climbed.href).toBeUndefined();
  });

  it('drops an event handler and keeps the picture address', () => {
    const view = render(
      <Img src="https://example.com/a.png" alt="Pixel" onError={() => undefined} />
    );
    const image = view.getByRole('img');
    expect(image.getAttribute('src')).toBe('https://example.com/a.png');
    expect(image.getAttribute('onerror')).toBeNull();
    view.unmount();

    const raw = confinePreviewElement('img', {
      src: 'https://example.com/a.png',
      alt: 'Pixel',
      onerror: 'alert(1)',
    }) as { src?: string; onerror?: string; alt?: string };
    expect(raw.src).toBe('https://example.com/a.png');
    expect(raw.onerror).toBeUndefined();
    expect(raw.alt).toBe('Pixel');
  });


  it('shows a png data image and drops an svg data image that points at a file', () => {
    const png = render(<Img src="data:image/png;base64,aaaa" alt="Pixel" />);
    expect(png.getByRole('img').getAttribute('src')).toBe('data:image/png;base64,aaaa');
    png.unmount();

    const icon = btoa('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const safe = render(<Img src={`data:image/svg+xml;base64,${icon}`} alt="Icon" />);
    expect(safe.getByRole('img').getAttribute('src')).toContain('svg+xml');
    safe.unmount();

    const fileSvg = btoa('<svg><image href="file:///etc/passwd"/></svg>');
    const disk = render(<Img src={`data:image/svg+xml;base64,${fileSvg}`} alt="Secret" />);
    expect(disk.getByRole('img').getAttribute('src')).toBeNull();
    disk.unmount();

    const page = render(<Img src="data:text/html,hi" alt="Page" />);
    expect(page.getByRole('img').getAttribute('src')).toBeNull();
  });


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
    documentLink.unmount();

    const parent = render(<Link href="../secret.css" />);
    expect(parent.container.querySelector('link')?.getAttribute('href')).toBeNull();
  });

  it('does not let the preview follow a parent file', () => {
    const view = render(<A href="../secret.png">Secret</A>);
    const link = view.getByText('Secret').closest('a');
    expect(link?.getAttribute('href')).toBeNull();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const aux = new MouseEvent('auxclick', { bubbles: true, cancelable: true });
    link?.dispatchEvent(aux);
    expect(aux.defaultPrevented).toBe(true);

    const notes = render(<A href="../notes/a.md">Notes</A>);
    expect(notes.getByText('Notes').closest('a')?.getAttribute('href')).toBe('../notes/a.md');
  });
});
