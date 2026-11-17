import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { UsageStats as UsageStatsType } from '@shared/ai/types';

import { UsageStats } from './UsageStats';

function stats(): UsageStatsType {
  return {
    timeRange: 'week',
    totalRequests: 3,
    successfulRequests: 2,
    failedRequests: 1,
    totalTokens: 1500,
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCostUsd: 0.02,
    avgDurationMs: 40,
    byProvider: {
      anthropic: {
        providerId: 'anthropic',
        requestCount: 2,
        totalTokens: 1200,
        estimatedCostUsd: 0.015,
      },
    },
    byModel: {
      'claude-test': {
        modelId: 'claude-test',
        providerId: 'anthropic',
        requestCount: 2,
        totalTokens: 1200,
        estimatedCostUsd: 0.015,
      },
    },
    byOperation: {
      'text-generation': {
        operationType: 'text-generation',
        requestCount: 3,
        avgDurationMs: 40,
      },
    },
  };
}

describe('UsageStats', () => {
  it('shows provider, model, and operation totals', () => {
    render(<UsageStats stats={stats()} timeRange="week" onTimeRangeChange={() => undefined} />);

    expect(screen.getByText('By provider')).toBeTruthy();
    expect(screen.getByText('anthropic')).toBeTruthy();
    expect(screen.getByText('By model')).toBeTruthy();
    expect(screen.getByText('claude-test')).toBeTruthy();
    expect(screen.getByText('By operation')).toBeTruthy();
    expect(screen.getByText('text-generation')).toBeTruthy();
  });
});
