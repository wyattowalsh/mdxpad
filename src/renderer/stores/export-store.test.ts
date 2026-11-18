import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ExportCliInvokeResponse,
  ExportJobLifecycleResponse,
  ExportPresetCrudResponse,
  LlmsGenerationResponse,
} from '@shared/contracts/export-schemas';
import type { ExportCliOutput, ExportJob, ExportPreset } from '@shared/types/export-model';
import {
  selectCliRunStatus,
  selectExportJobs,
  selectExportPresets,
  selectLlmsResult,
  useExportStore,
} from './export-store';

const TEST_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_ID_TWO = '660e8400-e29b-41d4-a716-446655440000';
const TEST_DATE = '2026-02-18T10:00:00.000Z';

function createPreset(overrides: Partial<ExportPreset> = {}): ExportPreset {
  return {
    id: TEST_ID,
    name: 'Default PDF',
    format: 'pdf',
    options: {},
    ...overrides,
  };
}

function createJob(overrides: Partial<ExportJob> = {}): ExportJob {
  const preset = overrides.preset ?? createPreset();
  return {
    id: TEST_ID,
    preset,
    format: preset.format,
    sourcePath: '/tmp/source.mdx',
    targetPath: '/tmp/output.pdf',
    generationMode: 'native',
    status: 'queued',
    warnings: [],
    createdAt: TEST_DATE,
    ...overrides,
  };
}

function createCliOutput(overrides: Partial<ExportCliOutput> = {}): ExportCliOutput {
  const job = overrides.job ?? createJob();
  return {
    job,
    exitCode: 0,
    durationMs: 120,
    artifactPath: '/tmp/output.pdf',
    events: [],
    ...overrides,
  };
}

type ExportApiMock = {
  jobLifecycle: ReturnType<typeof vi.fn<(r: unknown) => Promise<ExportJobLifecycleResponse>>>;
  presetCrud: ReturnType<typeof vi.fn<(r: unknown) => Promise<ExportPresetCrudResponse>>>;
  cliInvoke: ReturnType<typeof vi.fn<(r: unknown) => Promise<ExportCliInvokeResponse>>>;
  llmsGenerate: ReturnType<typeof vi.fn<(r: unknown) => Promise<LlmsGenerationResponse>>>;
};

function createExportApiMock(): ExportApiMock {
  return {
    jobLifecycle: vi.fn(),
    presetCrud: vi.fn(),
    cliInvoke: vi.fn(),
    llmsGenerate: vi.fn(),
  };
}

function setWindowExportApi(mockExportApi: ExportApiMock): void {
  (globalThis as unknown as { window: { mdxpad: { export: ExportApiMock } } }).window = {
    mdxpad: {
      export: mockExportApi,
    },
  };
}

describe('useExportStore', () => {
  let mockExportApi: ExportApiMock;

  beforeEach(() => {
    mockExportApi = createExportApiMock();
    setWindowExportApi(mockExportApi);
    useExportStore.getState().reset();
    vi.clearAllMocks();
  });

  it('starts with initial state', () => {
    const state = useExportStore.getState();

    expect(state.jobs).toEqual([]);
    expect(state.presets).toEqual([]);
    expect(state.isLoadingJobs).toBe(false);
    expect(state.isLoadingPresets).toBe(false);
    expect(state.cliRunStatus).toBe('idle');
    expect(state.llmsResult).toBeNull();
  });

  it('loads jobs via preload export API', async () => {
    const job = createJob();
    mockExportApi.jobLifecycle.mockResolvedValue({
      ok: true,
      jobs: [job],
    });

    await useExportStore.getState().loadJobs();
    const state = useExportStore.getState();

    expect(mockExportApi.jobLifecycle).toHaveBeenCalledWith({ action: 'list' });
    expect(selectExportJobs(state)).toEqual([job]);
    expect(state.jobsError).toBeNull();
    expect(state.isLoadingJobs).toBe(false);
  });

  it('stores job errors when load fails', async () => {
    mockExportApi.jobLifecycle.mockResolvedValue({
      ok: false,
      code: 'INTERNAL_ERROR',
      error: 'Could not load jobs',
    });

    await useExportStore.getState().loadJobs();
    const state = useExportStore.getState();

    expect(state.jobsError).toBe('Could not load jobs');
    expect(state.isLoadingJobs).toBe(false);
  });

  it('keeps the newer export job list when an older list finishes late', async () => {
    const older = createJob({ id: TEST_ID, status: 'failed' });
    const newer = createJob({ id: TEST_ID_TWO, status: 'completed' });
    let finishOld: (value: ExportJobLifecycleResponse) => void = () => undefined;
    let finishNew: (value: ExportJobLifecycleResponse) => void = () => undefined;
    mockExportApi.jobLifecycle
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve;
          })
      );

    const first = useExportStore.getState().loadJobs('failed');
    const second = useExportStore.getState().loadJobs();
    finishOld({ ok: true, jobs: [older] });
    await first;

    expect(useExportStore.getState().isLoadingJobs).toBe(true);
    expect(useExportStore.getState().jobs).toEqual([]);

    finishNew({ ok: true, jobs: [newer] });
    await second;

    expect(useExportStore.getState().jobs.map((job) => job.id)).toEqual([TEST_ID_TWO]);
    expect(useExportStore.getState().isLoadingJobs).toBe(false);
  });

  it('keeps an export that finishes while a newer job list is open', async () => {
    const created = createJob({ id: TEST_ID, status: 'completed' });
    const listed = createJob({
      id: TEST_ID_TWO,
      status: 'queued',
      createdAt: '2026-02-18T09:00:00.000Z',
    });
    let finishCreate: (value: ExportJobLifecycleResponse) => void = () => undefined;
    let finishList: (value: ExportJobLifecycleResponse) => void = () => undefined;
    mockExportApi.jobLifecycle
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishCreate = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishList = resolve;
          })
      );

    const creating = useExportStore.getState().runJobLifecycle({ action: 'create', job: created });
    const listing = useExportStore.getState().loadJobs();
    finishList({ ok: true, jobs: [listed] });
    await listing;
    finishCreate({ ok: true, job: created });
    await creating;

    expect(useExportStore.getState().jobs.map((job) => job.id).sort()).toEqual(
      [TEST_ID, TEST_ID_TWO].sort()
    );
    expect(useExportStore.getState().isLoadingJobs).toBe(false);
  });

  it('keeps the newer preset list when an older list finishes late', async () => {
    const older = createPreset({ id: TEST_ID, name: 'Older' });
    const newer = createPreset({ id: TEST_ID_TWO, name: 'Newer' });
    let finishOld: (value: ExportPresetCrudResponse) => void = () => undefined;
    let finishNew: (value: ExportPresetCrudResponse) => void = () => undefined;
    mockExportApi.presetCrud
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve;
          })
      );

    const first = useExportStore.getState().loadPresets();
    const second = useExportStore.getState().loadPresets();
    finishOld({ ok: true, presets: [older] });
    await first;

    expect(useExportStore.getState().isLoadingPresets).toBe(true);
    expect(useExportStore.getState().presets).toEqual([]);

    finishNew({ ok: true, presets: [newer] });
    await second;

    expect(useExportStore.getState().presets.map((preset) => preset.id)).toEqual([TEST_ID_TWO]);
    expect(useExportStore.getState().isLoadingPresets).toBe(false);
  });

  it('loads presets via preload export API', async () => {
    const preset = createPreset();
    mockExportApi.presetCrud.mockResolvedValue({
      ok: true,
      presets: [preset],
    });

    await useExportStore.getState().loadPresets();
    const state = useExportStore.getState();

    expect(mockExportApi.presetCrud).toHaveBeenCalledWith({ action: 'list' });
    expect(selectExportPresets(state)).toEqual([preset]);
    expect(state.presetsError).toBeNull();
    expect(state.isLoadingPresets).toBe(false);
  });

  it('tracks CLI run state and updates job on success', async () => {
    const queuedJob = createJob({ status: 'queued' });
    const completedJob = createJob({ status: 'completed', completedAt: TEST_DATE });
    const output = createCliOutput({ job: completedJob });
    mockExportApi.cliInvoke.mockResolvedValue({
      ok: true,
      output,
    });

    await useExportStore.getState().invokeCli({
      job: queuedJob,
      command: 'mdxpad-export',
      args: ['--format', 'pdf'],
    });

    const state = useExportStore.getState();
    expect(selectCliRunStatus(state)).toBe('success');
    expect(state.isRunningCli).toBe(false);
    expect(state.cliError).toBeNull();
    expect(state.cliOutput).toEqual(output);
    expect(state.jobs).toEqual([completedJob]);
  });

  it('keeps the newer export running when an older one finishes', async () => {
    const olderJob = createJob({ id: TEST_ID, status: 'queued' });
    const newerJob = createJob({
      id: TEST_ID_TWO,
      status: 'queued',
      targetPath: '/tmp/newer.pdf',
    });
    const olderDone = createJob({ id: TEST_ID, status: 'completed', completedAt: TEST_DATE });
    const newerDone = createJob({
      id: TEST_ID_TWO,
      status: 'completed',
      completedAt: TEST_DATE,
      targetPath: '/tmp/newer.pdf',
    });
    let finishOld: (value: ExportCliInvokeResponse) => void = () => undefined;
    let finishNew: (value: ExportCliInvokeResponse) => void = () => undefined;
    mockExportApi.cliInvoke
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve;
          })
      );

    const first = useExportStore.getState().invokeCli({
      job: olderJob,
      command: 'mdxpad-export',
      args: [],
    });
    const second = useExportStore.getState().invokeCli({
      job: newerJob,
      command: 'mdxpad-export',
      args: [],
    });
    finishOld({ ok: true, output: createCliOutput({ job: olderDone }) });
    await first;

    expect(useExportStore.getState().isRunningCli).toBe(true);
    expect(useExportStore.getState().activeCliJobId).toBe(TEST_ID_TWO);
    expect(useExportStore.getState().jobs.map((job) => job.id)).toContain(TEST_ID);

    finishNew({ ok: true, output: createCliOutput({ job: newerDone }) });
    await second;

    const state = useExportStore.getState();
    expect(state.isRunningCli).toBe(false);
    expect(state.cliOutput?.job.id).toBe(TEST_ID_TWO);
    expect(state.jobs.map((job) => job.id).sort()).toEqual([TEST_ID, TEST_ID_TWO].sort());
  });

  it('tracks CLI errors and preserves output when available', async () => {
    const runningJob = createJob({ status: 'running' });
    const failedJob = createJob({
      status: 'failed',
      errorMessage: 'exit code 1',
      id: TEST_ID_TWO,
    });
    const output = createCliOutput({
      job: failedJob,
      exitCode: 1,
      artifactPath: undefined,
    });
    mockExportApi.cliInvoke.mockResolvedValue({
      ok: false,
      code: 'NON_ZERO_EXIT',
      error: 'Command exited with code 1',
      output,
    });

    await useExportStore.getState().invokeCli({
      job: runningJob,
      command: 'mdxpad-export',
      args: ['--format', 'pdf'],
    });

    const state = useExportStore.getState();
    expect(selectCliRunStatus(state)).toBe('error');
    expect(state.isRunningCli).toBe(false);
    expect(state.cliError).toBe('Command exited with code 1');
    expect(state.cliOutput).toEqual(output);
    expect(state.jobs).toEqual([failedJob]);
  });

  it('keeps the newer llms file when an older run finishes late', async () => {
    let finishOld: (value: LlmsGenerationResponse) => void = () => undefined;
    let finishNew: (value: LlmsGenerationResponse) => void = () => undefined;
    mockExportApi.llmsGenerate
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve;
          })
      );

    const first = useExportStore.getState().generateLlms({
      action: 'generate',
      target: 'llms.txt',
      sourcePath: '/tmp/source.mdx',
      content: '# old',
      outputPath: '/tmp/old.txt',
      overwrite: true,
    });
    const second = useExportStore.getState().generateLlms({
      action: 'generate',
      target: 'llms-full.txt',
      sourcePath: '/tmp/source.mdx',
      content: '# new',
      outputPath: '/tmp/new.txt',
      overwrite: true,
    });
    finishOld({
      ok: true,
      target: 'llms.txt',
      path: '/tmp/old.txt',
      bytesWritten: 1,
    });
    await first;
    expect(useExportStore.getState().isGeneratingLlms).toBe(true);
    expect(selectLlmsResult(useExportStore.getState())).toBeNull();

    finishNew({
      ok: true,
      target: 'llms-full.txt',
      path: '/tmp/new.txt',
      bytesWritten: 2,
    });
    await second;
    expect(selectLlmsResult(useExportStore.getState())?.path).toBe('/tmp/new.txt');
    expect(useExportStore.getState().isGeneratingLlms).toBe(false);
  });

  it('stores llms generation success result', async () => {
    mockExportApi.llmsGenerate.mockResolvedValue({
      ok: true,
      target: 'llms.txt',
      path: '/tmp/llms.txt',
      bytesWritten: 128,
    });

    await useExportStore.getState().generateLlms({
      action: 'generate',
      target: 'llms.txt',
      sourcePath: '/tmp/source.mdx',
      content: '# llms',
      outputPath: '/tmp/llms.txt',
      overwrite: true,
    });

    const state = useExportStore.getState();
    expect(selectLlmsResult(state)).toEqual({
      ok: true,
      target: 'llms.txt',
      path: '/tmp/llms.txt',
      bytesWritten: 128,
    });
    expect(state.llmsError).toBeNull();
    expect(state.isGeneratingLlms).toBe(false);
  });

  it('stores llms generation error message', async () => {
    mockExportApi.llmsGenerate.mockResolvedValue({
      ok: false,
      code: 'WRITE_FAILED',
      error: 'File already exists',
    });

    await useExportStore.getState().generateLlms({
      action: 'generate',
      target: 'llms-full.txt',
      sourcePath: '/tmp/source.mdx',
      content: '# llms full',
      outputPath: '/tmp/llms-full.txt',
      overwrite: false,
    });

    const state = useExportStore.getState();
    expect(selectLlmsResult(state)).toBeNull();
    expect(state.llmsError).toBe('File already exists');
    expect(state.isGeneratingLlms).toBe(false);
  });
});
