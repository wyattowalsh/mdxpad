import type { QueryUsageResponseSchemaType } from '@shared/ai/schemas';
import type { TimeRange, UsageStats } from '@shared/ai/types';

type UsageQueryStats = NonNullable<QueryUsageResponseSchemaType['stats']>;

export function usageStatsFromQuery(timeRange: TimeRange, stats: UsageQueryStats): UsageStats {
  const byProvider: UsageStats['byProvider'] = {};
  for (const provider of stats.byProvider) {
    byProvider[provider.providerId] = {
      providerId: provider.providerId,
      requestCount: provider.requestCount,
      totalTokens: provider.tokenCount,
      estimatedCostUsd: provider.estimatedCostUsd,
    };
  }

  const byModel: UsageStats['byModel'] = {};
  for (const model of stats.byModel) {
    byModel[model.modelId] = {
      modelId: model.modelId,
      providerId: model.providerId,
      requestCount: model.requestCount,
      totalTokens: model.tokenCount,
      estimatedCostUsd: model.estimatedCostUsd,
    };
  }

  const byOperation: UsageStats['byOperation'] = {};
  for (const operation of stats.byOperation) {
    byOperation[operation.operationType] = {
      operationType: operation.operationType,
      requestCount: operation.requestCount,
      avgDurationMs: operation.avgDurationMs,
    };
  }

  return {
    timeRange,
    totalRequests: stats.totalRequests,
    successfulRequests: stats.successfulRequests,
    failedRequests: stats.failedRequests,
    totalTokens: stats.totalTokens,
    inputTokens: stats.inputTokens,
    outputTokens: stats.outputTokens,
    estimatedCostUsd: stats.estimatedCostUsd,
    avgDurationMs: stats.avgDurationMs,
    byProvider,
    byModel,
    byOperation,
  };
}
