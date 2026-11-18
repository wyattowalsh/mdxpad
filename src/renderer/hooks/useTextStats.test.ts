/**
 * useTextStats Hook Tests
 *
 * Tests for text statistics hook that subscribes to document store.
 *
 * @module renderer/hooks/useTextStats.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTextStats } from './useTextStats';

describe('useTextStats', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
  });

  it('should return zero stats for empty document', () => {
    const { result } = renderHook(() => useTextStats());

    expect(result.current.wordCount).toBe(0);
    expect(result.current.charCount).toBe(0);
    expect(result.current.readingTime.minutes).toBe(0);
    expect(result.current.readingTime.seconds).toBe(0);
  });

  it('should update stats when content changes', () => {
    const { result } = renderHook(() => useTextStats());

    act(() => {
      useDocumentStore.getState().setContent('hello world foo bar');
    });

    expect(result.current.wordCount).toBe(4);
    expect(result.current.charCount).toBe(16);
  });

  it('does not count frontmatter keys as words', () => {
    const { result } = renderHook(() => useTextStats());

    act(() => {
      useDocumentStore.getState().setContent('---\ntitle: Notes\n---\n\nHello world');
    });

    expect(result.current.wordCount).toBe(2);
  });

  it('does not count a fenced sample as reading time', () => {
    const { result } = renderHook(() => useTextStats());

    act(() => {
      useDocumentStore.getState().setContent('# Hello\n\n```\nconst secret = 1\n```\n\nworld');
    });

    expect(result.current.wordCount).toBe(2);
  });

  it('should compute reading time', () => {
    const { result } = renderHook(() => useTextStats());

    // 200 words for exactly 1 minute
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    act(() => {
      useDocumentStore.getState().setContent(words);
    });

    expect(result.current.readingTime.minutes).toBe(1);
    expect(result.current.readingTime.seconds).toBe(0);
  });
});
