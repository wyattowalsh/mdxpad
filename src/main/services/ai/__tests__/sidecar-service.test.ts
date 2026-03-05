import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import * as path from 'node:path';

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockElectronApp } = vi.hoisted(() => ({
  mockElectronApp: {
    isPackaged: false,
    getAppPath: () => '/app/path',
  },
}));

vi.mock('electron', () => ({
  app: mockElectronApp,
}));

import { SidecarLifecycleService } from '../sidecar-service';

class MockChildProcess extends EventEmitter {
  public readonly pid: number;
  public killed = false;
  public exitCode: number | null = null;
  public signalCode: NodeJS.Signals | null = null;

  public readonly kill = vi.fn((signal?: NodeJS.Signals) => {
    this.killed = true;
    this.signalCode = signal ?? null;
    this.exitCode = 0;
    this.emit('exit', 0, signal ?? null);
    return true;
  });

  constructor(pid: number) {
    super();
    this.pid = pid;
  }
}

describe('SidecarLifecycleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronApp.isPackaged = false;
  });

  it('stores effective config and reports stopped status', async () => {
    const service = new SidecarLifecycleService({
      binaryPath: '/usr/local/bin/llama-server',
      verifyBinaryPath: vi.fn().mockResolvedValue(undefined),
      spawnProcess: vi.fn(),
      env: {},
    });

    await service.configure({
      modelPath: '/models/test.gguf',
      port: 11470,
      threads: 4,
    });

    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        success: true,
        status: 'stopped',
        config: expect.objectContaining({
          modelPath: '/models/test.gguf',
          port: 11470,
          threads: 4,
        }),
      })
    );
  });

  it('starts sidecar process on localhost and exposes endpoint/pid', async () => {
    const child = new MockChildProcess(4242);
    const spawnProcess = vi.fn(() => child as unknown as ChildProcess);
    const service = new SidecarLifecycleService({
      binaryPath: '/usr/local/bin/llama-server',
      verifyBinaryPath: vi.fn().mockResolvedValue(undefined),
      spawnProcess,
      env: {},
    });

    await service.configure({
      modelPath: '/models/test.gguf',
      port: 11470,
      contextSize: 4096,
      gpuLayers: 10,
      threads: 8,
    });

    const startPromise = service.start();
    setTimeout(() => child.emit('spawn'), 0);
    const status = await startPromise;

    expect(spawnProcess).toHaveBeenCalledWith(
      '/usr/local/bin/llama-server',
      expect.arrayContaining([
        '--host',
        '127.0.0.1',
        '--port',
        '11470',
        '--model',
        '/models/test.gguf',
      ]),
      expect.objectContaining({
        shell: false,
      })
    );
    expect(status).toEqual(
      expect.objectContaining({
        success: true,
        status: 'running',
        pid: 4242,
        endpoint: 'http://127.0.0.1:11470',
      })
    );
  });

  it('fails when start is called without sidecar configuration', async () => {
    const service = new SidecarLifecycleService({
      binaryPath: '/usr/local/bin/llama-server',
      verifyBinaryPath: vi.fn().mockResolvedValue(undefined),
      spawnProcess: vi.fn(),
      env: {},
    });

    await expect(service.start()).rejects.toMatchObject({
      code: 'SIDECAR_CONFIG_MISSING',
      message: 'Sidecar configuration is missing',
    });
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        success: false,
        status: 'error',
        error: expect.objectContaining({
          code: 'SIDECAR_CONFIG_MISSING',
        }),
      })
    );
  });

  it('fails with explicit start error when child process emits startup error', async () => {
    const child = new MockChildProcess(4242);
    const service = new SidecarLifecycleService({
      binaryPath: '/usr/local/bin/llama-server',
      verifyBinaryPath: vi.fn().mockResolvedValue(undefined),
      spawnProcess: vi.fn(() => child as unknown as ChildProcess),
      env: {},
    });

    await service.configure({
      modelPath: '/models/test.gguf',
      port: 11470,
    });

    const startPromise = service.start();
    setTimeout(() => child.emit('error', new Error('spawn failed')), 0);

    await expect(startPromise).rejects.toMatchObject({
      code: 'SIDECAR_START_FAILED',
      message: 'spawn failed',
    });
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        success: false,
        status: 'error',
        error: expect.objectContaining({
          code: 'SIDECAR_START_FAILED',
          message: 'spawn failed',
        }),
      })
    );
  });

  it('reports explicit error state when process exits unexpectedly', async () => {
    const child = new MockChildProcess(4242);
    const service = new SidecarLifecycleService({
      binaryPath: '/usr/local/bin/llama-server',
      verifyBinaryPath: vi.fn().mockResolvedValue(undefined),
      spawnProcess: vi.fn(() => child as unknown as ChildProcess),
      env: {},
    });

    await service.configure({
      modelPath: '/models/test.gguf',
      port: 11470,
    });

    const startPromise = service.start();
    setTimeout(() => child.emit('spawn'), 0);
    await startPromise;
    child.emit('exit', 1, null);

    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        success: false,
        status: 'error',
        error: expect.objectContaining({
          code: 'SIDECAR_EXITED',
          message: expect.stringContaining('exit code 1'),
        }),
      })
    );
  });

  it('stops running sidecar and clears endpoint/pid from status', async () => {
    const child = new MockChildProcess(4242);
    const service = new SidecarLifecycleService({
      binaryPath: '/usr/local/bin/llama-server',
      verifyBinaryPath: vi.fn().mockResolvedValue(undefined),
      spawnProcess: vi.fn(() => child as unknown as ChildProcess),
      env: {},
    });

    await service.configure({
      modelPath: '/models/test.gguf',
      port: 11470,
    });

    const startPromise = service.start();
    setTimeout(() => child.emit('spawn'), 0);
    await startPromise;

    const stopStatus = await service.stop();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(stopStatus).toEqual(
      expect.objectContaining({
        success: true,
        status: 'stopped',
      })
    );
    expect(stopStatus.pid).toBeUndefined();
    expect(stopStatus.endpoint).toBeUndefined();
  });

  it('fails with explicit error when stop is called while sidecar is not running', async () => {
    const service = new SidecarLifecycleService({
      binaryPath: '/usr/local/bin/llama-server',
      verifyBinaryPath: vi.fn().mockResolvedValue(undefined),
      spawnProcess: vi.fn(),
      env: {},
    });

    await expect(service.stop()).rejects.toMatchObject({
      code: 'SIDECAR_NOT_RUNNING',
      message: 'Sidecar process is not running',
    });
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        success: false,
        status: 'error',
        error: expect.objectContaining({
          code: 'SIDECAR_NOT_RUNNING',
        }),
      })
    );
  });

  it('fails with explicit error when binary path is missing', async () => {
    const service = new SidecarLifecycleService({
      verifyBinaryPath: vi.fn().mockRejectedValue(new Error('ENOENT')),
      spawnProcess: vi.fn(),
      env: {},
    });

    await service.configure({
      modelPath: '/models/test.gguf',
      port: 11470,
    });

    await expect(service.start()).rejects.toMatchObject({
      code: 'SIDECAR_BINARY_PATH_MISSING',
      message: expect.stringContaining('Checked:'),
    });

    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        success: false,
        status: 'error',
        error: expect.objectContaining({
          code: 'SIDECAR_BINARY_PATH_MISSING',
        }),
      })
    );
  });

  it('resolves bundled sidecar binary path candidates when not explicitly configured', async () => {
    const child = new MockChildProcess(4242);
    const spawnProcess = vi.fn(() => child as unknown as ChildProcess);
    const expectedBinaryPath = path.resolve(
      '/app/path',
      'resources',
      'sidecar',
      process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
    );
    const verifyBinaryPath = vi.fn().mockImplementation(async (binaryPath: string) => {
      if (binaryPath === expectedBinaryPath) {
        return;
      }
      throw new Error('ENOENT');
    });

    const service = new SidecarLifecycleService({
      verifyBinaryPath,
      spawnProcess,
      env: {},
    });

    await service.configure({
      modelPath: '/models/test.gguf',
      port: 11470,
    });

    const startPromise = service.start();
    setTimeout(() => child.emit('spawn'), 0);
    await startPromise;

    expect(spawnProcess).toHaveBeenCalledWith(
      expectedBinaryPath,
      expect.any(Array),
      expect.objectContaining({
        shell: false,
      })
    );
  });

  it('resolves packaged sidecar binary path when app is packaged', async () => {
    const child = new MockChildProcess(4242);
    const spawnProcess = vi.fn(() => child as unknown as ChildProcess);
    const processWithResourcesPath = process as NodeJS.Process & { resourcesPath?: string };
    const previousResourcesPath = processWithResourcesPath.resourcesPath;
    const packagedResourcesPath = path.resolve('/Applications/mdxpad.app/Contents/Resources');
    const expectedBinaryPath = path.join(
      packagedResourcesPath,
      'sidecar',
      process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
    );
    const verifyBinaryPath = vi.fn().mockImplementation(async (binaryPath: string) => {
      if (binaryPath === expectedBinaryPath) {
        return;
      }
      throw new Error('ENOENT');
    });
    mockElectronApp.isPackaged = true;
    processWithResourcesPath.resourcesPath = packagedResourcesPath;

    try {
      const service = new SidecarLifecycleService({
        verifyBinaryPath,
        spawnProcess,
        env: {},
      });

      await service.configure({
        modelPath: '/models/test.gguf',
        port: 11470,
      });

      const startPromise = service.start();
      setTimeout(() => child.emit('spawn'), 0);
      await startPromise;

      expect(spawnProcess).toHaveBeenCalledWith(
        expectedBinaryPath,
        expect.any(Array),
        expect.objectContaining({
          shell: false,
        })
      );
    } finally {
      mockElectronApp.isPackaged = false;
      if (previousResourcesPath === undefined) {
        Reflect.deleteProperty(processWithResourcesPath, 'resourcesPath');
      } else {
        processWithResourcesPath.resourcesPath = previousResourcesPath;
      }
    }
  });

  it('fails with explicit error for relative model paths', async () => {
    const service = new SidecarLifecycleService({
      binaryPath: '/usr/local/bin/llama-server',
      verifyBinaryPath: vi.fn().mockResolvedValue(undefined),
      spawnProcess: vi.fn(),
      env: {},
    });

    await expect(
      service.configure({
        modelPath: 'relative/path.gguf',
        port: 11470,
      })
    ).rejects.toMatchObject({
      code: 'SIDECAR_INVALID_CONFIG',
    });
  });
});
