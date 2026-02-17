/**
 * AI Usage Statistics IPC Handlers
 *
 * Handles usage query, export, and clear operations for AI usage tracking.
 *
 * @module src/main/ipc/ai-usage-handlers
 */

import { ipcMain } from 'electron';

import { AIChannels } from '@shared/ai/ipc-channels';
import * as schemas from '@shared/ai/schemas';
import type { AIServices } from '@main/services/ai';
import type { UsageQuery } from '@main/services/ai';

import { toErrorResponse, filterUndefined } from './ai-handler-utils';

// =============================================================================
// REQUEST BUILDERS
// =============================================================================

/**
 * Builds a usage query filtering out undefined values.
 */
function buildUsageQuery(request: {
  timeRange: 'day' | 'week' | 'month' | 'all';
  providerId?: string | undefined;
  operationType?: 'text-generation' | 'streaming-generation' | 'embedding' | 'image-generation' | 'agent-execution' | undefined;
}): UsageQuery {
  return filterUndefined(request) as UsageQuery;
}

// =============================================================================
// HANDLER IMPLEMENTATIONS
// =============================================================================

/**
 * Handles USAGE_QUERY: Query usage statistics.
 */
async function handleUsageQuery(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.QueryUsageResponseSchemaType> {
  try {
    const request = schemas.QueryUsageRequestSchema.parse(rawRequest);
    const stats = await services.usageService.queryStats(
      buildUsageQuery(request)
    );

    return schemas.QueryUsageResponseSchema.parse({
      success: true,
      stats: {
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        totalTokens: stats.totalTokens,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        estimatedCostUsd: stats.estimatedCostUsd,
        byProvider: Object.values(stats.byProvider).map((p) => ({
          providerId: p.providerId,
          providerName: p.providerId, // Use providerId as name for now
          requestCount: p.requestCount,
          tokenCount: p.totalTokens,
          estimatedCostUsd: p.estimatedCostUsd,
        })),
        byOperation: buildOperationStats(),
      },
    });
  } catch (error) {
    console.error('[AI] Failed to query usage stats:', error);
    return schemas.QueryUsageResponseSchema.parse({ success: false });
  }
}

/**
 * Builds operation stats from usage stats.
 * TODO: Implement real operation stats aggregation when usage data model supports it
 */
function buildOperationStats(): schemas.OperationUsageStatSchemaType[] {
  return [];
}

/**
 * Handles USAGE_EXPORT: Export usage data.
 */
async function handleUsageExport(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ExportUsageResponseSchemaType> {
  try {
    const request = schemas.ExportUsageRequestSchema.parse(rawRequest);
    const format = request.format ?? 'json';
    const data = await services.usageService.exportData(
      request.timeRange,
      format
    );

    const filename = `mdxpad-usage-${request.timeRange}-${Date.now()}.${format}`;

    return schemas.ExportUsageResponseSchema.parse({
      success: true,
      data,
      filename,
    });
  } catch (error) {
    return schemas.ExportUsageResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles USAGE_CLEAR: Clear usage history.
 */
async function handleUsageClear(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ClearUsageResponseSchemaType> {
  try {
    const request = schemas.ClearUsageRequestSchema.parse(rawRequest);
    const beforeDate = request.olderThan
      ? new Date(request.olderThan)
      : undefined;

    await services.usageService.clearHistory(beforeDate);

    return schemas.ClearUsageResponseSchema.parse({
      success: true,
      deletedCount: 0, // UsageService doesn't return count
    });
  } catch (error) {
    return schemas.ClearUsageResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Registers all usage statistics IPC handlers.
 */
export function registerUsageHandlers(services: AIServices): void {
  ipcMain.handle(AIChannels.USAGE_QUERY, (_, request) =>
    handleUsageQuery(services, request)
  );
  ipcMain.handle(AIChannels.USAGE_EXPORT, (_, request) =>
    handleUsageExport(services, request)
  );
  ipcMain.handle(AIChannels.USAGE_CLEAR, (_, request) =>
    handleUsageClear(services, request)
  );
}
