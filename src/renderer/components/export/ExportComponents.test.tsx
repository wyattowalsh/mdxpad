import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ExportCliInvokeRequest,
  ExportCliInvokeResponse,
  ExportJobLifecycleRequest,
  ExportJobLifecycleResponse,
  ExportPresetCrudResponse,
  LlmsGenerationResponse,
} from '@shared/contracts/export-schemas';
import type { ExportCliOutput, ExportJob, ExportPreset } from '@shared/types/export-model';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useExportStore } from '@renderer/stores/export-store';
import { useTabStore } from '@renderer/stores/tab-store';

import { ExportCliInvocation } from './ExportCliInvocation';
import { ExportJobList } from './ExportJobList';
import { ExportPresetActions } from './ExportPresetActions';
import { LlmsGenerationAction } from './LlmsGenerationAction';

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
    durationMs: 100,
    artifactPath: '/tmp/output.pdf',
    events: [],
    ...overrides,
  };
}

type ExportApiMock = {
  jobLifecycle: ReturnType<
    typeof vi.fn<(r: ExportJobLifecycleRequest) => Promise<ExportJobLifecycleResponse>>
  >;
  presetCrud: ReturnType<typeof vi.fn<(r: unknown) => Promise<ExportPresetCrudResponse>>>;
  cliInvoke: ReturnType<
    typeof vi.fn<(r: ExportCliInvokeRequest) => Promise<ExportCliInvokeResponse>>
  >;
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

const exportFile = vi.fn();

function setWindowExportApi(mockExportApi: ExportApiMock): void {
  (
    window as unknown as { mdxpad: { export: ExportApiMock; exportFile: typeof exportFile } }
  ).mdxpad = {
    export: mockExportApi,
    exportFile,
  };
}

describe('export components', () => {
  let mockExportApi: ExportApiMock;

  beforeEach(() => {
    mockExportApi = createExportApiMock();
    setWindowExportApi(mockExportApi);

    act(() => {
      useExportStore.getState().reset();
      useDocumentStore.getState().reset();
      useTabStore.getState().reset();
    });

    vi.clearAllMocks();
    exportFile.mockReset();
  });

  afterEach(() => {
    cleanup();
    act(() => {
      useExportStore.getState().reset();
    });
  });

  it('loads and renders export jobs', async () => {
    const queuedJob = createJob({ status: 'queued' });
    mockExportApi.jobLifecycle.mockResolvedValueOnce({ ok: true, jobs: [queuedJob] });

    render(<ExportJobList />);

    await waitFor(() => {
      expect(mockExportApi.jobLifecycle).toHaveBeenCalledWith({ action: 'list' });
    });

    expect(screen.getByText(queuedJob.preset.name)).toBeTruthy();
    expect(screen.getByText(queuedJob.targetPath)).toBeTruthy();
    expect(screen.getByText('queued')).toBeTruthy();
  });

  it('exports the open document in the selected format', async () => {
    const preset = createPreset();

    mockExportApi.presetCrud.mockResolvedValueOnce({ ok: true, presets: [preset] });
    mockExportApi.jobLifecycle.mockResolvedValueOnce({
      ok: true,
      job: createJob({
        id: TEST_ID_TWO,
        preset,
        status: 'completed',
        targetPath: '/tmp/custom.pdf',
      }),
    });
    exportFile.mockResolvedValueOnce({
      ok: true,
      value: { path: '/tmp/custom.pdf', format: 'pdf', warnings: [] },
    });

    render(<ExportPresetActions content="# Note" sourcePath="/tmp/source.mdx" />);

    await waitFor(() => {
      expect(mockExportApi.presetCrud).toHaveBeenCalledWith({ action: 'list' });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Export document' }));

    await waitFor(() => {
      expect(exportFile).toHaveBeenCalledWith('# Note', {
        sourcePath: '/tmp/source.mdx',
        format: 'pdf',
      });
    });

    await waitFor(() => {
      expect(mockExportApi.jobLifecycle).toHaveBeenCalled();
    });

    const createCall = mockExportApi.jobLifecycle.mock.calls.find(
      ([request]: [ExportJobLifecycleRequest]) => request.action === 'create'
    );

    expect(createCall).toBeTruthy();
    expect(createCall?.[0]).toMatchObject({
      action: 'create',
      job: {
        preset,
        format: 'pdf',
        sourcePath: '/tmp/source.mdx',
        targetPath: '/tmp/custom.pdf',
        generationMode: 'native',
        status: 'completed',
        warnings: [],
      },
    });
  });

  it('invokes CLI for selected export job', async () => {
    const queuedJob = createJob({ status: 'queued' });
    mockExportApi.cliInvoke.mockResolvedValueOnce({
      ok: true,
      output: createCliOutput({
        job: createJob({ ...queuedJob, status: 'completed', completedAt: TEST_DATE }),
      }),
    });

    act(() => {
      useExportStore.setState({ jobs: [queuedJob] });
    });

    render(<ExportCliInvocation />);

    fireEvent.change(screen.getByLabelText('CLI command'), {
      target: { value: 'mdxpad-export' },
    });
    fireEvent.change(screen.getByLabelText('CLI args'), {
      target: { value: '--format pdf --verbose' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run export CLI' }));

    await waitFor(() => {
      expect(mockExportApi.cliInvoke).toHaveBeenCalledWith({
        job: queuedJob,
        command: 'mdxpad-export',
        args: ['--format', 'pdf', '--verbose'],
      });
    });
  });

  it('sends the open editor text with the export job', async () => {
    const queuedJob = createJob({ status: 'queued' });
    useDocumentStore.setState({ filePath: '/tmp/source.mdx', content: '# Live draft' });
    mockExportApi.cliInvoke.mockResolvedValueOnce({
      ok: true,
      output: createCliOutput({
        job: createJob({ ...queuedJob, status: 'completed', completedAt: TEST_DATE }),
      }),
    });
    act(() => {
      useExportStore.setState({ jobs: [queuedJob] });
    });

    render(<ExportCliInvocation />);
    fireEvent.click(screen.getByRole('button', { name: 'Run export CLI' }));

    await waitFor(() => {
      expect(mockExportApi.cliInvoke).toHaveBeenCalledWith({
        job: queuedJob,
        command: 'mdxpad-export',
        args: [],
        content: '# Live draft',
      });
    });
  });

  it('sends an unsaved tab when that file is not the active document', async () => {
    const queuedJob = createJob({ status: 'queued' });
    useDocumentStore.setState({ filePath: '/tmp/other.mdx', content: '# Other' });
    useTabStore.getState().addTab({
      filePath: '/tmp/source.mdx',
      fileName: 'source.mdx',
      isDirty: true,
      content: '# Tab draft',
      savedContent: '# Saved',
    });
    mockExportApi.cliInvoke.mockResolvedValueOnce({
      ok: true,
      output: createCliOutput({
        job: createJob({ ...queuedJob, status: 'completed', completedAt: TEST_DATE }),
      }),
    });
    act(() => {
      useExportStore.setState({ jobs: [queuedJob] });
    });

    render(<ExportCliInvocation />);
    fireEvent.click(screen.getByRole('button', { name: 'Run export CLI' }));

    await waitFor(() => {
      expect(mockExportApi.cliInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ content: '# Tab draft' })
      );
    });
  });

  it('runs llms generation with selected target', async () => {
    mockExportApi.llmsGenerate.mockResolvedValueOnce({
      ok: true,
      target: 'llms.txt',
      path: '/tmp/llms.txt',
      bytesWritten: 128,
    });

    render(<LlmsGenerationAction content="# hello" sourcePath="/tmp/source.mdx" />);

    fireEvent.change(screen.getByLabelText('Output path'), {
      target: { value: '/tmp/llms.txt' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate llms file' }));

    await waitFor(() => {
      expect(mockExportApi.llmsGenerate).toHaveBeenCalledWith({
        action: 'generate',
        target: 'llms.txt',
        sourcePath: '/tmp/source.mdx',
        content: '# hello',
        outputPath: '/tmp/llms.txt',
        overwrite: false,
      });
    });
  });
});
