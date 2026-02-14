import type { ElectronApplication } from 'playwright';

/**
 * Close an Electron app reliably in Playwright tests.
 * On macOS, closing all windows does not quit the app process by default.
 */
export async function safeCloseElectronApp(
  app: ElectronApplication | null | undefined
): Promise<void> {
  if (!app) {
    return;
  }

  const pid = app.process().pid;

  // Request a full app quit before closing the Playwright handle.
  try {
    await app.evaluate(({ app: electronApp }) => {
      electronApp.quit();
    });
  } catch {
    // App may already be closed.
  }

  try {
    await Promise.race([
      app.close(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timed out closing Electron app')), 5000);
      }),
    ]);
  } catch {
    // Fall through to PID-based cleanup.
  }

  if (!pid) {
    return;
  }

  try {
    process.kill(pid, 0);
  } catch {
    // Process no longer exists.
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Process may have exited between checks.
  }
}
