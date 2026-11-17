import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { RequestId } from '@shared/types/preview-worker';
import { compileMdx } from '@renderer/lib/mdx/compile';
import { BuiltInComponents } from '../components';
import { createModuleFromCode, type MDXContentProps } from '../mdx-module-runtime';

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
  });
});
