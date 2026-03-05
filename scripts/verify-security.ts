/**
 * Security Verification Script (T044-T046)
 *
 * Launches the Electron app and verifies that all security settings
 * are correctly applied per constitution §3.2.
 *
 * Required settings (all must be true except nodeIntegration):
 * - contextIsolation: true
 * - sandbox: true
 * - nodeIntegration: false
 * - webSecurity: true
 */

import { _electron as electron } from 'playwright';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

interface SecurityInfo {
  contextIsolation: boolean;
  sandbox: boolean;
  nodeIntegration: boolean;
  webSecurity: boolean;
}

interface VerificationResult {
  passed: boolean;
  settings: SecurityInfo;
  authoritativeSettings: SecurityInfo | null;
  violations: string[];
}

interface RuntimeProbe {
  hasMdxpadApi: boolean;
  hasRequire: boolean;
  hasNodeProcess: boolean;
  hasIpcRendererGlobal: boolean;
  hasElectronGlobal: boolean;
}

const REQUIRED_SETTINGS: SecurityInfo = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
};
const CLOSE_TIMEOUT_MS = 5000;

interface VerifySecurityRunOptions {
  runRuntime: boolean;
  runStatic: boolean;
}

function parseRunOptions(args: string[]): VerifySecurityRunOptions {
  let runRuntime = true;
  let runStatic = true;

  for (const arg of args) {
    if (!arg || arg === '--') {
      continue;
    }

    if (arg === '--runtime-only') {
      runRuntime = true;
      runStatic = false;
      continue;
    }

    if (arg === '--static-only') {
      runRuntime = false;
      runStatic = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!runRuntime && !runStatic) {
    throw new Error('At least one verification mode must be enabled');
  }

  return { runRuntime, runStatic };
}

function validateSettings(
  source: string,
  settings: SecurityInfo | null,
  violations: string[]
): void {
  if (!settings) {
    violations.push(`${source}: unable to read security settings`);
    return;
  }

  if (settings.contextIsolation !== REQUIRED_SETTINGS.contextIsolation) {
    violations.push(
      `${source}: contextIsolation expected ${String(REQUIRED_SETTINGS.contextIsolation)}, got ${String(
        settings.contextIsolation
      )}`
    );
  }
  if (settings.sandbox !== REQUIRED_SETTINGS.sandbox) {
    violations.push(
      `${source}: sandbox expected ${String(REQUIRED_SETTINGS.sandbox)}, got ${String(settings.sandbox)}`
    );
  }
  if (settings.nodeIntegration !== REQUIRED_SETTINGS.nodeIntegration) {
    violations.push(
      `${source}: nodeIntegration expected ${String(REQUIRED_SETTINGS.nodeIntegration)}, got ${String(
        settings.nodeIntegration
      )}`
    );
  }
  if (settings.webSecurity !== REQUIRED_SETTINGS.webSecurity) {
    violations.push(
      `${source}: webSecurity expected ${String(REQUIRED_SETTINGS.webSecurity)}, got ${String(
        settings.webSecurity
      )}`
    );
  }
}

function buildIsolatedUserDataDir(): string {
  return join(tmpdir(), 'mdxpad-security-verify', `${Date.now()}-${process.pid}-${randomUUID()}`);
}

interface ClosableElectronApp {
  close: () => Promise<void>;
  process: () => { pid?: number };
  evaluate?: (fn: ({ app }: { app: { quit: () => void } }) => void) => Promise<void>;
}

async function closeElectronApp(electronApp: ClosableElectronApp): Promise<void> {
  const pid = electronApp.process().pid;
  try {
    if (electronApp.evaluate) {
      await electronApp.evaluate(({ app }) => {
        app.quit();
      });
    }
    await Promise.race([
      electronApp.close(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timed out closing Electron app after ${CLOSE_TIMEOUT_MS}ms`));
        }, CLOSE_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.warn('[verify-security] Graceful close failed, forcing process shutdown:', error);
    if (pid) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Process may have already exited.
      }
    }
  }
}

async function verifySecuritySettings(): Promise<VerificationResult> {
  console.log('Starting security verification...\n');

  // Launch the Electron app
  const electronPath = join(process.cwd(), 'node_modules', '.bin', 'electron');
  const appPath = join(process.cwd(), 'dist', 'main', 'index.js');
  const userDataDir = buildIsolatedUserDataDir();
  mkdirSync(userDataDir, { recursive: true });

  console.log('Launching Electron app...');
  console.log(`  Electron: ${electronPath}`);
  console.log(`  App: ${appPath}`);

  const electronApp = await electron.launch({
    args: [appPath, `--user-data-dir=${userDataDir}`],
    executablePath: electronPath,
    env: {
      ...process.env,
      NODE_ENV: 'test',
    } as Record<string, string>,
  });

  try {
    // Get the first window
    console.log('Waiting for first window...');
    const page = await electronApp.firstWindow();

    const rendererErrors: string[] = [];
    const rendererSecurityConsoleErrors: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && /security|sandbox|context|preload|ipc|csp|unsafe/i.test(text)) {
        rendererSecurityConsoleErrors.push(text);
      }
    });
    page.on('pageerror', (error) => {
      rendererErrors.push(error.message);
    });

    console.log('Window obtained, waiting for DOM...');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('domcontentloaded');

    console.log('DOM loaded, checking for mdxpad API...\n');

    // Wait for window.mdxpad to be available (from preload script)
    // Note: The function runs in the browser context where 'window' is the browser window
    await page.waitForFunction(
      () => {
        return typeof (window as any).mdxpad !== 'undefined';
      },
      { timeout: 10000 }
    );

    console.log('mdxpad API found, querying security info...\n');

    // Get security info via IPC
    const securityInfo = (await page.evaluate(async () => {
      // Access the mdxpad API exposed via contextBridge
      return (window as any).mdxpad.getSecurityInfo();
    })) as SecurityInfo;

    const authoritativeSettings = await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) {
        return null;
      }

      const webContentsWithPrefs = win.webContents as unknown as {
        getLastWebPreferences?: () => {
          contextIsolation?: boolean;
          sandbox?: boolean;
          nodeIntegration?: boolean;
          webSecurity?: boolean;
        };
        getWebPreferences?: () => {
          contextIsolation?: boolean;
          sandbox?: boolean;
          nodeIntegration?: boolean;
          webSecurity?: boolean;
        };
      };
      const prefs =
        webContentsWithPrefs.getLastWebPreferences?.() ??
        webContentsWithPrefs.getWebPreferences?.();
      if (!prefs) {
        return null;
      }
      return {
        contextIsolation: Boolean(prefs.contextIsolation),
        sandbox: Boolean(prefs.sandbox),
        nodeIntegration: Boolean(prefs.nodeIntegration),
        webSecurity: Boolean(prefs.webSecurity),
      };
    });

    const runtimeProbe = (await page.evaluate(() => {
      const candidateProcess = (window as any).process;
      return {
        hasMdxpadApi: typeof (window as any).mdxpad === 'object' && (window as any).mdxpad !== null,
        hasRequire: typeof (window as any).require === 'function',
        hasNodeProcess: Boolean(candidateProcess?.versions?.node),
        hasIpcRendererGlobal: typeof (window as any).ipcRenderer !== 'undefined',
        hasElectronGlobal: typeof (window as any).electron !== 'undefined',
      };
    })) as RuntimeProbe;

    const violations: string[] = [];
    validateSettings('preload-reported settings', securityInfo, violations);
    validateSettings('main-process webPreferences', authoritativeSettings, violations);
    if (
      authoritativeSettings &&
      (securityInfo.contextIsolation !== authoritativeSettings.contextIsolation ||
        securityInfo.sandbox !== authoritativeSettings.sandbox ||
        securityInfo.nodeIntegration !== authoritativeSettings.nodeIntegration ||
        securityInfo.webSecurity !== authoritativeSettings.webSecurity)
    ) {
      violations.push('preload-reported settings do not match main-process webPreferences');
    }

    if (!runtimeProbe.hasMdxpadApi) {
      violations.push('renderer runtime probe: preload API is missing');
    }
    if (runtimeProbe.hasRequire) {
      violations.push('renderer runtime probe: global require is exposed');
    }
    if (runtimeProbe.hasNodeProcess) {
      violations.push('renderer runtime probe: Node.js process is exposed');
    }
    if (runtimeProbe.hasIpcRendererGlobal) {
      violations.push('renderer runtime probe: ipcRenderer is exposed globally');
    }
    if (runtimeProbe.hasElectronGlobal) {
      violations.push('renderer runtime probe: electron global is exposed');
    }

    for (const err of rendererErrors) {
      violations.push(`renderer page error: ${err}`);
    }
    for (const err of rendererSecurityConsoleErrors) {
      violations.push(`renderer security console error: ${err}`);
    }

    // Output results
    console.log('Security Settings (preload-reported):');
    console.log('-------------------------------------');
    console.log(
      `  contextIsolation: ${securityInfo.contextIsolation ? '✓' : '✗'} (${String(securityInfo.contextIsolation)})`
    );
    console.log(
      `  sandbox:          ${securityInfo.sandbox ? '✓' : '✗'} (${String(securityInfo.sandbox)})`
    );
    console.log(
      `  nodeIntegration:  ${!securityInfo.nodeIntegration ? '✓' : '✗'} (${String(securityInfo.nodeIntegration)})`
    );
    console.log(
      `  webSecurity:      ${securityInfo.webSecurity ? '✓' : '✗'} (${String(securityInfo.webSecurity)})`
    );
    console.log('');

    console.log('Security Settings (main-process webPreferences):');
    console.log('------------------------------------------------');
    if (authoritativeSettings) {
      console.log(
        `  contextIsolation: ${authoritativeSettings.contextIsolation ? '✓' : '✗'} (${String(authoritativeSettings.contextIsolation)})`
      );
      console.log(
        `  sandbox:          ${authoritativeSettings.sandbox ? '✓' : '✗'} (${String(authoritativeSettings.sandbox)})`
      );
      console.log(
        `  nodeIntegration:  ${!authoritativeSettings.nodeIntegration ? '✓' : '✗'} (${String(authoritativeSettings.nodeIntegration)})`
      );
      console.log(
        `  webSecurity:      ${authoritativeSettings.webSecurity ? '✓' : '✗'} (${String(authoritativeSettings.webSecurity)})`
      );
    } else {
      console.log('  Unable to read BrowserWindow webPreferences');
    }
    console.log('');

    console.log('Renderer Runtime Probe:');
    console.log('-----------------------');
    console.log(`  preload API exposed:            ${runtimeProbe.hasMdxpadApi ? '✓' : '✗'}`);
    console.log(`  require exposed:                ${runtimeProbe.hasRequire ? '✗' : '✓'}`);
    console.log(`  Node process exposed:           ${runtimeProbe.hasNodeProcess ? '✗' : '✓'}`);
    console.log(
      `  ipcRenderer global exposed:     ${runtimeProbe.hasIpcRendererGlobal ? '✗' : '✓'}`
    );
    console.log(`  electron global exposed:        ${runtimeProbe.hasElectronGlobal ? '✗' : '✓'}`);
    console.log('');

    const passed = violations.length === 0;

    if (passed) {
      console.log('✓ All security settings verified successfully!');
    } else {
      console.log('✗ Security verification FAILED:');
      violations.forEach((v) => console.log(`  - ${v}`));
    }

    return {
      passed,
      settings: securityInfo,
      authoritativeSettings,
      violations,
    };
  } finally {
    await closeElectronApp(electronApp as ClosableElectronApp);
    if (existsSync(userDataDir)) {
      rmSync(userDataDir, { recursive: true, force: true });
    }
  }
}

// ============================================================================
// Static Source Verification (Wave 3 Security Checks)
// ============================================================================

interface StaticCheckResult {
  passed: boolean;
  violations: string[];
}

/**
 * Run static source analysis to verify security invariants
 * introduced with Wave 3 features (collaboration, sharing, plugins, IPC).
 */
async function verifyStaticSecurityChecks(): Promise<StaticCheckResult> {
  const { readFileSync } = await import('node:fs');
  const violations: string[] = [];

  console.log('\nStatic Security Checks:');
  console.log('========================\n');

  // --- Collab Server: room IDs are validated ---
  try {
    const collabServerSrc = readFileSync(
      join(process.cwd(), 'src/main/services/collab-server.ts'),
      'utf-8'
    );

    // Verify the server checks for missing docId before creating rooms
    if (!collabServerSrc.includes("'Missing docId parameter'")) {
      violations.push('collab-server: missing docId validation on connection');
    } else {
      console.log('  [pass] Collab server validates room IDs (docId parameter check)');
    }

    // Verify max rooms/clients limits exist
    if (!collabServerSrc.includes('maxClientsPerRoom') || !collabServerSrc.includes('maxRooms')) {
      violations.push('collab-server: missing room/client capacity limits');
    } else {
      console.log('  [pass] Collab server enforces room/client capacity limits');
    }
  } catch {
    violations.push('collab-server: could not read source file');
  }

  // --- Share Links: tokens use crypto.randomBytes ---
  try {
    const shareLinkSrc = readFileSync(
      join(process.cwd(), 'src/main/services/share-link-service.ts'),
      'utf-8'
    );

    if (!shareLinkSrc.includes('randomBytes')) {
      violations.push('share-link-service: tokens not generated with crypto.randomBytes');
    } else {
      console.log('  [pass] Share link tokens use crypto.randomBytes');
    }

    if (!shareLinkSrc.includes('randomUUID')) {
      violations.push('share-link-service: link IDs not generated with crypto.randomUUID');
    } else {
      console.log('  [pass] Share link IDs use crypto.randomUUID');
    }
  } catch {
    violations.push('share-link-service: could not read source file');
  }

  // --- IPC Handlers: new handlers have Zod validation ---
  const handlerFiles = [
    'src/main/ipc/collab-handlers.ts',
    'src/main/ipc/share-handlers.ts',
    'src/main/ipc/history-handlers.ts',
    'src/main/ipc/notification-handlers.ts',
  ];

  for (const handlerFile of handlerFiles) {
    try {
      const src = readFileSync(join(process.cwd(), handlerFile), 'utf-8');
      const fileName = handlerFile.split('/').pop() ?? handlerFile;

      if (!src.includes('createValidatedHandler')) {
        violations.push(`${fileName}: does not use createValidatedHandler for Zod validation`);
      } else {
        console.log(`  [pass] ${fileName} uses createValidatedHandler (Zod validation)`);
      }
    } catch {
      violations.push(`${handlerFile}: could not read source file`);
    }
  }

  // --- Plugin System: sandbox uses vm.createContext ---
  try {
    const pluginLoaderSrc = readFileSync(
      join(process.cwd(), 'src/main/services/plugin/plugin-loader.ts'),
      'utf-8'
    );

    if (!pluginLoaderSrc.includes('vm.createContext')) {
      violations.push('plugin-loader: does not use vm.createContext for sandboxing');
    } else {
      console.log('  [pass] Plugin loader uses vm.createContext for sandboxing');
    }

    if (!pluginLoaderSrc.includes('vm.Script')) {
      violations.push('plugin-loader: does not use vm.Script for code execution');
    } else {
      console.log('  [pass] Plugin loader uses vm.Script for code execution');
    }

    if (!pluginLoaderSrc.includes('timeout')) {
      violations.push('plugin-loader: no execution timeout for plugin scripts');
    } else {
      console.log('  [pass] Plugin loader enforces execution timeout');
    }
  } catch {
    violations.push('plugin-loader: could not read source file');
  }

  // --- Plugin Manifest: uses Zod schema validation ---
  try {
    const pluginManifestSrc = readFileSync(
      join(process.cwd(), 'src/main/services/plugin/plugin-manifest.ts'),
      'utf-8'
    );

    if (!pluginManifestSrc.includes('PluginManifestSchema.safeParse')) {
      violations.push('plugin-manifest: does not use Zod schema validation');
    } else {
      console.log('  [pass] Plugin manifest loader validates with Zod schema');
    }
  } catch {
    violations.push('plugin-manifest: could not read source file');
  }

  console.log('');
  const passed = violations.length === 0;

  if (passed) {
    console.log('All static security checks passed.');
  } else {
    console.log('Static security check FAILURES:');
    violations.forEach((v) => console.log(`  - ${v}`));
  }

  return { passed, violations };
}

async function runVerifications(): Promise<void> {
  const options = parseRunOptions(process.argv.slice(2));
  const runtimeCheck = options.runRuntime
    ? verifySecuritySettings()
    : Promise.resolve<VerificationResult | null>(null);
  const staticCheck = options.runStatic
    ? verifyStaticSecurityChecks()
    : Promise.resolve<StaticCheckResult | null>(null);

  if (!options.runRuntime) {
    console.log('Skipping runtime security verification (--static-only).');
  }
  if (!options.runStatic) {
    console.log('Skipping static security checks (--runtime-only).');
  }

  const [runtimeResult, staticResult] = await Promise.all([runtimeCheck, staticCheck]);

  const runtimePassed = runtimeResult?.passed ?? true;
  const staticPassed = staticResult?.passed ?? true;

  if (!runtimePassed || !staticPassed) {
    if (!runtimePassed) {
      console.error('\nRuntime security verification failed.');
    }
    if (!staticPassed) {
      console.error('\nStatic security checks failed.');
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nAll security verifications complete.');
}

runVerifications().catch((error: unknown) => {
  console.error('Security verification failed with error:', error);
  process.exitCode = 1;
});
