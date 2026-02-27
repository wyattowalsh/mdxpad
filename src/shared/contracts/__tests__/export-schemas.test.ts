import { describe, it, expect } from 'vitest';
import {
  ExportJobLifecycleRequestSchema,
  ExportJobLifecycleResponseSchema,
  ExportPresetCrudRequestSchema,
  ExportPresetCrudResponseSchema,
  ExportCliInvokeRequestSchema,
  ExportCliInvokeResponseSchema,
  LlmsTargetSchema,
  LlmsGenerationRequestSchema,
  LlmsGenerationResponseSchema,
} from '../export-schemas';

const uuidv4 = () => crypto.randomUUID();
const isoNow = () => new Date().toISOString();

const validPreset = {
  id: uuidv4(),
  name: 'Default PDF',
  format: 'pdf' as const,
  options: {},
};

const validJob = {
  id: uuidv4(),
  preset: validPreset,
  format: 'pdf' as const,
  sourcePath: '/docs/post.mdx',
  targetPath: '/exports/post.pdf',
  generationMode: 'native' as const,
  status: 'queued' as const,
  warnings: [],
  createdAt: isoNow(),
};

const validCliOutput = {
  job: validJob,
  exitCode: 0,
  durationMs: 1250,
  artifactPath: '/exports/post.pdf',
  events: [
    {
      level: 'info' as const,
      message: 'Export completed',
      timestamp: isoNow(),
    },
  ],
};

describe('ExportJobLifecycleRequestSchema', () => {
  it('accepts create requests with a full export job payload', () => {
    const result = ExportJobLifecycleRequestSchema.safeParse({
      action: 'create',
      job: validJob,
    });
    expect(result.success).toBe(true);
  });

  it('accepts list requests with optional status filter', () => {
    const result = ExportJobLifecycleRequestSchema.safeParse({
      action: 'list',
      status: 'running',
    });
    expect(result.success).toBe(true);
  });

  it('rejects list requests with invalid status filter', () => {
    const result = ExportJobLifecycleRequestSchema.safeParse({
      action: 'list',
      status: 'invalid-status',
    });
    expect(result.success).toBe(false);
  });

  it('rejects create requests when preset format does not match job format', () => {
    const result = ExportJobLifecycleRequestSchema.safeParse({
      action: 'create',
      job: {
        ...validJob,
        format: 'docx',
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('ExportJobLifecycleResponseSchema', () => {
  it('accepts successful list responses', () => {
    const result = ExportJobLifecycleResponseSchema.safeParse({
      ok: true,
      jobs: [validJob],
    });
    expect(result.success).toBe(true);
  });

  it('accepts lifecycle error responses', () => {
    const result = ExportJobLifecycleResponseSchema.safeParse({
      ok: false,
      code: 'INVALID_STATE',
      error: 'Cannot cancel completed job',
    });
    expect(result.success).toBe(true);
  });
});

describe('ExportPresetCrudRequestSchema', () => {
  it('accepts create preset requests', () => {
    const result = ExportPresetCrudRequestSchema.safeParse({
      action: 'create',
      preset: validPreset,
    });
    expect(result.success).toBe(true);
  });

  it('rejects update requests without preset id', () => {
    const result = ExportPresetCrudRequestSchema.safeParse({
      action: 'update',
      preset: validPreset,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid PDF preset option values', () => {
    const result = ExportPresetCrudRequestSchema.safeParse({
      action: 'create',
      preset: {
        ...validPreset,
        options: {
          pageSize: 'A0',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid DOCX preset option values', () => {
    const result = ExportPresetCrudRequestSchema.safeParse({
      action: 'create',
      preset: {
        ...validPreset,
        format: 'docx',
        options: {
          headingBaseLevel: 9,
        },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('ExportPresetCrudResponseSchema', () => {
  it('accepts successful list responses', () => {
    const result = ExportPresetCrudResponseSchema.safeParse({
      ok: true,
      presets: [validPreset],
    });
    expect(result.success).toBe(true);
  });
});

describe('ExportCliInvokeRequestSchema', () => {
  it('accepts invocation requests and defaults args', () => {
    const result = ExportCliInvokeRequestSchema.safeParse({
      job: validJob,
      command: 'mdxpad-export',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.args).toEqual([]);
    }
  });

  it('rejects blank command values', () => {
    const result = ExportCliInvokeRequestSchema.safeParse({
      job: validJob,
      command: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts shell and background execution flags', () => {
    const result = ExportCliInvokeRequestSchema.safeParse({
      job: validJob,
      command: 'echo ok',
      shell: true,
      background: true,
    });

    expect(result.success).toBe(true);
  });
});

describe('ExportCliInvokeResponseSchema', () => {
  it('accepts successful CLI output payloads', () => {
    const result = ExportCliInvokeResponseSchema.safeParse({
      ok: true,
      output: validCliOutput,
    });
    expect(result.success).toBe(true);
  });
});

describe('Llms generation schemas', () => {
  it('accepts llms.txt target and llms-full.txt target values', () => {
    expect(LlmsTargetSchema.safeParse('llms.txt').success).toBe(true);
    expect(LlmsTargetSchema.safeParse('llms-full.txt').success).toBe(true);
  });

  it('accepts generation requests', () => {
    const result = LlmsGenerationRequestSchema.safeParse({
      action: 'generate',
      target: 'llms-full.txt',
      sourcePath: '/docs/post.mdx',
      content: '# Post',
      outputPath: '/docs/llms-full.txt',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid targets', () => {
    const result = LlmsGenerationRequestSchema.safeParse({
      action: 'generate',
      target: 'llms.md',
      content: '# Post',
      outputPath: '/docs/llms.txt',
    });
    expect(result.success).toBe(false);
  });

  it('accepts successful generation responses', () => {
    const result = LlmsGenerationResponseSchema.safeParse({
      ok: true,
      target: 'llms.txt',
      path: '/docs/llms.txt',
      bytesWritten: 1024,
    });
    expect(result.success).toBe(true);
  });

  it('accepts tag filters on generation requests', () => {
    const result = LlmsGenerationRequestSchema.safeParse({
      action: 'generate',
      target: 'llms.txt',
      content: '# Post',
      outputPath: '/docs/llms.txt',
      tagFilter: ['api', 'docs'],
    });

    expect(result.success).toBe(true);
  });
});
