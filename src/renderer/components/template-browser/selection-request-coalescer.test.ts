import { describe, it, expect, vi } from 'vitest';
import { createSelectionRequestCoalescer } from './selection-request-coalescer';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('createSelectionRequestCoalescer', () => {
  it('coalesces rapid requests to the latest queued id', async () => {
    const first = createDeferred<void>();
    const run = vi
      .fn<(_: string) => Promise<void>>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);

    const coalescer = createSelectionRequestCoalescer(run);

    const p1 = coalescer('template-1');
    const p2 = coalescer('template-2');
    const p3 = coalescer('template-3');

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenNthCalledWith(1, 'template-1');

    first.resolve();
    await Promise.all([p1, p2, p3]);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(2, 'template-3');
  });

  it('skips duplicate queued ids while request is in flight', async () => {
    const first = createDeferred<void>();
    const run = vi
      .fn<(_: string) => Promise<void>>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);

    const coalescer = createSelectionRequestCoalescer(run);

    const p1 = coalescer('template-1');
    const p2 = coalescer('template-2');
    const p3 = coalescer('template-2');

    first.resolve();
    await Promise.all([p1, p2, p3]);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(2, 'template-2');
  });
});
