/**
 * OnboardingService - Tracks provider onboarding analytics for SC-006 measurement.
 *
 * This service provides local-only, privacy-preserving analytics for measuring
 * the success rate of first-provider configuration attempts. It stores both
 * individual attempts (with 30-day retention) and aggregated metrics.
 *
 * Key metrics tracked:
 * - Total attempts, success/failure/abandonment counts
 * - Success rate (target: 95% per SC-006)
 * - Average successful onboarding duration
 *
 * @module main/services/ai/onboarding-service
 */

import Store from 'electron-store';
import type {
  OnboardingAttempt,
  OnboardingMetrics,
  OnboardingOutcome,
  OnboardingStep,
  ProviderType,
} from '../../../shared/ai/types';

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Service interface for onboarding analytics.
 * Provides methods to track and measure provider configuration attempts.
 */
export interface IOnboardingService {
  /**
   * Starts tracking a new onboarding attempt.
   * @param providerType - The type of provider being configured
   * @returns Unique attempt ID for tracking this attempt
   */
  startAttempt(providerType: ProviderType): string;

  /**
   * Records the outcome of an onboarding attempt.
   * @param attemptId - The ID returned from startAttempt
   * @param outcome - The final outcome (success, failure, abandoned)
   * @param details - Optional details about failure step or error
   */
  recordOutcome(
    attemptId: string,
    outcome: OnboardingOutcome,
    details?: {
      failedAtStep?: OnboardingStep;
      errorCode?: string;
    }
  ): Promise<void>;

  /**
   * Retrieves the current aggregated onboarding metrics.
   * @returns Promise resolving to the current metrics
   */
  getMetrics(): Promise<OnboardingMetrics>;

  /**
   * Resets all onboarding data (attempts and metrics).
   * @returns Promise resolving when reset is complete
   */
  resetMetrics(): Promise<void>;
}

// =============================================================================
// STORE TYPES
// =============================================================================

/**
 * Schema definition for the onboarding electron-store instance.
 */
interface OnboardingStore {
  /** Individual onboarding attempt records (30-day retention) */
  attempts: OnboardingAttempt[];
  /** Aggregated metrics computed from attempts */
  metrics: OnboardingMetrics;
}

/**
 * In-progress attempt tracking data stored in memory.
 */
interface InProgressAttempt {
  /** Provider type being configured */
  providerType: ProviderType;
  /** Unix timestamp when attempt started */
  startedAt: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Store name for electron-store persistence */
const STORE_NAME = 'mdxpad-onboarding';

/** Retention period for individual attempts in milliseconds (30 days) */
const RETENTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Service for tracking provider onboarding analytics.
 *
 * Maintains both individual attempt records and aggregated metrics for
 * measuring the SC-006 success criterion: "95% first-provider success rate".
 *
 * @example
 * ```typescript
 * const onboardingService = new OnboardingService();
 *
 * // Start tracking an onboarding attempt
 * const attemptId = onboardingService.startAttempt('openai');
 *
 * // ... user completes or abandons onboarding ...
 *
 * // Record successful outcome
 * await onboardingService.recordOutcome(attemptId, 'success');
 *
 * // Or record failure with details
 * await onboardingService.recordOutcome(attemptId, 'failure', {
 *   failedAtStep: 'validation',
 *   errorCode: 'INVALID_API_KEY'
 * });
 *
 * // Get current metrics
 * const metrics = await onboardingService.getMetrics();
 * console.log(`Success rate: ${metrics.successRate * 100}%`);
 * ```
 */
export class OnboardingService implements IOnboardingService {
  private readonly store: Store<OnboardingStore>;
  private readonly inProgressAttempts: Map<string, InProgressAttempt>;

  /**
   * Creates a new OnboardingService instance.
   *
   * Initializes the electron-store with default empty values and
   * creates an in-memory map for tracking in-progress attempts.
   */
  constructor() {
    this.store = new Store<OnboardingStore>({
      name: STORE_NAME,
      defaults: {
        attempts: [],
        metrics: this.createEmptyMetrics(),
      },
    });
    this.inProgressAttempts = new Map<string, InProgressAttempt>();
  }

  /**
   * Starts tracking a new onboarding attempt.
   *
   * Generates a unique ID and stores the start timestamp in memory
   * for duration calculation when the outcome is recorded.
   *
   * @param providerType - The type of provider being configured
   * @returns Unique attempt ID (UUID v4)
   */
  startAttempt(providerType: ProviderType): string {
    const attemptId = crypto.randomUUID();
    this.inProgressAttempts.set(attemptId, {
      providerType,
      startedAt: Date.now(),
    });
    return attemptId;
  }

  /**
   * Records the outcome of an onboarding attempt.
   *
   * Calculates duration from the stored start timestamp, creates an
   * attempt record, prunes old attempts, and updates aggregated metrics.
   *
   * @param attemptId - The ID returned from startAttempt
   * @param outcome - The final outcome (success, failure, abandoned)
   * @param details - Optional details about failure step or error
   */
  async recordOutcome(
    attemptId: string,
    outcome: OnboardingOutcome,
    details?: {
      failedAtStep?: OnboardingStep;
      errorCode?: string;
    }
  ): Promise<void> {
    const inProgress = this.inProgressAttempts.get(attemptId);
    if (!inProgress) {
      return; // Silently ignore unknown attempt IDs
    }

    // Calculate duration and create attempt record
    const durationMs = Date.now() - inProgress.startedAt;
    const attempt: OnboardingAttempt = {
      id: attemptId,
      providerType: inProgress.providerType,
      outcome,
      durationMs,
      ...(details?.failedAtStep !== undefined && { failedAtStep: details.failedAtStep }),
      ...(details?.errorCode !== undefined && { errorCode: details.errorCode }),
      timestamp: new Date().toISOString(),
    };

    // Clean up in-progress tracking
    this.inProgressAttempts.delete(attemptId);

    // Persist attempt and update metrics
    await this.persistAttempt(attempt);
  }

  /**
   * Retrieves the current aggregated onboarding metrics.
   *
   * @returns Promise resolving to the current metrics
   */
  async getMetrics(): Promise<OnboardingMetrics> {
    return this.store.get('metrics');
  }

  /**
   * Resets all onboarding data (attempts and metrics).
   *
   * Clears both individual attempts and aggregated metrics,
   * resetting all counters to zero.
   *
   * @returns Promise resolving when reset is complete
   */
  async resetMetrics(): Promise<void> {
    this.store.set('attempts', []);
    this.store.set('metrics', this.createEmptyMetrics());
    this.inProgressAttempts.clear();
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Creates an empty metrics object with all counters set to zero.
   *
   * @returns A new OnboardingMetrics object with default values
   */
  private createEmptyMetrics(): OnboardingMetrics {
    return {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      abandonmentCount: 0,
      successRate: 0,
      avgSuccessDurationMs: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Persists an attempt record and updates aggregated metrics.
   *
   * Prunes attempts older than the retention period before persisting.
   *
   * @param attempt - The attempt record to persist
   */
  private async persistAttempt(attempt: OnboardingAttempt): Promise<void> {
    // Get current attempts and prune old ones
    const attempts = this.pruneOldAttempts(this.store.get('attempts'));

    // Add new attempt
    attempts.push(attempt);
    this.store.set('attempts', attempts);

    // Recalculate and update metrics
    const metrics = this.calculateMetrics(attempts);
    this.store.set('metrics', metrics);
  }

  /**
   * Removes attempts older than the retention period.
   *
   * @param attempts - Array of attempts to prune
   * @returns Filtered array with only recent attempts
   */
  private pruneOldAttempts(attempts: OnboardingAttempt[]): OnboardingAttempt[] {
    const cutoffTime = Date.now() - RETENTION_PERIOD_MS;
    return attempts.filter((attempt) => {
      const attemptTime = new Date(attempt.timestamp).getTime();
      return attemptTime >= cutoffTime;
    });
  }

  /**
   * Calculates aggregated metrics from attempt records.
   *
   * @param attempts - Array of attempts to aggregate
   * @returns Calculated OnboardingMetrics
   */
  private calculateMetrics(attempts: OnboardingAttempt[]): OnboardingMetrics {
    const totalAttempts = attempts.length;
    const successCount = attempts.filter((a) => a.outcome === 'success').length;
    const failureCount = attempts.filter((a) => a.outcome === 'failure').length;
    const abandonmentCount = attempts.filter((a) => a.outcome === 'abandoned').length;

    // Calculate success rate (avoid division by zero)
    const successRate = totalAttempts > 0 ? successCount / totalAttempts : 0;

    // Calculate average success duration
    const avgSuccessDurationMs = this.calculateAvgSuccessDuration(attempts);

    return {
      totalAttempts,
      successCount,
      failureCount,
      abandonmentCount,
      successRate,
      avgSuccessDurationMs,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculates the average duration of successful attempts.
   *
   * @param attempts - Array of attempts to analyze
   * @returns Average duration in milliseconds, or 0 if no successes
   */
  private calculateAvgSuccessDuration(attempts: OnboardingAttempt[]): number {
    const successfulAttempts = attempts.filter((a) => a.outcome === 'success');
    if (successfulAttempts.length === 0) {
      return 0;
    }

    const totalDuration = successfulAttempts.reduce((sum, a) => sum + a.durationMs, 0);
    return Math.round(totalDuration / successfulAttempts.length);
  }
}
