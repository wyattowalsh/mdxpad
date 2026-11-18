import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CollaborationService } from '../collaboration-service';

describe('CollaborationService', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-collab-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('creates comment threads and persists message history', async () => {
    const service = new CollaborationService(tempDir);
    const comment = await service.addComment({
      documentId: 'doc-collab-1',
      anchor: {
        blockId: 'heading-1',
        startOffset: 0,
        endOffset: 5,
        headingPath: ['Title'],
      },
      author: 'alice',
      message: 'Please revise this heading.',
    });

    expect(comment.thread.messages).toHaveLength(1);
    expect(comment.thread.state).toBe('open');

    const listed = await service.list('doc-collab-1');
    expect(listed.threads).toHaveLength(1);
    expect(listed.threads[0]?.messages[0]?.author).toBe('alice');
  });

  it('marks suggestions outdated when revision checksum has drifted', async () => {
    const service = new CollaborationService(tempDir);
    const suggestion = await service.addSuggestion({
      documentId: 'doc-collab-2',
      anchor: {
        blockId: 'paragraph-1',
        startOffset: 2,
        endOffset: 8,
        headingPath: [],
      },
      patch: '- old\n+ new',
      rationale: 'Use updated wording',
      author: 'bob',
      baseChecksum: 'checksum-base',
    });

    const apply = await service.applySuggestion({
      documentId: 'doc-collab-2',
      suggestionId: suggestion.suggestion.id,
      currentChecksum: 'checksum-different',
    });

    expect(apply.ok).toBe(false);
    expect(apply.outdated).toBe(true);
    expect(apply.applied).toBe(false);
    expect(apply.suggestion.state).toBe('outdated');
  });

  it('keeps a new document free of another document comments', async () => {
    const service = new CollaborationService(tempDir);
    await service.addComment({
      documentId: 'doc-a',
      anchor: {
        blockId: 'heading-1',
        startOffset: 0,
        endOffset: 5,
        headingPath: ['Title'],
      },
      author: 'alice',
      message: 'Only on A',
    });

    const other = await service.list('doc-b');
    expect(other.threads).toEqual([]);
    expect(other.suggestions).toEqual([]);
  });

  it('does not load comments through a link', async () => {
    const outside = path.join(tempDir, 'outside.json');
    const documentPath = path.join(tempDir, 'doc-link.json');
    await writeFile(
      outside,
      JSON.stringify({
        threads: [
          {
            id: 'secret-thread',
            documentId: 'doc-link',
            anchor: { blockId: 'x', startOffset: 0, endOffset: 1, headingPath: [] },
            state: 'open',
            messages: [{ id: 'm', author: 'eve', message: 'hidden', createdAt: 1 }],
            updatedAt: 1,
          },
        ],
        suggestions: [],
      }),
      'utf-8'
    );
    await symlink(outside, documentPath);
    const service = new CollaborationService(tempDir);

    const listed = await service.list('doc-link');
    expect(listed.threads).toEqual([]);

    await service.addComment({
      documentId: 'doc-link',
      anchor: {
        blockId: 'heading-1',
        startOffset: 0,
        endOffset: 5,
        headingPath: ['Title'],
      },
      author: 'alice',
      message: 'Local note',
    });

    expect(await readFile(outside, 'utf-8')).toContain('hidden');
    expect((await lstat(documentPath)).isSymbolicLink()).toBe(false);
    const saved = await service.list('doc-link');
    expect(saved.threads).toHaveLength(1);
    expect(saved.threads[0]?.messages[0]?.message).toBe('Local note');
  });
});
