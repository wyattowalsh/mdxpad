import { promises as fs } from 'node:fs';
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { grantReadCapability, resetFileCapabilities } from '@main/ipc/document-capability';

import { PublishProvenanceService } from '../publish-provenance-service';

describe('PublishProvenanceService', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-platform-'));
  });

  afterEach(async () => {
    resetFileCapabilities();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('publishes content and records provenance + backlinks', async () => {
    const service = new PublishProvenanceService(tempDir);
    const sourcePath = path.join(tempDir, 'notes.mdx');
    await writeFile(sourcePath, '# Notes', 'utf-8');
    grantReadCapability(sourcePath);
    const published = await service.publish({
      providerId: 'filesystem-export',
      sourcePath,
      content: '# Notes\nSee [Docs](https://example.com/docs).',
      frontmatter: {
        references: ['https://example.com/source'],
      },
    });

    expect(published.ok).toBe(true);
    expect(published.canonicalUrl.startsWith('file://')).toBe(true);
    expect(published.provenanceEventId.length).toBeGreaterThan(0);
    expect(published.backlinks.length).toBeGreaterThan(0);

    const provenance = await service.listProvenance(sourcePath);
    expect(provenance).toHaveLength(1);
    expect(provenance[0]?.publishTarget.canonicalUrl).toBe(published.canonicalUrl);

    const backlinks = await service.getBacklinks(published.canonicalUrl);
    expect(backlinks.some((record) => record.targetUrl === 'https://example.com/docs')).toBe(true);
    expect(backlinks.some((record) => record.targetUrl === 'https://example.com/source')).toBe(
      true
    );
  });

  it('preserves backlink index updates during concurrent publishes', async () => {
    const service = new PublishProvenanceService(tempDir);
    const backlinksPath = path.join(tempDir, 'backlinks.json');
    await writeFile(backlinksPath, '{}', 'utf-8');

    const originalReadFile = fs.readFile.bind(fs);
    let backlinkReadCount = 0;
    let releaseBacklinkReads: () => void = () => {};
    const backlinkReadGate = new Promise<void>((resolve) => {
      releaseBacklinkReads = resolve;
    });

    const readFileSpy = vi.spyOn(fs, 'readFile').mockImplementation((async (
      ...args: Parameters<typeof fs.readFile>
    ) => {
      const filePath = args[0];
      if (typeof filePath === 'string' && filePath === backlinksPath) {
        backlinkReadCount += 1;
        const snapshot = await originalReadFile(...args);
        if (backlinkReadCount === 1) {
          setTimeout(() => releaseBacklinkReads(), 50);
        }
        if (backlinkReadCount === 2) {
          releaseBacklinkReads();
        }
        await backlinkReadGate;
        return snapshot;
      }
      return originalReadFile(...args);
    }) as typeof fs.readFile);

    const firstSource = path.join(tempDir, 'first.mdx');
    const secondSource = path.join(tempDir, 'second.mdx');
    await writeFile(firstSource, '# First', 'utf-8');
    await writeFile(secondSource, '# Second', 'utf-8');
    grantReadCapability(firstSource);
    grantReadCapability(secondSource);

    const firstPublish = service.publish({
      providerId: 'filesystem-export',
      sourcePath: firstSource,
      content: '# First\nSee [A](https://example.com/a).',
      frontmatter: undefined,
    });
    const secondPublish = service.publish({
      providerId: 'filesystem-export',
      sourcePath: secondSource,
      content: '# Second\nSee [B](https://example.com/b).',
      frontmatter: undefined,
    });

    const [firstResult, secondResult] = await Promise.all([firstPublish, secondPublish]);

    readFileSpy.mockRestore();

    const firstBacklinks = await service.getBacklinks(firstResult.canonicalUrl);
    const secondBacklinks = await service.getBacklinks(secondResult.canonicalUrl);
    expect(firstBacklinks.some((record) => record.targetUrl === 'https://example.com/a')).toBe(
      true
    );
    expect(secondBacklinks.some((record) => record.targetUrl === 'https://example.com/b')).toBe(
      true
    );

    const provenance = await service.listProvenance();
    expect(provenance).toHaveLength(2);
  });

  it('does not append provenance through a link', async () => {
    const outside = path.join(tempDir, 'outside.jsonl');
    const log = path.join(tempDir, 'provenance.jsonl');
    await writeFile(outside, '{"secret":true}\n', 'utf-8');
    await symlink(outside, log);
    const service = new PublishProvenanceService(tempDir);
    const sourcePath = path.join(tempDir, 'notes.mdx');
    await writeFile(sourcePath, '# Notes', 'utf-8');
    grantReadCapability(sourcePath);

    await expect(service.listProvenance()).resolves.toEqual([]);
    const published = await service.publish({
      providerId: 'filesystem-export',
      sourcePath,
      content: '# Notes',
      frontmatter: undefined,
    });

    expect(published.ok).toBe(true);
    expect(await readFile(outside, 'utf-8')).toBe('{"secret":true}\n');
    expect((await lstat(log)).isSymbolicLink()).toBe(false);
    await expect(service.listProvenance(sourcePath)).resolves.toHaveLength(1);
  });

  it('does not write a published copy of a file that is not open', async () => {
    const service = new PublishProvenanceService(tempDir);
    const sourcePath = path.join(tempDir, 'secret.mdx');
    await writeFile(sourcePath, 'hidden', 'utf-8');

    await expect(
      service.publish({
        providerId: 'filesystem-export',
        sourcePath,
        content: 'leaked',
        frontmatter: undefined,
      })
    ).rejects.toThrow('file that is open');
    await expect(fs.access(path.join(tempDir, 'secret.published.mdx'))).rejects.toThrow();
  });

  it('does not read provenance through a linked parent folder', async () => {
    const outside = path.join(tempDir, 'outside');
    const store = path.join(outside, 'publish-platform');
    await fs.mkdir(store, { recursive: true });
    const secret = path.join(store, 'provenance.jsonl');
    await writeFile(secret, '{"secret":true}\n');
    const appLink = path.join(tempDir, 'userData');
    await symlink(outside, appLink);

    const service = new PublishProvenanceService(path.join(appLink, 'publish-platform'), appLink);

    await expect(service.listProvenance()).resolves.toEqual([]);
    expect(await readFile(secret, 'utf8')).toBe('{"secret":true}\n');
    expect((await lstat(appLink)).isSymbolicLink()).toBe(false);
  });
});
