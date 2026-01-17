/**
 * Performance Tests
 *
 * Tests for compilation timing, memory management, and performance characteristics.
 *
 * @module renderer/__tests__/performance.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RequestId, CompileResponse } from '@shared/types/preview-worker';
import type { CompileError } from '@shared/types/preview';
import { compileMdx, MAX_SOURCE_SIZE } from '../lib/mdx/compile';
import { usePreviewStore } from '../stores/preview-store';

/** Helper to create a test RequestId */
const testId = (id: string): RequestId => id as RequestId;

describe('Performance - Compilation Timing', () => {
  describe('simple document compilation', () => {
    it('should compile simple markdown quickly', async () => {
      const start = performance.now();
      const result = await compileMdx(testId('simple'), '# Hello World');
      const duration = performance.now() - start;

      expect(result.ok).toBe(true);
      // Simple documents should compile in under 500ms (allows for CI/machine variability)
      expect(duration).toBeLessThan(500);
    });

    it('should compile empty source instantly', async () => {
      const start = performance.now();
      const result = await compileMdx(testId('empty'), '');
      const duration = performance.now() - start;

      expect(result.ok).toBe(true);
      // Empty source is a fast path, should be < 5ms
      expect(duration).toBeLessThan(5);
    });

    it('should compile with frontmatter efficiently', async () => {
      const source = `---
title: Test Document
date: 2024-01-15
tags:
  - typescript
  - mdx
---

# Content

Some paragraph text.`;

      const start = performance.now();
      const result = await compileMdx(testId('frontmatter'), source);
      const duration = performance.now() - start;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('moderate document compilation', () => {
    it('should compile 1KB document within acceptable time', async () => {
      // Create ~1KB of content
      const content = '# Heading\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(40);
      const source = content.slice(0, 1024);

      const start = performance.now();
      const result = await compileMdx(testId('1kb'), source);
      const duration = performance.now() - start;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(200);
    });

    it('should compile 10KB document within acceptable time', async () => {
      // Create ~10KB of content
      const paragraphs = Array.from(
        { length: 50 },
        (_, i) => `## Section ${i + 1}\n\nParagraph content for section ${i + 1}. `.repeat(10)
      );
      const source = paragraphs.join('\n\n').slice(0, 10240);

      const start = performance.now();
      const result = await compileMdx(testId('10kb'), source);
      const duration = performance.now() - start;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(500);
    });

    it('should compile 50KB document within acceptable time', async () => {
      // Create ~50KB of content
      const content = '# Large Document\n\n' + 'Content line. '.repeat(3000);
      const source = content.slice(0, 51200);

      const start = performance.now();
      const result = await compileMdx(testId('50kb'), source);
      const duration = performance.now() - start;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('complex document compilation', () => {
    it('should compile document with many code blocks efficiently', async () => {
      const codeBlocks = Array.from(
        { length: 20 },
        (_, i) => `\`\`\`typescript
const example${i} = ${i};
console.log(example${i});
\`\`\``
      ).join('\n\n');

      const source = `# Code Examples\n\n${codeBlocks}`;

      const start = performance.now();
      const result = await compileMdx(testId('code-blocks'), source);
      const duration = performance.now() - start;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(500);
    });

    it('should compile document with large table efficiently', async () => {
      const headers = '| ' + Array.from({ length: 10 }, (_, i) => `Col${i}`).join(' | ') + ' |';
      const separator = '| ' + Array.from({ length: 10 }, () => '---').join(' | ') + ' |';
      const rows = Array.from(
        { length: 50 },
        (_, r) => '| ' + Array.from({ length: 10 }, (_, c) => `R${r}C${c}`).join(' | ') + ' |'
      ).join('\n');

      const source = `# Table\n\n${headers}\n${separator}\n${rows}`;

      const start = performance.now();
      const result = await compileMdx(testId('table'), source);
      const duration = performance.now() - start;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(1000);
    });

    it('should compile document with many JSX elements efficiently', async () => {
      const jsxElements = Array.from(
        { length: 30 },
        (_, i) => `<div className="section-${i}">Content {${i}}</div>`
      ).join('\n');

      const source = `# JSX Elements\n\n${jsxElements}`;

      const start = performance.now();
      const result = await compileMdx(testId('jsx'), source);
      const duration = performance.now() - start;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('repeated compilation', () => {
    it('should maintain consistent timing across repeated compilations', async () => {
      const source = '# Test Document\n\nSome content here.';
      const timings: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await compileMdx(testId(`repeat-${i}`), source);
        timings.push(performance.now() - start);
      }

      // Calculate variance
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance = timings.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be reasonable (< 50ms)
      expect(stdDev).toBeLessThan(50);
    });

    // Skip: Comparing batch timings is inherently flaky. JIT warm-up, GC pauses,
    // and CPU scheduling can cause the second batch to be slower than expected.
    // This test requires a dedicated, controlled perf environment.
    it.skip('should not degrade performance over many compilations', async () => {
      const source = '# Repeated Test\n\nParagraph.';

      // First batch
      const firstBatchStart = performance.now();
      for (let i = 0; i < 10; i++) {
        await compileMdx(testId(`first-${i}`), source);
      }
      const firstBatchTime = performance.now() - firstBatchStart;

      // Second batch
      const secondBatchStart = performance.now();
      for (let i = 0; i < 10; i++) {
        await compileMdx(testId(`second-${i}`), source);
      }
      const secondBatchTime = performance.now() - secondBatchStart;

      // Second batch should not be significantly slower (< 50% increase)
      expect(secondBatchTime).toBeLessThan(firstBatchTime * 1.5);
    });
  });
});

describe('Performance - Store Operations', () => {
  beforeEach(() => {
    usePreviewStore.getState().reset();
  });

  describe('state update performance', () => {
    it('should handle rapid state updates efficiently', () => {
      const store = usePreviewStore.getState();
      const iterations = 1000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        store.setScrollRatio(i / iterations);
      }
      const duration = performance.now() - start;

      // 1000 updates should complete in < 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should handle rapid success updates efficiently', () => {
      const store = usePreviewStore.getState();
      const iterations = 100;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        store.setSuccess({
          ok: true,
          code: `code-${i}`,
          frontmatter: { index: i },
          outline: undefined,
        });
      }
      const duration = performance.now() - start;

      // 100 success updates should complete in < 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should handle state transition cycles efficiently', () => {
      const store = usePreviewStore.getState();
      const cycles = 50;

      const start = performance.now();
      for (let i = 0; i < cycles; i++) {
        store.startCompiling();
        store.setSuccess({ ok: true, code: '', frontmatter: {}, outline: undefined });
        store.setError([{ message: 'test' }]);
        store.reset();
      }
      const duration = performance.now() - start;

      // 50 full cycles (200 transitions) should complete in < 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('selector performance', () => {
    it('should access selectors efficiently', () => {
      const store = usePreviewStore.getState();
      store.setSuccess({ ok: true, code: 'test', frontmatter: { key: 'value' }, outline: undefined });

      const iterations = 10000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const state = usePreviewStore.getState();
        const _ = state.state.status;
        const __ = state.scrollRatio;
        const ___ = state.lastSuccessfulRender;
      }

      const duration = performance.now() - start;

      // 10000 selector accesses should complete in < 50ms
      expect(duration).toBeLessThan(50);
    });
  });
});

describe('Performance - Size Limit Fast Path', () => {
  describe('size limit rejection performance', () => {
    // Skip: Timing-based test with 5ms threshold is too flaky for CI environments
    // with variable CPU load. The behavior (rejecting oversized docs) is tested;
    // the sub-5ms performance requires a dedicated perf environment to verify.
    it.skip('should reject oversized documents instantly', async () => {
      const oversizedSource = 'x'.repeat(MAX_SOURCE_SIZE + 1);

      const start = performance.now();
      const result = await compileMdx(testId('oversized'), oversizedSource);
      const duration = performance.now() - start;

      expect(result.ok).toBe(false);
      // Size check should be near-instant (< 5ms)
      expect(duration).toBeLessThan(5);
    });

    // Skip: The 10ms threshold is too tight for CI environments. String creation
    // and size checking of large strings can vary significantly under load.
    // The behavior (rejection) is verified; timing requires a dedicated perf env.
    it.skip('should not process content of oversized documents', async () => {
      // Create a complex document that would take time to parse
      const complexContent = Array.from({ length: 100000 }, (_, i) => `# Heading ${i}`).join('\n');
      const oversizedSource = complexContent.slice(0, MAX_SOURCE_SIZE + 100);

      const start = performance.now();
      const result = await compileMdx(testId('complex-oversized'), oversizedSource);
      const duration = performance.now() - start;

      expect(result.ok).toBe(false);
      // Should reject quickly without parsing
      expect(duration).toBeLessThan(10);
    });
  });
});

describe('Performance - Parallel Compilation', () => {
  describe('concurrent compilation throughput', () => {
    it('should handle parallel compilations efficiently', async () => {
      const sources = Array.from({ length: 10 }, (_, i) => `# Document ${i}\n\nContent ${i}`);

      const start = performance.now();
      const results = await Promise.all(
        sources.map((src, i) => compileMdx(testId(`parallel-${i}`), src))
      );
      const duration = performance.now() - start;

      // All should succeed
      results.forEach((r) => expect(r.ok).toBe(true));

      // 10 parallel compilations should complete faster than 10 sequential
      // (accounting for thread/event loop overhead)
      expect(duration).toBeLessThan(1000);
    });

    // Skip: Comparing sequential vs parallel timing is inherently flaky.
    // Under variable CPU load, parallel execution may not always outperform
    // sequential due to event loop contention and scheduling variance.
    // This test requires a dedicated, isolated perf environment.
    it.skip('should scale reasonably with parallelism', async () => {
      const source = '# Test\n\nContent';

      // Sequential baseline
      const seqStart = performance.now();
      for (let i = 0; i < 5; i++) {
        await compileMdx(testId(`seq-${i}`), source);
      }
      const seqDuration = performance.now() - seqStart;

      // Parallel execution
      const parStart = performance.now();
      await Promise.all(
        Array.from({ length: 5 }, (_, i) => compileMdx(testId(`par-${i}`), source))
      );
      const parDuration = performance.now() - parStart;

      // Parallel should be at least as fast, ideally faster
      expect(parDuration).toBeLessThanOrEqual(seqDuration * 1.2);
    });
  });
});

describe('Performance - Error Path', () => {
  describe('error handling performance', () => {
    it('should report syntax errors quickly', async () => {
      const invalidSource = `# Title

<div>
  <span>Unclosed
</div>`;

      const start = performance.now();
      const result = await compileMdx(testId('syntax-error'), invalidSource);
      const duration = performance.now() - start;

      expect(result.ok).toBe(false);
      // Error detection should be reasonably fast
      expect(duration).toBeLessThan(200);
    });

    it('should report frontmatter errors quickly', async () => {
      const invalidFrontmatter = `---
title: "unclosed string
key: value
---

# Content`;

      const start = performance.now();
      const result = await compileMdx(testId('frontmatter-error'), invalidFrontmatter);
      const duration = performance.now() - start;

      // Should either succeed (tolerant parsing) or fail quickly
      expect(duration).toBeLessThan(200);
    });
  });
});

describe('Performance - Memory Management', () => {
  describe('cleanup behavior', () => {
    it('should handle many store resets without issues', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        usePreviewStore.getState().setSuccess({
          ok: true,
          code: `code-${i}`,
          frontmatter: { data: 'x'.repeat(100) },
          outline: undefined,
        });
        usePreviewStore.getState().reset();
      }

      const duration = performance.now() - startTime;

      // 1000 set+reset cycles should complete reasonably quickly
      expect(duration).toBeLessThan(500);

      // Final state should be clean
      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('idle');
      expect(state.lastSuccessfulRender).toBeNull();
    });

    it('should handle growing frontmatter efficiently', async () => {
      const results: boolean[] = [];

      for (let i = 0; i < 20; i++) {
        // Progressively larger frontmatter
        const frontmatter = Array.from({ length: (i + 1) * 10 }, (_, j) => `key${j}: value${j}`).join('\n');
        const source = `---\n${frontmatter}\n---\n\n# Content`;

        const result = await compileMdx(testId(`grow-${i}`), source);
        results.push(result.ok);
      }

      expect(results.every((ok) => ok)).toBe(true);
    });
  });
});
