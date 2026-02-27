import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { _electron as electron, type ElectronApplication } from 'playwright';

export interface LaunchedMdxpadApp {
  app: ElectronApplication;
  userDataDir: string;
}

export interface LaunchMdxpadOptions {
  env?: Record<string, string>;
  userDataDirSuffix?: string;
  userDataDir?: string;
}

function buildIsolatedUserDataDir(suffix = 'session'): string {
  const safeSuffix = suffix.replace(/[^a-zA-Z0-9-_]/g, '-');
  return join(
    tmpdir(),
    'mdxpad-e2e-user-data',
    `${Date.now()}-${process.pid}-${safeSuffix}-${randomUUID()}`
  );
}

export function createIsolatedUserDataDir(suffix = 'session'): string {
  return buildIsolatedUserDataDir(suffix);
}

/**
 * Launch mdxpad Electron app with an isolated profile directory.
 * Isolating user data avoids Chromium SingletonLock collisions between runs.
 */
export async function launchMdxpad(options: LaunchMdxpadOptions = {}): Promise<LaunchedMdxpadApp> {
  const electronPath = join(process.cwd(), 'node_modules', '.bin', 'electron');
  const appPath = join(process.cwd(), 'dist', 'main', 'index.js');
  const userDataDir = options.userDataDir ?? buildIsolatedUserDataDir(options.userDataDirSuffix);
  mkdirSync(userDataDir, { recursive: true });

  const app = await electron.launch({
    args: [appPath, `--user-data-dir=${userDataDir}`],
    executablePath: electronPath,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ...options.env,
    } as Record<string, string>,
  });

  return { app, userDataDir };
}

/**
 * Close an Electron app reliably in Playwright tests.
 * On macOS, closing all windows does not quit the app process by default.
 */
export async function safeCloseElectronApp(
  app: ElectronApplication | null | undefined,
  userDataDir?: string | null
): Promise<void> {
  if (app) {
    const pid = app.process().pid;

    if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // Process may already be terminated.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));

    if (pid) {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // Process group may already be terminated.
      }

      try {
        process.kill(pid, 0);
        process.kill(pid, 'SIGKILL');
      } catch {
        // Process may already be terminated.
      }
    }

    try {
      await Promise.race([
        app.close(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timed out closing Electron app handle')), 1000);
        }),
      ]);
    } catch {
      // App connection may already be closed after PID cleanup.
    }
  }

  if (userDataDir && existsSync(userDataDir)) {
    rmSync(userDataDir, { recursive: true, force: true });
  }
}
