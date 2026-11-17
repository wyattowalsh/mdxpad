/**
 * UsageService Unit Tests
 *
 * Tests for usage tracking, statistics aggregation, cost estimation,
 * and data export functionality.
 *
 * @module tests/unit/usage-service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { UsageRecord, TimeRange } from '../../../../shared/ai/types';

// =============================================================================
// Mock Setup - Use vi.hoisted for hoisted mock variables
// =============================================================================

const { mockStoreData, mockStore, mockStoreConstructor, mockRandomUUID } = vi.hoisted(() => {
  const storeData = new Map<string, unknown>();
  const store = {
    get: vi.fn((key: string, defaultValue?: unknown) => storeData.get(key) ?? defaultValue),
    set: vi.fn((key: string, value: unknown) => {
      storeData.set(key, value);
    }),
    delete: vi.fn((key: string) => {
      storeData.delete(key);
    }),
    has: vi.fn((key: string) => storeData.has(key)),
    clear: vi.fn(() => {
      storeData.clear();
    }),
    onDidChange: vi.fn(),
  };
  return {
    mockStoreData: storeData,
    mockStore: store,
    mockStoreConstructor: vi.fn().mockImplementation(() => store),
    mockRandomUUID: vi.fn(() => 'test-uuid-123'),
  };
});

// Mock electron-store
vi.mock('electron-store', () => ({
  default: mockStoreConstructor,
}));

// Mock crypto
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    randomUUID: mockRandomUUID,
  };
});

// Import after mocks
import { UsageService } from '../usage-service';

// =============================================================================
// Test Utilities
// =============================================================================

function createMockRecord(overrides?: Partial<UsageRecord>): UsageRecord {
  return {
    id: 'record-1',
    providerId: 'openai',
    modelId: 'gpt-4o',
    operationType: 'text-generation',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    durationMs: 1500,
    success: true,
    timestamp: new Date().toISOString(),
    estimatedCostUsd: 0.001,
    ...overrides,
  };
}

function resetMocks(): void {
  vi.clearAllMocks();
  mockStoreData.clear();
  mockStoreData.set('records', []);
  mockStore.get.mockImplementation(
    (key: string, defaultValue?: unknown) => mockStoreData.get(key) ?? defaultValue
  );
  mockStore.set.mockImplementation((key: string, value: unknown) => {
    mockStoreData.set(key, value);
  });
  mockStoreConstructor.mockImplementation(() => mockStore);
  mockRandomUUID.mockReturnValue('test-uuid-123');
}

// =============================================================================
// UsageService Tests
// =============================================================================

describe('UsageService', () => {
  let service: UsageService;

  beforeEach(() => {
    resetMocks();
    service = new UsageService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('constructor', () => {
    it('should initialize electron-store with correct config', () => {
      expect(mockStoreConstructor).toHaveBeenCalledWith({
        name: 'mdxpad-usage',
        defaults: {
          records: [],
        },
      });
    });
  });

  // ===========================================================================
  // recordUsage Tests
  // ===========================================================================

  describe('recordUsage', () => {
    it('should record usage with generated ID and timestamp', async () => {
      const record = {
        providerId: 'openai',
        modelId: 'gpt-4o',
        operationType: 'text-generation' as const,
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        durationMs: 1500,
        success: true,
      };

      await service.recordUsage(record);

      expect(mockStore.set).toHaveBeenCalledWith(
        'records',
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            providerId: 'openai',
            modelId: 'gpt-4o',
            timestamp: expect.any(String),
          }),
        ])
      );
    });

    it('should calculate estimated cost when not provided', async () => {
      const record = {
        providerId: 'openai',
        modelId: 'gpt-4o',
        operationType: 'text-generation' as const,
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        durationMs: 1500,
        success: true,
      };

      await service.recordUsage(record);

      const setCall = mockStore.set.mock.calls[0];
      const savedRecords = setCall?.[1] as UsageRecord[];
      const savedRecord = savedRecords[0];

      expect(savedRecord?.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('should use provided estimated cost', async () => {
      const record = {
        providerId: 'openai',
        modelId: 'gpt-4o',
        operationType: 'text-generation' as const,
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        durationMs: 1500,
        success: true,
        estimatedCostUsd: 0.123,
      };

      await service.recordUsage(record);

      const setCall = mockStore.set.mock.calls[0];
      const savedRecords = setCall?.[1] as UsageRecord[];
      const savedRecord = savedRecords[0];

      expect(savedRecord?.estimatedCostUsd).toBe(0.123);
    });

    it('should append to existing records', async () => {
      const existing = [createMockRecord({ id: 'existing-1' })];
      mockStoreData.set('records', existing);

      await service.recordUsage({
        providerId: 'openai',
        modelId: 'gpt-4o',
        operationType: 'text-generation',
        totalTokens: 100,
        durationMs: 1000,
        success: true,
      });

      const setCall = mockStore.set.mock.calls[0];
      const savedRecords = setCall?.[1] as UsageRecord[];

      expect(savedRecords).toHaveLength(2);
      expect(savedRecords[0]?.id).toBe('existing-1');
    });

    it('should prune old records before adding new one', async () => {
      const now = Date.now();
      const oldRecords = Array.from({ length: 5 }, (_, i) =>
        createMockRecord({
          id: `old-${i}`,
          timestamp: new Date(now - 91 * 24 * 60 * 60 * 1000).toISOString(),
        })
      );
      mockStoreData.set('records', oldRecords);

      await service.recordUsage({
        providerId: 'openai',
        modelId: 'gpt-4o',
        operationType: 'text-generation',
        totalTokens: 100,
        durationMs: 1000,
        success: true,
      });

      const setCall = mockStore.set.mock.calls[0];
      const savedRecords = setCall?.[1] as UsageRecord[];

      expect(savedRecords.length).toBeLessThan(oldRecords.length + 1);
    });

    it('should enforce max records limit (FIFO)', async () => {
      const records = Array.from({ length: 100001 }, (_, i) =>
        createMockRecord({ id: `record-${i}` })
      );
      mockStoreData.set('records', records);

      await service.recordUsage({
        providerId: 'openai',
        modelId: 'gpt-4o',
        operationType: 'text-generation',
        totalTokens: 100,
        durationMs: 1000,
        success: true,
      });

      const setCall = mockStore.set.mock.calls[0];
      const savedRecords = setCall?.[1] as UsageRecord[];

      // After pruning to MAX_RECORDS (100000) and adding the new record, total is MAX_RECORDS + 1
      expect(savedRecords.length).toBeLessThanOrEqual(100001);
      expect(savedRecords.length).toBeLessThan(records.length + 1);
    });
  });

  // ===========================================================================
  // queryStats Tests
  // ===========================================================================

  describe('queryStats', () => {
    it('should return stats for time range', async () => {
      const records = [
        createMockRecord({
          timestamp: new Date(Date.now() - 1000).toISOString(),
          totalTokens: 100,
        }),
        createMockRecord({
          timestamp: new Date(Date.now() - 2000).toISOString(),
          totalTokens: 200,
        }),
      ];
      mockStoreData.set('records', records);

      const result = await service.queryStats({ timeRange: 'day' });

      expect(result.totalRequests).toBe(2);
      expect(result.totalTokens).toBe(300);
    });

    it('should filter by providerId', async () => {
      const records = [
        createMockRecord({ providerId: 'openai', totalTokens: 100 }),
        createMockRecord({ providerId: 'anthropic', totalTokens: 200 }),
      ];
      mockStoreData.set('records', records);

      const result = await service.queryStats({
        timeRange: 'all',
        providerId: 'openai',
      });

      expect(result.totalRequests).toBe(1);
      expect(result.totalTokens).toBe(100);
    });

    it('should filter by operationType', async () => {
      const records = [
        createMockRecord({ operationType: 'text-generation', totalTokens: 100 }),
        createMockRecord({ operationType: 'embedding', totalTokens: 200 }),
      ];
      mockStoreData.set('records', records);

      const result = await service.queryStats({
        timeRange: 'all',
        operationType: 'text-generation',
      });

      expect(result.totalRequests).toBe(1);
      expect(result.totalTokens).toBe(100);
    });

    it('should calculate success/failure counts', async () => {
      const records = [
        createMockRecord({ success: true }),
        createMockRecord({ success: true }),
        createMockRecord({ success: false }),
      ];
      mockStoreData.set('records', records);

      const result = await service.queryStats({ timeRange: 'all' });

      expect(result.successfulRequests).toBe(2);
      expect(result.failedRequests).toBe(1);
    });

    it('should aggregate by provider', async () => {
      const records = [
        createMockRecord({ providerId: 'openai', totalTokens: 100 }),
        createMockRecord({ providerId: 'openai', totalTokens: 200 }),
        createMockRecord({ providerId: 'anthropic', totalTokens: 300 }),
      ];
      mockStoreData.set('records', records);

      const result = await service.queryStats({ timeRange: 'all' });

      expect(result.byProvider.openai?.requestCount).toBe(2);
      expect(result.byProvider.openai?.totalTokens).toBe(300);
      expect(result.byProvider.anthropic?.requestCount).toBe(1);
    });

    it('should aggregate by model', async () => {
      const records = [
        createMockRecord({ modelId: 'gpt-4o', totalTokens: 100 }),
        createMockRecord({ modelId: 'gpt-4o', totalTokens: 200 }),
        createMockRecord({ modelId: 'gpt-4o-mini', totalTokens: 50 }),
      ];
      mockStoreData.set('records', records);

      const result = await service.queryStats({ timeRange: 'all' });

      expect(result.byModel['gpt-4o']?.requestCount).toBe(2);
      expect(result.byModel['gpt-4o']?.totalTokens).toBe(300);
    });

    it('should aggregate by operation', async () => {
      const records = [
        createMockRecord({ operationType: 'text-generation', durationMs: 1000 }),
        createMockRecord({ operationType: 'text-generation', durationMs: 3000 }),
        createMockRecord({ operationType: 'embedding', durationMs: 500 }),
      ];
      mockStoreData.set('records', records);

      const result = await service.queryStats({ timeRange: 'all' });

      expect(result.byOperation['text-generation']?.requestCount).toBe(2);
      expect(result.byOperation['text-generation']?.avgDurationMs).toBe(2000);
      expect(result.byOperation.embedding?.requestCount).toBe(1);
      expect(result.byOperation.embedding?.avgDurationMs).toBe(500);
    });

    it('should calculate average duration', async () => {
      const records = [
        createMockRecord({ durationMs: 1000 }),
        createMockRecord({ durationMs: 2000 }),
        createMockRecord({ durationMs: 3000 }),
      ];
      mockStoreData.set('records', records);

      const result = await service.queryStats({ timeRange: 'all' });

      expect(result.avgDurationMs).toBe(2000);
    });

    it('should handle empty records', async () => {
      mockStoreData.set('records', []);

      const result = await service.queryStats({ timeRange: 'all' });

      expect(result.totalRequests).toBe(0);
      expect(result.avgDurationMs).toBe(0);
    });
  });

  // ===========================================================================
  // exportData Tests
  // ===========================================================================

  describe('exportData', () => {
    it('should export as JSON', async () => {
      const records = [createMockRecord()];
      mockStoreData.set('records', records);

      const result = await service.exportData('all', 'json');

      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
    });

    it('should export as CSV with headers', async () => {
      const records = [createMockRecord()];
      mockStoreData.set('records', records);

      const result = await service.exportData('all', 'csv');

      expect(result).toContain('id,providerId,modelId');
      expect(result.split('\n').length).toBeGreaterThan(1);
    });

    it('should escape CSV fields with commas', async () => {
      const records = [createMockRecord({ providerId: 'test,provider' })];
      mockStoreData.set('records', records);

      const result = await service.exportData('all', 'csv');

      expect(result).toContain('"test,provider"');
    });

    it('should filter by time range', async () => {
      const now = Date.now();
      const records = [
        createMockRecord({ timestamp: new Date(now - 1000).toISOString() }),
        createMockRecord({
          timestamp: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      mockStoreData.set('records', records);

      const result = await service.exportData('day', 'json');

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
    });
  });

  // ===========================================================================
  // clearHistory Tests
  // ===========================================================================

  describe('clearHistory', () => {
    it('should clear all records when no date provided', async () => {
      const records = [createMockRecord(), createMockRecord()];
      mockStoreData.set('records', records);

      await service.clearHistory();

      expect(mockStore.set).toHaveBeenCalledWith('records', []);
    });

    it('should clear records before specified date', async () => {
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const records = [
        createMockRecord({
          id: 'old',
          timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        createMockRecord({
          id: 'new',
          timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      mockStoreData.set('records', records);

      await service.clearHistory(cutoffDate);

      const setCall = mockStore.set.mock.calls[0];
      const remainingRecords = setCall?.[1] as UsageRecord[];

      expect(remainingRecords).toHaveLength(1);
      expect(remainingRecords[0]?.id).toBe('new');
    });
  });

  // ===========================================================================
  // getEstimatedCost Tests
  // ===========================================================================

  describe('getEstimatedCost', () => {
    it('should calculate total cost for provider', async () => {
      const records = [
        createMockRecord({ providerId: 'openai', estimatedCostUsd: 0.001 }),
        createMockRecord({ providerId: 'openai', estimatedCostUsd: 0.002 }),
        createMockRecord({ providerId: 'anthropic', estimatedCostUsd: 0.003 }),
      ];
      mockStoreData.set('records', records);

      const result = await service.getEstimatedCost('openai', 'all');

      expect(result).toBe(0.003);
    });

    it('should filter by time range', async () => {
      const now = Date.now();
      const records = [
        createMockRecord({
          providerId: 'openai',
          estimatedCostUsd: 0.001,
          timestamp: new Date(now - 1000).toISOString(),
        }),
        createMockRecord({
          providerId: 'openai',
          estimatedCostUsd: 0.002,
          timestamp: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ];
      mockStoreData.set('records', records);

      const result = await service.getEstimatedCost('openai', 'day');

      expect(result).toBe(0.001);
    });

    it('should calculate cost when not in record', async () => {
      const record = createMockRecord({
        providerId: 'openai',
        modelId: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      });
      delete record.estimatedCostUsd;
      const records = [record];
      mockStoreData.set('records', records);

      const result = await service.getEstimatedCost('openai', 'all');

      expect(result).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Time Range Tests
  // ===========================================================================

  describe('time range filtering', () => {
    const now = Date.now();
    const records = [
      createMockRecord({ timestamp: new Date(now - 1 * 60 * 60 * 1000).toISOString() }),
      createMockRecord({ timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() }),
      createMockRecord({ timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() }),
      createMockRecord({ timestamp: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString() }),
    ];

    beforeEach(() => {
      mockStoreData.set('records', records);
    });

    it('should filter for day range', async () => {
      const result = await service.queryStats({ timeRange: 'day' });
      expect(result.totalRequests).toBe(1);
    });

    it('should filter for week range', async () => {
      const result = await service.queryStats({ timeRange: 'week' });
      expect(result.totalRequests).toBe(2);
    });

    it('should filter for month range', async () => {
      const result = await service.queryStats({ timeRange: 'month' });
      expect(result.totalRequests).toBe(3);
    });

    it('should include all for all range', async () => {
      const result = await service.queryStats({ timeRange: 'all' });
      expect(result.totalRequests).toBe(4);
    });
  });
});
