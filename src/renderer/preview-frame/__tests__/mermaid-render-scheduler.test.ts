import { describe, it, expect, vi } from 'vitest';
import { createMermaidRenderScheduler } from '../mermaid-render-scheduler';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('createMermaidRenderScheduler', () => {
  it('coalesces multiple pending render requests into one follow-up run', async () => {
    const firstRun = createDeferred<void>();
    const renderDiagram = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(firstRun.promise)
      .mockResolvedValue(undefined);

    const scheduler = createMermaidRenderScheduler(renderDiagram);

    scheduler.requestRender();
    scheduler.requestRender();
    scheduler.requestRender();

    expect(renderDiagram).toHaveBeenCalledTimes(1);

    firstRun.resolve(undefined);
    await flushMicrotasks();

    expect(renderDiagram).toHaveBeenCalledTimes(2);
  });

  it('never runs mermaid rendering re-entrantly', async () => {
    const runs: Deferred<void>[] = [];
    let activeRenders = 0;
    let maxConcurrentRenders = 0;

    const renderDiagram = vi.fn(async () => {
      activeRenders += 1;
      maxConcurrentRenders = Math.max(maxConcurrentRenders, activeRenders);
      const currentRun = createDeferred<void>();
      runs.push(currentRun);
      await currentRun.promise;
      activeRenders -= 1;
    });

    const scheduler = createMermaidRenderScheduler(renderDiagram);

    scheduler.requestRender();
    scheduler.requestRender();
    scheduler.requestRender();

    expect(renderDiagram).toHaveBeenCalledTimes(1);
    expect(maxConcurrentRenders).toBe(1);

    runs[0]?.resolve(undefined);
    await flushMicrotasks();

    expect(renderDiagram).toHaveBeenCalledTimes(2);
    expect(maxConcurrentRenders).toBe(1);

    runs[1]?.resolve(undefined);
    await flushMicrotasks();

    expect(maxConcurrentRenders).toBe(1);
  });
});
