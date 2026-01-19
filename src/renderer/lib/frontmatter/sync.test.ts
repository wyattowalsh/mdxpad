/**
 * Sync Module Unit Tests
 *
 * Tests for bidirectional synchronization utilities including debouncing,
 * source-aware handling, sync management, and subscriptions.
 *
 * @module renderer/lib/frontmatter/sync.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  debounce,
  createSourceAwareHandler,
  createSyncManager,
  createSubscription,
  DEFAULT_DEBOUNCE_MS,
  type DebouncedFunction,
  type SyncManager,
} from './sync';
import type { ChangeSource } from '@shared/types/frontmatter';

// ============================================================================
// debounce Tests
// ============================================================================

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should call function after delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should reset delay on subsequent calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('first');
      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      // Second call resets the timer
      debouncedFn('second');
      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      // Now complete the delay from second call
      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('second');
    });

    it('should use most recent arguments when called multiple times', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });
  });

  describe('cancel()', () => {
    it('should prevent execution when called before timeout', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('test');
      vi.advanceTimersByTime(50);
      debouncedFn.cancel();

      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should clear pending arguments', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('test');
      debouncedFn.cancel();

      // Calling flush after cancel should not invoke function
      debouncedFn.flush();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('test');
      debouncedFn.cancel();
      debouncedFn.cancel();
      debouncedFn.cancel();

      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should be safe to call when no pending invocation', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      // Cancel without any prior call
      expect(() => debouncedFn.cancel()).not.toThrow();
    });
  });

  describe('flush()', () => {
    it('should execute immediately when pending', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('test');
      expect(fn).not.toHaveBeenCalled();

      debouncedFn.flush();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('test');
    });

    it('should clear the timeout after flush', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('test');
      debouncedFn.flush();

      // Advancing timer should not call again
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call when no pending invocation', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      expect(() => debouncedFn.flush()).not.toThrow();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should use most recent arguments when flushed', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn.flush();

      expect(fn).toHaveBeenCalledWith('second');
    });
  });

  describe('edge cases', () => {
    it('should work with zero delay', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 0);

      debouncedFn('test');
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(0);
      expect(fn).toHaveBeenCalledWith('test');
    });

    it('should handle functions with no arguments', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith();
    });

    it('should handle functions with multiple arguments', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn(1, 'two', { three: 3 }, [4, 5]);
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith(1, 'two', { three: 3 }, [4, 5]);
    });
  });
});

// ============================================================================
// createSourceAwareHandler Tests
// ============================================================================

describe('createSourceAwareHandler', () => {
  it('should process update when source does not match ignore source', () => {
    const processUpdate = vi.fn();
    let lastSource: ChangeSource = 'document';

    const handler = createSourceAwareHandler(
      processUpdate,
      () => lastSource,
      'panel' // Ignore panel changes
    );

    handler('test value');
    expect(processUpdate).toHaveBeenCalledWith('test value');
  });

  it('should skip update when source matches ignore source', () => {
    const processUpdate = vi.fn();
    let lastSource: ChangeSource = 'panel';

    const handler = createSourceAwareHandler(
      processUpdate,
      () => lastSource,
      'panel' // Ignore panel changes
    );

    handler('test value');
    expect(processUpdate).not.toHaveBeenCalled();
  });

  it('should process update when source is null', () => {
    const processUpdate = vi.fn();
    let lastSource: ChangeSource = null;

    const handler = createSourceAwareHandler(
      processUpdate,
      () => lastSource,
      'panel'
    );

    handler('test value');
    expect(processUpdate).toHaveBeenCalledWith('test value');
  });

  it('should re-evaluate source on each call', () => {
    const processUpdate = vi.fn();
    let lastSource: ChangeSource = 'document';

    const handler = createSourceAwareHandler(
      processUpdate,
      () => lastSource,
      'panel'
    );

    // First call - should process
    handler('first');
    expect(processUpdate).toHaveBeenCalledTimes(1);

    // Change source to panel
    lastSource = 'panel';

    // Second call - should skip
    handler('second');
    expect(processUpdate).toHaveBeenCalledTimes(1);

    // Change source back
    lastSource = 'document';

    // Third call - should process
    handler('third');
    expect(processUpdate).toHaveBeenCalledTimes(2);
  });

  it('should work with document as ignore source', () => {
    const processUpdate = vi.fn();
    let lastSource: ChangeSource = 'document';

    const handler = createSourceAwareHandler(
      processUpdate,
      () => lastSource,
      'document' // Ignore document changes
    );

    handler('test');
    expect(processUpdate).not.toHaveBeenCalled();

    lastSource = 'panel';
    handler('test2');
    expect(processUpdate).toHaveBeenCalledWith('test2');
  });
});

// ============================================================================
// createSyncManager Tests
// ============================================================================

describe('createSyncManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Helper to create a sync manager with mocked dependencies.
   */
  function createTestSyncManager(overrides: {
    debounceMs?: number;
    lastSource?: ChangeSource;
  } = {}): {
    manager: SyncManager;
    mocks: {
      getLastSource: ReturnType<typeof vi.fn>;
      parseFromDocument: ReturnType<typeof vi.fn>;
      updateEditor: ReturnType<typeof vi.fn>;
      serializeToYaml: ReturnType<typeof vi.fn>;
      setChangeSource: ReturnType<typeof vi.fn>;
    };
  } {
    let lastSource: ChangeSource = overrides.lastSource ?? null;

    const mocks = {
      getLastSource: vi.fn(() => lastSource),
      parseFromDocument: vi.fn(),
      updateEditor: vi.fn(),
      serializeToYaml: vi.fn(() => 'title: Test\n'),
      setChangeSource: vi.fn((source: ChangeSource) => {
        lastSource = source;
      }),
    };

    const manager = createSyncManager({
      debounceMs: overrides.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      ...mocks,
    });

    return { manager, mocks };
  }

  describe('handleEditorChange', () => {
    it('should debounce calls to parseFromDocument', () => {
      const { manager, mocks } = createTestSyncManager();

      manager.handleEditorChange('content 1');
      manager.handleEditorChange('content 2');
      manager.handleEditorChange('content 3');

      expect(mocks.parseFromDocument).not.toHaveBeenCalled();

      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);
      expect(mocks.parseFromDocument).toHaveBeenCalledTimes(1);
      expect(mocks.parseFromDocument).toHaveBeenCalledWith('content 3');
    });

    it('should use custom debounce delay', () => {
      const { manager, mocks } = createTestSyncManager({ debounceMs: 50 });

      manager.handleEditorChange('content');

      vi.advanceTimersByTime(49);
      expect(mocks.parseFromDocument).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mocks.parseFromDocument).toHaveBeenCalled();
    });

    it('should skip parsing when last source is panel', () => {
      const { manager, mocks } = createTestSyncManager({ lastSource: 'panel' });

      manager.handleEditorChange('content');
      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

      expect(mocks.parseFromDocument).not.toHaveBeenCalled();
    });

    it('should parse when last source is document', () => {
      const { manager, mocks } = createTestSyncManager({ lastSource: 'document' });

      manager.handleEditorChange('content');
      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

      expect(mocks.parseFromDocument).toHaveBeenCalledWith('content');
    });

    it('should parse when last source is null', () => {
      const { manager, mocks } = createTestSyncManager({ lastSource: null });

      manager.handleEditorChange('content');
      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

      expect(mocks.parseFromDocument).toHaveBeenCalledWith('content');
    });
  });

  describe('handlePanelChange', () => {
    it('should set source to panel before updating editor', () => {
      const { manager, mocks } = createTestSyncManager();

      manager.handlePanelChange();

      expect(mocks.setChangeSource).toHaveBeenCalledWith('panel');
      // setChangeSource should be called before other operations
      expect(mocks.setChangeSource.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.serializeToYaml.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    it('should serialize and update editor immediately', () => {
      const { manager, mocks } = createTestSyncManager();

      manager.handlePanelChange();

      expect(mocks.serializeToYaml).toHaveBeenCalled();
      expect(mocks.updateEditor).toHaveBeenCalledWith('title: Test\n');
    });

    it('should not debounce updates', () => {
      const { manager, mocks } = createTestSyncManager();

      manager.handlePanelChange();
      manager.handlePanelChange();
      manager.handlePanelChange();

      // All calls should happen immediately
      expect(mocks.updateEditor).toHaveBeenCalledTimes(3);
    });
  });

  describe('cancel()', () => {
    it('should cancel pending debounced updates', () => {
      const { manager, mocks } = createTestSyncManager();

      manager.handleEditorChange('content');
      vi.advanceTimersByTime(50);

      manager.cancel();

      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);
      expect(mocks.parseFromDocument).not.toHaveBeenCalled();
    });
  });

  describe('flush()', () => {
    it('should immediately execute pending updates', () => {
      const { manager, mocks } = createTestSyncManager();

      manager.handleEditorChange('content');
      expect(mocks.parseFromDocument).not.toHaveBeenCalled();

      manager.flush();
      expect(mocks.parseFromDocument).toHaveBeenCalledWith('content');
    });
  });

  describe('dispose()', () => {
    it('should clean up resources and cancel pending updates', () => {
      const { manager, mocks } = createTestSyncManager();

      manager.handleEditorChange('content');
      manager.dispose();

      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);
      expect(mocks.parseFromDocument).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      const { manager } = createTestSyncManager();

      expect(() => {
        manager.dispose();
        manager.dispose();
        manager.dispose();
      }).not.toThrow();
    });
  });
});

// ============================================================================
// createSubscription Tests
// ============================================================================

describe('createSubscription', () => {
  it('should call callback when selected state changes', () => {
    type State = { content: string; other: number };
    let currentState: State = { content: 'initial', other: 1 };
    const listeners: Array<(state: State) => void> = [];

    const subscribe = (listener: (state: State) => void): (() => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      };
    };

    const callback = vi.fn();
    createSubscription(
      subscribe,
      (state) => state.content,
      callback
    );

    // Simulate state change
    currentState = { content: 'changed', other: 1 };
    listeners.forEach((l) => l(currentState));

    expect(callback).toHaveBeenCalledWith('changed');
  });

  it('should skip callback when selected state is same', () => {
    type State = { content: string; other: number };
    let currentState: State = { content: 'initial', other: 1 };
    const listeners: Array<(state: State) => void> = [];

    const subscribe = (listener: (state: State) => void): (() => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      };
    };

    const callback = vi.fn();
    createSubscription(
      subscribe,
      (state) => state.content,
      callback
    );

    // First notification - content changes
    currentState = { content: 'new content', other: 1 };
    listeners.forEach((l) => l(currentState));
    expect(callback).toHaveBeenCalledTimes(1);

    // Second notification - only other changes, content stays same
    currentState = { content: 'new content', other: 2 };
    listeners.forEach((l) => l(currentState));
    expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it('should return unsubscribe function', () => {
    type State = { value: number };
    let currentState: State = { value: 0 };
    const listeners: Array<(state: State) => void> = [];

    const subscribe = (listener: (state: State) => void): (() => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      };
    };

    const callback = vi.fn();
    const unsubscribe = createSubscription(
      subscribe,
      (state) => state.value,
      callback
    );

    // Trigger change
    currentState = { value: 1 };
    listeners.forEach((l) => l(currentState));
    expect(callback).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsubscribe();

    // Another change should not trigger callback
    currentState = { value: 2 };
    listeners.forEach((l) => l(currentState));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should track changes across multiple updates', () => {
    type State = { count: number };
    let currentState: State = { count: 0 };
    const listeners: Array<(state: State) => void> = [];

    const subscribe = (listener: (state: State) => void): (() => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      };
    };

    const receivedValues: number[] = [];
    createSubscription(
      subscribe,
      (state) => state.count,
      (count) => receivedValues.push(count)
    );

    // Multiple updates
    for (let i = 1; i <= 5; i++) {
      currentState = { count: i };
      listeners.forEach((l) => l(currentState));
    }

    expect(receivedValues).toEqual([1, 2, 3, 4, 5]);
  });

  it('should use reference equality for comparison', () => {
    type State = { obj: { value: number } };
    const obj1 = { value: 1 };
    const obj2 = { value: 1 }; // Same content, different reference
    let currentState: State = { obj: obj1 };
    const listeners: Array<(state: State) => void> = [];

    const subscribe = (listener: (state: State) => void): (() => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      };
    };

    const callback = vi.fn();
    createSubscription(
      subscribe,
      (state) => state.obj,
      callback
    );

    // Same reference - should not trigger
    listeners.forEach((l) => l(currentState));
    // First notification with different reference from undefined (initial)
    expect(callback).toHaveBeenCalledTimes(1);

    // Different reference with same content - should trigger
    currentState = { obj: obj2 };
    listeners.forEach((l) => l(currentState));
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('constants', () => {
  it('should export DEFAULT_DEBOUNCE_MS as 150', () => {
    expect(DEFAULT_DEBOUNCE_MS).toBe(150);
  });
});
