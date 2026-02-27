import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';

import type { ExportOrchestratorService } from '@main/services/export-orchestrator';
import type { ExportPreset, ExportJob } from '@shared/types/export-model';
import {
  registerExportHandlers,
  EXPORT_IPC_CHANNELS,
  type ExportCliService,
} from '../export-handlers';

const mockIpcMain = {
  handle: vi.fn(),
} as unknown as IpcMain;

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 17,
      mainFrame: { routingId: 71 },
    },
  } as unknown as BrowserWindow;
}

function createInvokeEvent(
  window: BrowserWindow,
  overrides?: { senderId?: number; senderFrameRoutingId?: number }
): IpcMainInvokeEvent {
  return {
    sender: {
      id: overrides?.senderId ?? window.webContents.id,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: {
      routingId: overrides?.senderFrameRoutingId ?? window.webContents.mainFrame.routingId,
    },
  } as unknown as IpcMainInvokeEvent;
}

function createPreset(overrides: Partial<ExportPreset> = {}): ExportPreset {
  return {
    id: '550e8400-e29b-41d4-a716-446655440101',
    name: 'PDF preset',
    format: 'pdf',
    options: {},
    ...overrides,
  };
}

function createJob(overrides: Partial<ExportJob> = {}): ExportJob {
  const preset = overrides.preset ?? createPreset();
  return {
    id: '550e8400-e29b-41d4-a716-446655440102',
    preset,
    format: preset.format,
    sourcePath: '/tmp/input.mdx',
    targetPath: '/tmp/output.pdf',
    generationMode: 'llm',
    llm: { modelId: 'gpt-5-mini' },
    status: 'queued',
    warnings: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createDependencies() {
  const handleJobLifecycle = vi.fn();
  const handlePresetCrud = vi.fn();
  const invokeExportCli = vi.fn();
  const generateLlmsFile = vi.fn();

  return {
    orchestratorService: {
      handleJobLifecycle,
      handlePresetCrud,
    } as unknown as ExportOrchestratorService,
    cliService: {
      invokeExportCli: invokeExportCli as ExportCliService['invokeExportCli'],
      generateLlmsFile: generateLlmsFile as ExportCliService['generateLlmsFile'],
    },
    handleJobLifecycle,
    handlePresetCrud,
    invokeExportCli,
    generateLlmsFile,
  };
}

describe('registerExportHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers export lifecycle, preset, CLI, and llms handlers', () => {
    const window = createMockWindow();
    const dependencies = createDependencies();

    registerExportHandlers(mockIpcMain, window, dependencies);

    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      EXPORT_IPC_CHANNELS.jobLifecycle,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      EXPORT_IPC_CHANNELS.presetCrud,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      EXPORT_IPC_CHANNELS.cliInvoke,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      EXPORT_IPC_CHANNELS.llmsGenerate,
      expect.any(Function)
    );
  });

  it('rejects unauthorized sender for export handlers', () => {
    const window = createMockWindow();
    const dependencies = createDependencies();
    registerExportHandlers(mockIpcMain, window, dependencies);

    const lifecycleCall = vi
      .mocked(mockIpcMain.handle)
      .mock.calls.find(([channel]) => channel === EXPORT_IPC_CHANNELS.jobLifecycle);
    const lifecycleHandler = lifecycleCall?.[1] as
      | ((event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>)
      | undefined;

    expect(lifecycleHandler).toBeDefined();
    expect(() =>
      lifecycleHandler!(createInvokeEvent(window, { senderId: window.webContents.id + 1 }), {
        action: 'list',
      })
    ).toThrow('Unauthorized IPC sender');
  });
});

describe('export lifecycle handlers', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;
  let window: BrowserWindow;
  let dependencies: ReturnType<typeof createDependencies>;
  let event: IpcMainInvokeEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
    window = createMockWindow();
    event = createInvokeEvent(window);
    dependencies = createDependencies();

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    registerExportHandlers(mockIpcMain, window, dependencies);
  });

  it('validates and handles export job lifecycle requests', async () => {
    const job = createJob();
    const request = { action: 'list' as const };
    const response = { ok: true as const, jobs: [job] };
    dependencies.handleJobLifecycle.mockReturnValue(response);

    const result = await handlers[EXPORT_IPC_CHANNELS.jobLifecycle]!(event, request);

    expect(result).toEqual(response);
    expect(dependencies.handleJobLifecycle).toHaveBeenCalledWith(request);
  });

  it('rejects invalid export lifecycle payloads before reaching services', async () => {
    expect(() =>
      handlers[EXPORT_IPC_CHANNELS.jobLifecycle]!(event, { action: 'list', status: 'invalid' })
    ).toThrow();

    expect(dependencies.handleJobLifecycle).not.toHaveBeenCalled();
  });

  it('validates export lifecycle responses against contract schema', async () => {
    dependencies.handleJobLifecycle.mockReturnValue({ ok: true });

    expect(() => handlers[EXPORT_IPC_CHANNELS.jobLifecycle]!(event, { action: 'list' })).toThrow();
  });

  it('validates and handles export preset CRUD requests', async () => {
    const preset = createPreset();
    const request = { action: 'list' as const };
    const response = { ok: true as const, presets: [preset] };
    dependencies.handlePresetCrud.mockReturnValue(response);

    const result = await handlers[EXPORT_IPC_CHANNELS.presetCrud]!(event, request);

    expect(result).toEqual(response);
    expect(dependencies.handlePresetCrud).toHaveBeenCalledWith(request);
  });

  it('validates and handles export CLI invocation requests', async () => {
    const request = {
      job: createJob(),
      command: 'mdxpad-export',
      args: ['--format', 'pdf'],
    };
    const response = {
      ok: true as const,
      output: {
        job: request.job,
        exitCode: 0,
        durationMs: 42,
        artifactPath: '/tmp/output.pdf',
        events: [
          {
            level: 'success' as const,
            message: 'Export completed',
            timestamp: '2026-01-01T00:00:01.000Z',
          },
        ],
      },
    };
    dependencies.invokeExportCli.mockResolvedValue(response);

    const result = await handlers[EXPORT_IPC_CHANNELS.cliInvoke]!(event, request);

    expect(result).toEqual(response);
    expect(dependencies.invokeExportCli).toHaveBeenCalledWith(request);
  });

  it('validates and handles llms generation requests', async () => {
    const request = {
      action: 'generate' as const,
      target: 'llms.txt' as const,
      sourcePath: '/tmp/input.mdx',
      content: '# llms',
      outputPath: '/tmp/llms.txt',
      overwrite: true,
    };
    const response = {
      ok: true as const,
      target: 'llms.txt' as const,
      path: '/tmp/llms.txt',
      bytesWritten: 6,
    };
    dependencies.generateLlmsFile.mockResolvedValue(response);

    const result = await handlers[EXPORT_IPC_CHANNELS.llmsGenerate]!(event, request);

    expect(result).toEqual(response);
    expect(dependencies.generateLlmsFile).toHaveBeenCalledWith(request);
  });
});
