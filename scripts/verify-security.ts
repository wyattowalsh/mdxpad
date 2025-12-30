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

interface SecurityInfo {
  contextIsolation: boolean;
  sandbox: boolean;
  nodeIntegration: boolean;
  webSecurity: boolean;
}

interface VerificationResult {
  passed: boolean;
  settings: SecurityInfo;
  violations: string[];
}

async function verifySecuritySettings(): Promise<VerificationResult> {
  console.log('Starting security verification...\n');

  // Launch the Electron app
  const electronPath = join(process.cwd(), 'node_modules', '.bin', 'electron');
  const appPath = join(process.cwd(), 'dist', 'main', 'index.js');

  console.log('Launching Electron app...');
  console.log(`  Electron: ${electronPath}`);
  console.log(`  App: ${appPath}`);

  const electronApp = await electron.launch({
    args: [appPath],
    executablePath: electronPath,
  });

  // Listen for console messages from the main process
  electronApp.on('console', (msg) => {
    console.log(`[Main] ${msg.text()}`);
  });

  try {
    // Get the first window
    console.log('Waiting for first window...');
    const page = await electronApp.firstWindow();

    // Listen for console messages from the renderer
    page.on('console', (msg) => {
      console.log(`[Renderer] ${msg.type()}: ${msg.text()}`);
    });

    page.on('pageerror', (error) => {
      console.error(`[Renderer Error] ${error.message}`);
    });

    console.log('Window obtained, waiting for DOM...');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('domcontentloaded');

    console.log('DOM loaded, checking for mdxpad API...\n');

    // Wait for window.mdxpad to be available (from preload script)
    // Note: The function runs in the browser context where 'window' is the browser window
    await page.waitForFunction(() => {
      return typeof (window as any).mdxpad !== 'undefined';
    }, { timeout: 10000 });

    console.log('mdxpad API found, querying security info...\n');

    // Get security info via IPC
    const securityInfo = await page.evaluate(async () => {
      // Access the mdxpad API exposed via contextBridge
      return (window as any).mdxpad.getSecurityInfo();
    }) as SecurityInfo;

    // Verify each setting
    const violations: string[] = [];

    if (securityInfo.contextIsolation !== true) {
      violations.push(
        `contextIsolation: expected true, got ${String(securityInfo.contextIsolation)}`
      );
    }

    if (securityInfo.sandbox !== true) {
      violations.push(
        `sandbox: expected true, got ${String(securityInfo.sandbox)}`
      );
    }

    if (securityInfo.nodeIntegration !== false) {
      violations.push(
        `nodeIntegration: expected false, got ${String(securityInfo.nodeIntegration)}`
      );
    }

    if (securityInfo.webSecurity !== true) {
      violations.push(
        `webSecurity: expected true, got ${String(securityInfo.webSecurity)}`
      );
    }

    // Output results
    console.log('Security Settings:');
    console.log('------------------');
    console.log(`  contextIsolation: ${securityInfo.contextIsolation ? '✓' : '✗'} (${String(securityInfo.contextIsolation)})`);
    console.log(`  sandbox:          ${securityInfo.sandbox ? '✓' : '✗'} (${String(securityInfo.sandbox)})`);
    console.log(`  nodeIntegration:  ${!securityInfo.nodeIntegration ? '✓' : '✗'} (${String(securityInfo.nodeIntegration)})`);
    console.log(`  webSecurity:      ${securityInfo.webSecurity ? '✓' : '✗'} (${String(securityInfo.webSecurity)})`);
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
      violations,
    };
  } finally {
    // Close the app
    await electronApp.close();
  }
}

// Run verification
verifySecuritySettings()
  .then((result) => {
    if (!result.passed) {
      process.exit(1);
    }
    console.log('\nSecurity verification complete.');
  })
  .catch((error: unknown) => {
    console.error('Security verification failed with error:', error);
    process.exit(1);
  });
