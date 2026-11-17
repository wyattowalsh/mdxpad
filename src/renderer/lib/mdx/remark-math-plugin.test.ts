import { describe, expect, it } from 'vitest';

import type { RequestId } from '@shared/types/preview-worker';

import { compileMdx } from './compile';

const testId = (id: string): RequestId => id as RequestId;

describe('remark math prices', () => {
  it('leaves a price out of KaTeX', async () => {
    const result = await compileMdx(testId('price'), 'It costs $5 and $10 today.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).not.toContain('katex');
    }
  });

  it('keeps a live expression that contains a colon', async () => {
    const result = await compileMdx(testId('mdx-live'), '{css({ color: "red" })}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('color');
    }
  });

  it('compiles a comparison and a JSON sample', async () => {
    const result = await compileMdx(testId('mdx-json'), 'Compare a <= b and JSON {"a": 1}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('Compare');
      expect(result.code).toContain('JSON');
    }
  });

  it('compiles an autolink and a generic type', async () => {
    const result = await compileMdx(
      testId('mdx-autolink'),
      'See <https://example.com> and List<T> and <Card>Hi</Card>'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('https://example.com');
      expect(result.code).toContain('List');
      expect(result.code).toContain('Card');
    }
  });

  it('compiles a markdown comment and a line break', async () => {
    const result = await compileMdx(testId('mdx-html'), 'See <!-- secret --> this.<br>Next');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('this.');
      expect(result.code).toContain('Next');
      expect(result.code).not.toContain('secret');
    }
  });

  it('renders a TeX inline formula', async () => {
    const result = await compileMdx(testId('tex-inline'), 'The area is \\(x^2\\).');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('katex');
      expect(result.code).not.toContain('\\(x^2\\)');
    }
  });

  it('keeps a real formula', async () => {
    const result = await compileMdx(testId('formula'), 'The area is $x^2$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('katex');
    }
  });

  it('keeps a formula that contains spaces', async () => {
    const result = await compileMdx(testId('spaced'), 'The sum is $a + b$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('katex');
    }
  });
});
