/**
 * UsageStats Component
 *
 * Displays AI usage statistics with time range selection.
 *
 * @module src/renderer/features/ai-provider/components/UsageStats
 */

import React from 'react';
import type {
  ModelUsageSummary,
  OperationUsageSummary,
  ProviderUsageSummary,
  TimeRange,
  UsageStats as UsageStatsType,
} from '@shared/ai/types';

interface UsageStatsProps {
  stats: UsageStatsType | null;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  isLoading?: boolean;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

export function UsageStats({ stats, timeRange, onTimeRangeChange, isLoading }: UsageStatsProps) {
  return (
    <div className="space-y-4">
      {/* Time range selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Usage Statistics</h3>
        <select
          value={timeRange}
          onChange={(e) => onTimeRangeChange(e.target.value as TimeRange)}
          disabled={isLoading}
          className="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        >
          {TIME_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stats grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Total Requests"
              value={stats.totalRequests.toLocaleString()}
              subValue={`${stats.successfulRequests} successful`}
            />
            <StatCard
              label="Total Tokens"
              value={formatTokens(stats.totalTokens)}
              subValue={`${formatTokens(stats.inputTokens)} in / ${formatTokens(stats.outputTokens)} out`}
            />
            <StatCard
              label="Success Rate"
              value={formatPercent(stats.successfulRequests, stats.totalRequests)}
              subValue={`${stats.failedRequests} failed`}
            />
            <StatCard
              label="Est. Cost"
              value={formatCurrency(stats.estimatedCostUsd)}
              subValue="USD"
            />
          </div>
          <UsageBreakdown stats={stats} />
        </>
      ) : (
        <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">No usage data available</p>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
}

function sortedEntries<T extends { requestCount: number }>(
  records: Record<string, T>
): readonly (readonly [string, T])[] {
  return Object.entries(records).sort(
    (left, right) => right[1].requestCount - left[1].requestCount
  );
}

function UsageBreakdown({ stats }: { stats: UsageStatsType }): React.JSX.Element | null {
  const providers = sortedEntries<ProviderUsageSummary>(stats.byProvider);
  const models = sortedEntries<ModelUsageSummary>(stats.byModel);
  const operations = sortedEntries<OperationUsageSummary>(stats.byOperation);
  if (providers.length === 0 && models.length === 0 && operations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <BreakdownList
        title="By provider"
        rows={providers.map(([id, summary]) => ({
          id,
          detail: `${summary.requestCount.toLocaleString()} requests · ${formatCurrency(summary.estimatedCostUsd)}`,
        }))}
      />
      <BreakdownList
        title="By model"
        rows={models.map(([id, summary]) => ({
          id,
          detail: `${summary.requestCount.toLocaleString()} requests · ${formatTokens(summary.totalTokens)} tokens`,
        }))}
      />
      <BreakdownList
        title="By operation"
        rows={operations.map(([id, summary]) => ({
          id,
          detail: `${summary.requestCount.toLocaleString()} requests`,
        }))}
      />
    </div>
  );
}

function BreakdownList({
  title,
  rows,
}: {
  title: string;
  rows: readonly { id: string; detail: string }[];
}): React.JSX.Element | null {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section>
      <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">{title}</h4>
      <ul className="mt-1 space-y-1">
        {rows.map((row) => (
          <li key={`${title}:${row.id}`} className="flex justify-between gap-3 text-xs">
            <span className="text-gray-800 dark:text-gray-200">{row.id}</span>
            <span className="text-gray-500 dark:text-gray-400">{row.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatCard({ label, value, subValue }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      {subValue && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subValue}</p>}
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return '0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}
