import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { grantReadCapability, resetFileCapabilities } from '@main/ipc/document-capability';

import { AIPromptFileLoaderService } from '../prompt-file-loader-service';

describe('AIPromptFileLoaderService', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-prompt-loader-'));
  });

  afterEach(async () => {
    resetFileCapabilities();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  async function writePromptFile(
    rootPath: string,
    fileName: string,
    content: string
  ): Promise<string> {
    const promptDir = path.join(rootPath, '.mdxpad', 'prompts');
    await mkdir(promptDir, { recursive: true });
    const filePath = path.join(promptDir, fileName);
    await writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  it('discovers workspace and project prompt files with extracted metadata', async () => {
    const workspaceRootPath = path.join(tempDir, 'workspace');
    const projectRootPath = path.join(workspaceRootPath, 'projects', 'alpha');
    await mkdir(projectRootPath, { recursive: true });

    await writePromptFile(
      workspaceRootPath,
      'workspace-rewrite.md',
      `---
title: Workspace Rewrite
description: Rewrite with docs tone
variables:
  - tone
---
Rewrite this document using the {{tone}} tone.
`
    );
    await writePromptFile(
      projectRootPath,
      'project-summary.md',
      `---
title: Project Summary
systemPrompt: Keep responses brief.
modelSelection:
  providerId: openai-provider
  modelId: gpt-4o
  providerType: openai
---
Summarize project progress.
`
    );

    grantReadCapability(path.join(workspaceRootPath, 'note.md'));
    const service = new AIPromptFileLoaderService();
    const prompts = await service.discoverPromptFiles({
      workspaceRootPath,
      projectRootPath,
    });

    expect(prompts).toHaveLength(2);

    const workspacePrompt = prompts.find((prompt) => prompt.fileName === 'workspace-rewrite.md');
    const projectPrompt = prompts.find((prompt) => prompt.fileName === 'project-summary.md');

    expect(workspacePrompt).toMatchObject({
      kind: 'prompt',
      title: 'Workspace Rewrite',
      description: 'Rewrite with docs tone',
      variables: ['tone'],
    });
    expect(workspacePrompt?.checksum).toHaveLength(64);
    expect(projectPrompt).toMatchObject({
      kind: 'prompt',
      title: 'Project Summary',
      systemPrompt: 'Keep responses brief.',
      modelSelection: {
        providerId: 'openai-provider',
        modelId: 'gpt-4o',
        providerType: 'openai',
      },
    });
  });

  it('derives title and variables when frontmatter omits prompt metadata', async () => {
    const workspaceRootPath = path.join(tempDir, 'workspace');
    await mkdir(workspaceRootPath, { recursive: true });

    await writePromptFile(
      workspaceRootPath,
      'summarize.mdx',
      `# Summarize Notes

Provide a summary for {{audience}} and keep the {{tone}} tone.
`
    );

    grantReadCapability(path.join(workspaceRootPath, 'note.md'));
    const service = new AIPromptFileLoaderService();
    const prompts = await service.discoverPromptFiles({ workspaceRootPath });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({
      fileName: 'summarize.mdx',
      title: 'Summarize Notes',
      variables: ['audience', 'tone'],
    });
  });

  it('skips prompt files that fail metadata schema validation', async () => {
    const workspaceRootPath = path.join(tempDir, 'workspace');
    await mkdir(workspaceRootPath, { recursive: true });

    await writePromptFile(
      workspaceRootPath,
      'valid.md',
      `---
title: Valid Prompt
---
Draft content.
`
    );
    await writePromptFile(
      workspaceRootPath,
      'invalid.md',
      `---
title: Invalid Prompt
modelSelection:
  providerType: invalid-provider
---
Draft content.
`
    );

    grantReadCapability(path.join(workspaceRootPath, 'note.md'));
    const service = new AIPromptFileLoaderService();
    const prompts = await service.discoverPromptFiles({ workspaceRootPath });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.fileName).toBe('valid.md');
  });

  it('does not discover a prompt file that is a link', async () => {
    const workspaceRootPath = path.join(tempDir, 'workspace');
    const promptDir = path.join(workspaceRootPath, '.mdxpad', 'prompts');
    const outside = path.join(tempDir, 'secret.md');
    await mkdir(promptDir, { recursive: true });
    await writeFile(
      outside,
      `---
title: Secret
---
hidden
`,
      'utf-8'
    );
    await symlink(outside, path.join(promptDir, 'linked.md'));

    grantReadCapability(path.join(workspaceRootPath, 'note.md'));
    const service = new AIPromptFileLoaderService();
    const prompts = await service.discoverPromptFiles({ workspaceRootPath });

    expect(prompts).toEqual([]);
  });
});
