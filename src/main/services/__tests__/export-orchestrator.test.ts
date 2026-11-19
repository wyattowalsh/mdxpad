import { randomUUID } from 'node:crypto';
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ExportJob, ExportPreset } from '@shared/types/export-model';
import { BUILT_IN_EXPORT_PRESETS } from '../built-in-export-presets';
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
    expect(listed.presets).toHaveLength(BUILT_IN_EXPORT_PRESETS.length + 1);
    expect(listed.presets.map((preset) => preset.format)).toEqual(
      expect.arrayContaining(['pdf', 'docx', 'epub', 'latex', 'pandoc'])
    );

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

describe('ExportOrchestratorService persistence', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('remembers a preset and job after a restart without following a link', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-export-registry-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-export-secret-'));
    tempDirs.push(root, outside);
    const secret = path.join(outside, 'secret.json');
    const storagePath = path.join(root, 'export-registry.json');
    await writeFile(secret, '{"secret":true}\n');
    await symlink(secret, storagePath);
    await symlink(secret, `${storagePath}.${process.pid}.tmp`);

    const preset = createPreset({ name: 'Team PDF' });
    const job = createJob({ preset });
    const first = new ExportOrchestratorService({ storagePath });
    expect(first.handlePresetCrud({ action: 'create', preset }).ok).toBe(true);
    expect(first.handleJobLifecycle({ action: 'create', job }).ok).toBe(true);
    expect(
      first.handlePresetCrud({ action: 'delete', presetId: BUILT_IN_EXPORT_PRESETS[3]!.id }).ok
    ).toBe(true);

    expect(await readFile(secret, 'utf-8')).toBe('{"secret":true}\n');
    expect((await lstat(storagePath)).isSymbolicLink()).toBe(false);

    const second = new ExportOrchestratorService({ storagePath });
    const listed = second.handlePresetCrud({ action: 'list' });
    const jobs = second.handleJobLifecycle({ action: 'list' });
    expect(
      listed.ok && 'presets' in listed && listed.presets.some((item) => item.name === 'Team PDF')
    ).toBe(true);
    expect(
      listed.ok &&
        'presets' in listed &&
        listed.presets.some((item) => item.id === BUILT_IN_EXPORT_PRESETS[3]!.id)
    ).toBe(false);
    expect(jobs.ok && 'jobs' in jobs && jobs.jobs.some((item) => item.id === job.id)).toBe(true);
  });

  it('leaves the preset list unchanged when the save fails', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-export-fail-'));
    tempDirs.push(root);
    const blocked = path.join(root, 'blocked');
    await writeFile(blocked, 'not a directory');
    const service = new ExportOrchestratorService({
      storagePath: path.join(blocked, 'export-registry.json'),
    });
    const preset = createPreset({ name: 'Unsaved PDF' });

    const created = service.handlePresetCrud({ action: 'create', preset });
    const listed = service.handlePresetCrud({ action: 'list' });

    expect(created).toMatchObject({ ok: false, code: 'INTERNAL_ERROR' });
    expect(
      listed.ok && 'presets' in listed && listed.presets.some((item) => item.id === preset.id)
    ).toBe(false);
  });
});
