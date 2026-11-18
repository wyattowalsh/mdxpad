import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const WORKFLOWS = ['.github/workflows/ci.yml', '.github/workflows/rehearsals.yml'];

describe('pnpm CI pin', () => {
  it('pins every pnpm setup step to the packageManager version', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { packageManager: string };
    const version = pkg.packageManager.slice('pnpm@'.length);
    expect(version).toBe('10.30.3');

    for (const file of WORKFLOWS) {
      const text = readFileSync(file, 'utf8');
      const steps = text.split('uses: pnpm/action-setup@').slice(1);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expect(step.slice(0, 180)).toContain(`version: ${version}`);
      }
    }
  });
});
