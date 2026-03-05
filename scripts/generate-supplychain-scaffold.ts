import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { globSync } from 'glob';
import { parse as parseYaml } from 'yaml';

interface ParsedOptions {
  arch: 'arm64' | 'x64';
  reportDir: string;
}

function parseOptions(args: string[]): ParsedOptions {
  let arch: ParsedOptions['arch'] | null = null;
  let reportDir = resolve(process.cwd(), 'ci-reports');

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

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!arch) {
    throw new Error('Missing required --arch argument (arm64 or x64).');
  }

  return { arch, reportDir };
}

function sha256File(filePath: string): string {
  const digest = createHash('sha256');
  digest.update(readFileSync(filePath));
  return digest.digest('hex');
}

function buildSbom(reportDir: string, arch: ParsedOptions['arch']): string {
  const lockfilePath = resolve(process.cwd(), 'pnpm-lock.yaml');
  const packageJsonPath = resolve(process.cwd(), 'package.json');
  const lockfile = parseYaml(readFileSync(lockfilePath, 'utf8')) as {
    packages?: Record<string, unknown>;
  };
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    name: string;
    version: string;
  };

  const componentsByRef = new Map<string, { name: string; version: string }>();
  for (const packageSnapshotId of Object.keys(lockfile.packages ?? {})) {
    const withoutPeers = packageSnapshotId.split('(')[0];
    if (!withoutPeers) {
      continue;
    }
    const separator = withoutPeers.lastIndexOf('@');
    if (separator <= 0) {
      continue;
    }
    const name = withoutPeers.slice(0, separator);
    const version = withoutPeers.slice(separator + 1);
    if (!name || !version) {
      continue;
    }
    componentsByRef.set(`${name}@${version}`, { name, version });
  }

  const components = Array.from(componentsByRef.values())
    .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`))
    .map((component) => ({
      type: 'library',
      name: component.name,
      version: component.version,
      purl: `pkg:npm/${encodeURIComponent(component.name)}@${component.version}`,
    }));

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: {
        type: 'application',
        name: packageJson.name,
        version: packageJson.version,
      },
      properties: [
        { name: 'mdxpad.ci.arch', value: arch },
        { name: 'mdxpad.ci.generator', value: 'scripts/generate-supplychain-scaffold.ts' },
      ],
    },
    components,
  };

  const sbomDir = resolve(reportDir, 'sbom');
  mkdirSync(sbomDir, { recursive: true });
  const sbomPath = resolve(sbomDir, `sbom-${arch}.cdx.json`);
  writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');
  return sbomPath;
}

function buildProvenance(reportDir: string, arch: ParsedOptions['arch']): string {
  const releasePattern = resolve(process.cwd(), 'release/*.{dmg,blockmap,zip}');
  const releaseArtifacts = globSync(releasePattern, { nodir: true }).sort();
  const archArtifactPattern = new RegExp(`(^|[-_.])${arch}([-.]|$)`, 'i');
  const archArtifacts = releaseArtifacts.filter((artifactPath) =>
    archArtifactPattern.test(basename(artifactPath))
  );

  if (archArtifacts.length === 0) {
    const discovered = releaseArtifacts.map((artifactPath) => basename(artifactPath));
    throw new Error(
      `No release artifacts matched architecture '${arch}'. Found: ${discovered.length > 0 ? discovered.join(', ') : 'none'}`
    );
  }

  const provenance = {
    schemaVersion: '0.1.0',
    generatedAt: new Date().toISOString(),
    generator: 'scripts/generate-supplychain-scaffold.ts',
    architecture: arch,
    repository: process.env.GITHUB_REPOSITORY ?? null,
    ref: process.env.GITHUB_REF ?? null,
    sha: process.env.GITHUB_SHA ?? null,
    run: {
      workflow: process.env.GITHUB_WORKFLOW ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      actor: process.env.GITHUB_ACTOR ?? null,
    },
    artifactDigests: archArtifacts.map((artifactPath) => ({
      path: relative(process.cwd(), artifactPath),
      sha256: sha256File(artifactPath),
    })),
    notes: [
      'Scaffold output for future provenance attestations.',
      'For signed/notarized release artifacts set CSC_LINK, CSC_KEY_PASSWORD, APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID secrets.',
      'To publish attestations, enable GitHub artifact attestations with id-token and attestations permissions.',
    ],
  };

  const provenanceDir = resolve(reportDir, 'provenance');
  mkdirSync(provenanceDir, { recursive: true });
  const provenancePath = resolve(provenanceDir, `provenance-${arch}.json`);
  writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');
  return provenancePath;
}

function main(): number {
  const options = parseOptions(process.argv.slice(2));
  const sbomPath = buildSbom(options.reportDir, options.arch);
  const provenancePath = buildProvenance(options.reportDir, options.arch);
  console.log(`[generate-supplychain-scaffold] SBOM: ${sbomPath}`);
  console.log(`[generate-supplychain-scaffold] Provenance: ${provenancePath}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(
    `[generate-supplychain-scaffold] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
