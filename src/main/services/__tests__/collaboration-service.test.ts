import { mkdtemp, rm } from 'node:fs/promises';
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
});
