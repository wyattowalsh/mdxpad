import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ExportCliInvokeResponseSchema,
  LlmsGenerationResponseSchema,
  type ExportCliInvokeRequest,
} from '@shared/contracts/export-schemas';
import { generateLlmsFile, getDefaultLlmsOutputPath, invokeExportCli } from '../cli-service';

const SAMPLE_CONTENT = `---
title: "CLI Guide"
tags: [Docs, CLI]
---

# Overview #ops
Use mdxpad from the command line.

## API usage [tags: api, automation]
\`\`\`ts
export const run = true;
\`\`\`
`;

function createTestRequest(overrides?: Partial<ExportCliInvokeRequest>): ExportCliInvokeRequest {
  return {
    job: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      preset: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'PDF export',
        format: 'pdf',
        options: {},
      },
      format: 'pdf',
      sourcePath: '/tmp/source.mdx',
      targetPath: '/tmp/output.pdf',
      generationMode: 'llm',
      llm: {
        modelId: 'test-model',
      },
      status: 'queued',
      warnings: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    command: process.execPath,
    args: ['-e', 'process.stdout.write("ok\\n");'],
    timeoutMs: 5_000,
    ...overrides,
  };
}

describe('invokeExportCli', () => {
  it('returns successful output for zero-exit commands', async () => {
    const response = await invokeExportCli(createTestRequest());

    expect(ExportCliInvokeResponseSchema.safeParse(response).success).toBe(true);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.output.exitCode).toBe(0);
      expect(response.output.artifactPath).toBe('/tmp/output.pdf');
      expect(response.output.commandLine).toContain(process.execPath);
      expect(response.output.events.some((event) => event.message === 'ok')).toBe(true);
    }
  });

  it('returns NON_ZERO_EXIT when command exits with error code', async () => {
    const response = await invokeExportCli(
      createTestRequest({
        args: ['-e', 'process.stderr.write("boom\\n"); process.exit(7);'],
      })
    );

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('NON_ZERO_EXIT');
      expect(response.output?.exitCode).toBe(7);
    }
  });

  it('runs built-in PDF export using preset options', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-pdf-export-'));
    try {
      const sourcePath = path.join(tempDir, 'source.mdx');
      const targetPath = path.join(tempDir, 'output.pdf');
      await writeFile(sourcePath, '# PDF Heading\n\nPreset-based export test.', 'utf-8');

      const request = createTestRequest({
        command: 'mdxpad-export',
        args: [],
        job: {
          ...createTestRequest().job,
          sourcePath,
          targetPath,
          format: 'pdf',
          generationMode: 'native',
          preset: {
            ...createTestRequest().job.preset,
            format: 'pdf',
            options: {
              title: 'Preset PDF',
              author: 'MDXPad Tests',
              pageSize: 'Letter',
              fontSizePt: 12,
            },
          },
        },
      });

      const response = await invokeExportCli(request);
      expect(response.ok).toBe(true);
      if (response.ok) {
        const artifact = await readFile(targetPath, 'utf-8');
        expect(artifact.startsWith('%PDF-1.4')).toBe(true);
        expect(artifact).toContain('/Title (Preset PDF)');
        expect(
          response.output.events.some((event) => event.message.includes('built-in PDF exporter'))
        ).toBe(true);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('runs built-in DOCX export using preset options', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-docx-export-'));
    try {
      const sourcePath = path.join(tempDir, 'source.mdx');
      const targetPath = path.join(tempDir, 'output.docx');
      await writeFile(
        sourcePath,
        '# DOCX Heading\n\n## Section\n\n![diagram](./diagram.png)\n\nBody text.',
        'utf-8'
      );

      const request = createTestRequest({
        command: 'mdxpad-export',
        args: [],
        job: {
          ...createTestRequest().job,
          sourcePath,
          targetPath,
          format: 'docx',
          generationMode: 'native',
          preset: {
            ...createTestRequest().job.preset,
            format: 'docx',
            options: {
              title: 'Preset DOCX',
              headingBaseLevel: 2,
              includeToc: true,
              embedImages: true,
            },
          },
        },
      });

      const response = await invokeExportCli(request);
      expect(response.ok).toBe(true);
      if (response.ok) {
        const artifact = await readFile(targetPath);
        expect(artifact.subarray(0, 2).toString()).toBe('PK');
        expect(artifact.includes(Buffer.from('word/document.xml'))).toBe(true);
        expect(
          response.output.events.some((event) =>
            event.message.includes('Image embedding is not available')
          )
        ).toBe(true);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns TIMEOUT when command exceeds timeoutMs', async () => {
    const response = await invokeExportCli(
      createTestRequest({
        args: ['-e', 'setTimeout(() => process.exit(0), 5000);'],
        timeoutMs: 25,
      })
    );

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('TIMEOUT');
      expect(response.output?.events.some((event) => event.message.includes('timed out'))).toBe(
        true
      );
    }
  });

  it('returns VALIDATION_ERROR for invalid request payloads', async () => {
    const invalidRequest = {
      ...createTestRequest(),
      command: '',
    } as unknown as ExportCliInvokeRequest;

    const response = await invokeExportCli(invalidRequest);
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('VALIDATION_ERROR');
    }
  });

  it('supports shell integration mode', async () => {
    const response = await invokeExportCli(
      createTestRequest({
        command: 'printf "shell-ok\\n"',
        args: [],
        shell: true,
      })
    );

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(
        response.output.events.some((event) => event.message.includes('Shell integration'))
      ).toBe(true);
      expect(response.output.events.some((event) => event.message === 'shell-ok')).toBe(true);
    }
  });

  it('supports background execution mode', async () => {
    const response = await invokeExportCli(
      createTestRequest({
        args: ['-e', 'setTimeout(() => process.exit(0), 100);'],
        background: true,
      })
    );

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.output.background).toBe(true);
      expect(response.output.pid).toBeGreaterThan(0);
      expect(
        response.output.events.some((event) =>
          event.message.includes('Command started in background')
        )
      ).toBe(true);
    }
  });
});

describe('llms generation helpers', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-cli-service-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('derives default llms output paths from source path', () => {
    expect(getDefaultLlmsOutputPath('/tmp/docs/post.mdx', 'llms.txt')).toBe('/tmp/docs/llms.txt');
    expect(getDefaultLlmsOutputPath('/tmp/docs/post.mdx', 'llms-full.txt')).toBe(
      '/tmp/docs/llms-full.txt'
    );
    expect(getDefaultLlmsOutputPath(null, 'llms.txt')).toBe('llms.txt');
  });

  it('writes llms content and returns bytes written', async () => {
    const outputPath = path.join(tempDir, 'exports', 'llms.txt');
    const response = await generateLlmsFile({
      action: 'generate',
      target: 'llms.txt',
      sourcePath: '/tmp/docs/post.mdx',
      content: SAMPLE_CONTENT,
      outputPath,
      overwrite: false,
    });

    expect(LlmsGenerationResponseSchema.safeParse(response).success).toBe(true);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.path).toBe(outputPath);
      const generated = await readFile(outputPath, 'utf-8');
      expect(generated).toContain('# llms.txt');
      expect(generated).toContain('title: CLI Guide');
      expect(generated).toContain('## Headings');
      expect(generated).toContain('- Overview #ops');
      expect(response.bytesWritten).toBe(Buffer.byteLength(generated, 'utf-8'));
    }
  });

  it('returns WRITE_FAILED when output exists and overwrite is false', async () => {
    const outputPath = path.join(tempDir, 'llms.txt');
    await writeFile(outputPath, 'old content', 'utf-8');
    const response = await generateLlmsFile({
      action: 'generate',
      target: 'llms.txt',
      sourcePath: null,
      content: 'new content',
      outputPath,
      overwrite: false,
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('WRITE_FAILED');
    }
  });

  it('overwrites existing llms output when overwrite is true', async () => {
    const outputPath = path.join(tempDir, 'llms-full.txt');
    await writeFile(outputPath, 'old content', 'utf-8');
    const response = await generateLlmsFile({
      action: 'generate',
      target: 'llms-full.txt',
      sourcePath: null,
      content: SAMPLE_CONTENT,
      outputPath,
      overwrite: true,
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      await expect(readFile(outputPath, 'utf-8')).resolves.toContain('# llms-full.txt');
    }
  });

  it('filters llms-full output by requested tags', async () => {
    const outputPath = path.join(tempDir, 'llms-full.txt');
    const response = await generateLlmsFile({
      action: 'generate',
      target: 'llms-full.txt',
      sourcePath: '/tmp/docs/post.mdx',
      content: `---
title: Filter test
tags: [docs]
---

## API usage [tags: api]
Keep this.

## UI usage [tags: ui]
Drop this.
`,
      outputPath,
      overwrite: false,
      tagFilter: ['api'],
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      const generated = await readFile(outputPath, 'utf-8');
      expect(generated).toContain('tag-filter: api');
      expect(generated).toContain('## API usage [tags: api]');
      expect(generated).not.toContain('## UI usage [tags: ui]');
    }
  });
});
