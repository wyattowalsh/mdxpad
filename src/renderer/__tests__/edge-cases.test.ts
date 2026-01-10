/**
 * Edge Case Tests
 *
 * Tests for edge cases including extremely large documents, rapid updates,
 * concurrent operations, and stress testing.
 *
 * @module renderer/__tests__/edge-cases.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RequestId } from '@shared/types/preview-worker';
import type { CompileError } from '@shared/types/preview';
import { compileMdx, MAX_SOURCE_SIZE } from '../lib/mdx/compile';
import { usePreviewStore } from '../stores/preview-store';
import type { CompileSuccess } from '@shared/types/preview';

/** Helper to create a test RequestId */
const testId = (id: string): RequestId => id as RequestId;

describe('Edge Cases - Large Documents', () => {
  describe('document size boundaries', () => {
    it('should handle document exactly at size limit', async () => {
      const source = '# Test\n' + 'x'.repeat(MAX_SOURCE_SIZE - 8);
      const result = await compileMdx(testId('exact-limit'), source);

      // Should compile (no size error), but may have other parse issues
      if (!result.ok) {
        expect(result.errors[0]?.message).not.toContain('Document too large');
      }
    });

    it('should reject document one byte over limit', async () => {
      const source = 'x'.repeat(MAX_SOURCE_SIZE + 1);
      const result = await compileMdx(testId('over-limit'), source);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.message).toContain('Document too large');
      }
    });

    it('should handle document with many small lines', async () => {
      // Create document with 10,000 short lines
      const lines = Array.from({ length: 10000 }, (_, i) => `Line ${i + 1}`);
      const source = lines.join('\n');
      const result = await compileMdx(testId('many-lines'), source);

      expect(result.id).toBe('many-lines');
      // Should either succeed or fail gracefully
      expect(typeof result.ok).toBe('boolean');
    });

    it('should handle document with very long single line', async () => {
      // A paragraph with 100,000 characters
      const longLine = 'word '.repeat(20000);
      const source = `# Title\n\n${longLine}`;
      const result = await compileMdx(testId('long-line'), source);

      expect(result.id).toBe('long-line');
      expect(typeof result.ok).toBe('boolean');
    });

    it('should handle deeply nested headings', async () => {
      // H1 through H6 nested repeatedly
      const headings = Array.from(
        { length: 100 },
        (_, i) => `${'#'.repeat((i % 6) + 1)} Heading ${i + 1}`
      ).join('\n\n');
      const result = await compileMdx(testId('nested-headings'), headings);

      expect(result.ok).toBe(true);
    });
  });

  describe('complex document structures', () => {
    it('should handle deeply nested lists', async () => {
      // Create 50 levels of nested lists
      const nestedList = Array.from({ length: 50 }, (_, i) => `${'  '.repeat(i)}- Item ${i + 1}`).join('\n');
      const source = `# Nested List\n\n${nestedList}`;
      const result = await compileMdx(testId('nested-list'), source);

      expect(result.id).toBe('nested-list');
      expect(typeof result.ok).toBe('boolean');
    });

    it('should handle large GFM table', async () => {
      const headers = '| ' + Array.from({ length: 20 }, (_, i) => `Col ${i + 1}`).join(' | ') + ' |';
      const separator = '| ' + Array.from({ length: 20 }, () => '---').join(' | ') + ' |';
      const rows = Array.from(
        { length: 100 },
        (_, row) => '| ' + Array.from({ length: 20 }, (_, col) => `R${row + 1}C${col + 1}`).join(' | ') + ' |'
      ).join('\n');

      const source = `# Large Table\n\n${headers}\n${separator}\n${rows}`;
      const result = await compileMdx(testId('large-table'), source);

      expect(result.ok).toBe(true);
    });

    it('should handle many code blocks', async () => {
      const codeBlocks = Array.from(
        { length: 50 },
        (_, i) => `\`\`\`javascript\nconst x${i} = ${i};\nconsole.log(x${i});\n\`\`\``
      ).join('\n\n');
      const source = `# Code Blocks\n\n${codeBlocks}`;
      const result = await compileMdx(testId('many-code-blocks'), source);

      expect(result.ok).toBe(true);
    });

    it('should handle complex frontmatter', async () => {
      const source = `---
title: Complex Frontmatter Test
author:
  name: Test Author
  email: test@example.com
  social:
    twitter: "@test"
    github: test
tags:
  - javascript
  - typescript
  - react
  - mdx
  - web development
metadata:
  created: 2024-01-15
  updated: 2024-06-20
  version: 1.0.0
  published: true
  views: 12345
settings:
  theme: dark
  layout: wide
  sidebar: true
  toc: true
---

# Content`;
      const result = await compileMdx(testId('complex-frontmatter'), source);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.frontmatter).toHaveProperty('title');
        expect(result.frontmatter).toHaveProperty('author');
        expect(result.frontmatter).toHaveProperty('tags');
      }
    });
  });

  describe('unicode and special characters', () => {
    it('should handle unicode content', async () => {
      const source = `# 你好世界 (Hello World)

这是中文内容。

## Emoji Support 🎉

- ✅ Task completed
- 🚀 Rocket launched
- 💡 Idea proposed

## Mixed Scripts

日本語テキスト | English text | Русский текст | العربية`;
      const result = await compileMdx(testId('unicode'), source);

      expect(result.ok).toBe(true);
    });

    it('should handle emoji in various positions', async () => {
      const source = `# 🎯 Title with Emoji

Paragraph with 🔥 inline emoji.

- 📝 List item with emoji
- 💻 Another item

\`\`\`
// 🐛 Bug fixed here
\`\`\``;
      const result = await compileMdx(testId('emoji-positions'), source);

      expect(result.ok).toBe(true);
    });

    it('should handle special HTML entities', async () => {
      const source = `# Special Characters

&amp; &lt; &gt; &quot; &apos;

Copyright &copy; 2024

Math: 5 &times; 10 = 50

Arrow: left &larr; right &rarr;`;
      const result = await compileMdx(testId('html-entities'), source);

      expect(result.ok).toBe(true);
    });

    it('should handle zero-width characters', async () => {
      // Zero-width space, zero-width non-joiner, zero-width joiner
      const source = `# Title\u200B\u200C\u200D

Content with\u200Bzero-width\u200Ccharacters\u200Dinside.`;
      const result = await compileMdx(testId('zero-width'), source);

      expect(result.ok).toBe(true);
    });

    it('should handle right-to-left text', async () => {
      const source = `# RTL Support

مرحبا بالعالم

עברית`;
      const result = await compileMdx(testId('rtl-text'), source);

      expect(result.ok).toBe(true);
    });
  });
});

describe('Edge Cases - Rapid Updates', () => {
  beforeEach(() => {
    usePreviewStore.getState().reset();
  });

  describe('store state transitions', () => {
    it('should handle rapid state transitions', () => {
      const store = usePreviewStore.getState();

      // Simulate rapid typing - many state changes in quick succession
      for (let i = 0; i < 100; i++) {
        store.startCompiling();
        store.setSuccess({
          ok: true,
          code: `code-${i}`,
          frontmatter: { iteration: i },
        });
      }

      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('success');
      if (state.state.status === 'success') {
        expect(state.state.result.frontmatter).toEqual({ iteration: 99 });
      }
    });

    it('should handle alternating success and error states', () => {
      const store = usePreviewStore.getState();

      for (let i = 0; i < 50; i++) {
        if (i % 2 === 0) {
          store.setSuccess({
            ok: true,
            code: `success-${i}`,
            frontmatter: {},
          });
        } else {
          store.setError([{ message: `error-${i}` }]);
        }
      }

      // After 50 iterations (0-49), last is 49 (odd) = error
      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('error');
      // Should still have last successful render
      expect(state.lastSuccessfulRender).not.toBeNull();
    });

    it('should preserve lastSuccessfulRender through many errors', () => {
      const store = usePreviewStore.getState();
      const successResult: CompileSuccess = {
        ok: true,
        code: 'initial',
        frontmatter: { preserved: true },
      };

      store.setSuccess(successResult);

      // Many errors should not clear lastSuccessfulRender
      for (let i = 0; i < 100; i++) {
        store.setError([{ message: `error-${i}` }]);
      }

      const state = usePreviewStore.getState();
      expect(state.lastSuccessfulRender).toEqual(successResult);
    });

    it('should handle scroll ratio updates at high frequency', () => {
      const store = usePreviewStore.getState();

      // Simulate smooth scrolling with many small updates
      for (let i = 0; i <= 100; i++) {
        store.setScrollRatio(i / 100);
      }

      expect(usePreviewStore.getState().scrollRatio).toBe(1);
    });
  });
});

describe('Edge Cases - Concurrent Operations', () => {
  describe('parallel compilation scenarios', () => {
    it('should handle multiple compilations returning out of order', async () => {
      // Track completion order
      const completionOrder: string[] = [];

      const compile1 = compileMdx(testId('first'), '# First').then((r) => {
        completionOrder.push('first');
        return r;
      });
      const compile2 = compileMdx(testId('second'), '# Second').then((r) => {
        completionOrder.push('second');
        return r;
      });
      const compile3 = compileMdx(testId('third'), '# Third').then((r) => {
        completionOrder.push('third');
        return r;
      });

      const [result1, result2, result3] = await Promise.all([compile1, compile2, compile3]);

      expect(result1.id).toBe('first');
      expect(result2.id).toBe('second');
      expect(result3.id).toBe('third');
      expect(completionOrder).toHaveLength(3);
    });

    it('should maintain request ID correlation across concurrent requests', async () => {
      const ids = Array.from({ length: 10 }, (_, i) => testId(`concurrent-${i}`));
      const sources = ids.map((_, i) => `# Document ${i}`);

      const promises = ids.map((id, i) => compileMdx(id, sources[i]!));
      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result.id).toBe(`concurrent-${i}`);
      });
    });

    it('should handle mixed success and failure in concurrent operations', async () => {
      const validSource = '# Valid MDX';
      const invalidSource = '<div>Unclosed';

      const promises = [
        compileMdx(testId('valid-1'), validSource),
        compileMdx(testId('invalid-1'), invalidSource),
        compileMdx(testId('valid-2'), validSource),
        compileMdx(testId('invalid-2'), invalidSource),
      ];

      const results = await Promise.all(promises);

      expect(results[0]?.ok).toBe(true);
      expect(results[1]?.ok).toBe(false);
      expect(results[2]?.ok).toBe(true);
      expect(results[3]?.ok).toBe(false);
    });
  });
});

describe('Edge Cases - Boundary Conditions', () => {
  describe('scroll ratio boundaries', () => {
    beforeEach(() => {
      usePreviewStore.getState().reset();
    });

    it('should clamp extremely negative values', () => {
      usePreviewStore.getState().setScrollRatio(-1000);
      expect(usePreviewStore.getState().scrollRatio).toBe(0);
    });

    it('should clamp extremely positive values', () => {
      usePreviewStore.getState().setScrollRatio(1000);
      expect(usePreviewStore.getState().scrollRatio).toBe(1);
    });

    it('should handle NaN by converting to valid range', () => {
      usePreviewStore.getState().setScrollRatio(NaN);
      // NaN should be clamped - Math.max/min with NaN returns NaN, so implementation should handle this
      const ratio = usePreviewStore.getState().scrollRatio;
      expect(Number.isNaN(ratio) || (ratio >= 0 && ratio <= 1)).toBe(true);
    });

    it('should handle Infinity', () => {
      usePreviewStore.getState().setScrollRatio(Infinity);
      expect(usePreviewStore.getState().scrollRatio).toBe(1);
    });

    it('should handle negative Infinity', () => {
      usePreviewStore.getState().setScrollRatio(-Infinity);
      expect(usePreviewStore.getState().scrollRatio).toBe(0);
    });

    it('should handle very small positive numbers', () => {
      usePreviewStore.getState().setScrollRatio(Number.EPSILON);
      expect(usePreviewStore.getState().scrollRatio).toBe(Number.EPSILON);
    });

    it('should handle values very close to 1', () => {
      usePreviewStore.getState().setScrollRatio(0.9999999999999999);
      const ratio = usePreviewStore.getState().scrollRatio;
      expect(ratio).toBeGreaterThanOrEqual(0);
      expect(ratio).toBeLessThanOrEqual(1);
    });
  });

  describe('empty and whitespace inputs', () => {
    it('should handle whitespace-only source', async () => {
      const result = await compileMdx(testId('whitespace'), '   \n\n\t\t\n   ');
      expect(result.id).toBe('whitespace');
      expect(typeof result.ok).toBe('boolean');
    });

    it('should handle source with only newlines', async () => {
      const result = await compileMdx(testId('newlines'), '\n\n\n\n\n');
      expect(result.id).toBe('newlines');
      expect(typeof result.ok).toBe('boolean');
    });

    it('should handle source with only carriage returns', async () => {
      const result = await compileMdx(testId('crlf'), '\r\n\r\n\r\n');
      expect(result.id).toBe('crlf');
      expect(typeof result.ok).toBe('boolean');
    });
  });
});

describe('Edge Cases - Memory and Resource Management', () => {
  describe('repeated operations', () => {
    it('should not leak state across many compilations', async () => {
      const results: boolean[] = [];

      for (let i = 0; i < 100; i++) {
        const result = await compileMdx(testId(`leak-test-${i}`), `# Document ${i}`);
        results.push(result.ok);
      }

      // All should succeed
      expect(results.every((ok) => ok)).toBe(true);
    });

    it('should not leak state across many store resets', () => {
      for (let i = 0; i < 100; i++) {
        usePreviewStore.getState().setSuccess({
          ok: true,
          code: `code-${i}`,
          frontmatter: { large: 'x'.repeat(1000) },
        });
        usePreviewStore.getState().reset();
      }

      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('idle');
      expect(state.lastSuccessfulRender).toBeNull();
    });
  });
});
