/**
 * UsageService - Tracks and reports AI usage statistics.
 *
 * This service provides persistence for usage records using electron-store,
 * with automatic pruning based on record age (90 days) and count (100K max).
 * Supports cost estimation using hardcoded pricing tables for cloud providers.
 *
 * @module main/services/ai/usage-service
 */

import Store from 'electron-store';
import { randomUUID } from 'node:crypto';

import type {
  UsageRecord,
  UsageStats,
  TimeRange,
  OperationType,
  ProviderUsageSummary,
  ModelUsageSummary,
} from '@shared/ai/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Query parameters for usage statistics.
 */
export interface UsageQuery {
  timeRange: TimeRange;
  providerId?: string;
  operationType?: OperationType;
}

/**
 * Schema for the electron-store instance.
 */
interface StoreSchema {
  records: UsageRecord[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum age of records in milliseconds (90 days) */
const MAX_RECORD_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** Maximum number of records to retain (FIFO pruning) */
const MAX_RECORDS = 100_000;

/** Pricing per 1K tokens (USD) */
const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  openai: {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'claude-3-5-haiku-20241022': { input: 0.001, output: 0.005 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  },
};

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Service interface for usage tracking.
 */
export interface IUsageService {
  recordUsage(record: Omit<UsageRecord, 'id' | 'timestamp'>): Promise<void>;
  queryStats(query: UsageQuery): Promise<UsageStats>;
  exportData(timeRange: TimeRange, format: 'json' | 'csv'): Promise<string>;
  clearHistory(beforeDate?: Date): Promise<void>;
  getEstimatedCost(providerId: string, timeRange: TimeRange): Promise<number>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Gets the start timestamp for a time range.
 */
function getTimeRangeStart(timeRange: TimeRange): Date {
  const now = new Date();
  switch (timeRange) {
    case 'day':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return new Date(0);
  }
}

/**
 * Filters records by time range.
 */
function filterByTimeRange(records: UsageRecord[], timeRange: TimeRange): UsageRecord[] {
  const startDate = getTimeRangeStart(timeRange);
  return records.filter((r) => new Date(r.timestamp) >= startDate);
}

/**
 * Filters records by optional query parameters.
 */
function filterByQuery(records: UsageRecord[], query: UsageQuery): UsageRecord[] {
  let filtered = filterByTimeRange(records, query.timeRange);
  if (query.providerId) {
    filtered = filtered.filter((r) => r.providerId === query.providerId);
  }
  if (query.operationType) {
    filtered = filtered.filter((r) => r.operationType === query.operationType);
  }
  return filtered;
}

/**
 * Calculates cost for a single record based on pricing tables.
 */
function calculateRecordCost(record: UsageRecord): number {
  const providerPricing = PRICING[record.providerId];
  if (!providerPricing) return 0;

  const modelPricing = providerPricing[record.modelId];
  if (!modelPricing) return 0;

  const inputCost = ((record.inputTokens ?? 0) / 1000) * modelPricing.input;
  const outputCost = ((record.outputTokens ?? 0) / 1000) * modelPricing.output;

  return inputCost + outputCost;
}

/**
 * Escapes a CSV field value.
 */
function escapeCSVField(value: string | number | boolean | undefined): string {
  if (value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts records to CSV format.
 */
function recordsToCSV(records: UsageRecord[]): string {
  const headers = [
    'id',
    'providerId',
    'modelId',
    'operationType',
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'durationMs',
    'success',
    'errorCode',
    'timestamp',
    'estimatedCostUsd',
  ];

  const headerLine = headers.join(',');
  const dataLines = records.map((r) =>
    [
      escapeCSVField(r.id),
      escapeCSVField(r.providerId),
      escapeCSVField(r.modelId),
      escapeCSVField(r.operationType),
      escapeCSVField(r.inputTokens),
      escapeCSVField(r.outputTokens),
      escapeCSVField(r.totalTokens),
      escapeCSVField(r.durationMs),
      escapeCSVField(r.success),
      escapeCSVField(r.errorCode),
      escapeCSVField(r.timestamp),
      escapeCSVField(r.estimatedCostUsd),
    ].join(',')
  );

  return [headerLine, ...dataLines].join('\n');
}

/**
 * Aggregates records by provider.
 */
function aggregateByProvider(
  records: UsageRecord[]
): Record<string, ProviderUsageSummary> {
  const byProvider: Record<string, ProviderUsageSummary> = {};

  for (const record of records) {
    let summary = byProvider[record.providerId];
    if (!summary) {
      summary = {
        providerId: record.providerId,
        requestCount: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      };
      byProvider[record.providerId] = summary;
    }
    summary.requestCount++;
    summary.totalTokens += record.totalTokens ?? 0;
    summary.estimatedCostUsd += record.estimatedCostUsd ?? calculateRecordCost(record);
  }

  return byProvider;
}

/**
 * Aggregates records by model.
 */
function aggregateByModel(records: UsageRecord[]): Record<string, ModelUsageSummary> {
  const byModel: Record<string, ModelUsageSummary> = {};

  for (const record of records) {
    let summary = byModel[record.modelId];
    if (!summary) {
      summary = {
        modelId: record.modelId,
        providerId: record.providerId,
        requestCount: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      };
      byModel[record.modelId] = summary;
    }
    summary.requestCount++;
    summary.totalTokens += record.totalTokens ?? 0;
    summary.estimatedCostUsd += record.estimatedCostUsd ?? calculateRecordCost(record);
  }

  return byModel;
}

// =============================================================================
// USAGE SERVICE CLASS
// =============================================================================

/**
 * Service for tracking AI usage and calculating costs.
 *
 * Provides methods to record usage, query statistics, export data, and
 * estimate costs. Records are automatically pruned based on age (90 days)
 * and count (100K max, FIFO).
 *
 * @example
 * ```typescript
 * const usageService = new UsageService();
 *
 * // Record usage
 * await usageService.recordUsage({
 *   providerId: 'openai',
 *   modelId: 'gpt-4o',
 *   operationType: 'text-generation',
 *   inputTokens: 100,
 *   outputTokens: 50,
 *   totalTokens: 150,
 *   durationMs: 1500,
 *   success: true,
 * });
 *
 * // Query statistics
 * const stats = await usageService.queryStats({ timeRange: 'week' });
 *
 * // Export data
 * const csv = await usageService.exportData('month', 'csv');
 * ```
 */
export class UsageService implements IUsageService {
  private readonly store: Store<StoreSchema>;

  /**
   * Creates a new UsageService instance.
   * Store is persisted at user's app data directory as 'mdxpad-usage.json'.
   */
  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'mdxpad-usage',
      defaults: {
        records: [],
      },
    });
  }

  /**
   * Records a usage event.
   * Automatically generates ID and timestamp, calculates cost,
   * and prunes old records if limits are exceeded.
   */
  async recordUsage(record: Omit<UsageRecord, 'id' | 'timestamp'>): Promise<void> {
    const fullRecord: UsageRecord = {
      ...record,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      estimatedCostUsd: record.estimatedCostUsd ?? calculateRecordCost(record as UsageRecord),
    };

    const records = this.store.get('records');
    records.push(fullRecord);

    const pruned = this.pruneRecords(records);
    this.store.set('records', pruned);
  }

  /**
   * Queries usage statistics based on time range and optional filters.
   */
  async queryStats(query: UsageQuery): Promise<UsageStats> {
    const records = this.store.get('records');
    const filtered = filterByQuery(records, query);

    return this.buildStats(filtered, query.timeRange);
  }

  /**
   * Exports raw usage data as JSON or CSV.
   */
  async exportData(timeRange: TimeRange, format: 'json' | 'csv'): Promise<string> {
    const records = this.store.get('records');
    const filtered = filterByTimeRange(records, timeRange);

    if (format === 'json') {
      return JSON.stringify(filtered, null, 2);
    }
    return recordsToCSV(filtered);
  }

  /**
   * Clears usage history. If beforeDate is provided, only clears older records.
   */
  async clearHistory(beforeDate?: Date): Promise<void> {
    if (!beforeDate) {
      this.store.set('records', []);
      return;
    }

    const records = this.store.get('records');
    const filtered = records.filter((r) => new Date(r.timestamp) >= beforeDate);
    this.store.set('records', filtered);
  }

  /**
   * Gets estimated cost for a specific provider within a time range.
   */
  async getEstimatedCost(providerId: string, timeRange: TimeRange): Promise<number> {
    const records = this.store.get('records');
    const filtered = filterByTimeRange(records, timeRange).filter(
      (r) => r.providerId === providerId
    );

    return filtered.reduce(
      (sum, r) => sum + (r.estimatedCostUsd ?? calculateRecordCost(r)),
      0
    );
  }

  /**
   * Prunes records based on age and count limits.
   * Removes records older than 90 days and enforces 100K max (FIFO).
   */
  private pruneRecords(records: UsageRecord[]): UsageRecord[] {
    const cutoffDate = new Date(Date.now() - MAX_RECORD_AGE_MS);

    // Remove records older than 90 days
    let pruned = records.filter((r) => new Date(r.timestamp) >= cutoffDate);

    // Enforce max record count (FIFO - remove oldest first)
    if (pruned.length > MAX_RECORDS) {
      pruned = pruned.slice(pruned.length - MAX_RECORDS);
    }

    return pruned;
  }

  /**
   * Builds aggregated statistics from filtered records.
   */
  private buildStats(records: UsageRecord[], timeRange: TimeRange): UsageStats {
    const successfulRecords = records.filter((r) => r.success);
    const failedRecords = records.filter((r) => !r.success);

    const totalInputTokens = records.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0);
    const totalOutputTokens = records.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0);
    const totalTokens = records.reduce((sum, r) => sum + (r.totalTokens ?? 0), 0);
    const totalCost = records.reduce(
      (sum, r) => sum + (r.estimatedCostUsd ?? calculateRecordCost(r)),
      0
    );
    const totalDuration = records.reduce((sum, r) => sum + r.durationMs, 0);

    return {
      timeRange,
      totalRequests: records.length,
      successfulRequests: successfulRecords.length,
      failedRequests: failedRecords.length,
      totalTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      estimatedCostUsd: totalCost,
      avgDurationMs: records.length > 0 ? totalDuration / records.length : 0,
      byProvider: aggregateByProvider(records),
      byModel: aggregateByModel(records),
    };
  }
}
