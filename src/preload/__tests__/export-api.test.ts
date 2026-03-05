import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
}));

const { mockValidatedInvoke, mockCreateTypedValidatedInvoke } = vi.hoisted(() => {
  const hoistedMockValidatedInvoke = vi.fn();
  const hoistedMockCreateTypedValidatedInvoke = vi.fn(
    (channel: unknown, requestSchema: unknown, responseSchema: unknown) =>
      (request: unknown) =>
        hoistedMockValidatedInvoke(channel, requestSchema, responseSchema, request)
  );

  return {
    mockValidatedInvoke: hoistedMockValidatedInvoke,
    mockCreateTypedValidatedInvoke: hoistedMockCreateTypedValidatedInvoke,
  };
});

vi.mock('../validated-invoke', () => ({
  createTypedValidatedInvoke: (
    channel: unknown,
    requestSchema: unknown,
    responseSchema: unknown
  ) => mockCreateTypedValidatedInvoke(channel, requestSchema, responseSchema),
}));

import { EXPORT_IPC_CHANNELS, exportApi } from '../export-api';

const TEST_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_DATE = '2026-02-18T10:00:00.000Z';

function createJob() {
  return {
    id: TEST_ID,
    preset: {
      id: TEST_ID,
      name: 'PDF preset',
      format: 'pdf' as const,
      options: {},
    },
    format: 'pdf' as const,
    sourcePath: '/tmp/source.mdx',
    targetPath: '/tmp/output.pdf',
    generationMode: 'native' as const,
    status: 'queued' as const,
    warnings: [],
    createdAt: TEST_DATE,
  };
}

describe('export-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes export job lifecycle channel', async () => {
    const request = { action: 'list' as const };
    const response = { ok: true as const, jobs: [] };
    mockValidatedInvoke.mockResolvedValue(response);

    const result = await exportApi.jobLifecycle(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      EXPORT_IPC_CHANNELS.jobLifecycle,
      expect.any(Object),
      expect.any(Object),
      request
    );
    expect(result).toEqual(response);
  });

  it('invokes export preset CRUD channel', async () => {
    const request = { action: 'list' as const };
    const response = { ok: true as const, presets: [] };
    mockValidatedInvoke.mockResolvedValue(response);

    const result = await exportApi.presetCrud(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      EXPORT_IPC_CHANNELS.presetCrud,
      expect.any(Object),
      expect.any(Object),
      request
    );
    expect(result).toEqual(response);
  });

  it('invokes export CLI channel', async () => {
    const job = createJob();
    const request = {
      job,
      command: 'mdxpad-export',
      args: ['--format', 'pdf'],
    };
    const response = {
      ok: true as const,
      output: {
        job,
        exitCode: 0,
        durationMs: 120,
        artifactPath: '/tmp/output.pdf',
        events: [{ level: 'success' as const, message: 'done', timestamp: TEST_DATE }],
      },
    };
    mockValidatedInvoke.mockResolvedValue(response);

    const result = await exportApi.cliInvoke(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      EXPORT_IPC_CHANNELS.cliInvoke,
      expect.any(Object),
      expect.any(Object),
      request
    );
    expect(result).toEqual(response);
  });

  it('invokes llms generation channel', async () => {
    const request = {
      action: 'generate' as const,
      target: 'llms.txt' as const,
      sourcePath: '/tmp/source.mdx',
      content: '# llms',
      outputPath: '/tmp/llms.txt',
      overwrite: false,
    };
    const response = {
      ok: true as const,
      target: 'llms.txt' as const,
      path: '/tmp/llms.txt',
      bytesWritten: 6,
    };
    mockValidatedInvoke.mockResolvedValue(response);

    const result = await exportApi.llmsGenerate(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      EXPORT_IPC_CHANNELS.llmsGenerate,
      expect.any(Object),
      expect.any(Object),
      request
    );
    expect(result).toEqual(response);
  });
});
