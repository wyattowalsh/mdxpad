import type { TimeRange } from '@shared/ai/types';

/**
 * Start of the period shown in usage stats.
 * Today starts at local midnight, the week starts on Sunday, and the month
 * starts on the first.
 */
export function usageTimeRangeStart(timeRange: TimeRange, now = new Date()): Date {
  switch (timeRange) {
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start.setDate(start.getDate() - start.getDay());
      return start;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'all':
      return new Date(0);
    default: {
      const unreachable: never = timeRange;
      throw new Error(`Unknown usage time range: ${String(unreachable)}`);
    }
  }
}
