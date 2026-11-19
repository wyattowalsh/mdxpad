import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const homeDir = vi.hoisted(() => ({ current: '' }));

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => homeDir.current,
    default: {
      ...actual,
      homedir: () => homeDir.current,
    },
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/tmp/mdxpad-template-app',
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showSaveDialog: async () => ({ canceled: true, filePath: '' }),
  },
}));

import {
  handleCreateFromTemplate,
  handleTemplateExport,
  handleTemplateImport,
  handleTemplateSave,
} from './handlers';
import { getCustomTemplatesPath } from './paths';
import { rememberChosenTemplatePath, resetChosenTemplatePaths } from './template-scope';

const TEMPLATE = `---
name: Note
id: note
description: A note
category: notes
tags: []
version: 1.0.0
---
hello
`;

describe('template files written through a link', () => {
  const dirs: string[] = [];
  let home = '';

  afterEach(async () => {
    resetChosenTemplatePaths();
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function useTempHome(): Promise<string> {
    home = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-template-home-'));
    dirs.push(home);
    homeDir.current = home;
    const templates = getCustomTemplatesPath();
    expect(templates.startsWith(home)).toBe(true);
    await mkdir(templates, { recursive: true });
    return templates;
  }

  async function linkedFile(directory: string, name: string): Promise<string> {
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-template-secret-'));
    dirs.push(outside);
    const secret = path.join(outside, name);
    const link = path.join(directory, name);
    await writeFile(secret, 'secret');
    await symlink(secret, link);
    return secret;
  }

  it('saves a template in place of a link', async () => {
    const templates = await useTempHome();
    const secret = await linkedFile(templates, 'note.mdxt');

    const result = await handleTemplateSave({
      action: 'save',
      replace: true,
      template: {
        id: 'note',
        name: 'Note',
        description: 'A note',
        category: 'notes',
        content: 'hello',
      },
    });

    expect(result).toMatchObject({ success: true });
    expect(await readFile(secret, 'utf8')).toBe('secret');
    expect((await lstat(path.join(templates, 'note.mdxt'))).isSymbolicLink()).toBe(false);
    expect(await readFile(path.join(templates, 'note.mdxt'), 'utf8')).toContain('hello');
  });

  it('does not import a template that is a link', async () => {
    await useTempHome();
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-template-src-'));
    dirs.push(sourceDir);
    const secret = await linkedFile(sourceDir, 'note.mdxt');
    const source = path.join(sourceDir, 'note.mdxt');
    rememberChosenTemplatePath(source);

    const result = await handleTemplateImport({
      action: 'import',
      path: source,
      replace: true,
    });

    expect(result).toMatchObject({ success: false });
    expect(await readFile(secret, 'utf8')).toBe('secret');
  });

  it('imports a template in place of a link', async () => {
    const templates = await useTempHome();
    const secret = await linkedFile(templates, 'note.mdxt');
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-template-src-'));
    dirs.push(sourceDir);
    const source = path.join(sourceDir, 'note.mdxt');
    await writeFile(source, TEMPLATE);
    rememberChosenTemplatePath(source);

    const result = await handleTemplateImport({
      action: 'import',
      path: source,
      replace: true,
    });

    expect(result).toMatchObject({ success: true });
    expect(await readFile(secret, 'utf8')).toBe('secret');
    expect(await readFile(path.join(templates, 'note.mdxt'), 'utf8')).toContain('hello');
  });

  it('exports a template in place of a link', async () => {
    const templates = await useTempHome();
    await writeFile(path.join(templates, 'note.mdxt'), TEMPLATE);
    const exportDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-template-export-'));
    dirs.push(exportDir);
    const secret = await linkedFile(exportDir, 'copy.mdxt');
    const output = path.join(exportDir, 'copy.mdxt');
    rememberChosenTemplatePath(output);

    const result = await handleTemplateExport({
      action: 'export',
      id: 'note',
      path: output,
    });

    expect(result).toMatchObject({ success: true, path: output });
    expect(await readFile(secret, 'utf8')).toBe('secret');
    expect((await lstat(output)).isSymbolicLink()).toBe(false);
    expect(await readFile(output, 'utf8')).toContain('hello');
  });

  it('creates a document in place of a link', async () => {
    const templates = await useTempHome();
    await writeFile(path.join(templates, 'note.mdxt'), TEMPLATE);
    const exportDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-template-doc-'));
    dirs.push(exportDir);
    const secret = await linkedFile(exportDir, 'page.md');
    const output = path.join(exportDir, 'page.md');
    rememberChosenTemplatePath(output);

    const result = await handleCreateFromTemplate({
      templateId: 'note',
      variables: {},
      savePath: output,
    });

    expect(result).toMatchObject({ success: true, path: output });
    expect(await readFile(secret, 'utf8')).toBe('secret');
    expect(await readFile(output, 'utf8')).toContain('hello');
  });
});
