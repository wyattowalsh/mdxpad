export const MAX_LOCAL_TELEMETRY_HISTORY = 500;

export type LocalTelemetrySurface = 'workspace' | 'ai' | 'export' | 'plugin-pipeline';
export type LocalTelemetryStatus = 'started' | 'succeeded' | 'failed';
export type LocalTelemetryLogLevel = 'silent' | 'warn' | 'error';

export interface LocalTelemetryEvent {
  readonly surface: LocalTelemetrySurface;
  readonly action: string;
  readonly status: LocalTelemetryStatus;
  readonly timestamp: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

interface LocalTelemetryOptions {
  readonly details?: Readonly<Record<string, unknown>>;
  readonly logLevel?: LocalTelemetryLogLevel;
}

const telemetryHistory: LocalTelemetryEvent[] = [];
const telemetryCounters = new Map<string, number>();

function incrementCounter(counterKey: string): void {
  telemetryCounters.set(counterKey, (telemetryCounters.get(counterKey) ?? 0) + 1);
}

function sanitizeDetails(
  details: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, string | number | boolean>> | undefined {
  if (details === undefined) {
    return undefined;
  }

  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, 120);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function logTelemetryEvent(event: LocalTelemetryEvent, logLevel: LocalTelemetryLogLevel): void {
  if (logLevel === 'silent') {
    return;
  }

  const message = `[Telemetry][${event.surface}] ${event.action}:${event.status}`;
  const details = event.details ?? {};
  if (logLevel === 'error') {
    console.error(message, details);
    return;
  }

  console.warn(message, details);
}

export function recordLocalTelemetryEvent(
  surface: LocalTelemetrySurface,
  action: string,
  status: LocalTelemetryStatus,
  options?: LocalTelemetryOptions
): LocalTelemetryEvent {
  const details = sanitizeDetails(options?.details);
  const event: LocalTelemetryEvent = details
    ? { surface, action, status, timestamp: new Date().toISOString(), details }
    : { surface, action, status, timestamp: new Date().toISOString() };

  incrementCounter(`${surface}.total`);
  incrementCounter(`${surface}.${action}.${status}`);

  telemetryHistory.push(event);
  if (telemetryHistory.length > MAX_LOCAL_TELEMETRY_HISTORY) {
    telemetryHistory.shift();
  }

  const logLevel = options?.logLevel ?? (status === 'failed' ? 'warn' : 'silent');
  logTelemetryEvent(event, logLevel);
  return event;
}

export function getLocalTelemetryCounter(counterKey: string): number {
  return telemetryCounters.get(counterKey) ?? 0;
}

export function getLocalTelemetryHistory(): readonly LocalTelemetryEvent[] {
  return [...telemetryHistory];
}

export function resetLocalTelemetry(): void {
  telemetryCounters.clear();
  telemetryHistory.length = 0;
}
