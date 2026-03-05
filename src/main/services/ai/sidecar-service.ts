import { spawn } from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as path from 'node:path';

import { AIProviderError } from '@shared/ai/errors';
import { SidecarConfigSchema } from '@shared/ai/schemas';
import type { SidecarConfigSchemaType } from '@shared/ai/schemas';
import type {
  SidecarConfig,
  SidecarLifecycleStatus,
  SidecarLifecycleStatusResponse,
} from '@shared/ai/types';
import { getBundledSidecarBinaryPathCandidates } from './sidecar-paths';

const LOCALHOST_BIND_ADDRESS = '127.0.0.1';
const DEFAULT_SIDECAR_PORT = 11434;
const DEFAULT_STARTUP_TIMEOUT_MS = 5_000;
const DEFAULT_STOP_TIMEOUT_MS = 5_000;

export interface SidecarLifecycleServiceOptions {
  binaryPath?: string;
  env?: NodeJS.ProcessEnv;
  spawnProcess?: (
    command: string,
    args: readonly string[],
    options: SpawnOptions
  ) => ChildProcess;
  verifyBinaryPath?: (binaryPath: string) => Promise<void>;
  startupTimeoutMs?: number;
  stopTimeoutMs?: number;
}

export interface ISidecarLifecycleService {
  configure(config: SidecarConfig): Promise<SidecarLifecycleStatusResponse>;
  start(config?: SidecarConfig): Promise<SidecarLifecycleStatusResponse>;
  stop(): Promise<SidecarLifecycleStatusResponse>;
  getStatus(): SidecarLifecycleStatusResponse;
}

export class SidecarLifecycleService implements ISidecarLifecycleService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly binaryPath: string | undefined;
  private readonly spawnProcess: (
    command: string,
    args: readonly string[],
    options: SpawnOptions
  ) => ChildProcess;
  private readonly verifyBinaryPath: (binaryPath: string) => Promise<void>;
  private readonly startupTimeoutMs: number;
  private readonly stopTimeoutMs: number;

  private effectiveConfig: SidecarConfig | undefined;
  private status: SidecarLifecycleStatus = 'stopped';
  private sidecarProcess: ChildProcess | null = null;
  private pid: number | undefined;
  private endpoint: string | undefined;
  private lastError: { code: string; message: string } | undefined;

  constructor(options: SidecarLifecycleServiceOptions = {}) {
    this.env = options.env ?? process.env;
    this.binaryPath = options.binaryPath;
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.verifyBinaryPath = options.verifyBinaryPath ?? assertExecutable;
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
    this.stopTimeoutMs = options.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS;
  }

  configure(config: SidecarConfig): Promise<SidecarLifecycleStatusResponse> {
    try {
      const parsed = SidecarConfigSchema.safeParse(config);
      if (!parsed.success) {
        throw this.failWithStatus(
          new AIProviderError(parsed.error.message, 'SIDECAR_INVALID_CONFIG')
        );
      }

      if (!path.isAbsolute(parsed.data.modelPath)) {
        throw this.failWithStatus(
          new AIProviderError(
            'Sidecar modelPath must be an absolute path',
            'SIDECAR_INVALID_CONFIG'
          )
        );
      }

      if (parsed.data.binaryPath && !path.isAbsolute(parsed.data.binaryPath)) {
        throw this.failWithStatus(
          new AIProviderError(
            'Sidecar binaryPath must be an absolute path',
            'SIDECAR_INVALID_CONFIG'
          )
        );
      }

      this.effectiveConfig = normalizeSidecarConfig(parsed.data);
      this.clearError();

      return Promise.resolve(this.getStatus());
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async start(config?: SidecarConfig): Promise<SidecarLifecycleStatusResponse> {
    if (config) {
      await this.configure(config);
    }

    if (this.isRunning()) {
      throw this.failWithStatus(
        new AIProviderError('Sidecar process is already running', 'SIDECAR_ALREADY_RUNNING')
      );
    }

    const effectiveConfig = this.effectiveConfig;
    if (!effectiveConfig) {
      throw this.failWithStatus(
        new AIProviderError('Sidecar configuration is missing', 'SIDECAR_CONFIG_MISSING')
      );
    }

    const binaryPath = await this.resolveBinaryPath();

    const args = buildLlamaServerArgs(effectiveConfig);
    this.status = 'starting';
    this.clearError();

    const child = this.spawnProcess(binaryPath, args, {
      shell: false,
      detached: false,
      stdio: 'ignore',
      env: this.env,
    });

    this.sidecarProcess = child;
    child.once('exit', (code, signal) => {
      this.handleExit(code, signal);
    });

    try {
      await this.waitForSpawn(child, this.startupTimeoutMs);
    } catch (error) {
      this.sidecarProcess = null;
      const message = error instanceof Error ? error.message : 'Unknown startup failure';
      throw this.failWithStatus(new AIProviderError(message, 'SIDECAR_START_FAILED'));
    }

    if (typeof child.pid !== 'number' || child.pid <= 0) {
      this.sidecarProcess = null;
      throw this.failWithStatus(
        new AIProviderError('Failed to determine sidecar process id', 'SIDECAR_START_FAILED')
      );
    }

    this.pid = child.pid;
    this.endpoint = toEndpoint(effectiveConfig.port ?? DEFAULT_SIDECAR_PORT);
    this.status = 'running';

    return this.getStatus();
  }

  async stop(): Promise<SidecarLifecycleStatusResponse> {
    if (!this.sidecarProcess || !this.isRunning()) {
      throw this.failWithStatus(
        new AIProviderError('Sidecar process is not running', 'SIDECAR_NOT_RUNNING')
      );
    }

    const processToStop = this.sidecarProcess;
    this.status = 'stopping';
    this.clearError();

    const waitForExit = new Promise<void>((resolve) => {
      processToStop.once('exit', () => resolve());
    });

    const killed = processToStop.kill('SIGTERM');
    if (!killed) {
      throw this.failWithStatus(
        new AIProviderError('Failed to stop sidecar process', 'SIDECAR_STOP_FAILED')
      );
    }

    const exited = await waitForPromise(waitForExit, this.stopTimeoutMs);
    if (!exited) {
      processToStop.kill('SIGKILL');
      await waitForExit;
    }

    this.status = 'stopped';
    this.sidecarProcess = null;
    this.pid = undefined;
    this.endpoint = undefined;

    return this.getStatus();
  }

  getStatus(): SidecarLifecycleStatusResponse {
    return {
      success: this.status !== 'error',
      status: this.status,
      ...(this.pid !== undefined ? { pid: this.pid } : {}),
      ...(this.endpoint !== undefined ? { endpoint: this.endpoint } : {}),
      ...(this.effectiveConfig ? { config: this.effectiveConfig } : {}),
      ...(this.lastError ? { error: this.lastError } : {}),
    };
  }

  private isRunning(): boolean {
    return this.status === 'running' && this.sidecarProcess !== null;
  }

  private async resolveBinaryPath(): Promise<string> {
    const configuredPath =
      this.binaryPath ??
      this.effectiveConfig?.binaryPath ??
      this.env.MDXPAD_SIDECAR_BINARY_PATH ??
      this.env.LLAMA_CPP_SERVER_PATH;

    if (configuredPath) {
      if (!path.isAbsolute(configuredPath)) {
        throw this.failWithStatus(
          new AIProviderError(
            'Sidecar binary path must be absolute',
            'SIDECAR_BINARY_PATH_INVALID'
          )
        );
      }

      await this.verifyBinaryPathOrFail(configuredPath);
      return configuredPath;
    }

    const bundledCandidates = getBundledSidecarBinaryPathCandidates();
    if (bundledCandidates.length === 0) {
      throw this.failWithStatus(
        new AIProviderError(
          'Sidecar binary path not configured (set config.binaryPath or MDXPAD_SIDECAR_BINARY_PATH)',
          'SIDECAR_BINARY_PATH_MISSING'
        )
      );
    }

    try {
      return await Promise.any(
        bundledCandidates.map(async (candidatePath) => {
          await this.verifyBinaryPath(candidatePath);
          return candidatePath;
        })
      );
    } catch {
      const checkedPaths = bundledCandidates.join(', ');
      throw this.failWithStatus(
        new AIProviderError(
          `Sidecar binary path not configured and bundled binary was not found. Checked: ${checkedPaths}. Set config.binaryPath or MDXPAD_SIDECAR_BINARY_PATH`,
          'SIDECAR_BINARY_PATH_MISSING'
        )
      );
    }
  }

  private async verifyBinaryPathOrFail(binaryPath: string): Promise<void> {
    try {
      await this.verifyBinaryPath(binaryPath);
    } catch (error) {
      const message =
        error instanceof Error
          ? `Sidecar binary is not executable: ${error.message}`
          : 'Sidecar binary is not executable';
      throw this.failWithStatus(
        new AIProviderError(message, 'SIDECAR_BINARY_NOT_EXECUTABLE')
      );
    }
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.sidecarProcess = null;
    this.pid = undefined;
    this.endpoint = undefined;

    if (this.status === 'stopping' || this.status === 'stopped') {
      this.status = 'stopped';
      return;
    }

    const detail = signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`;
    this.failWithStatus(
      new AIProviderError(`Sidecar process exited unexpectedly (${detail})`, 'SIDECAR_EXITED')
    );
  }

  private failWithStatus(error: AIProviderError): AIProviderError {
    this.status = 'error';
    this.lastError = { code: error.code, message: error.message };
    return error;
  }

  private clearError(): void {
    this.lastError = undefined;
  }

  private async waitForSpawn(child: ChildProcess, timeoutMs: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(new Error(`Sidecar startup timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const onSpawn = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        child.off('spawn', onSpawn);
        child.off('error', onError);
      };

      child.once('spawn', onSpawn);
      child.once('error', onError);
    });
  }
}

async function assertExecutable(binaryPath: string): Promise<void> {
  await access(binaryPath, fsConstants.F_OK | fsConstants.X_OK);
}

function toEndpoint(port: number): string {
  return `http://${LOCALHOST_BIND_ADDRESS}:${port}`;
}

function normalizeSidecarConfig(config: SidecarConfigSchemaType): SidecarConfig {
  return {
    modelPath: config.modelPath,
    ...(config.binaryPath !== undefined && { binaryPath: config.binaryPath }),
    ...(config.contextSize !== undefined && { contextSize: config.contextSize }),
    ...(config.gpuLayers !== undefined && { gpuLayers: config.gpuLayers }),
    ...(config.threads !== undefined && { threads: config.threads }),
    port: config.port ?? DEFAULT_SIDECAR_PORT,
  };
}

function buildLlamaServerArgs(config: SidecarConfig): readonly string[] {
  const args: string[] = [
    '--host',
    LOCALHOST_BIND_ADDRESS,
    '--port',
    String(config.port ?? DEFAULT_SIDECAR_PORT),
    '--model',
    config.modelPath,
  ];

  if (config.contextSize !== undefined) {
    args.push('--ctx-size', String(config.contextSize));
  }
  if (config.gpuLayers !== undefined) {
    args.push('--n-gpu-layers', String(config.gpuLayers));
  }
  if (config.threads !== undefined) {
    args.push('--threads', String(config.threads));
  }

  return args;
}

async function waitForPromise(promise: Promise<void>, timeoutMs: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(false);
    }, timeoutMs);

    void promise.then(() => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(true);
    });
  });
}
