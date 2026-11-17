import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  rememberChosenTemplatePath,
  resetChosenTemplatePaths,
  templatePathWasChosen,
  unchosenTemplatePathError,
} from './template-scope';

describe('template dialog path scope', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    resetChosenTemplatePaths();
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('accepts only the path the dialog returned', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-template-scope-'));
    dirs.push(dir);
    const chosen = path.join(dir, 'chosen.mdxt');
    const other = path.join(dir, 'other.mdxt');
    await writeFile(chosen, 'template');
    await writeFile(other, 'template');

    rememberChosenTemplatePath(chosen);

    expect(templatePathWasChosen(chosen)).toBe(true);
    expect(unchosenTemplatePathError(chosen)).toBeNull();
    expect(templatePathWasChosen(other)).toBe(false);
    expect(unchosenTemplatePathError(other)).toContain('template dialog');
  });
});
