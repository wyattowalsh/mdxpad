import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { RequestId } from '@shared/types/preview-worker';
import { compileMdx } from '@renderer/lib/mdx/compile';
import { BuiltInComponents } from '../components';
import { createModuleFromCode, previewComponents, type MDXContentProps } from '../mdx-module-runtime';

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
    expect(container.querySelector('img')?.getAttribute('src')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('srcset')).toBe(
      'https://example.com/a.png 2x'
    );
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
    expect(document.querySelector('link[rel="alternate"]')?.getAttribute('href')).toBe('./local.css');
    expect(document.querySelector('meta')?.getAttribute('content')).toBeNull();
    expect(document.querySelector('area')?.getAttribute('href')).toBeNull();
    expect(document.body.innerHTML).not.toContain('secret');
    expect(document.body.innerHTML).not.toContain('file:');
    expect(document.head.innerHTML).not.toContain('secret');
    expect(document.head.innerHTML).not.toContain('file:');
    expect(document.querySelector('img')?.getAttribute('imagesrcset')).toBe(
      'https://example.com/a.png 2x'
    );
    expect(document.querySelector('a')?.getAttribute('href')).toBe('../notes/a.md');
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
