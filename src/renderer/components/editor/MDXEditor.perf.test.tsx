import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MDXEditor } from './MDXEditor';

describe('MDXEditor Performance', () => {
  const KEYSTROKE_P99_THRESHOLD_MS = Number.parseFloat(
    process.env.MDXPAD_EDITOR_KEYSTROKE_P99_MS ?? '200'
  );

  afterEach(() => {
    cleanup();
  });

  it('keystroke latency p99 stays below configured threshold with 10K char document', async () => {
    // Generate 10K character document
    const largeDoc = 'A'.repeat(10000);

    const { container } = render(
      <MDXEditor value={largeDoc} />
    );

    await waitFor(() => {
      expect(container.querySelector('.cm-content')).not.toBeNull();
    });

    const cmContent = container.querySelector('.cm-content');
    expect(cmContent).not.toBeNull();

    const latencies: number[] = [];
    const warmupIterations = 20;

    const createInputEvent = () =>
      new InputEvent('input', {
        inputType: 'insertText',
        data: 'x',
        bubbles: true,
        cancelable: true,
      });

    // Warm up event handlers to reduce first-sample jitter in CI.
    for (let i = 0; i < warmupIterations; i++) {
      cmContent!.dispatchEvent(createInputEvent());
    }

    // Simulate 100 keystrokes and measure latency
    for (let i = 0; i < 100; i++) {
      const start = performance.now();

      // Dispatch a synthetic input event
      cmContent!.dispatchEvent(createInputEvent());

      const end = performance.now();
      latencies.push(end - start);
    }

    // Calculate p99
    const sorted = latencies.sort((a, b) => a - b);
    const p99Index = Math.floor(sorted.length * 0.99);
    const p99 = sorted[p99Index] ?? sorted[sorted.length - 1] ?? 0;

    expect(p99).toBeLessThan(KEYSTROKE_P99_THRESHOLD_MS);
  });
});
