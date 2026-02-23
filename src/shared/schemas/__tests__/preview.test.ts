import { describe, it, expect } from 'vitest';
import {
  compileRequestSchema,
  compileResponseSuccessSchema,
  parentToIframeMessageSchema,
  iframeToParentMessageSchema,
} from '../preview';

const VALID_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('preview boundary schemas', () => {
  it('rejects unknown keys in compile request envelope', () => {
    const result = compileRequestSchema.safeParse({
      id: VALID_ID,
      source: '# hello',
      unexpected: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys in parent-to-iframe envelope', () => {
    const result = parentToIframeMessageSchema.safeParse({
      type: 'theme',
      value: 'light',
      unexpected: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys in iframe-to-parent envelope', () => {
    const result = iframeToParentMessageSchema.safeParse({
      type: 'ready',
      unexpected: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('keeps frontmatter dynamic for render commands', () => {
    const result = parentToIframeMessageSchema.safeParse({
      type: 'render',
      code: 'console.log("ok")',
      frontmatter: {
        title: 'Test',
        nested: { enabled: true },
        tags: ['x', 'y'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('keeps frontmatter dynamic for compile success responses', () => {
    const result = compileResponseSuccessSchema.safeParse({
      id: VALID_ID,
      ok: true,
      code: 'export default function() {}',
      frontmatter: {
        published: false,
        metadata: { priority: 1 },
      },
    });
    expect(result.success).toBe(true);
  });
});
