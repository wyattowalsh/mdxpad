/**
 * Shared write-lock utility with timeout-safe acquisition and release semantics.
 *
 * @module shared/lib/write-lock
 */

const DEFAULT_ACQUIRE_TIMEOUT_MS = 5_000;
const DEFAULT_HOLD_TIMEOUT_MS = 30_000;

type TimeoutHandle = ReturnType<typeof setTimeout>;

export interface WriteLockAcquireOptions {
  readonly timeoutMs?: number;
  readonly holdTimeoutMs?: number;
}

export interface WriteLockLease {
  readonly key: string;
  readonly acquiredAt: number;
  readonly expiresAt: number;
  readonly released: boolean;
  release: () => boolean;
}

export interface WriteLock {
  acquire: (key: string, options?: WriteLockAcquireOptions) => Promise<WriteLockLease>;
  isLocked: (key: string) => boolean;
}

export class WriteLockTimeoutError extends Error {
  constructor(key: string, timeoutMs: number) {
    super(`Timed out acquiring write lock for "${key}" after ${timeoutMs}ms`);
    this.name = 'WriteLockTimeoutError';
  }
}

interface LockWaiter {
  readonly resolve: (lease: WriteLockLease) => void;
  readonly reject: (error: WriteLockTimeoutError) => void;
  readonly holdTimeoutMs: number;
  active: boolean;
  timeoutHandle?: TimeoutHandle;
}

interface ActiveLeaseState {
  readonly token: symbol;
  released: boolean;
  holdTimeoutHandle?: TimeoutHandle;
}

interface LockState {
  active?: ActiveLeaseState;
  readonly queue: LockWaiter[];
}

export function createWriteLock(): WriteLock {
  const locks = new Map<string, LockState>();

  return {
    acquire: async (key, options = {}) => {
      const timeoutMs = normalizeTimeout(options.timeoutMs, DEFAULT_ACQUIRE_TIMEOUT_MS);
      const holdTimeoutMs = normalizeTimeout(options.holdTimeoutMs, DEFAULT_HOLD_TIMEOUT_MS);
      const state = getOrCreateLockState(locks, key);

      if (state.active === undefined) {
        return grantLock(locks, state, key, holdTimeoutMs);
      }

      return await new Promise<WriteLockLease>((resolve, reject) => {
        const waiter: LockWaiter = {
          resolve,
          reject,
          holdTimeoutMs,
          active: true,
        };

        waiter.timeoutHandle = setTimeout(() => {
          if (!waiter.active) {
            return;
          }

          waiter.active = false;
          removeWaiter(state, waiter);
          reject(new WriteLockTimeoutError(key, timeoutMs));
          pruneLockState(locks, key, state);
        }, timeoutMs);

        detachTimeout(waiter.timeoutHandle);
        state.queue.push(waiter);
      });
    },
    isLocked: (key) => locks.get(key)?.active !== undefined,
  };
}

function grantLock(
  locks: Map<string, LockState>,
  state: LockState,
  key: string,
  holdTimeoutMs: number,
): WriteLockLease {
  const token = Symbol(key);
  const acquiredAt = Date.now();
  const expiresAt = acquiredAt + holdTimeoutMs;
  const leaseState: ActiveLeaseState = {
    token,
    released: false,
  };

  leaseState.holdTimeoutHandle = setTimeout(() => {
    releaseLock(locks, key, token);
  }, holdTimeoutMs);
  detachTimeout(leaseState.holdTimeoutHandle);

  state.active = leaseState;

  return {
    key,
    acquiredAt,
    expiresAt,
    get released() {
      return leaseState.released;
    },
    release: () => releaseLock(locks, key, token),
  };
}

function releaseLock(locks: Map<string, LockState>, key: string, token: symbol): boolean {
  const state = locks.get(key);
  if (state === undefined || state.active?.token !== token) {
    return false;
  }

  const activeLease = state.active;

  activeLease.released = true;
  clearTimeout(activeLease.holdTimeoutHandle);
  delete state.active;

  while (state.queue.length > 0) {
    const waiter = state.queue.shift();
    if (!waiter?.active) {
      continue;
    }

    waiter.active = false;
    clearTimeout(waiter.timeoutHandle);
    waiter.resolve(grantLock(locks, state, key, waiter.holdTimeoutMs));
    return true;
  }

  locks.delete(key);
  return true;
}

function normalizeTimeout(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}

function getOrCreateLockState(locks: Map<string, LockState>, key: string): LockState {
  const existing = locks.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const created: LockState = { queue: [] };
  locks.set(key, created);
  return created;
}

function removeWaiter(state: LockState, waiter: LockWaiter): void {
  const index = state.queue.indexOf(waiter);
  if (index === -1) {
    return;
  }

  state.queue.splice(index, 1);
}

function pruneLockState(locks: Map<string, LockState>, key: string, state: LockState): void {
  if (state.active === undefined && state.queue.length === 0) {
    locks.delete(key);
  }
}

function detachTimeout(handle: TimeoutHandle | undefined): void {
  const timer = handle as { unref?: () => void } | undefined;
  timer?.unref?.();
}
