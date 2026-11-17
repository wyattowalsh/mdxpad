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
