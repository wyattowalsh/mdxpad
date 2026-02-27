/**
 * OnboardingService Unit Tests
 *
 * Tests for onboarding analytics: attempt tracking, outcome recording,
 * metrics aggregation, pruning, and reset.
 *
 * @module tests/unit/ai/onboarding-service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

const mockStore = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  return {
    get: vi.fn((key: string) => data[key]),
    set: vi.fn((key: string, value: unknown) => {
      data[key] = value;
    }),
    _data: data,
    _reset: () => {
      for (const k of Object.keys(data)) {
        data[k] = undefined;
      }
    },
  };
});

vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation((opts: { defaults?: Record<string, unknown> }) => {
    mockStore._reset();
    if (opts.defaults) {
      Object.entries(opts.defaults).forEach(([k, v]) => {
        mockStore._data[k] = v;
      });
    }
    return mockStore;
  }),
}));

import { OnboardingService } from '../onboarding-service';

// ============================================================================
// Tests
// ============================================================================

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OnboardingService();
  });

  // --------------------------------------------------------------------------
  // startAttempt
  // --------------------------------------------------------------------------

  describe('startAttempt', () => {
    it('should return a unique attempt ID', () => {
      const id1 = service.startAttempt('openai');
      const id2 = service.startAttempt('anthropic');

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should return a UUID-format string', () => {
      const id = service.startAttempt('ollama');

      // UUID v4 format check
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  // --------------------------------------------------------------------------
  // recordOutcome
  // --------------------------------------------------------------------------

  describe('recordOutcome', () => {
    it('should record successful outcome and update metrics', async () => {
      const attemptId = service.startAttempt('openai');

      await service.recordOutcome(attemptId, 'success');

      // Should have persisted the attempt
      expect(mockStore.set).toHaveBeenCalledWith(
        'attempts',
        expect.arrayContaining([
          expect.objectContaining({
            id: attemptId,
            providerType: 'openai',
            outcome: 'success',
          }),
        ])
      );

      // Should have updated metrics
      expect(mockStore.set).toHaveBeenCalledWith(
        'metrics',
        expect.objectContaining({
          totalAttempts: 1,
          successCount: 1,
          successRate: 1,
        })
      );
    });

    it('should record failure with details', async () => {
      const attemptId = service.startAttempt('anthropic');

      await service.recordOutcome(attemptId, 'failure', {
        failedAtStep: 'validation',
        errorCode: 'INVALID_API_KEY',
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        'attempts',
        expect.arrayContaining([
          expect.objectContaining({
            outcome: 'failure',
            failedAtStep: 'validation',
            errorCode: 'INVALID_API_KEY',
          }),
        ])
      );
    });

    it('should record abandoned outcome', async () => {
      const attemptId = service.startAttempt('ollama');

      await service.recordOutcome(attemptId, 'abandoned');

      expect(mockStore.set).toHaveBeenCalledWith(
        'metrics',
        expect.objectContaining({
          abandonmentCount: 1,
        })
      );
    });

    it('should silently ignore unknown attempt IDs', async () => {
      await service.recordOutcome('nonexistent-id', 'success');

      // Should not have called set for attempts
      expect(mockStore.set).not.toHaveBeenCalledWith('attempts', expect.anything());
    });

    it('should calculate correct success rate', async () => {
      // Simulate existing attempts
      mockStore._data.attempts = [];

      const id1 = service.startAttempt('openai');
      await service.recordOutcome(id1, 'success');

      const id2 = service.startAttempt('openai');
      await service.recordOutcome(id2, 'failure');

      // After 2 attempts (1 success, 1 failure), rate should be 0.5
      expect(mockStore.set).toHaveBeenCalledWith(
        'metrics',
        expect.objectContaining({
          successRate: 0.5,
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // getMetrics
  // --------------------------------------------------------------------------

  describe('getMetrics', () => {
    it('should return stored metrics', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalAttempts).toBe(0);
      expect(metrics.successRate).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // resetMetrics
  // --------------------------------------------------------------------------

  describe('resetMetrics', () => {
    it('should clear all attempts and metrics', async () => {
      const attemptId = service.startAttempt('openai');
      await service.recordOutcome(attemptId, 'success');

      await service.resetMetrics();

      expect(mockStore.set).toHaveBeenCalledWith('attempts', []);
      expect(mockStore.set).toHaveBeenCalledWith(
        'metrics',
        expect.objectContaining({
          totalAttempts: 0,
          successCount: 0,
          failureCount: 0,
          abandonmentCount: 0,
          successRate: 0,
          avgSuccessDurationMs: 0,
        })
      );
    });
  });
});
