import { describe, expect, it } from 'vitest';

import { isCurrencySpan } from './currency-span';

describe('isCurrencySpan', () => {
  it('treats a number and a price phrase as currency', () => {
    expect(isCurrencySpan('5')).toBe(true);
    expect(isCurrencySpan('5 and $10')).toBe(true);
    expect(isCurrencySpan('100 dollars')).toBe(true);
  });

  it('keeps a formula that is only words', () => {
    expect(isCurrencySpan('n and m')).toBe(false);
    expect(isCurrencySpan('a + b')).toBe(false);
    expect(isCurrencySpan('x^2')).toBe(false);
  });
});
