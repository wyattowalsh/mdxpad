import { describe, it, expect, vi } from 'vitest';
import type { RequestId } from '@shared/types/preview-worker';

const testId = (id: string): RequestId => id as RequestId;
const mathPluginConfig = {
  plugins: {
    'remark-math': { enabled: true },
    'rehype-katex': { enabled: true },
  },
} as const;
const DOM_PARSER_TEST_TIMEOUT_MS = 20_000;

describe('compileMdx without DOM globals', () => {
  const mockRehypeHighlightDocumentError = () =>
    vi.doMock('rehype-highlight', () => ({
      default: () => {
        throw new ReferenceError('document is not defined');
      },
    }));

  const mockRehypeKatexDocumentError = () =>
    vi.doMock('rehype-katex', () => ({
      default: () => {
        throw new ReferenceError('document is not defined');
      },
    }));

  it(
    'compiles a heading even when rehype-highlight requires document',
    async () => {
      vi.resetModules();
      mockRehypeHighlightDocumentError();

      try {
        const { compileMdx } = await import('../lib/mdx/compile');
      const result = await compileMdx(testId('worker-document-highlight'), '# Heading');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.code).toContain('_jsx');
      }
    } finally {
      vi.doUnmock('rehype-highlight');
      vi.resetModules();
    }
    },
    DOM_PARSER_TEST_TIMEOUT_MS
  );

  it(
    'compiles a heading even when rehype-katex requires document',
    async () => {
      vi.resetModules();
      mockRehypeKatexDocumentError();

      try {
        const { compileMdx } = await import('../lib/mdx/compile');
        const result = await compileMdx(testId('worker-document-heading'), '# Heading', {
          pluginConfig: mathPluginConfig,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.code).toContain('_jsx');
        }
      } finally {
        vi.doUnmock('rehype-katex');
        vi.resetModules();
      }
    },
    DOM_PARSER_TEST_TIMEOUT_MS
  );

  it(
    'still reports errors for actual math content when rehype-katex requires document',
    async () => {
      vi.resetModules();
      mockRehypeKatexDocumentError();

      try {
        const { compileMdx } = await import('../lib/mdx/compile');
        const result = await compileMdx(testId('worker-document-math'), '$x$', {
          pluginConfig: mathPluginConfig,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ message: expect.stringContaining('document is not defined') }),
            ])
          );
        }
      } finally {
        vi.doUnmock('rehype-katex');
        vi.resetModules();
      }
    },
    DOM_PARSER_TEST_TIMEOUT_MS
  );
});
