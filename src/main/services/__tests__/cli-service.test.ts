import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { grantReadCapability, grantWriteCapability } from '@main/ipc/document-capability';
import {
  ExportCliInvokeResponseSchema,
  LlmsGenerationResponseSchema,
  type ExportCliInvokeRequest,
} from '@shared/contracts/export-schemas';

import { ALLOWED_COMMANDS } from '../cli-engine';
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
  // Allow process.execPath (node binary) for spawn behavior tests
  beforeEach(() => {
    ALLOWED_COMMANDS.add(process.execPath);
  });
  afterEach(() => {
    ALLOWED_COMMANDS.delete(process.execPath);
  });

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
      grantReadCapability(sourcePath);

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
        expect(artifact.startsWith('%PDF')).toBe(true);
        const usedTextPdf = response.output.events.some((event) =>
          event.message.includes('text PDF was written')
        );
        if (usedTextPdf) {
          expect(artifact).toContain('/Title (Preset PDF)');
        }
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
      await writeFile(
        path.join(tempDir, 'diagram.png'),
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64'
        )
      );
      grantReadCapability(sourcePath);

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
        const extracted = spawnSync(
          'python3',
          [
            '-c',
            'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print("\\n".join(z.namelist())); print(z.read("word/document.xml").decode("utf-8"))',
            targetPath,
          ],
          { encoding: 'utf8' }
        );
        expect(extracted.stdout).toContain('word/media/');
        expect(extracted.stdout).toContain('DOCX Heading');
        expect(extracted.stdout).toContain('Body text');
        expect(extracted.stdout).toContain('Table of Contents');
        expect(extracted.stdout).toContain('w:val="Heading2"');
        expect(extracted.stdout).toContain('w:val="Heading3"');
        expect(
          response.output.events.some((event) =>
            event.message.includes('Image embedding is not available')
          )
        ).toBe(false);
        expect(
          response.output.events.some((event) => event.message.includes('table of contents'))
        ).toBe(false);
        expect(
          response.output.events.some((event) => event.message.includes('heading levels'))
        ).toBe(false);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('writes the LaTeX class and packages from the preset', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-latex-class-'));
    try {
      const sourcePath = path.join(tempDir, 'source.mdx');
      const targetPath = path.join(tempDir, 'output.tex');
      await writeFile(sourcePath, 'Hello', 'utf-8');
      grantReadCapability(sourcePath);

      const response = await invokeExportCli(
        createTestRequest({
          command: 'mdxpad-export',
          args: [],
          cwd: tempDir,
          job: {
            ...createTestRequest().job,
            sourcePath,
            targetPath,
            format: 'latex',
            generationMode: 'native',
            preset: {
              id: '10000000-0000-4000-8000-000000000012',
              name: 'LaTeX',
              format: 'latex',
              options: {
                documentClass: 'book',
                fontSize: '10pt',
                packages: ['booktabs'],
              },
            },
          },
        })
      );

      expect(response.ok).toBe(true);
      const artifact = await readFile(targetPath, 'utf-8');
      expect(artifact).toContain('\\documentclass[10pt]{book}');
      expect(artifact).toContain('\\usepackage{booktabs}');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('runs built-in LaTeX export through the format writer', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-latex-export-'));
    try {
      const sourcePath = path.join(tempDir, 'source.mdx');
      const targetPath = path.join(tempDir, 'output.tex');
      await writeFile(sourcePath, '# Latex Heading\n\nBody text.', 'utf-8');
      grantReadCapability(sourcePath);

      const request = createTestRequest({
        command: 'mdxpad-export',
        args: [],
        cwd: tempDir,
        job: {
          ...createTestRequest().job,
          sourcePath,
          targetPath,
          format: 'latex',
          generationMode: 'native',
          preset: {
            id: '10000000-0000-4000-8000-000000000007',
            name: 'LaTeX',
            format: 'latex',
            options: {},
          },
        },
      });

      const response = await invokeExportCli(request);
      expect(response.ok).toBe(true);
      if (response.ok) {
        const artifact = await readFile(targetPath, 'utf-8');
        expect(artifact).toContain('\\documentclass');
        expect(artifact).toContain('Latex Heading');
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not write an export through a linked folder', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-export-link-dir-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-export-link-out-'));
    try {
      const sourcePath = path.join(tempDir, 'source.mdx');
      const targetPath = path.join(tempDir, 'out', 'output.tex');
      await writeFile(sourcePath, '# Latex Heading\n\nBody text.', 'utf-8');
      await symlink(outside, path.join(tempDir, 'out'));
      grantReadCapability(sourcePath);

      const response = await invokeExportCli(
        createTestRequest({
          command: 'mdxpad-export',
          args: [],
          cwd: tempDir,
          job: {
            ...createTestRequest().job,
            sourcePath,
            targetPath,
            format: 'latex',
            generationMode: 'native',
            preset: {
              id: '10000000-0000-4000-8000-000000000011',
              name: 'LaTeX',
              format: 'latex',
              options: {},
            },
          },
        })
      );

      expect(response.ok).toBe(false);
      if (!response.ok && response.output) {
        expect(
          response.output.events.some((event) => event.message.includes('outside the workspace'))
        ).toBe(true);
      }
      await expect(readFile(path.join(outside, 'output.tex'))).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('exports the supplied editor text instead of the file on disk', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-editor-export-'));
    try {
      const sourcePath = path.join(tempDir, 'source.mdx');
      const targetPath = path.join(tempDir, 'output.tex');
      await writeFile(sourcePath, '# Disk heading', 'utf-8');
      grantReadCapability(sourcePath);

      const response = await invokeExportCli(
        createTestRequest({
          command: 'mdxpad-export',
          args: [],
          cwd: tempDir,
          content: '# Editor heading',
          job: {
            ...createTestRequest().job,
            sourcePath,
            targetPath,
            format: 'latex',
            generationMode: 'native',
            preset: {
              id: '10000000-0000-4000-8000-000000000008',
              name: 'LaTeX',
              format: 'latex',
              options: {},
            },
          },
        })
      );

      expect(response.ok).toBe(true);
      const artifact = await readFile(targetPath, 'utf-8');
      expect(artifact).toContain('Editor heading');
      expect(artifact).not.toContain('Disk heading');
      expect(await readFile(sourcePath, 'utf-8')).toBe('# Disk heading');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('exports an untitled document to a file the user already chose', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-untitled-export-'));
    try {
      const targetPath = path.join(tempDir, 'output.tex');
      await writeFile(targetPath, 'previous', 'utf-8');
      grantWriteCapability(targetPath);

      const response = await invokeExportCli(
        createTestRequest({
          command: 'mdxpad-export',
          args: [],
          cwd: tempDir,
          content: '# Draft heading',
          job: {
            ...createTestRequest().job,
            sourcePath: null,
            targetPath,
            format: 'latex',
            generationMode: 'native',
            preset: {
              id: '10000000-0000-4000-8000-000000000009',
              name: 'LaTeX',
              format: 'latex',
              options: {},
            },
          },
        })
      );

      expect(response.ok).toBe(true);
      expect(await readFile(targetPath, 'utf-8')).toContain('Draft heading');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not write an untitled export to a file the user has not chosen', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-untitled-closed-'));
    try {
      const targetPath = path.join(tempDir, 'output.tex');
      const response = await invokeExportCli(
        createTestRequest({
          command: 'mdxpad-export',
          args: [],
          cwd: tempDir,
          content: '# Draft heading',
          job: {
            ...createTestRequest().job,
            sourcePath: null,
            targetPath,
            format: 'latex',
            generationMode: 'native',
            preset: {
              id: '10000000-0000-4000-8000-00000000000a',
              name: 'LaTeX',
              format: 'latex',
              options: {},
            },
          },
        })
      );

      expect(response.ok).toBe(false);
      await expect(readFile(targetPath, 'utf-8')).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not export supplied text for a file that is not open', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-closed-content-'));
    try {
      const sourcePath = path.join(tempDir, 'secret.md');
      const targetPath = path.join(tempDir, 'output.tex');
      await writeFile(sourcePath, 'hidden', 'utf-8');
      const response = await invokeExportCli(
        createTestRequest({
          command: 'mdxpad-export',
          args: [],
          cwd: tempDir,
          content: '# Sneaky',
          job: {
            ...createTestRequest().job,
            sourcePath,
            targetPath,
            format: 'latex',
            generationMode: 'native',
            preset: {
              id: '10000000-0000-4000-8000-00000000000b',
              name: 'LaTeX',
              format: 'latex',
              options: {},
            },
          },
        })
      );

      expect(response.ok).toBe(false);
      await expect(readFile(targetPath, 'utf-8')).rejects.toThrow();
      expect(await readFile(sourcePath, 'utf-8')).toBe('hidden');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not read a file that is not open', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-closed-export-'));
    try {
      const sourcePath = path.join(tempDir, 'secret.md');
      const targetPath = path.join(tempDir, 'secret.pdf');
      await writeFile(sourcePath, 'hidden', 'utf-8');
      const request = createTestRequest({
        command: 'mdxpad-export',
        args: [],
        cwd: tempDir,
        job: {
          ...createTestRequest().job,
          sourcePath,
          targetPath,
          format: 'pdf',
          generationMode: 'native',
        },
      });

      const response = await invokeExportCli(request);

      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(
          response.output?.events.some((event) => event.message.includes('file that is open'))
        ).toBe(true);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not write an export outside the opened file directory', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-export-escape-'));
    try {
      const sourceDir = path.join(tempDir, 'docs');
      await mkdir(sourceDir);
      const sourcePath = path.join(sourceDir, 'source.mdx');
      const targetPath = path.join(tempDir, 'escape.tex');
      await writeFile(sourcePath, '# Heading\n\nBody.', 'utf-8');
      grantReadCapability(sourcePath);
      const request = createTestRequest({
        command: 'mdxpad-export',
        args: [],
        cwd: tempDir,
        job: {
          ...createTestRequest().job,
          sourcePath,
          targetPath,
          format: 'latex',
          generationMode: 'native',
          preset: {
            id: '10000000-0000-4000-8000-000000000007',
            name: 'LaTeX',
            format: 'latex',
            options: {},
          },
        },
      });

      const response = await invokeExportCli(request);

      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(
          response.output?.events.some((event) => event.message.includes('outside the workspace'))
        ).toBe(true);
      }
      await expect(access(targetPath)).rejects.toThrow();
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

  it('rejects non-allowlisted commands', async () => {
    const response = await invokeExportCli(
      createTestRequest({
        command: 'printf "shell-ok\\n"',
        args: [],
      })
    );

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error).toContain('not in the allowed commands list');
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
    const sourcePath = path.join(tempDir, 'post.mdx');
    await writeFile(sourcePath, SAMPLE_CONTENT, 'utf-8');
    grantReadCapability(sourcePath);
    const outputPath = path.join(tempDir, 'exports', 'llms.txt');
    const response = await generateLlmsFile({
      action: 'generate',
      target: 'llms.txt',
      sourcePath,
      content: SAMPLE_CONTENT,
      outputPath: path.join('exports', 'llms.txt'),
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
    const sourcePath = path.join(tempDir, 'post.mdx');
    const outputPath = path.join(tempDir, 'llms.txt');
    await writeFile(sourcePath, SAMPLE_CONTENT, 'utf-8');
    await writeFile(outputPath, 'old content', 'utf-8');
    grantReadCapability(sourcePath);
    const response = await generateLlmsFile({
      action: 'generate',
      target: 'llms.txt',
      sourcePath,
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
    const sourcePath = path.join(tempDir, 'post.mdx');
    const outputPath = path.join(tempDir, 'llms-full.txt');
    await writeFile(sourcePath, SAMPLE_CONTENT, 'utf-8');
    await writeFile(outputPath, 'old content', 'utf-8');
    grantReadCapability(sourcePath);
    const response = await generateLlmsFile({
      action: 'generate',
      target: 'llms-full.txt',
      sourcePath,
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
    const sourcePath = path.join(tempDir, 'post.mdx');
    const outputPath = path.join(tempDir, 'llms-full.txt');
    await writeFile(sourcePath, 'source', 'utf-8');
    grantReadCapability(sourcePath);
    const response = await generateLlmsFile({
      action: 'generate',
      target: 'llms-full.txt',
      sourcePath,
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

  it('does not write llms output for a file that is not open', async () => {
    const sourcePath = path.join(tempDir, 'closed.mdx');
    const outputPath = path.join(tempDir, 'llms.txt');
    await writeFile(sourcePath, SAMPLE_CONTENT, 'utf-8');
    const response = await generateLlmsFile({
      action: 'generate',
      target: 'llms.txt',
      sourcePath,
      content: SAMPLE_CONTENT,
      outputPath,
      overwrite: false,
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('WRITE_FAILED');
      expect(response.error).toContain('file that is open');
    }
    await expect(access(outputPath)).rejects.toThrow();
  });

  it('does not write llms output outside the opened file directory', async () => {
    const sourceDir = path.join(tempDir, 'docs');
    await mkdir(sourceDir);
    const sourcePath = path.join(sourceDir, 'post.mdx');
    const outputPath = path.join(tempDir, 'llms.txt');
    await writeFile(sourcePath, SAMPLE_CONTENT, 'utf-8');
    grantReadCapability(sourcePath);
    const response = await generateLlmsFile({
      action: 'generate',
      target: 'llms.txt',
      sourcePath,
      content: SAMPLE_CONTENT,
      outputPath,
      overwrite: false,
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('WRITE_FAILED');
      expect(response.error).toContain('outside the workspace');
    }
    await expect(access(outputPath)).rejects.toThrow();
  });
});
