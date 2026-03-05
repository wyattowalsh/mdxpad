import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, relative, resolve } from 'node:path';
import { globSync } from 'glob';

interface ParsedOptions {
  arch: 'arm64' | 'x64';
  reportDir: string;
  requireSecrets: boolean;
}

interface Finding {
  severity: 'error' | 'warning' | 'info';
  message: string;
}

const REQUIRED_SIGNING_VARS = ['CSC_LINK', 'CSC_KEY_PASSWORD'];
const REQUIRED_NOTARIZATION_VARS = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];

function parseOptions(args: string[]): ParsedOptions {
  let arch: ParsedOptions['arch'] | null = null;
  let reportDir = resolve(process.cwd(), 'ci-reports/release-rehearsal');
  let requireSecrets = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg || arg === '--') {
      continue;
    }

    if (arg === '--arch') {
      const next = args[index + 1];
      if (!next || (next !== 'arm64' && next !== 'x64')) {
        throw new Error('Missing or invalid value after --arch (expected arm64 or x64).');
      }
      arch = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--arch=')) {
      const parsed = arg.slice('--arch='.length);
      if (parsed !== 'arm64' && parsed !== 'x64') {
        throw new Error(`Invalid --arch value: ${parsed}`);
      }
      arch = parsed;
      continue;
    }

    if (arg === '--report-dir') {
      const next = args[index + 1];
      if (!next) {
        throw new Error('Missing path after --report-dir');
      }
      reportDir = resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg.startsWith('--report-dir=')) {
      reportDir = resolve(process.cwd(), arg.slice('--report-dir='.length));
      continue;
    }

    if (arg === '--require-secrets') {
      requireSecrets = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!arch) {
    throw new Error('Missing required --arch argument (arm64 or x64).');
  }

  return { arch, reportDir, requireSecrets };
}

function runSupplychainScaffold(options: ParsedOptions): number {
  console.log(
    `[rehearse-release] Validating release artifacts for ${options.arch} via supply-chain scaffold`
  );
  const result = spawnSync(
    'pnpm',
    ['generate-supplychain-scaffold', '--arch', options.arch, '--report-dir', options.reportDir],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    }
  );
  return result.status ?? 1;
}

function listArchArtifacts(arch: ParsedOptions['arch']): string[] {
  const releasePattern = resolve(process.cwd(), 'release/*.{dmg,blockmap,zip}');
  const releaseArtifacts = globSync(releasePattern, { nodir: true }).sort();
  const archArtifactPattern = new RegExp(`(^|[-_.])${arch}([-.]|$)`, 'i');
  return releaseArtifacts
    .filter((artifactPath) => archArtifactPattern.test(basename(artifactPath)))
    .map((artifactPath) => relative(process.cwd(), artifactPath));
}

function main(): number {
  const options = parseOptions(process.argv.slice(2));
  const findings: Finding[] = [];

  const builderConfig = readFileSync(resolve(process.cwd(), 'electron-builder.yml'), 'utf8');
  if (!builderConfig.includes('${productName}-${version}-${arch}.${ext}')) {
    findings.push({
      severity: 'error',
      message:
        "electron-builder.yml must keep '${arch}' in artifactName for architecture validation.",
    });
  }
  if (!builderConfig.includes('afterSign: scripts/notarize.cjs')) {
    findings.push({
      severity: 'error',
      message: 'electron-builder.yml is missing the afterSign notarization hook.',
    });
  }

  const notarizeScript = readFileSync(resolve(process.cwd(), 'scripts/notarize.cjs'), 'utf8');
  if (!notarizeScript.includes('Skipping notarization. Missing secrets')) {
    findings.push({
      severity: 'error',
      message:
        'scripts/notarize.cjs must support secret-gated notarization skips for rehearsal runs.',
    });
  }

  const missingSigningVars = REQUIRED_SIGNING_VARS.filter((envVar) => !process.env[envVar]);
  const missingNotarizationVars = REQUIRED_NOTARIZATION_VARS.filter(
    (envVar) => !process.env[envVar]
  );
  const missingReleaseVars = [...missingSigningVars, ...missingNotarizationVars];

  if (missingReleaseVars.length > 0) {
    const severity: Finding['severity'] = options.requireSecrets ? 'error' : 'warning';
    findings.push({
      severity,
      message: `Release signing/notarization secrets missing: ${missingReleaseVars.join(', ')}`,
    });
  } else {
    findings.push({
      severity: 'info',
      message: 'All signing and notarization secrets are present for full release rehearsal.',
    });
  }

  const scaffoldExitCode = runSupplychainScaffold(options);
  if (scaffoldExitCode !== 0) {
    findings.push({
      severity: 'error',
      message: 'generate-supplychain-scaffold failed for requested architecture.',
    });
  }

  const archArtifacts = listArchArtifacts(options.arch);
  if (archArtifacts.length === 0) {
    findings.push({
      severity: 'error',
      message: `No release artifacts found for architecture '${options.arch}'.`,
    });
  }

  const errorFindings = findings.filter((finding) => finding.severity === 'error');
  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    arch: options.arch,
    requireSecrets: options.requireSecrets,
    summary: {
      status: errorFindings.length === 0 ? 'pass' : 'fail',
      totalFindings: findings.length,
      blockingFindings: errorFindings.length,
    },
    env: {
      missingSigningVars,
      missingNotarizationVars,
    },
    artifacts: {
      matched: archArtifacts,
    },
    findings,
  };

  mkdirSync(options.reportDir, { recursive: true });
  const reportPath = resolve(options.reportDir, `release-rehearsal-${options.arch}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[rehearse-release] Report: ${reportPath}`);

  if (errorFindings.length > 0) {
    for (const finding of errorFindings) {
      console.error(`[rehearse-release] ${finding.message}`);
    }
    return 1;
  }

  console.log('[rehearse-release] Release rehearsal checks passed.');
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`[rehearse-release] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
