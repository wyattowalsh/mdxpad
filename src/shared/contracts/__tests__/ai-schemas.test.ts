/**
 * Tests for AI IPC contract schemas.
 *
 * Covers provider, session, prompt, instruction, and stream contracts.
 */

import { describe, it, expect } from 'vitest';

const uuidv4 = () => crypto.randomUUID();
const isoNow = () => new Date().toISOString();

import {
  AIProviderListRequestSchema,
  AIProviderListResponseSchema,
  AIProviderSetActiveRequestSchema,
  AISessionCreateRequestSchema,
  AISessionCreateResponseSchema,
  AISessionArchiveRequestSchema,
  AISessionPromptContextSchema,
  AIPromptFileMetadataSchema,
  AIPromptListRequestSchema,
  AIPromptAttachRequestSchema,
  AIInstructionFileMetadataSchema,
  AIInstructionAttachRequestSchema,
  AIInstructionLoadRequestSchema,
  AIInstructionLoadResponseSchema,
  AIInstructionListRequestSchema,
  AIInstructionScopeSchema,
  AIStreamStartRequestSchema,
  AIStreamStartResponseSchema,
  AIStreamCancelRequestSchema,
  AIStreamEventSchema,
} from '../ai-schemas';

describe('Provider contracts', () => {
  it('should accept provider list request', () => {
    expect(AIProviderListRequestSchema.safeParse(undefined).success).toBe(true);
  });

  it('should accept provider list response', () => {
    const result = AIProviderListResponseSchema.safeParse({
      providers: [
        {
          id: uuidv4(),
          displayName: 'OpenAI',
          type: 'openai',
          isActive: true,
          status: 'connected',
          createdAt: isoNow(),
          updatedAt: isoNow(),
        },
      ],
      activeProviderId: uuidv4(),
    });
    expect(result.success).toBe(true);
  });

  it('should reject set-active request with invalid provider id', () => {
    expect(AIProviderSetActiveRequestSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('Session contracts', () => {
  it('should accept session create request', () => {
    const result = AISessionCreateRequestSchema.safeParse({
      workspaceId: uuidv4(),
      providerId: uuidv4(),
      modelId: 'gpt-4o',
      contextDocumentIds: [uuidv4()],
    });
    expect(result.success).toBe(true);
  });

  it('should reject session create request with invalid context document id', () => {
    const result = AISessionCreateRequestSchema.safeParse({
      workspaceId: uuidv4(),
      providerId: uuidv4(),
      modelId: 'gpt-4o',
      contextDocumentIds: ['not-a-uuid'],
    });
    expect(result.success).toBe(false);
  });

  it('should accept session create response', () => {
    const result = AISessionCreateResponseSchema.safeParse({
      success: true,
      session: {
        id: uuidv4(),
        workspaceId: uuidv4(),
        provider: 'provider-1',
        model: 'gpt-4o',
        contextDocumentIds: [uuidv4()],
        startedAt: isoNow(),
        lastActivityAt: isoNow(),
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept session archive request', () => {
    const result = AISessionArchiveRequestSchema.safeParse({
      sessionId: uuidv4(),
      endedAt: isoNow(),
    });
    expect(result.success).toBe(true);
  });
});

describe('Prompt contracts', () => {
  it('should accept prompt file metadata', () => {
    const result = AIPromptFileMetadataSchema.safeParse({
      id: 'prompt-1',
      kind: 'prompt',
      filePath: '/Users/test/prompts/rewrite.md',
      fileName: 'rewrite.md',
      createdAt: isoNow(),
      updatedAt: isoNow(),
      title: 'Rewrite Selection',
      variables: ['tone', 'audience'],
      modelSelection: {
        providerId: uuidv4(),
        modelId: 'gpt-4o',
        providerType: 'openai',
        capabilities: ['text-generation', 'streaming'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject prompt metadata with invalid provider type', () => {
    const result = AIPromptFileMetadataSchema.safeParse({
      id: 'prompt-1',
      kind: 'prompt',
      filePath: '/Users/test/prompts/rewrite.md',
      fileName: 'rewrite.md',
      createdAt: isoNow(),
      updatedAt: isoNow(),
      title: 'Rewrite Selection',
      variables: [],
      modelSelection: {
        providerId: uuidv4(),
        modelId: 'gpt-4o',
        providerType: 'invalid-provider',
      },
    });
    expect(result.success).toBe(false);
  });

  it('should accept prompt attach request', () => {
    const result = AIPromptAttachRequestSchema.safeParse({
      sessionId: uuidv4(),
      promptFileId: 'prompt-1',
    });
    expect(result.success).toBe(true);
  });

  it('should accept prompt list request with workspace/project path context', () => {
    const result = AIPromptListRequestSchema.safeParse({
      workspaceRootPath: '/workspace',
      projectRootPath: '/workspace/projects/alpha',
    });
    expect(result.success).toBe(true);
  });
});

describe('Instruction contracts', () => {
  it('should accept instruction scope values', () => {
    expect(AIInstructionScopeSchema.safeParse('global').success).toBe(true);
    expect(AIInstructionScopeSchema.safeParse('workspace').success).toBe(true);
    expect(AIInstructionScopeSchema.safeParse('document').success).toBe(true);
  });

  it('should accept instruction file metadata', () => {
    const result = AIInstructionFileMetadataSchema.safeParse({
      id: 'instruction-1',
      kind: 'instruction',
      scope: 'document',
      appliesToDocumentIds: [uuidv4()],
      filePath: '/Users/test/instructions/doc.md',
      fileName: 'doc.md',
      createdAt: isoNow(),
      updatedAt: isoNow(),
      version: '1.0.0',
    });
    expect(result.success).toBe(true);
  });

  it('should reject instruction metadata with invalid scope', () => {
    const result = AIInstructionFileMetadataSchema.safeParse({
      id: 'instruction-1',
      kind: 'instruction',
      scope: 'invalid',
      filePath: '/Users/test/instructions/doc.md',
      fileName: 'doc.md',
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
    expect(result.success).toBe(false);
  });

  it('should accept instruction attach request', () => {
    const result = AIInstructionAttachRequestSchema.safeParse({
      sessionId: uuidv4(),
      instructionFileId: 'instruction-1',
    });
    expect(result.success).toBe(true);
  });

  it('should accept instruction list request with discovery paths', () => {
    const result = AIInstructionListRequestSchema.safeParse({
      workspaceId: uuidv4(),
      scope: 'workspace',
      projectRootPath: '/Users/test/project',
      workspaceRootPath: '/Users/test/workspace',
      documentPath: '/Users/test/workspace/docs/note.mdx',
    });
    expect(result.success).toBe(true);
  });

  it('should accept instruction load request and response', () => {
    const request = AIInstructionLoadRequestSchema.safeParse({
      instructionFileId: 'instruction-1',
    });
    expect(request.success).toBe(true);

    const response = AIInstructionLoadResponseSchema.safeParse({
      instruction: {
        metadata: {
          id: 'instruction-1',
          kind: 'instruction',
          scope: 'workspace',
          filePath: '/Users/test/workspace/AGENTS.md',
          fileName: 'AGENTS.md',
          createdAt: isoNow(),
          updatedAt: isoNow(),
        },
        content: 'Follow workspace conventions.',
      },
    });
    expect(response.success).toBe(true);
  });
});

describe('Session prompt context contract', () => {
  it('should accept context with prompt and instruction metadata', () => {
    const result = AISessionPromptContextSchema.safeParse({
      sessionId: uuidv4(),
      promptFile: {
        id: 'prompt-1',
        kind: 'prompt',
        filePath: '/Users/test/prompts/rewrite.md',
        fileName: 'rewrite.md',
        createdAt: isoNow(),
        updatedAt: isoNow(),
        title: 'Rewrite',
        variables: [],
      },
      instructionFile: {
        id: 'instruction-1',
        kind: 'instruction',
        scope: 'workspace',
        filePath: '/Users/test/instructions/workspace.md',
        fileName: 'workspace.md',
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('Stream contracts', () => {
  it('should accept stream start request', () => {
    const result = AIStreamStartRequestSchema.safeParse({
      sessionId: uuidv4(),
      prompt: 'Summarize this document',
    });
    expect(result.success).toBe(true);
  });

  it('should reject stream start request with empty prompt', () => {
    const result = AIStreamStartRequestSchema.safeParse({
      sessionId: uuidv4(),
      prompt: '',
    });
    expect(result.success).toBe(false);
  });

  it('should accept stream start response', () => {
    const result = AIStreamStartResponseSchema.safeParse({
      success: true,
      streamId: uuidv4(),
    });
    expect(result.success).toBe(true);
  });

  it('should accept stream cancel request', () => {
    const result = AIStreamCancelRequestSchema.safeParse({
      streamId: uuidv4(),
    });
    expect(result.success).toBe(true);
  });

  it('should accept stream event union variants', () => {
    const chunk = AIStreamEventSchema.safeParse({
      event: 'chunk',
      payload: {
        streamId: uuidv4(),
        chunk: 'partial response',
        isComplete: false,
      },
    });
    const complete = AIStreamEventSchema.safeParse({
      event: 'complete',
      payload: {
        streamId: uuidv4(),
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      },
    });
    const error = AIStreamEventSchema.safeParse({
      event: 'error',
      payload: {
        streamId: uuidv4(),
        error: {
          code: 'STREAM_TIMEOUT',
          message: 'Timed out',
        },
      },
    });

    expect(chunk.success).toBe(true);
    expect(complete.success).toBe(true);
    expect(error.success).toBe(true);
  });

  it('should reject unknown stream event type', () => {
    const result = AIStreamEventSchema.safeParse({
      event: 'unknown',
      payload: {},
    });
    expect(result.success).toBe(false);
  });
});
