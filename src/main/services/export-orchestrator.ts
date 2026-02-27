import {
  ExportJobLifecycleRequestSchema,
  ExportPresetCrudRequestSchema,
  type ExportJobLifecycleRequest,
  type ExportJobLifecycleResponse,
  type ExportPresetCrudRequest,
  type ExportPresetCrudResponse,
} from '@shared/contracts/export-schemas';
import type { ExportJob, ExportJobStatus, ExportPreset } from '@shared/types/export-model';
import { getExporter, type ExportResult, type ExportOptions } from './export-formats';

const TERMINAL_JOB_STATUSES: ReadonlySet<ExportJobStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
]);

const ALLOWED_JOB_TRANSITIONS: Readonly<Record<ExportJobStatus, ReadonlySet<ExportJobStatus>>> = {
  queued: new Set(['queued', 'running', 'completed', 'failed', 'cancelled']),
  running: new Set(['running', 'completed', 'failed', 'cancelled']),
  completed: new Set(['completed']),
  failed: new Set(['failed']),
  cancelled: new Set(['cancelled']),
};

interface ExportOrchestratorServiceOptions {
  now?: () => string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isTerminalStatus(status: ExportJobStatus): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}

function canTransitionStatus(from: ExportJobStatus, to: ExportJobStatus): boolean {
  return ALLOWED_JOB_TRANSITIONS[from].has(to);
}

function createValidationMessage(result: {
  success: false;
  error: { issues: { message: string }[] };
}): string {
  return result.error.issues[0]?.message ?? 'Invalid request payload';
}

function sortJobsByCreatedAt(jobs: readonly ExportJob[]): ExportJob[] {
  return [...jobs].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function sortPresetsByName(presets: readonly ExportPreset[]): ExportPreset[] {
  return [...presets].sort((left, right) => left.name.localeCompare(right.name));
}

export class ExportOrchestratorService {
  /**
   * In-memory job registry.
   * TODO: Persist jobs to disk for crash recovery and cross-restart continuity.
   */
  private readonly jobs = new Map<string, ExportJob>();
  private readonly presets = new Map<string, ExportPreset>();
  private readonly now: () => string;

  public constructor(options: ExportOrchestratorServiceOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  public handleJobLifecycle(request: ExportJobLifecycleRequest): ExportJobLifecycleResponse {
    const parsed = ExportJobLifecycleRequestSchema.safeParse(request);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        error: createValidationMessage(parsed),
      };
    }

    switch (parsed.data.action) {
      case 'create':
        return this.createJob(parsed.data.job);
      case 'get':
        return this.getJob(parsed.data.jobId);
      case 'list':
        return this.listJobs(parsed.data.status);
      case 'cancel':
        return this.cancelJob(parsed.data.jobId);
      case 'update-status':
        return this.updateJobStatus(
          parsed.data.jobId,
          parsed.data.status,
          parsed.data.warnings,
          parsed.data.errorMessage
        );
      default:
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          error: `Unsupported lifecycle action: ${(parsed.data as { action: string }).action}`,
        };
    }
  }

  public handlePresetCrud(request: ExportPresetCrudRequest): ExportPresetCrudResponse {
    const parsed = ExportPresetCrudRequestSchema.safeParse(request);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        error: createValidationMessage(parsed),
      };
    }

    switch (parsed.data.action) {
      case 'create':
        return this.createPreset(parsed.data.preset);
      case 'get':
        return this.getPreset(parsed.data.presetId);
      case 'list':
        return this.listPresets();
      case 'update':
        return this.updatePreset(parsed.data.presetId, parsed.data.preset);
      case 'delete':
        return this.deletePreset(parsed.data.presetId);
      default:
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          error: `Unsupported preset action: ${(parsed.data as { action: string }).action}`,
        };
    }
  }

  private createJob(job: ExportJob): ExportJobLifecycleResponse {
    if (this.jobs.has(job.id)) {
      return {
        ok: false,
        code: 'INVALID_STATE',
        error: `Export job already exists: ${job.id}`,
      };
    }

    const stored = clone(job);
    this.jobs.set(stored.id, stored);
    return { ok: true, job: clone(stored) };
  }

  private getJob(jobId: string): ExportJobLifecycleResponse {
    const job = this.jobs.get(jobId);
    if (!job) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        error: `Export job not found: ${jobId}`,
      };
    }
    return { ok: true, job: clone(job) };
  }

  private listJobs(status?: ExportJobStatus): ExportJobLifecycleResponse {
    const jobs = sortJobsByCreatedAt(
      [...this.jobs.values()].filter((job) => status === undefined || job.status === status)
    ).map((job) => clone(job));

    return { ok: true, jobs };
  }

  private cancelJob(jobId: string): ExportJobLifecycleResponse {
    const current = this.jobs.get(jobId);
    if (!current) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        error: `Export job not found: ${jobId}`,
      };
    }

    if (isTerminalStatus(current.status)) {
      return {
        ok: false,
        code: 'INVALID_STATE',
        error: `Cannot cancel job in terminal state "${current.status}"`,
      };
    }

    return this.updateJobStatus(jobId, 'cancelled');
  }

  private updateJobStatus(
    jobId: string,
    status: ExportJobStatus,
    warnings?: readonly string[],
    errorMessage?: string
  ): ExportJobLifecycleResponse {
    const current = this.jobs.get(jobId);
    if (!current) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        error: `Export job not found: ${jobId}`,
      };
    }

    if (!canTransitionStatus(current.status, status)) {
      return {
        ok: false,
        code: 'INVALID_STATE',
        error: `Cannot transition export job from "${current.status}" to "${status}"`,
      };
    }

    const next: ExportJob = clone(current);
    next.status = status;

    if (warnings !== undefined) {
      next.warnings = [...new Set([...next.warnings, ...warnings])];
    }

    if (status === 'running' && !next.startedAt) {
      next.startedAt = this.now();
    }

    if (isTerminalStatus(status)) {
      next.completedAt = next.completedAt ?? this.now();
    }

    if (errorMessage !== undefined) {
      next.errorMessage = errorMessage;
    } else if (status !== 'failed') {
      delete next.errorMessage;
    }

    this.jobs.set(jobId, next);
    return { ok: true, job: clone(next) };
  }

  private createPreset(preset: ExportPreset): ExportPresetCrudResponse {
    if (this.presets.has(preset.id)) {
      return {
        ok: false,
        code: 'ALREADY_EXISTS',
        error: `Export preset already exists: ${preset.id}`,
      };
    }

    const stored = clone(preset);
    this.presets.set(stored.id, stored);
    return { ok: true, preset: clone(stored) };
  }

  private getPreset(presetId: string): ExportPresetCrudResponse {
    const preset = this.presets.get(presetId);
    if (!preset) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        error: `Export preset not found: ${presetId}`,
      };
    }
    return { ok: true, preset: clone(preset) };
  }

  private listPresets(): ExportPresetCrudResponse {
    const presets = sortPresetsByName([...this.presets.values()]).map((preset) => clone(preset));
    return { ok: true, presets };
  }

  private updatePreset(presetId: string, preset: ExportPreset): ExportPresetCrudResponse {
    if (!this.presets.has(presetId)) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        error: `Export preset not found: ${presetId}`,
      };
    }

    if (preset.id !== presetId) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        error: 'Preset id must match presetId',
      };
    }

    const stored = clone(preset);
    this.presets.set(presetId, stored);
    return { ok: true, preset: clone(stored) };
  }

  private deletePreset(presetId: string): ExportPresetCrudResponse {
    if (!this.presets.has(presetId)) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        error: `Export preset not found: ${presetId}`,
      };
    }

    this.presets.delete(presetId);
    return { ok: true, deletedId: presetId };
  }

  /**
   * Execute an export job using the appropriate format exporter.
   * Manages job status transitions during the export lifecycle.
   */
  public async runExport(jobId: string, options: ExportOptions): Promise<ExportResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { ok: false, error: `Export job not found: ${jobId}`, warnings: [] };
    }

    const exporter = getExporter(job.format);
    if (!exporter) {
      this.updateJobStatus(jobId, 'failed', undefined, `Unsupported export format: ${job.format}`);
      return { ok: false, error: `Unsupported export format: ${job.format}`, warnings: [] };
    }

    this.updateJobStatus(jobId, 'running');

    try {
      const result = await exporter.export(options);
      if (result.ok) {
        this.updateJobStatus(jobId, 'completed', result.warnings);
      } else {
        this.updateJobStatus(jobId, 'failed', result.warnings, result.error);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.updateJobStatus(jobId, 'failed', undefined, message);
      return { ok: false, error: message, warnings: [] };
    }
  }
}
