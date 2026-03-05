import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const tsxCliPath = resolve(repoRoot, 'node_modules/.bin/tsx');
const actionsScriptPath = resolve(repoRoot, 'scripts/verify-actions-pinning.ts');
const auditScriptPath = resolve(repoRoot, 'scripts/verify-audit-baseline.ts');

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('CI hardening policy checks', () => {
  it('fails when Actions pinning is run in advisory mode on protected CI refs', () => {
    const tempDir = createTempDir('mdxpad-actions-pinning-');
    const reportPath = join(tempDir, 'actions-report.json');

    const result = spawnSync(
      tsxCliPath,
      [actionsScriptPath, '--mode', 'advisory', '--report', reportPath],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CI: 'true',
          GITHUB_ACTIONS: 'true',
          GITHUB_REF_PROTECTED: 'true',
        },
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('protected');
  });

  it('fails when resolved high-risk baseline entries remain in the baseline', () => {
    const tempDir = createTempDir('mdxpad-audit-baseline-');
    const reportPath = join(tempDir, 'audit-report.json');
    const baselinePath = join(tempDir, 'npm-audit-baseline.json');
    const fakeBinDir = join(tempDir, 'bin');
    const fakePnpmPath = join(fakeBinDir, 'pnpm');
    mkdirSync(fakeBinDir, { recursive: true });

    writeFileSync(
      baselinePath,
      `${JSON.stringify(
        {
          schemaVersion: '1.0.0',
          updatedAt: '2026-01-01T00:00:00.000Z',
          entries: [
            {
              id: 999999,
              package: 'example-package',
              severity: 'high',
              rationale: 'Temporary acceptance pending upstream fix.',
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    writeFileSync(fakePnpmPath, '#!/bin/sh\nprintf "{\\\"advisories\\\":{}}\\n"\n', 'utf8');
    chmodSync(fakePnpmPath, 0o755);

    const result = spawnSync(
      tsxCliPath,
      [auditScriptPath, '--baseline', baselinePath, '--report', reportPath],
      {
        cwd: tempDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fakeBinDir}:${process.env.PATH ?? ''}`,
        },
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('resolved');
  });
});
