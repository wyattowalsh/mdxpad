/** A dollar span that is a price, such as `$5` or `$5 and $10`, rather than a formula. */
export function isCurrencySpan(value: string): boolean {
  const trimmed = value.trim();
  if (!/\d/.test(trimmed)) {
    return false;
  }
  if (/^[\d\s.,:;]+$/.test(trimmed)) {
    return true;
  }
  return /\s/.test(value) && /[A-Za-z]{2,}/.test(trimmed) && !/[\\^_{}=+*/<>]/.test(value);
}
