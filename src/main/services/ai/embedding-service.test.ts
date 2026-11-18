/**
 * Unit tests for Embedding Service - chunkText function.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { ProviderConfig, ProviderType } from '@shared/ai/types';
import type { IAIService } from './ai-types';
import { EmbeddingsUnavailableError } from './embedding-availability';
import { chunkText, EmbeddingService, readIndexableContent } from './embedding-service';

function provider(type: ProviderType): ProviderConfig {
  return {
    id: 'provider-1',
    displayName: 'Test',
    type,
    isActive: true,
    status: 'connected',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function embeddingAi(): IAIService {
  return {
    generateEmbedding: vi.fn(async ({ texts }: { texts: string[] }) => ({
      embeddings: texts.map(() => [0.1, 0.2]),
      dimensions: 2,
      modelId: 'test-model',
    })),
    generateText: vi.fn(),
    streamText: vi.fn(),
    generateImage: vi.fn(),
    getActiveModel: vi.fn(),
    isReady: vi.fn(),
  } as unknown as IAIService;
}

describe('chunkText', () => {
  it('should return single chunk for short text', () => {
    const text = 'Hello world';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello world');
  });

  it('should return single chunk for text exactly at chunk size', () => {
    const text = 'a'.repeat(1000);
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(1000);
  });

  it('should split text longer than chunk size', () => {
    const text = 'a'.repeat(1500);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should produce overlapping chunks', () => {
    // With CHUNK_SIZE=1000 and CHUNK_OVERLAP=200
    const text = 'a'.repeat(1200);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);

    // Second chunk should start 800 chars in (1000 - 200 overlap)
    // so it captures some of what the first chunk covered
    const first = chunks[0];
    const second = chunks[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.length).toBe(1000);
    expect(second!.length).toBe(400); // 1200 - 800
  });

  it('should handle empty text', () => {
    const chunks = chunkText('');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('');
  });

  it('should handle very long text', () => {
    const text = 'word '.repeat(1000); // ~5000 chars
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    // All chunks should be non-empty
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
    }
  });
});

describe('EmbeddingService#indexWorkspace', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('should report successful indexed file count when some files fail', async () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'mdxpad-embedding-service-'));
    tempDirs.push(workspacePath);

    fs.writeFileSync(path.join(workspacePath, 'success.md'), 'SUCCESS', 'utf-8');
    fs.writeFileSync(path.join(workspacePath, 'failure.md'), 'FAIL', 'utf-8');

    const aiService = {
      generateEmbedding: vi.fn(async ({ texts }: { texts: string[] }) => {
        if (texts.includes('FAIL')) {
          throw new Error('Embedding failed');
        }
        return {
          embeddings: texts.map(() => [0.1, 0.2]),
          dimensions: 2,
          modelId: 'test-model',
        };
      }),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateImage: vi.fn(),
      getActiveModel: vi.fn(),
      isReady: vi.fn(),
    } as unknown as IAIService;

    const embeddingService = new EmbeddingService(aiService);
    const result = await embeddingService.indexWorkspace(workspacePath);

    expect(result.indexedFiles).toBe(1);
    expect(result.totalChunks).toBe(1);
  });

  it('does not count a file when the model returns no vectors', async () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'mdxpad-embedding-empty-'));
    tempDirs.push(workspacePath);
    fs.writeFileSync(path.join(workspacePath, 'note.md'), 'note', 'utf-8');

    const aiService = {
      generateEmbedding: vi.fn(async () => ({
        embeddings: [],
        dimensions: 0,
        modelId: 'test-model',
      })),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateImage: vi.fn(),
      getActiveModel: vi.fn(),
      isReady: vi.fn(),
    } as unknown as IAIService;

    const embeddingService = new EmbeddingService(aiService);
    const result = await embeddingService.indexWorkspace(workspacePath);

    expect(result.indexedFiles).toBe(0);
    expect(result.totalChunks).toBe(0);
  });

  it('does not call the provider when no provider is active', async () => {
    const aiService = embeddingAi();
    const embeddingService = new EmbeddingService(aiService, {
      getActiveProvider: async () => null,
      getCredential: async () => null,
    });

    await expect(embeddingService.indexWorkspace('/tmp/unused-workspace')).rejects.toBeInstanceOf(
      EmbeddingsUnavailableError
    );
    expect(aiService.generateEmbedding).not.toHaveBeenCalled();
  });

  it('does not call the provider for a keyed provider with no credential', async () => {
    const aiService = embeddingAi();
    const embeddingService = new EmbeddingService(aiService, {
      getActiveProvider: async () => provider('openai'),
      getCredential: async () => null,
    });

    await expect(embeddingService.search('/tmp/unused-workspace', 'query')).rejects.toBeInstanceOf(
      EmbeddingsUnavailableError
    );
    expect(aiService.generateEmbedding).not.toHaveBeenCalled();
  });

  it('still embeds with a local provider that does not require a key', async () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'mdxpad-embedding-local-'));
    tempDirs.push(workspacePath);
    fs.writeFileSync(path.join(workspacePath, 'note.md'), 'local', 'utf-8');

    const aiService = embeddingAi();
    const embeddingService = new EmbeddingService(aiService, {
      getActiveProvider: async () => provider('ollama'),
      getCredential: async () => null,
    });

    const result = await embeddingService.indexWorkspace(workspacePath);
    expect(result.indexedFiles).toBe(1);
    expect(aiService.generateEmbedding).toHaveBeenCalled();
  });

  it('does not embed the text behind a linked note', async () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'mdxpad-embedding-link-'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mdxpad-embedding-secret-'));
    tempDirs.push(workspacePath, outside);
    fs.writeFileSync(path.join(workspacePath, 'note.md'), 'visible', 'utf-8');
    const secret = path.join(outside, 'secret.md');
    fs.writeFileSync(secret, 'SECRET', 'utf-8');
    fs.symlinkSync(secret, path.join(workspacePath, 'linked.md'));

    const aiService = embeddingAi();
    const result = await new EmbeddingService(aiService).indexWorkspace(workspacePath);
    const texts = vi
      .mocked(aiService.generateEmbedding)
      .mock.calls.flatMap((call) => call[0].texts);

    expect(result.indexedFiles).toBe(1);
    expect(texts).toContain('visible');
    expect(texts).not.toContain('SECRET');
  });

  it('does not embed a file outside the workspace', async () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'mdxpad-embedding-root-'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mdxpad-embedding-out-'));
    tempDirs.push(workspacePath, outside);
    const secret = path.join(outside, 'secret.md');
    fs.writeFileSync(secret, 'SECRET', 'utf-8');

    const aiService = embeddingAi();
    await new EmbeddingService(aiService).updateFile(workspacePath, secret);

    expect(aiService.generateEmbedding).not.toHaveBeenCalled();
  });
});

describe('readIndexableContent', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('reads a regular note and skips a link', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdxpad-embedding-read-'));
    tempDirs.push(dir);
    const note = path.join(dir, 'note.md');
    const secret = path.join(dir, 'secret.md');
    const link = path.join(dir, 'linked.md');
    fs.writeFileSync(note, 'visible', 'utf-8');
    fs.writeFileSync(secret, 'SECRET', 'utf-8');
    fs.symlinkSync(secret, link);

    await expect(readIndexableContent(note)).resolves.toBe('visible');
    await expect(readIndexableContent(link)).resolves.toBeNull();
  });
});
