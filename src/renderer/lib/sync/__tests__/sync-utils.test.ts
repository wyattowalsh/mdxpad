/**
 * Tests for sync utilities: position-cache, position-mapper, scroll-lock.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createPositionCache } from '../position-cache';
import { createPositionMapper, findNearestHeading } from '../position-mapper';
import { createScrollLock } from '../scroll-lock';
import type { PositionMapping } from '@shared/types/sync';

describe('position-cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should store and retrieve mappings', () => {
    const cache = createPositionCache({ ttl: 1000 });
    const mapping: PositionMapping = {
      editorLine: 10,
      previewScrollTop: 500,
      confidence: 'high',
      timestamp: Date.now(),
    };

    cache.set(10, mapping);

    expect(cache.get(10)).toEqual(mapping);
    expect(cache.has(10)).toBe(true);
    expect(cache.size()).toBe(1);
  });

  it('should return null for non-existent entries', () => {
    const cache = createPositionCache({ ttl: 1000 });
    expect(cache.get(99)).toBeNull();
    expect(cache.has(99)).toBe(false);
  });

  it('should expire entries after TTL', () => {
    const cache = createPositionCache({ ttl: 1000 });
    const mapping: PositionMapping = {
      editorLine: 5,
      previewScrollTop: 200,
      confidence: 'medium',
      timestamp: Date.now(),
    };

    cache.set(5, mapping);

    vi.advanceTimersByTime(1001);

    expect(cache.get(5)).toBeNull();
    expect(cache.has(5)).toBe(false);
  });

  it('should call onExpire callback when entry expires', () => {
    const onExpire = vi.fn();
    const cache = createPositionCache({ ttl: 500, onExpire });
    const mapping: PositionMapping = {
      editorLine: 3,
      previewScrollTop: 100,
      confidence: 'low',
      timestamp: Date.now(),
    };

    cache.set(3, mapping);
    vi.advanceTimersByTime(600);

    cache.get(3);

    expect(onExpire).toHaveBeenCalledWith(3, mapping);
  });

  it('should invalidate specific entries', () => {
    const cache = createPositionCache({ ttl: 10000 });
    const mapping: PositionMapping = {
      editorLine: 1,
      previewScrollTop: 0,
      confidence: 'high',
      timestamp: Date.now(),
    };

    cache.set(1, mapping);
    expect(cache.has(1)).toBe(true);

    cache.invalidate(1);
    expect(cache.has(1)).toBe(false);
    expect(cache.get(1)).toBeNull();
  });

  it('should clear all entries', () => {
    const cache = createPositionCache({ ttl: 10000 });

    cache.set(1, { editorLine: 1, previewScrollTop: 0, confidence: 'high', timestamp: Date.now() });
    cache.set(2, {
      editorLine: 2,
      previewScrollTop: 100,
      confidence: 'medium',
      timestamp: Date.now(),
    });

    expect(cache.size()).toBe(2);

    cache.clear();

    expect(cache.size()).toBe(0);
    expect(cache.get(1)).toBeNull();
    expect(cache.get(2)).toBeNull();
  });

  it('should return entries map', () => {
    const cache = createPositionCache({ ttl: 10000 });
    const mapping: PositionMapping = {
      editorLine: 1,
      previewScrollTop: 0,
      confidence: 'high',
      timestamp: Date.now(),
    };

    cache.set(1, mapping);
    const entries = cache.entries();

    expect(entries.size).toBe(1);
    expect(entries.get(1)).toEqual(mapping);
  });

  it('should overwrite existing entries', () => {
    const cache = createPositionCache({ ttl: 10000 });
    const first: PositionMapping = {
      editorLine: 1,
      previewScrollTop: 0,
      confidence: 'low',
      timestamp: Date.now(),
    };
    const second: PositionMapping = {
      editorLine: 1,
      previewScrollTop: 100,
      confidence: 'high',
      timestamp: Date.now(),
    };

    cache.set(1, first);
    cache.set(1, second);

    expect(cache.get(1)).toEqual(second);
    expect(cache.size()).toBe(1);
  });
});

describe('position-mapper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('findNearestHeading', () => {
    it('should find exact match', () => {
      const lineMap = new Map([
        [5, { text: 'Heading', level: 1, position: { line: 5 } }],
        [10, { text: 'Another', level: 2, position: { line: 10 } }],
      ]);

      const result = findNearestHeading(5, lineMap);
      expect(result).toEqual({ text: 'Heading', level: 1, position: { line: 5 } });
    });

    it('should find nearest heading within tolerance', () => {
      const lineMap = new Map([[10, { text: 'Heading', level: 1, position: { line: 10 } }]]);

      const result = findNearestHeading(12, lineMap, 5);
      expect(result).toEqual({ text: 'Heading', level: 1, position: { line: 10 } });
    });

    it('should return null when no heading is within tolerance', () => {
      const lineMap = new Map([[10, { text: 'Heading', level: 1, position: { line: 10 } }]]);

      const result = findNearestHeading(20, lineMap, 5);
      expect(result).toBeNull();
    });

    it('should return null for empty map', () => {
      const result = findNearestHeading(5, new Map());
      expect(result).toBeNull();
    });
  });

  describe('createPositionMapper', () => {
    function createMapper() {
      const cache = createPositionCache({ ttl: 10000 });
      return createPositionMapper({ cache });
    }

    it('should return low confidence mapping with proportional fallback', () => {
      const mapper = createMapper();
      mapper.updateEditorLines(100);
      mapper.updatePreviewHeight(2000, 500);

      const result = mapper.editorToPreview(50);

      expect(result.confidence).toBe('low');
      expect(result.editorLine).toBe(50);
      expect(result.previewScrollTop).toBeGreaterThanOrEqual(0);
    });

    it('should return high confidence mapping when near a heading', () => {
      const mapper = createMapper();
      mapper.updateEditorLines(100);
      mapper.updatePreviewHeight(2000, 500);
      mapper.updateAST([
        { text: 'First', level: 1, position: { line: 1 } },
        { text: 'Middle', level: 2, position: { line: 50 } },
        { text: 'Last', level: 2, position: { line: 100 } },
      ]);

      const result = mapper.editorToPreview(50);

      expect(result.confidence).toBe('high');
      expect(result.editorLine).toBe(50);
    });

    it('should handle line < 1 gracefully', () => {
      const mapper = createMapper();
      const result = mapper.editorToPreview(0);

      expect(result.editorLine).toBe(1);
      expect(result.previewScrollTop).toBe(0);
      expect(result.confidence).toBe('low');
    });

    it('should use cache for repeated lookups', () => {
      const mapper = createMapper();
      mapper.updateEditorLines(100);
      mapper.updatePreviewHeight(2000, 500);

      const first = mapper.editorToPreview(50);
      const second = mapper.editorToPreview(50);

      expect(second).toEqual(first);
    });

    it('should map preview scroll to editor line', () => {
      const mapper = createMapper();
      mapper.updateEditorLines(100);
      mapper.updatePreviewHeight(2000, 500);

      const result = mapper.previewToEditor(750);

      expect(result.editorLine).toBeGreaterThanOrEqual(1);
      expect(result.editorLine).toBeLessThanOrEqual(100);
      expect(result.previewScrollTop).toBe(750);
    });

    it('should map preview scroll with headings to medium confidence', () => {
      const mapper = createMapper();
      mapper.updateEditorLines(100);
      mapper.updatePreviewHeight(2000, 500);
      mapper.updateAST([
        { text: 'First', level: 1, position: { line: 1 } },
        { text: 'Last', level: 2, position: { line: 100 } },
      ]);

      const result = mapper.previewToEditor(0);

      expect(result.confidence).toBe('medium');
    });

    it('should clear cache on AST update', () => {
      const cache = createPositionCache({ ttl: 10000 });
      const mapper = createPositionMapper({ cache });
      mapper.updateEditorLines(100);
      mapper.updatePreviewHeight(2000, 500);

      mapper.editorToPreview(50);
      expect(cache.size()).toBe(1);

      mapper.updateAST([]);
      expect(cache.size()).toBe(0);
    });

    it('should clear cache on significant preview height change', () => {
      const cache = createPositionCache({ ttl: 10000 });
      const mapper = createPositionMapper({ cache });
      mapper.updateEditorLines(100);
      mapper.updatePreviewHeight(2000, 500);

      mapper.editorToPreview(50);
      expect(cache.size()).toBe(1);

      mapper.updatePreviewHeight(3000, 500);
      expect(cache.size()).toBe(0);
    });

    it('should not clear cache on insignificant preview height change', () => {
      const cache = createPositionCache({ ttl: 10000 });
      const mapper = createPositionMapper({ cache });
      mapper.updateEditorLines(100);
      mapper.updatePreviewHeight(2000, 500);

      mapper.editorToPreview(50);
      expect(cache.size()).toBe(1);

      mapper.updatePreviewHeight(2005, 500);
      expect(cache.size()).toBe(1);
    });

    it('should reset all state', () => {
      const cache = createPositionCache({ ttl: 10000 });
      const mapper = createPositionMapper({ cache });
      mapper.updateEditorLines(100);
      mapper.updatePreviewHeight(2000, 500);
      mapper.updateAST([{ text: 'H', level: 1, position: { line: 1 } }]);

      mapper.editorToPreview(50);
      expect(cache.size()).toBeGreaterThan(0);

      mapper.reset();
      expect(cache.size()).toBe(0);
    });

    it('should interpolate between headings for medium confidence', () => {
      const mapper = createMapper();
      mapper.updateEditorLines(100);
      mapper.updatePreviewHeight(2000, 500);
      mapper.updateAST([
        { text: 'First', level: 1, position: { line: 1 } },
        { text: 'Last', level: 2, position: { line: 100 } },
      ]);

      // Line 50 is between headings at 1 and 100, tolerance 5 means no exact match
      const result = mapper.editorToPreview(50);

      expect(result.confidence).toBe('medium');
      expect(result.previewScrollTop).toBeGreaterThan(0);
    });
  });
});

describe('scroll-lock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('acquire', () => {
    it('should acquire lock when unlocked', () => {
      const lock = createScrollLock();
      const acquired = lock.acquire('editor');

      expect(acquired).toBe(true);
      expect(lock.isLocked()).toBe(true);
      expect(lock.getSource()).toBe('editor');
    });

    it('should not re-acquire for same source', () => {
      const lock = createScrollLock();
      lock.acquire('editor');

      const reacquired = lock.acquire('editor');

      expect(reacquired).toBe(false);
    });

    it('should break lock for different source', () => {
      const lock = createScrollLock();
      lock.acquire('editor');

      const acquired = lock.acquire('preview');

      expect(acquired).toBe(true);
      expect(lock.getSource()).toBe('preview');
    });
  });

  describe('release', () => {
    it('should release the lock', () => {
      const lock = createScrollLock();
      lock.acquire('editor');

      lock.release();

      expect(lock.isLocked()).toBe(false);
      expect(lock.getSource()).toBeNull();
    });
  });

  describe('auto-release', () => {
    it('should auto-release after lockDuration', () => {
      const lock = createScrollLock({ lockDuration: 100 });
      lock.acquire('editor');

      expect(lock.isLocked()).toBe(true);

      vi.advanceTimersByTime(100);

      expect(lock.isLocked()).toBe(false);
    });
  });

  describe('shouldIgnore', () => {
    it('should ignore scroll from same source when locked', () => {
      const lock = createScrollLock();
      lock.acquire('editor');

      expect(lock.shouldIgnore('editor')).toBe(true);
    });

    it('should not ignore scroll from different source when locked', () => {
      const lock = createScrollLock();
      lock.acquire('editor');

      expect(lock.shouldIgnore('preview')).toBe(false);
    });

    it('should not ignore any scroll when unlocked', () => {
      const lock = createScrollLock();

      expect(lock.shouldIgnore('editor')).toBe(false);
      expect(lock.shouldIgnore('preview')).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('should call onLockAcquired', () => {
      const onLockAcquired = vi.fn();
      const lock = createScrollLock({ onLockAcquired });

      lock.acquire('editor');

      expect(onLockAcquired).toHaveBeenCalledWith('editor');
    });

    it('should call onLockReleased', () => {
      const onLockReleased = vi.fn();
      const lock = createScrollLock({ onLockReleased });

      lock.acquire('editor');
      lock.release();

      expect(onLockReleased).toHaveBeenCalled();
    });

    it('should call onLockReleased on auto-release', () => {
      const onLockReleased = vi.fn();
      const lock = createScrollLock({ lockDuration: 50, onLockReleased });

      lock.acquire('editor');
      vi.advanceTimersByTime(50);

      expect(onLockReleased).toHaveBeenCalled();
    });
  });
});
