/**
 * Tests for MDX compilation logic.
 *
 * Tests the core compilation functions extracted from the MDX Web Worker.
 * These functions handle MDX parsing, frontmatter extraction, and error handling.
 *
 * @module renderer/__tests__/mdx-worker.test
 */

import { describe, it, expect, vi } from 'vitest';
import type { RequestId } from '@shared/types/preview-worker';
import {
  compileMdx,
  extractError,
  extractUnknownError,
  sanitizeFrontmatter,
  MAX_SOURCE_SIZE,
  type VFileDiagnostic,
} from '../lib/mdx/compile';

/** Helper to create a test RequestId */
const testId = (id: string): RequestId => id as RequestId;

describe('compileMdx', () => {
  describe('empty source handling', () => {
    it('should return success with empty code for empty source', async () => {
      const result = await compileMdx(testId('test-id'), '');

      expect(result.id).toBe('test-id');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.code).toBe('');
        expect(result.frontmatter).toEqual({});
      }
    });
  });

  describe('source size limits', () => {
    it('should return size limit error for large source', async () => {
      // Create a source that exceeds the limit
      const largeSource = 'x'.repeat(MAX_SOURCE_SIZE + 1);
      const result = await compileMdx(testId('test-id'), largeSource);

      expect(result.id).toBe('test-id');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        const firstError = result.errors[0];
        expect(firstError).toBeDefined();
        expect(firstError!.message).toContain('Document too large');
        expect(firstError!.message).toContain(
          (MAX_SOURCE_SIZE + 1).toLocaleString()
        );
        expect(firstError!.message).toContain(
          MAX_SOURCE_SIZE.toLocaleString()
        );
      }
    });

    it('should accept source at exactly the size limit', async () => {
      // Create valid MDX at exactly the limit
      const source = '# Hello\n' + 'x'.repeat(MAX_SOURCE_SIZE - 9);
      const result = await compileMdx(testId('test-id'), source);

      // Should not fail due to size limit
      if (!result.ok) {
        const firstError = result.errors[0];
        expect(firstError).toBeDefined();
        expect(firstError!.message).not.toContain('Document too large');
      }
    });
  });

  describe('valid MDX compilation', () => {
    it('should compile simple MDX successfully', async () => {
      const source = '# Hello World\n\nThis is MDX content.';
      const result = await compileMdx(testId('test-id'), source);

      expect(result.id).toBe('test-id');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.code).toBeTruthy();
        expect(result.code).toContain('_jsx');
        expect(result.frontmatter).toEqual({});
      }
    });

    it('should compile MDX with JSX elements', async () => {
      const source = `# Title

<div className="test">JSX content</div>

More markdown.`;
      const result = await compileMdx(testId('test-id'), source);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.code).toBeTruthy();
      }
    });

    it('should compile MDX with GFM extensions', async () => {
      const source = `# GFM Features

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |

- [x] Task 1
- [ ] Task 2

~~strikethrough~~
`;
      const result = await compileMdx(testId('test-id'), source);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.code).toBeTruthy();
      }
    });
  });

  describe('frontmatter extraction', () => {
    it('should extract and serialize frontmatter', async () => {
      const source = `---
title: Test Document
author: Test Author
tags:
  - one
  - two
count: 42
---

# Content`;
      const result = await compileMdx(testId('test-id'), source);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.frontmatter).toEqual({
          title: 'Test Document',
          author: 'Test Author',
          tags: ['one', 'two'],
          count: 42,
        });
      }
    });

    it('should handle empty frontmatter', async () => {
      const source = `---
---

# Content`;
      const result = await compileMdx(testId('test-id'), source);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.frontmatter).toEqual({});
      }
    });

    it('should handle MDX without frontmatter', async () => {
      const source = '# No frontmatter\n\nJust content.';
      const result = await compileMdx(testId('test-id'), source);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.frontmatter).toEqual({});
      }
    });
  });

  describe('syntax error handling', () => {
    it('should capture syntax errors with position info', async () => {
      // Invalid JSX that should cause a parse error
      const source = `# Title

<div>
  <span>Unclosed span
</div>`;
      const result = await compileMdx(testId('test-id'), source);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        const firstError = result.errors[0];
        expect(firstError).toBeDefined();
        expect(firstError!.message).toBeTruthy();
      }
    });

    it('should handle malformed frontmatter', async () => {
      const source = `---
title: "unclosed string
---

# Content`;
      const result = await compileMdx(testId('test-id'), source);

      // May succeed or fail depending on how parser handles it
      expect(result.id).toBe('test-id');
      expect(typeof result.ok).toBe('boolean');
    });

    it('should handle invalid JSX expression', async () => {
      const source = `# Title

{this is not valid}`;
      const result = await compileMdx(testId('test-id'), source);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
        const firstError = result.errors[0];
        expect(firstError).toBeDefined();
        expect(firstError!.message).toBeTruthy();
      }
    });
  });
});

describe('extractError', () => {
  it('should extract message from diagnostic', () => {
    const diagnostic: VFileDiagnostic = {
      message: 'Test error message',
    };

    const error = extractError(diagnostic);

    expect(error.message).toBe('Test error message');
    expect(error.line).toBeUndefined();
    expect(error.column).toBeUndefined();
    expect(error.source).toBeUndefined();
  });

  it('should extract line and column when present', () => {
    const diagnostic: VFileDiagnostic = {
      message: 'Error at position',
      line: 5,
      column: 10,
    };

    const error = extractError(diagnostic);

    expect(error.message).toBe('Error at position');
    expect(error.line).toBe(5);
    expect(error.column).toBe(10);
  });

  it('should extract source when present', () => {
    const diagnostic: VFileDiagnostic = {
      message: 'Parse error',
      source: 'mdx-parse',
    };

    const error = extractError(diagnostic);

    expect(error.source).toBe('mdx-parse');
  });

  it('should handle null values as undefined', () => {
    const diagnostic: VFileDiagnostic = {
      message: 'Error',
      line: null,
      column: null,
      source: null,
    };

    const error = extractError(diagnostic);

    expect(error.line).toBeUndefined();
    expect(error.column).toBeUndefined();
    expect(error.source).toBeUndefined();
  });

  it('should handle undefined values', () => {
    const diagnostic: VFileDiagnostic = {
      message: 'Error',
      line: undefined,
      column: undefined,
      source: undefined,
    };

    const error = extractError(diagnostic);

    expect(error.line).toBeUndefined();
    expect(error.column).toBeUndefined();
    expect(error.source).toBeUndefined();
  });
});

describe('extractUnknownError', () => {
  it('should extract message from Error instance', () => {
    const error = new Error('Test error');
    const result = extractUnknownError(error);

    expect(result.message).toBe('Test error');
  });

  it('should extract position info from VFile-like error', () => {
    const error = Object.assign(new Error('Parse error'), {
      line: 10,
      column: 5,
      source: 'mdx',
    });

    const result = extractUnknownError(error);

    expect(result.message).toBe('Parse error');
    expect(result.line).toBe(10);
    expect(result.column).toBe(5);
    expect(result.source).toBe('mdx');
  });

  it('should handle Error with null position values', () => {
    const error = Object.assign(new Error('Error'), {
      line: null,
      column: null,
      source: null,
    });

    const result = extractUnknownError(error);

    expect(result.message).toBe('Error');
    expect(result.line).toBeUndefined();
    expect(result.column).toBeUndefined();
    expect(result.source).toBeUndefined();
  });

  it('should convert string to message', () => {
    const result = extractUnknownError('string error');

    expect(result.message).toBe('string error');
  });

  it('should convert number to string message', () => {
    const result = extractUnknownError(42);

    expect(result.message).toBe('42');
  });

  it('should convert object to string message', () => {
    const result = extractUnknownError({ custom: 'error' });

    expect(result.message).toBe('[object Object]');
  });

  it('should handle null', () => {
    const result = extractUnknownError(null);

    expect(result.message).toBe('null');
  });

  it('should handle undefined', () => {
    const result = extractUnknownError(undefined);

    expect(result.message).toBe('undefined');
  });
});

describe('sanitizeFrontmatter', () => {
  it('should pass through serializable frontmatter', () => {
    const frontmatter = {
      title: 'Test',
      count: 42,
      tags: ['a', 'b'],
      nested: { key: 'value' },
    };

    const result = sanitizeFrontmatter(frontmatter);

    expect(result).toEqual(frontmatter);
  });

  it('should handle empty object', () => {
    const result = sanitizeFrontmatter({});

    expect(result).toEqual({});
  });

  it('should fall back to empty object for non-serializable values', () => {
    // Spy on console.warn to verify warning is logged
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create object with circular reference (non-serializable)
    const circular: Record<string, unknown> = { name: 'test' };
    circular.self = circular;

    const result = sanitizeFrontmatter(circular);

    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      '[MDX Worker] Frontmatter contains non-serializable values:',
      expect.any(Error)
    );

    warnSpy.mockRestore();
  });

  it('should handle object with function (non-serializable)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const frontmatter = {
      title: 'Test',
      callback: () => {},
    };

    const result = sanitizeFrontmatter(frontmatter);

    // Functions are stripped by JSON.stringify, so this should work
    expect(result).toEqual({ title: 'Test' });

    warnSpy.mockRestore();
  });

  it('should handle object with undefined values', () => {
    const frontmatter = {
      title: 'Test',
      empty: undefined,
    };

    const result = sanitizeFrontmatter(frontmatter);

    // undefined values are stripped by JSON.stringify
    expect(result).toEqual({ title: 'Test' });
  });

  it('should handle object with BigInt (non-serializable)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const frontmatter = {
      title: 'Test',
      bigNumber: BigInt(9007199254740991),
    };

    const result = sanitizeFrontmatter(frontmatter);

    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should preserve Date as ISO string', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const frontmatter = {
      publishedAt: date,
    };

    const result = sanitizeFrontmatter(frontmatter);

    // Date is serialized to ISO string by JSON.stringify
    expect(result).toEqual({
      publishedAt: '2024-01-15T12:00:00.000Z',
    });
  });
});

describe('MAX_SOURCE_SIZE constant', () => {
  it('should be 500,000 characters', () => {
    expect(MAX_SOURCE_SIZE).toBe(500_000);
  });
});
