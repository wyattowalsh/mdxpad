import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ExportJob, ExportPreset } from '@shared/types/export-model';
import { ExportOrchestratorService } from '../export-orchestrator';

function createPreset(overrides: Partial<ExportPreset> = {}): ExportPreset {
  return {
    id: randomUUID(),
    name: 'Default PDF',
    format: 'pdf',
    options: {},
    ...overrides,
  };
}

function createJob(overrides: Partial<ExportJob> = {}): ExportJob {
  const preset = overrides.preset ?? createPreset();
  return {
    id: randomUUID(),
    preset,
    format: preset.format,
    sourcePath: '/tmp/input.mdx',
    targetPath: `/tmp/output-${randomUUID()}.${preset.format}`,
    generationMode: 'native',
    status: 'queued',
    warnings: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ExportOrchestratorService - job lifecycle', () => {
  it('creates jobs and returns them via get/list APIs', () => {
    const service = new ExportOrchestratorService();
    const job = createJob();

    const created = service.handleJobLifecycle({ action: 'create', job });
    expect(created.ok).toBe(true);
    if (!created.ok || !('job' in created)) {
      throw new Error('Expected create to return a job payload');
    }
    expect(created.job.id).toBe(job.id);

    const fetched = service.handleJobLifecycle({ action: 'get', jobId: job.id });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || !('job' in fetched)) {
      throw new Error('Expected get to return a job payload');
    }
    expect(fetched.job.id).toBe(job.id);

    const listed = service.handleJobLifecycle({ action: 'list' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || !('jobs' in listed)) {
      throw new Error('Expected list to return jobs');
    }
    expect(listed.jobs).toHaveLength(1);

    const duplicate = service.handleJobLifecycle({ action: 'create', job });
    expect(duplicate).toMatchObject({
      ok: false,
      code: 'INVALID_STATE',
    });
  });

  it('updates status with lifecycle timestamps and guards invalid transitions', () => {
    const nowValues = ['2026-01-01T00:00:01.000Z', '2026-01-01T00:00:02.000Z'];
    const service = new ExportOrchestratorService({
      now: () => nowValues.shift() ?? '2026-01-01T00:00:03.000Z',
    });
    const job = createJob();

    service.handleJobLifecycle({ action: 'create', job });

    const running = service.handleJobLifecycle({
      action: 'update-status',
      jobId: job.id,
      status: 'running',
      warnings: ['Renderer fallback in use'],
    });
    expect(running.ok).toBe(true);
    if (!running.ok || !('job' in running)) {
      throw new Error('Expected running status update to return job payload');
    }
    expect(running.job.startedAt).toBe('2026-01-01T00:00:01.000Z');
    expect(running.job.warnings).toEqual(['Renderer fallback in use']);

    const completed = service.handleJobLifecycle({
      action: 'update-status',
      jobId: job.id,
      status: 'completed',
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok || !('job' in completed)) {
      throw new Error('Expected completed status update to return job payload');
    }
    expect(completed.job.completedAt).toBe('2026-01-01T00:00:02.000Z');

    const cancelled = service.handleJobLifecycle({ action: 'cancel', jobId: job.id });
    expect(cancelled).toMatchObject({
      ok: false,
      code: 'INVALID_STATE',
    });
  });

  it('returns a validation error when lifecycle payload does not match schema', () => {
    const service = new ExportOrchestratorService();

    const invalidRequest = {
      action: 'update-status',
      jobId: randomUUID(),
      status: 'not-a-real-status',
    };

    const response = service.handleJobLifecycle(invalidRequest as never);
    expect(response).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
  });

  it('returns a validation error when job format differs from preset format', () => {
    const service = new ExportOrchestratorService();
    const invalidJob = createJob({
      format: 'docx',
      preset: createPreset({ format: 'pdf' }),
    });

    const response = service.handleJobLifecycle({ action: 'create', job: invalidJob });
    expect(response).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('ExportOrchestratorService - preset management', () => {
  it('supports preset create/list/update/delete operations', () => {
    const service = new ExportOrchestratorService();
    const preset = createPreset({ name: 'Team PDF' });

    const created = service.handlePresetCrud({ action: 'create', preset });
    expect(created.ok).toBe(true);
    if (!created.ok || !('preset' in created)) {
      throw new Error('Expected create to return preset payload');
    }
    expect(created.preset.name).toBe('Team PDF');

    const duplicate = service.handlePresetCrud({ action: 'create', preset });
    expect(duplicate).toMatchObject({
      ok: false,
      code: 'ALREADY_EXISTS',
    });

    const updated = service.handlePresetCrud({
      action: 'update',
      presetId: preset.id,
      preset: { ...preset, name: 'Team PDF (v2)' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || !('preset' in updated)) {
      throw new Error('Expected update to return preset payload');
    }
    expect(updated.preset.name).toBe('Team PDF (v2)');

    const listed = service.handlePresetCrud({ action: 'list' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || !('presets' in listed)) {
      throw new Error('Expected list to return presets payload');
    }
    expect(listed.presets).toHaveLength(1);

    const deleted = service.handlePresetCrud({ action: 'delete', presetId: preset.id });
    expect(deleted).toEqual({
      ok: true,
      deletedId: preset.id,
    });

    const missing = service.handlePresetCrud({ action: 'get', presetId: preset.id });
    expect(missing).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });
});
