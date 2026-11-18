import { describe, expect, it } from 'vitest';

import { usageTimeRangeStart } from './usage-time-range';

describe('usageTimeRangeStart', () => {
  const wednesdayEvening = new Date(2026, 10, 18, 21, 30, 0);

  it('starts today at local midnight', () => {
    expect(usageTimeRangeStart('day', wednesdayEvening)).toEqual(new Date(2026, 10, 18));
  });

  it('starts the week on the local Sunday', () => {
    expect(usageTimeRangeStart('week', wednesdayEvening)).toEqual(new Date(2026, 10, 15));
  });

  it('starts the month on the first', () => {
    expect(usageTimeRangeStart('month', wednesdayEvening)).toEqual(new Date(2026, 10, 1));
  });

  it('keeps all-time at the epoch', () => {
    expect(usageTimeRangeStart('all', wednesdayEvening)).toEqual(new Date(0));
  });
});
