#!/usr/bin/env node

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const rootDir = process.cwd();
const allowedPnpmLockfiles = new Set(['pnpm-lock.yaml', 'docs-site/pnpm-lock.yaml']);
const disallowedLockfiles = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
]);
const ignoredDirs = new Set([
  '.git',
  '.idea',
  '.vscode',
  'node_modules',
  '.pnpm-store',
  'dist',
  'out',
  'release',
  'coverage',
  '.next',
  '.vite',
]);

/** @type {string[]} */
const pnpmLockfiles = [];
/** @type {string[]} */
const invalidLockfiles = [];

function walk(dirPath) {
  const entries = readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const relPath = relative(rootDir, fullPath).replace(/\\/gu, '/');
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (ignoredDirs.has(entry)) {
        continue;
      }
      walk(fullPath);
      continue;
    }

    if (entry === 'pnpm-lock.yaml') {
      pnpmLockfiles.push(relPath);
      continue;
    }

    if (disallowedLockfiles.has(entry)) {
      invalidLockfiles.push(relPath);
    }
  }
}

walk(rootDir);

const violations = [];

if (!pnpmLockfiles.includes('pnpm-lock.yaml')) {
  violations.push('Missing required root pnpm-lock.yaml lockfile.');
}

for (const lockfilePath of pnpmLockfiles) {
  if (!allowedPnpmLockfiles.has(lockfilePath)) {
    violations.push(
      `Unexpected pnpm lockfile '${lockfilePath}'. Expected only: ${Array.from(allowedPnpmLockfiles).join(', ')}.`
    );
  }
}

for (const lockfilePath of invalidLockfiles) {
  violations.push(`Disallowed non-pnpm lockfile detected: ${lockfilePath}`);
}

if (violations.length > 0) {
  console.error('[verify-lockfiles] Lockfile policy violations detected:');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `[verify-lockfiles] Lockfile policy passed. pnpm lockfiles: ${pnpmLockfiles.sort().join(', ')}`
  );
}
