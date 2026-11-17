import { describe, expect, it } from 'vitest';

import { usageStatsFromQuery } from './usage-stats-map';

describe('usageStatsFromQuery', () => {
  it('keeps provider, model, and operation breakdowns', () => {
    const stats = usageStatsFromQuery('week', {
      totalRequests: 2,
      successfulRequests: 2,
      failedRequests: 0,
      totalTokens: 30,
      inputTokens: 10,
      outputTokens: 20,
      estimatedCostUsd: 0.02,
      byProvider: [
        {
          providerId: 'openai',
          providerName: 'openai',
          requestCount: 2,
          tokenCount: 30,
          estimatedCostUsd: 0.02,
        },
      ],
      byModel: [
        {
          modelId: 'gpt-4o',
          providerId: 'openai',
          requestCount: 2,
          tokenCount: 30,
          estimatedCostUsd: 0.02,
        },
      ],
      byOperation: [
        {
          operationType: 'text-generation',
          requestCount: 2,
          avgDurationMs: 40,
        },
      ],
    });

    expect(stats.byProvider.openai?.requestCount).toBe(2);
    expect(stats.byModel['gpt-4o']?.totalTokens).toBe(30);
    expect(stats.byOperation['text-generation']?.requestCount).toBe(2);
    expect(stats.avgDurationMs).toBe(40);
  });
});
