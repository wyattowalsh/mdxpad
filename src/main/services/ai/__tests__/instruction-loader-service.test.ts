import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { grantReadCapability, resetFileCapabilities } from '@main/ipc/document-capability';

import { AISessionStorageService } from '../ai-session-storage-service';
import { InstructionLoaderService } from '../instruction-loader-service';

async function writeTextFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

describe('InstructionLoaderService', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-instruction-loader-'));
  });

  afterEach(async () => {
    resetFileCapabilities();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('discovers project/workspace/document instructions and applies scope filtering', async () => {
    const projectRootPath = path.join(tempDir, 'project');
    const workspaceRootPath = path.join(tempDir, 'workspace');
    const documentPath = path.join(workspaceRootPath, 'docs', 'note.mdx');
    const documentInstructionPath = path.join(workspaceRootPath, 'docs', 'note.instructions.md');

    await writeTextFile(path.join(projectRootPath, 'AGENTS.md'), 'Project instruction');
    await writeTextFile(path.join(workspaceRootPath, 'CLAUDE.md'), 'Workspace instruction');
    await writeTextFile(documentPath, '# Note');
    await writeTextFile(documentInstructionPath, 'Document instruction');

    grantReadCapability(path.join(projectRootPath, 'note.md'));
    grantReadCapability(path.join(workspaceRootPath, 'note.md'));
    grantReadCapability(documentPath);
    const storage = new AISessionStorageService(path.join(tempDir, 'storage'));
    const loader = new InstructionLoaderService(storage);

    const allInstructions = await loader.listInstructionFiles({
      projectRootPath,
      workspaceRootPath,
      documentPath,
    });

    expect(allInstructions.some((instruction) => instruction.scope === 'global')).toBe(true);
    expect(allInstructions.some((instruction) => instruction.scope === 'workspace')).toBe(true);
    expect(allInstructions.some((instruction) => instruction.scope === 'document')).toBe(true);

    const workspaceOnly = await loader.listInstructionFiles({
      projectRootPath,
      workspaceRootPath,
      documentPath,
      scope: 'workspace',
    });

    expect(workspaceOnly).toHaveLength(1);
    expect(workspaceOnly[0]?.fileName).toBe('CLAUDE.md');
    expect(workspaceOnly[0]?.scope).toBe('workspace');
  });

  it('loads instruction content by id and removes stale entries when files disappear', async () => {
    const projectRootPath = path.join(tempDir, 'project');
    const projectInstructionPath = path.join(projectRootPath, 'AGENTS.md');
    await writeTextFile(projectInstructionPath, 'Project instruction body');

    grantReadCapability(path.join(projectRootPath, 'note.md'));
    const storage = new AISessionStorageService(path.join(tempDir, 'storage'));
    const loader = new InstructionLoaderService(storage);

    const discovered = await loader.listInstructionFiles({ projectRootPath, scope: 'global' });
    const instruction = discovered[0];
    expect(instruction).toBeDefined();

    const loaded = await loader.loadInstructionFile(instruction!.id);
    expect(loaded?.metadata.id).toBe(instruction?.id);
    expect(loaded?.content).toBe('Project instruction body');

    await rm(projectInstructionPath, { force: true });

    const missing = await loader.loadInstructionFile(instruction!.id);
    expect(missing).toBeNull();
    expect(await storage.getInstructionFile(instruction!.id)).toBeNull();
  });

  it('does not load an instruction file that is a link', async () => {
    const projectRootPath = path.join(tempDir, 'project');
    const outside = path.join(tempDir, 'outside.md');
    await writeTextFile(outside, 'secret instruction');
    await mkdir(projectRootPath, { recursive: true });
    await symlink(outside, path.join(projectRootPath, 'AGENTS.md'));

    grantReadCapability(path.join(projectRootPath, 'note.md'));
    const storage = new AISessionStorageService(path.join(tempDir, 'storage'));
    const loader = new InstructionLoaderService(storage);

    const discovered = await loader.listInstructionFiles({ projectRootPath, scope: 'global' });

    expect(discovered).toEqual([]);
  });
});
