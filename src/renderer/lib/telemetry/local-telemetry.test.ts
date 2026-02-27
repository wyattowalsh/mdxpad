import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_LOCAL_TELEMETRY_HISTORY,
  getLocalTelemetryCounter,
  getLocalTelemetryHistory,
  recordLocalTelemetryEvent,
  resetLocalTelemetry,
} from './local-telemetry';

describe('local telemetry', () => {
  beforeEach(() => {
    resetLocalTelemetry();
    vi.restoreAllMocks();
  });

  it('records counters and sanitizes telemetry details', () => {
    recordLocalTelemetryEvent('workspace', 'open-workspace', 'started', {
      details: {
        projectCount: 2,
        hasWriteAccess: true,
        ignoredObject: { nested: true },
      },
    });

    const [event] = getLocalTelemetryHistory();
    expect(event).toBeDefined();
    expect(event?.details).toEqual({
      projectCount: 2,
      hasWriteAccess: true,
    });
    expect(getLocalTelemetryCounter('workspace.total')).toBe(1);
    expect(getLocalTelemetryCounter('workspace.open-workspace.started')).toBe(1);
  });

  it('keeps only the most recent telemetry entries', () => {
    for (let index = 0; index <= MAX_LOCAL_TELEMETRY_HISTORY; index++) {
      recordLocalTelemetryEvent('ai', `stream-${index}`, 'succeeded');
    }

    const history = getLocalTelemetryHistory();
    expect(history).toHaveLength(MAX_LOCAL_TELEMETRY_HISTORY);
    expect(history[0]?.action).toBe('stream-1');
    expect(history.at(-1)?.action).toBe(`stream-${MAX_LOCAL_TELEMETRY_HISTORY}`);
  });

  it('logs warning output for failed telemetry events', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    recordLocalTelemetryEvent('export', 'invoke-cli', 'failed', {
      details: { code: 'NON_ZERO_EXIT' },
    });

    expect(warnSpy).toHaveBeenCalledWith('[Telemetry][export] invoke-cli:failed', {
      code: 'NON_ZERO_EXIT',
    });
  });
});
