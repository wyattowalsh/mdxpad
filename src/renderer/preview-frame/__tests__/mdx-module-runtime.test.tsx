import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { RequestId } from '@shared/types/preview-worker';
import { compileMdx } from '@renderer/lib/mdx/compile';
import { BuiltInComponents } from '../components';
import {
  createModuleFromCode,
  previewComponents,
  type MDXContentProps,
} from '../mdx-module-runtime';

const testId = (id: string): RequestId => id as RequestId;

describe('createModuleFromCode', () => {
  it('keeps overlapping module creations isolated from each other runtime scope', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const gates = new Map<number, { promise: Promise<void>; resolve: () => void }>();
    const scopeKeys = new Map<number, Promise<string>>();
    let nextId = 0;

    (globalThis as Record<string, unknown>).__mdxpadWaitForScopeGate = (
      id: number
    ): Promise<void> => {
      const gate = gates.get(id);
      if (!gate) {
        return Promise.resolve();
      }
      return gate.promise;
    };
    (globalThis as Record<string, unknown>).__mdxpadGetScopeKey = (id: number): Promise<string> => {
      const scopeKey = scopeKeys.get(id);
      if (!scopeKey) {
        return Promise.resolve('');
      }
      return scopeKey;
    };

    URL.createObjectURL = (blob) => {
      const id = nextId++;
      let resolve!: () => void;
      const promise = new Promise<void>((res) => {
        resolve = res;
      });
      gates.set(id, { promise, resolve });
      scopeKeys.set(
        id,
        'text' in blob && typeof blob.text === 'function'
          ? blob.text().then((source) => /globalThis\["([^"]+)"\]/.exec(source)?.[1] ?? '')
          : Promise.resolve('')
      );
      return (
        `data:text/javascript,` +
        `await globalThis.__mdxpadWaitForScopeGate(${id});` +
        `const scopeKey = await globalThis.__mdxpadGetScopeKey(${id});` +
        `const scope = globalThis[scopeKey];` +
        `if (!scope || !scope.jsxRuntime) throw new Error('missing runtime scope');` +
        `export default () => null;`
      );
    };
    URL.revokeObjectURL = () => {};

    try {
      const first = createModuleFromCode('return { default: () => null };', {
        forceBlobRuntime: true,
      });
      const second = createModuleFromCode('return { default: () => null };', {
        forceBlobRuntime: true,
      });

      expect(nextId).toBe(2);

      gates.get(0)?.resolve();
      await first;
      gates.get(1)?.resolve();

      await expect(second).resolves.toMatchObject({
        default: expect.any(Function),
      });
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      delete (globalThis as Record<string, unknown>).__mdxpadWaitForScopeGate;
      delete (globalThis as Record<string, unknown>).__mdxpadGetScopeKey;
    }
  });

  it('evaluates MDX function-body output that reads JSX runtime from arguments[0]', async () => {
    const module = await createModuleFromCode(`
      const { jsx: _jsx } = arguments[0];
      function MDXContent() {
        return _jsx('h1', { children: 'Heading' });
      }
      return { default: MDXContent };
    `);

    const { default: MDXContent } = module;
    const { container } = render(<MDXContent />);

    expect(container.querySelector('h1')?.textContent).toBe('Heading');
  });

  it('renders a markdown heading from compiled MDX output', async () => {
    const result = await compileMdx(testId('preview-heading'), '# Heading');
    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const module = await createModuleFromCode(result.code);
    const MDXContent = module.default;
    const { container } = render(
      <MDXContent
        components={BuiltInComponents as unknown as NonNullable<MDXContentProps['components']>}
        frontmatter={result.frontmatter}
      />
    );

    expect(container.querySelector('h1')?.textContent).toBe('Heading');
    expect(container.querySelector('h1')?.id).toBe('heading');
  });

  it('gives a repeated heading a distinct id', async () => {
    const result = await compileMdx(testId('preview-heading-ids'), '# Intro\n\n# Intro');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const MDXContent = module.default;
    const { container } = render(
      <MDXContent
        components={BuiltInComponents as unknown as NonNullable<MDXContentProps['components']>}
        frontmatter={result.frontmatter}
      />
    );
    const headings = [...container.querySelectorAll('h1')];
    expect(headings.map((heading) => heading.id)).toEqual(['intro', 'intro-1']);
  });

  it('drops a local file from raw html that skips the preview components', async () => {
    const source = [
      '<a href="file:///etc/passwd">secret</a>',
      '<img alt="pic" src="file:///etc/passwd" srcset="file:///etc/passwd 1x, https://example.com/a.png 2x">',
      '<div style="background:url(file:///etc/passwd);color:red"></div>',
      '<a href="/notes/a.md">doc</a>',
    ].join('\n\n');
    const result = await compileMdx(testId('raw-local-file'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.innerHTML).not.toContain('file:');
    expect(container.querySelector('a[href="/notes/a.md"]')?.textContent).toBe('doc');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('pic');
    const style = container.querySelector('div')?.getAttribute('style') ?? '';
    expect(style).not.toContain('file:');
    if (style.length > 0) {
      expect(style).toContain('color');
    }
  });

  it('drops a parent file from a base, a stylesheet, and a refresh', async () => {
    const source = [
      '<base href="../">',
      '<link rel="stylesheet" href="../secret.css">',
      '<link rel="alternate" href="./local.css">',
      '<meta http-equiv="refresh" content="0;url=file:///etc/passwd">',
      '<area href="../secret.png" alt="map">',
      '<img alt="pic" imagesrcset="../secret.png 1x, https://example.com/a.png 2x">',
      '<a href="../notes/a.md">Notes</a>',
    ].join('\n\n');
    const result = await compileMdx(testId('raw-parent-file'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    render(<module.default />);
    expect(document.querySelector('base')?.getAttribute('href')).toBeNull();
    expect(document.querySelector('link[rel="stylesheet"]')?.getAttribute('href')).toBeNull();
    expect(document.querySelector('link[rel="alternate"]')?.getAttribute('href')).toBe(
      './local.css'
    );
    expect(document.querySelector('meta')?.getAttribute('content')).toBeNull();
    expect(document.querySelector('area')?.getAttribute('href')).toBeNull();
    expect(document.body.innerHTML).not.toContain('secret');
    expect(document.body.innerHTML).not.toContain('file:');
    expect(document.head.innerHTML).not.toContain('secret');
    expect(document.head.innerHTML).not.toContain('file:');
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(document.querySelector('img')?.getAttribute('alt')).toBe('pic');
    expect(document.querySelector('a')?.getAttribute('href')).toBe('../notes/a.md');
  });

  it('shows the words of a video that cannot be played', async () => {
    const blocked = await compileMdx(
      testId('video-blocked'),
      '<video src="file:///etc/passwd">Watch the clip</video>'
    );
    const sourced = await compileMdx(
      testId('video-sourced'),
      '<video><source src="file:///tmp/a.mp4" />Watch the clip</video>\n\n<video><source src="https://example.com/a.mp4" />Watch</video>'
    );
    const playable = await compileMdx(
      testId('video-playable'),
      '<video src="https://example.com/a.mp4">Watch</video>'
    );
    expect(blocked.ok).toBe(true);
    expect(sourced.ok).toBe(true);
    expect(playable.ok).toBe(true);
    if (!blocked.ok || !sourced.ok || !playable.ok) {
      return;
    }
    const components = previewComponents as unknown as NonNullable<MDXContentProps['components']>;
    const blockedModule = await createModuleFromCode(blocked.code);
    const blockedView = render(<blockedModule.default components={components} />);
    expect(blockedView.container.querySelector('video')).toBeNull();
    expect(blockedView.container.textContent).toContain('Watch the clip');
    expect(blockedView.container.innerHTML).not.toContain('passwd');
    blockedView.unmount();

    const sourcedModule = await createModuleFromCode(sourced.code);
    const sourcedView = render(<sourcedModule.default components={components} />);
    const players = sourcedView.container.querySelectorAll('video');
    expect(players).toHaveLength(1);
    expect(players[0]?.querySelector('source')?.getAttribute('src')).toBe(
      'https://example.com/a.mp4'
    );
    expect(sourcedView.container.textContent).toContain('Watch the clip');
    expect(sourcedView.container.innerHTML).not.toContain('file:');
    sourcedView.unmount();

    const playableModule = await createModuleFromCode(playable.code);
    const playableView = render(<playableModule.default components={components} />);
    expect(playableView.container.querySelector('video')?.getAttribute('src')).toBe(
      'https://example.com/a.mp4'
    );
  });

  it('shows the words of an unknown component', async () => {
    const source = '<Widget>Remember the ice</Widget>\n\n<Callout>Stay warm</Callout>';
    const result = await compileMdx(testId('unknown-component'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(
      <module.default
        components={previewComponents as unknown as NonNullable<MDXContentProps['components']>}
      />
    );
    expect(container.textContent).toContain('Remember the ice');
    expect(container.textContent).toContain('Stay warm');
    expect(container.textContent).toContain('Info');
  });

  it('shows a picture that only names its file in a source', async () => {
    const source = [
      '<picture><source srcset="https://example.com/a.webp" /></picture>',
      '<picture><source srcset="file:///tmp/a.webp 1x, https://example.com/b.webp 2x" /><img alt="Cat" src="file:///tmp/a.png" /></picture>',
      '<picture><img alt="Dog" src="dog.png" /></picture>',
    ].join('\n\n');
    const result = await compileMdx(testId('picture-source'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(
      <module.default
        components={previewComponents as unknown as NonNullable<MDXContentProps['components']>}
      />
    );
    const images = [...container.querySelectorAll('img')];
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      'https://example.com/a.webp',
      'https://example.com/b.webp',
      'dog.png',
    ]);
    expect(images[1]?.getAttribute('alt')).toBe('Cat');
    expect(container.innerHTML).not.toContain('file:');
  });

  it('shows the name of a frame that has no fallback', async () => {
    const source = '<iframe src="file:///etc/passwd" title="The report"></iframe>';
    const result = await compileMdx(testId('frame-title'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('The report');
    expect(container.innerHTML).not.toContain('file:');
  });

  it('shows an accessible name on a frame and a submit button', async () => {
    const source = [
      '<iframe src="file:///etc/passwd" aria-label="The report"></iframe>',
      '<input type="submit" aria-label="Save the file" />',
    ].join('\n\n');
    const result = await compileMdx(testId('accessible-name'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('The report');
    expect(container.querySelector('input')?.getAttribute('value')).toBe('Save the file');
    expect(container.innerHTML).not.toContain('file:');
  });

  it('shows a table summary that is not already in the cells', async () => {
    const source = [
      '<table summary="Sales table"><tbody><tr><td>Cellword</td></tr></tbody></table>',
      '<table summary="Cellword"><tbody><tr><td>Cellword</td></tr></tbody></table>',
    ].join('\n\n');
    const result = await compileMdx(testId('table-summary'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('Sales table');
    expect(container.textContent).toContain('Cellword');
    expect(container.textContent?.split('Cellword').length).toBe(3);
  });

  it('shows a header abbreviation and an empty note field', async () => {
    const source = [
      '<table><tbody><tr><th abbr="Quantity">Qty</th></tr></tbody></table>',
      '<textarea aria-label="Notes"></textarea>',
    ].join('\n\n');
    const result = await compileMdx(testId('header-note'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('Qty (Quantity)');
    expect(container.querySelector('textarea')?.value).toBe('Notes');
  });

  it('shows a choice label and a summary title', async () => {
    const source = [
      '<option label="Boston"></option>',
      '<details><summary title="The rest">More</summary>Body</details>',
    ].join('\n\n');
    const result = await compileMdx(testId('choice-summary'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('Boston');
    expect(container.textContent).toContain('More (The rest)');
    expect(container.textContent).toContain('Body');
  });

  it('shows a date and an expansion that have no other text', async () => {
    const source = '<time datetime="2020-01-01"></time>\n\n<abbr title="Hypertext Markup"></abbr>';
    const result = await compileMdx(testId('empty-name'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('(2020-01-01)');
    expect(container.textContent).toContain('(Hypertext Markup)');
  });

  it('shows a result name and a deletion date', async () => {
    const source = [
      '<output aria-label="Runningtotal">Fortytwo</output>',
      '<del datetime="2020-01-02">Removedwords</del>',
    ].join('\n\n');
    const result = await compileMdx(testId('stamp-name'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('Runningtotal');
    expect(container.textContent).toContain('Fortytwo');
    expect(container.textContent).toContain('Removedwords');
  });

  it('shows the name of a choice list', async () => {
    const source = '<select aria-label="Colorname"><option>Red</option></select>';
    const result = await compileMdx(testId('select-name'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('Colorname');
    expect(container.textContent).toContain('Red');
    expect(container.querySelector('select')).not.toBeNull();
  });

  it('shows a meter name beside its value', async () => {
    const source = '<meter value="4" max="10" title="Halfway"></meter>';
    const result = await compileMdx(testId('meter-name'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('4 (Halfway)');
    expect(container.querySelector('meter')).toBeNull();
  });

  it('shows a meter and a progress value', async () => {
    const source = '<meter value="4" max="10"></meter>\n\n<progress value="3" max="10"></progress>';
    const result = await compileMdx(testId('gauge'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('3/10');
    expect(container.querySelector('meter')).toBeNull();
    expect(container.querySelector('progress')).toBeNull();
  });

  it('shows the words of a noscript block', async () => {
    const source = '<noscript><p>Enable the page</p></noscript>';
    const result = await compileMdx(testId('noscript-words'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.querySelector('noscript')).toBeNull();
    expect(container.textContent).toContain('Enable the page');
  });

  it('shows a control name beside its value', async () => {
    const source = '<input type="color" value="#112233" aria-label="Colorpick" />';
    const result = await compileMdx(testId('color-name'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('Colorpick');
    expect(container.querySelector('input')?.getAttribute('value')).toBe('#112233');
  });

  it('shows the name of a file control and a choice', async () => {
    const source = [
      '<input type="file" aria-label="Upload the paper" />',
      '<input type="radio" value="Morning" />',
      '<input type="checkbox" aria-label="Agreed" />',
    ].join('\n\n');
    const result = await compileMdx(testId('choice-name'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('Upload the paper');
    expect(container.textContent).toContain('Morning');
    expect(container.textContent).toContain('Agreed');
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(container.querySelector('input[type="radio"]')).not.toBeNull();
  });

  it('shows a clip caption, a track label, and a map area outside the player', async () => {
    const source = [
      '<video src="https://example.com/clip.mp4" title="Lecturetitle">Watch the clip</video>',
      '<audio src="song.mp3"></audio>',
      '<video src="file:///tmp/clip.mp4"></video>',
      '<track label="Captionlabel" src="c.vtt" />',
      '<area alt="Northregion" href="https://example.com" />',
      '<area alt="Secret" href="file:///etc/passwd" />',
    ].join('\n\n');
    const result = await compileMdx(testId('clip-caption'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    const video = container.querySelector('video');
    const outside = (container.textContent ?? '').replace(video?.textContent ?? '', '');
    expect(outside).toContain('Watch the clip');
    expect(outside).toContain('Lecturetitle');
    expect(container.textContent).toContain('song.mp3');
    expect(container.textContent).toContain('Captionlabel');
    expect(container.textContent).toContain('Northregion');
    expect(container.textContent).toContain('https://example.com');
    expect(container.textContent).toContain('Secret');
    expect(container.innerHTML).not.toContain('file:');
  });

  it('shows a button name, a suggestion, a formula source, and a caption', async () => {
    const source = [
      '<button aria-label="Save the file"></button>',
      '<datalist><option label="Shown">Hidden</option></datalist>',
      '<math><semantics><annotation>x^2 + 1</annotation></semantics></math>',
      '<math><semantics><mi>x</mi><annotation>secret</annotation></semantics></math>',
      '<video src="https://example.com/clip.mp4"><track label="English captions" /></video>',
    ].join('\n\n');
    const result = await compileMdx(testId('visible-names'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.querySelector('button')?.textContent).toBe('Save the file');
    expect(container.textContent).toContain('Shown');
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).toContain('x^2 + 1');
    expect(container.querySelector('mi')?.textContent).toBe('x');
    expect(container.querySelector('video')).not.toBeNull();
    expect(container.textContent).toContain('English captions');
  });

  it('shows the words of a closed dialog and a popover', async () => {
    const source = '<dialog><p>Saved the note</p></dialog>\n\n<div popover>Popover words</div>';
    const result = await compileMdx(testId('dialog-popover'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(
      <module.default
        components={previewComponents as unknown as NonNullable<MDXContentProps['components']>}
      />
    );
    expect(container.querySelector('dialog')).toBeNull();
    expect(container.querySelector('[popover]')).toBeNull();
    expect(container.textContent).toContain('Saved the note');
    expect(container.textContent).toContain('Popover words');
  });

  it('shows the fallback inside a frame without its address', async () => {
    const source = [
      '<iframe src="file:///etc/passwd">Read the page</iframe>',
      '<object data="file:///etc/passwd">The report</object>',
      '<canvas>Chart of sales</canvas>',
    ].join('\n\n');
    const result = await compileMdx(testId('frame-fallback'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('object')).toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.textContent).toContain('Read the page');
    expect(container.textContent).toContain('The report');
    expect(container.textContent).toContain('Chart of sales');
    expect(container.innerHTML).not.toContain('file:');
    expect(container.innerHTML).not.toContain('passwd');
  });

  it('uses an image accessible name when the alt text is empty', async () => {
    const source = [
      '<img src="go.png" aria-label="Photolabel" />',
      '<img alt="Cat" aria-label="Other" src="cat.png" />',
    ].join('\n\n');
    const result = await compileMdx(testId('image-name'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    const images = container.querySelectorAll('img');
    expect(images[0]?.getAttribute('alt')).toBe('Photolabel');
    expect(images[1]?.getAttribute('alt')).toBe('Cat');
  });

  it('shows a quotation source, an image button, a command, and an applet name', async () => {
    const source = [
      '<q cite="https://example.com/source">quoted</q>',
      '<q cite="file:///etc/passwd">secret quote</q>',
      '<blockquote cite="https://example.com/source"><p>Quote</p></blockquote>',
      '<input type="image" alt="Searchgo" src="file:///tmp/go.png" />',
      '<menu><menuitem>Cut</menuitem><menuitem label="Copy"></menuitem></menu>',
      '<applet alt="Gameword" code="Game.class"></applet>',
    ].join('\n\n');
    const result = await compileMdx(testId('quoted-names'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.textContent).toContain('quoted');
    expect(container.textContent).toContain('https://example.com/source');
    expect(container.textContent).toContain('secret quote');
    expect(container.textContent).toContain('Quote');
    expect(container.textContent).toContain('Searchgo');
    expect(container.textContent).toContain('Cut');
    expect(container.textContent).toContain('Copy');
    expect(container.textContent).toContain('Gameword');
    expect(container.innerHTML).not.toContain('file:');
  });

  it('shows the name of a canvas that has no picture', async () => {
    const source = [
      '<canvas aria-label="Sketchname"></canvas>',
      '<canvas title="Sketchtitle"></canvas>',
      '<canvas aria-label="Sketchname">Drawnwords</canvas>',
    ].join('\n\n');
    const result = await compileMdx(testId('canvas-name'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.textContent).toContain('Sketchname');
    expect(container.textContent).toContain('Sketchtitle');
    expect(container.textContent).toContain('Drawnwords');
    expect(container.textContent).toContain('Drawnwords (Sketchname)');
  });

  it('does not render a script or a frame', async () => {
    const source = [
      '<script src="file:///etc/passwd">alert(1)</script>',
      '<iframe src="../secret.html"></iframe>',
      '<p>Visible</p>',
    ].join('\n\n');
    const result = await compileMdx(testId('raw-script'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.innerHTML).not.toContain('file:');
    expect(container.innerHTML).not.toContain('secret');
    expect(container.innerHTML).not.toContain('alert');
    expect(container.textContent).toContain('Visible');
  });

  it('drops a local file from a style element', async () => {
    const source = [
      '<style>body{background:url(file:///etc/passwd);color:red} @import "file:///etc/passwd.css";</style>',
      '<style>@import "https://example.com/a.css"; h1{color:blue}</style>',
      '<style>@import"file:///etc/passwd.css";p{color:green}</style>',
    ].join('\n\n');
    const result = await compileMdx(testId('raw-style-file'), source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const module = await createModuleFromCode(result.code);
    const { container } = render(<module.default />);
    const sheets = [...container.querySelectorAll('style')].map((sheet) => sheet.textContent ?? '');
    expect(sheets.join('\n')).not.toContain('file:');
    expect(sheets[0]).toContain('background:none');
    expect(sheets[0]).toContain('color:red');
    expect(sheets[1]).toContain('https://example.com/a.css');
    expect(sheets[1]).toContain('color:blue');
    expect(sheets[2]).toContain('color:green');
    expect(sheets[2]).not.toContain('@import');
  });
});
