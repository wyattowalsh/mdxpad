/**
 * Unit tests for Embedding Service - chunkText function.
 */

import { describe, it, expect } from 'vitest';
import { chunkText } from './embedding-service';

describe('chunkText', () => {
  it('should return single chunk for short text', () => {
    const text = 'Hello world';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello world');
  });

  it('should return single chunk for text exactly at chunk size', () => {
    const text = 'a'.repeat(1000);
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(1000);
  });

  it('should split text longer than chunk size', () => {
    const text = 'a'.repeat(1500);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should produce overlapping chunks', () => {
    // With CHUNK_SIZE=1000 and CHUNK_OVERLAP=200
    const text = 'a'.repeat(1200);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);

    // Second chunk should start 800 chars in (1000 - 200 overlap)
    // so it captures some of what the first chunk covered
    const first = chunks[0];
    const second = chunks[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.length).toBe(1000);
    expect(second!.length).toBe(400); // 1200 - 800
  });

  it('should handle empty text', () => {
    const chunks = chunkText('');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('');
  });

  it('should handle very long text', () => {
    const text = 'word '.repeat(1000); // ~5000 chars
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    // All chunks should be non-empty
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
    }
  });
});
