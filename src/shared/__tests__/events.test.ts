/**
 * Comprehensive tests for TypedEventEmitter.
 * Tests all operations: on, emit, off, once, listenerCount.
 */

import { describe, it, expect, vi } from 'vitest';
import { TypedEventEmitter, type EventMap } from '@shared/lib/events';

// Define test event types
type TestEvents = {
  'file:changed': { path: string };
  'theme:updated': { theme: 'light' | 'dark' };
  'user:login': { userId: number; username: string };
  'app:ready': void;
  'counter:increment': number;
};

describe('TypedEventEmitter', () => {
  describe('on()', () => {
    it('should subscribe to an event', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('file:changed', handler);
      emitter.emit('file:changed', { path: '/test.txt' });

      expect(handler).toHaveBeenCalledWith({ path: '/test.txt' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers to same event', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on('file:changed', handler1);
      emitter.on('file:changed', handler2);
      emitter.on('file:changed', handler3);

      emitter.emit('file:changed', { path: '/test.txt' });

      expect(handler1).toHaveBeenCalledWith({ path: '/test.txt' });
      expect(handler2).toHaveBeenCalledWith({ path: '/test.txt' });
      expect(handler3).toHaveBeenCalledWith({ path: '/test.txt' });
    });

    it('should return unsubscribe function', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      const unsubscribe = emitter.on('file:changed', handler);
      emitter.emit('file:changed', { path: '/test1.txt' });

      unsubscribe();
      emitter.emit('file:changed', { path: '/test2.txt' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ path: '/test1.txt' });
    });

    it('should handle different event types', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const fileHandler = vi.fn();
      const themeHandler = vi.fn();
      const userHandler = vi.fn();

      emitter.on('file:changed', fileHandler);
      emitter.on('theme:updated', themeHandler);
      emitter.on('user:login', userHandler);

      emitter.emit('file:changed', { path: '/test.txt' });
      emitter.emit('theme:updated', { theme: 'dark' });
      emitter.emit('user:login', { userId: 1, username: 'alice' });

      expect(fileHandler).toHaveBeenCalledWith({ path: '/test.txt' });
      expect(themeHandler).toHaveBeenCalledWith({ theme: 'dark' });
      expect(userHandler).toHaveBeenCalledWith({ userId: 1, username: 'alice' });
    });

    it('should handle void payloads', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('app:ready', handler);
      emitter.emit('app:ready', undefined);

      expect(handler).toHaveBeenCalledWith(undefined);
    });
  });

  describe('emit()', () => {
    it('should emit events to all subscribers', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('counter:increment', handler1);
      emitter.on('counter:increment', handler2);

      emitter.emit('counter:increment', 5);

      expect(handler1).toHaveBeenCalledWith(5);
      expect(handler2).toHaveBeenCalledWith(5);
    });

    it('should do nothing if no subscribers', () => {
      const emitter = new TypedEventEmitter<TestEvents>();

      // Should not throw
      expect(() => {
        emitter.emit('file:changed', { path: '/test.txt' });
      }).not.toThrow();
    });

    it('should emit multiple times', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('counter:increment', handler);

      emitter.emit('counter:increment', 1);
      emitter.emit('counter:increment', 2);
      emitter.emit('counter:increment', 3);

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenNthCalledWith(1, 1);
      expect(handler).toHaveBeenNthCalledWith(2, 2);
      expect(handler).toHaveBeenNthCalledWith(3, 3);
    });

    it('should emit to subscribers in registration order', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const calls: number[] = [];

      emitter.on('counter:increment', () => calls.push(1));
      emitter.on('counter:increment', () => calls.push(2));
      emitter.on('counter:increment', () => calls.push(3));

      emitter.emit('counter:increment', 42);

      expect(calls).toEqual([1, 2, 3]);
    });
  });

  describe('off()', () => {
    it('should remove all listeners for a specific event', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('file:changed', handler1);
      emitter.on('file:changed', handler2);

      emitter.emit('file:changed', { path: '/test1.txt' });
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      emitter.off('file:changed');

      emitter.emit('file:changed', { path: '/test2.txt' });
      expect(handler1).toHaveBeenCalledTimes(1); // No additional calls
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should only remove listeners for specified event', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const fileHandler = vi.fn();
      const themeHandler = vi.fn();

      emitter.on('file:changed', fileHandler);
      emitter.on('theme:updated', themeHandler);

      emitter.off('file:changed');

      emitter.emit('file:changed', { path: '/test.txt' });
      emitter.emit('theme:updated', { theme: 'dark' });

      expect(fileHandler).not.toHaveBeenCalled();
      expect(themeHandler).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('should remove all listeners when called without event', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const fileHandler = vi.fn();
      const themeHandler = vi.fn();
      const userHandler = vi.fn();

      emitter.on('file:changed', fileHandler);
      emitter.on('theme:updated', themeHandler);
      emitter.on('user:login', userHandler);

      emitter.off();

      emitter.emit('file:changed', { path: '/test.txt' });
      emitter.emit('theme:updated', { theme: 'dark' });
      emitter.emit('user:login', { userId: 1, username: 'alice' });

      expect(fileHandler).not.toHaveBeenCalled();
      expect(themeHandler).not.toHaveBeenCalled();
      expect(userHandler).not.toHaveBeenCalled();
    });

    it('should handle off() on non-existent event', () => {
      const emitter = new TypedEventEmitter<TestEvents>();

      // Should not throw
      expect(() => {
        emitter.off('file:changed');
      }).not.toThrow();
    });
  });

  describe('once()', () => {
    it('should call handler only once', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.once('file:changed', handler);

      emitter.emit('file:changed', { path: '/test1.txt' });
      emitter.emit('file:changed', { path: '/test2.txt' });
      emitter.emit('file:changed', { path: '/test3.txt' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ path: '/test1.txt' });
    });

    it('should return unsubscribe function', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      const unsubscribe = emitter.once('file:changed', handler);
      unsubscribe();

      emitter.emit('file:changed', { path: '/test.txt' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should work with multiple once handlers', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.once('counter:increment', handler1);
      emitter.once('counter:increment', handler2);

      emitter.emit('counter:increment', 1);
      emitter.emit('counter:increment', 2);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledWith(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledWith(1);
    });

    it('should work alongside regular on() handlers', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const onHandler = vi.fn();
      const onceHandler = vi.fn();

      emitter.on('counter:increment', onHandler);
      emitter.once('counter:increment', onceHandler);

      emitter.emit('counter:increment', 1);
      emitter.emit('counter:increment', 2);

      expect(onHandler).toHaveBeenCalledTimes(2);
      expect(onceHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('listenerCount()', () => {
    it('should return 0 for events with no listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      expect(emitter.listenerCount('file:changed')).toBe(0);
    });

    it('should return correct count for single listener', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.on('file:changed', () => {});

      expect(emitter.listenerCount('file:changed')).toBe(1);
    });

    it('should return correct count for multiple listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.on('file:changed', () => {});
      emitter.on('file:changed', () => {});
      emitter.on('file:changed', () => {});

      expect(emitter.listenerCount('file:changed')).toBe(3);
    });

    it('should update count when listeners are removed', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const unsub1 = emitter.on('file:changed', () => {});
      const unsub2 = emitter.on('file:changed', () => {});
      const unsub3 = emitter.on('file:changed', () => {});

      expect(emitter.listenerCount('file:changed')).toBe(3);

      unsub1();
      expect(emitter.listenerCount('file:changed')).toBe(2);

      unsub2();
      expect(emitter.listenerCount('file:changed')).toBe(1);

      unsub3();
      expect(emitter.listenerCount('file:changed')).toBe(0);
    });

    it('should track counts independently per event', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.on('file:changed', () => {});
      emitter.on('file:changed', () => {});
      emitter.on('theme:updated', () => {});

      expect(emitter.listenerCount('file:changed')).toBe(2);
      expect(emitter.listenerCount('theme:updated')).toBe(1);
      expect(emitter.listenerCount('user:login')).toBe(0);
    });

    it('should count once() listeners', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.once('file:changed', () => {});
      emitter.on('file:changed', () => {});

      expect(emitter.listenerCount('file:changed')).toBe(2);

      emitter.emit('file:changed', { path: '/test.txt' });

      expect(emitter.listenerCount('file:changed')).toBe(1);
    });

    it('should return 0 after off() is called', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      emitter.on('file:changed', () => {});
      emitter.on('file:changed', () => {});

      expect(emitter.listenerCount('file:changed')).toBe(2);

      emitter.off('file:changed');

      expect(emitter.listenerCount('file:changed')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle same handler registered multiple times', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      emitter.on('counter:increment', handler);
      emitter.on('counter:increment', handler);

      emitter.emit('counter:increment', 42);

      // Implementation uses Set internally, so same handler reference is only stored once
      // This prevents memory leaks from accidental double-registration
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle unsubscribe called multiple times', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler = vi.fn();

      const unsubscribe = emitter.on('file:changed', handler);

      unsubscribe();
      unsubscribe(); // Should not throw
      unsubscribe();

      emitter.emit('file:changed', { path: '/test.txt' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle handler that throws error', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const throwingHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      emitter.on('counter:increment', throwingHandler);
      emitter.on('counter:increment', normalHandler);

      // First handler throws, but second should still be called
      expect(() => emitter.emit('counter:increment', 42)).toThrow('Handler error');
      expect(throwingHandler).toHaveBeenCalled();
      // Note: normalHandler won't be called because forEach stops on error
    });

    it('should handle complex payload types', () => {
      type ComplexEvents = {
        'data:update': {
          id: string;
          nested: { value: number; items: string[] };
          optional?: boolean;
        };
      };

      const emitter = new TypedEventEmitter<ComplexEvents>();
      const handler = vi.fn();

      emitter.on('data:update', handler);

      const payload = {
        id: 'test-123',
        nested: { value: 42, items: ['a', 'b', 'c'] },
        optional: true,
      };

      emitter.emit('data:update', payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });
  });

  describe('real-world usage patterns', () => {
    it('should simulate file watcher pattern', () => {
      type FileEvents = {
        'file:created': { path: string; timestamp: number };
        'file:modified': { path: string; timestamp: number };
        'file:deleted': { path: string };
      };

      const fileWatcher = new TypedEventEmitter<FileEvents>();
      const createdFiles: string[] = [];
      const modifiedFiles: string[] = [];
      const deletedFiles: string[] = [];

      fileWatcher.on('file:created', ({ path }) => createdFiles.push(path));
      fileWatcher.on('file:modified', ({ path }) => modifiedFiles.push(path));
      fileWatcher.on('file:deleted', ({ path }) => deletedFiles.push(path));

      fileWatcher.emit('file:created', { path: '/test.txt', timestamp: Date.now() });
      fileWatcher.emit('file:modified', { path: '/test.txt', timestamp: Date.now() });
      fileWatcher.emit('file:deleted', { path: '/test.txt' });

      expect(createdFiles).toEqual(['/test.txt']);
      expect(modifiedFiles).toEqual(['/test.txt']);
      expect(deletedFiles).toEqual(['/test.txt']);
    });

    it('should simulate app lifecycle events', () => {
      type AppEvents = {
        'app:init': void;
        'app:ready': void;
        'app:shutdown': void;
      };

      const app = new TypedEventEmitter<AppEvents>();
      const lifecycle: string[] = [];

      app.on('app:init', () => lifecycle.push('init'));
      app.on('app:ready', () => lifecycle.push('ready'));
      app.on('app:shutdown', () => lifecycle.push('shutdown'));

      app.emit('app:init', undefined);
      app.emit('app:ready', undefined);
      app.emit('app:shutdown', undefined);

      expect(lifecycle).toEqual(['init', 'ready', 'shutdown']);
    });

    it('should simulate cleanup on shutdown', () => {
      const emitter = new TypedEventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on('file:changed', handler1);
      emitter.on('theme:updated', handler2);
      emitter.on('user:login', handler3);

      expect(emitter.listenerCount('file:changed')).toBe(1);
      expect(emitter.listenerCount('theme:updated')).toBe(1);
      expect(emitter.listenerCount('user:login')).toBe(1);

      // Cleanup all listeners
      emitter.off();

      expect(emitter.listenerCount('file:changed')).toBe(0);
      expect(emitter.listenerCount('theme:updated')).toBe(0);
      expect(emitter.listenerCount('user:login')).toBe(0);
    });
  });
});
