import { afterEach, describe, expect, it, vi } from 'vitest';

import { WriteLockTimeoutError, createWriteLock } from '../write-lock';

describe('createWriteLock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('acquires and releases a lock', async () => {
    const lock = createWriteLock();

    const lease = await lock.acquire('doc-1');

    expect(lock.isLocked('doc-1')).toBe(true);
    expect(lease.release()).toBe(true);
    expect(lock.isLocked('doc-1')).toBe(false);
    expect(lease.release()).toBe(false);
  });

  it('supports timer handles without unref', async () => {
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((() => 1) as unknown as typeof setTimeout);
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => undefined);

    try {
      const lock = createWriteLock();
      const lease = await lock.acquire('doc-1');

      expect(lock.isLocked('doc-1')).toBe(true);
      expect(lease.release()).toBe(true);
      expect(lock.isLocked('doc-1')).toBe(false);
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });

  it('queues concurrent acquisitions for the same key', async () => {
    const lock = createWriteLock();
    const first = await lock.acquire('doc-1');
    const secondPromise = lock.acquire('doc-1', { timeoutMs: 100 });

    let secondAcquired = false;
    void secondPromise.then(() => {
      secondAcquired = true;
    });
    await Promise.resolve();

    expect(secondAcquired).toBe(false);

    first.release();
    const second = await secondPromise;

    expect(lock.isLocked('doc-1')).toBe(true);
    expect(second.release()).toBe(true);
  });

  it('times out when lock cannot be acquired in time', async () => {
    vi.useFakeTimers();
    const lock = createWriteLock();
    const first = await lock.acquire('doc-1', { holdTimeoutMs: 10_000 });
    const secondPromise = lock.acquire('doc-1', { timeoutMs: 50 });
    const rejection = expect(secondPromise).rejects.toBeInstanceOf(WriteLockTimeoutError);

    await vi.advanceTimersByTimeAsync(50);

    await rejection;
    first.release();
  });

  it('auto-releases stale lock after hold timeout', async () => {
    vi.useFakeTimers();
    const lock = createWriteLock();
    const first = await lock.acquire('doc-1', { holdTimeoutMs: 25 });
    const secondPromise = lock.acquire('doc-1', { timeoutMs: 100 });

    await vi.advanceTimersByTimeAsync(25);
    const second = await secondPromise;

    expect(first.release()).toBe(false);
    expect(lock.isLocked('doc-1')).toBe(true);
    expect(second.release()).toBe(true);
  });
});
