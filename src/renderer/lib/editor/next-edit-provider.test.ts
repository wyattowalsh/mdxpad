import { describe, expect, it } from 'vitest';

import { predictionContext, sanitizePrediction } from './next-edit-provider';

describe('predictionContext', () => {
  it('returns null when there is no text before the cursor', () => {
    expect(predictionContext('   ', 3)).toBeNull();
  });

  it('keeps a short window around the cursor', () => {
    const text = `${'a'.repeat(500)}|after`;
    const context = predictionContext(text, 500);
    expect(context?.before).toHaveLength(400);
    expect(context?.after).toBe('|after');
  });
});

describe('sanitizePrediction', () => {
  it('keeps the first line and drops extra length', () => {
    expect(sanitizePrediction(`  hello\nworld  `)).toBe('hello');
    expect(sanitizePrediction('x'.repeat(120))).toHaveLength(80);
  });

  it('returns null for blank text', () => {
    expect(sanitizePrediction('  \n  ')).toBeNull();
    expect(sanitizePrediction(undefined)).toBeNull();
  });
});
