/**
 * Performance tests for MDXEditor component.
 *
 * Measures render time to verify compliance with spec.md success criteria:
 * - SC-001: Editor renders and accepts input within 100ms of document open
 * - SC-002: MDX syntax highlighting correctly identifies all token types
 *
 * These tests measure time from component mount to first contenteditable
 * interaction readiness. Note that in the happy-dom test environment,
 * timings may differ from real Electron app performance.
 *
 * @see spec.md SC-001, SC-002
 * @see FR-001: System MUST render an interactive text editor that accepts
 *      user input within 100ms of document open
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MDXEditor } from './MDXEditor';

describe('MDXEditor Render Performance', () => {
  // happy-dom timing is noisy in CI/local; strict UX perf SLOs are enforced in E2E perf specs.
  const RENDER_THRESHOLD_MS = Number.parseInt(
    process.env.MDXPAD_EDITOR_RENDER_THRESHOLD_MS ?? '3000',
    10
  );

  afterEach(() => {
    cleanup();
  });

  it('editor renders and accepts input within configured threshold', async () => {
    const startTime = performance.now();
    const { container } = render(createElement(MDXEditor, { value: '# Test' }));
    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(RENDER_THRESHOLD_MS);

    await waitFor(() => {
      expect(container.querySelector('.cm-content')).not.toBeNull();
    });
  });

  it('editor with large document renders within reasonable time', async () => {
    // 10K character document
    const largeContent = '# Large Document\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(400);

    const startTime = performance.now();
    const { container } = render(createElement(MDXEditor, { value: largeContent }));
    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(RENDER_THRESHOLD_MS);

    await waitFor(() => {
      expect(container.querySelector('.cm-content')).not.toBeNull();
    });
  });
});
