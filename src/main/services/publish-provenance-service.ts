import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';

import { hasReadCapability, normalizeCapabilityPath } from '@main/ipc/document-capability';
import type {
  BacklinkRecord,
  PublishRequest,
  PublishResponse,
  ProvenanceRecord,
} from '@shared/contracts/platform-schemas';
import { atomicWrite } from '@shared/lib/atomic-write';
import { computeChecksum } from '@shared/lib/checksum';

import { resolveWorkspaceFilePath } from './ai/agent-path';

type BacklinkIndex = Record<string, BacklinkRecord[]>;

function getDefaultBaseDir(): string {
  return path.join(app.getPath('userData'), 'publish-platform');
}

async function ensureDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const info = await fs.lstat(filePath);
    if (info.isSymbolicLink() || !info.isFile()) {
      return fallback;
    }
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function detachFileLink(filePath: string): Promise<void> {
  try {
    const info = await fs.lstat(filePath);
    if (info.isSymbolicLink()) {
      await fs.unlink(filePath);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function extractMarkdownBacklinks(content: string, sourceUrl: string): BacklinkRecord[] {
  const records: BacklinkRecord[] = [];
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const targetUrl = match[1]?.trim();
    if (targetUrl) {
      records.push({
        sourceUrl,
        targetUrl,
        relation: 'references',
      });
    }
  }
  return records;
}

function extractFrontmatterBacklinks(
  frontmatter: Record<string, unknown> | undefined,
  sourceUrl: string
): BacklinkRecord[] {
  if (!frontmatter) {
    return [];
  }
  const records: BacklinkRecord[] = [];
  const references = frontmatter.references;
  if (Array.isArray(references)) {
    for (const value of references) {
      if (typeof value === 'string' && value.length > 0) {
        records.push({
          sourceUrl,
          targetUrl: value,
          relation: 'derived-from',
        });
      }
    }
  }
  if (typeof frontmatter.canonical === 'string' && frontmatter.canonical.length > 0) {
    records.push({
      sourceUrl,
      targetUrl: frontmatter.canonical,
      relation: 'derived-from',
    });
  }
  return records;
}

export class PublishProvenanceService {
  private readonly baseDir: string;
  private persistenceQueue: Promise<unknown> = Promise.resolve();

  public constructor(baseDir: string = getDefaultBaseDir()) {
    this.baseDir = baseDir;
  }

  private getArtifactsDir(): string {
    return path.join(this.baseDir, 'artifacts');
  }

  private getProvenancePath(): string {
    return path.join(this.baseDir, 'provenance.jsonl');
  }

  private getBacklinkIndexPath(): string {
    return path.join(this.baseDir, 'backlinks.json');
  }

  private getDefaultOutputPath(sourcePath: string | null | undefined): string {
    if (!sourcePath) {
      return path.join(this.getArtifactsDir(), `untitled-${Date.now()}.published.mdx`);
    }
    const normalized = normalizeCapabilityPath(sourcePath);
    if (normalized === null || !hasReadCapability(sourcePath)) {
      throw new Error('Publish can only write beside a file that is open');
    }
    const sourceDir = path.dirname(normalized);
    const fileName = path.basename(normalized, path.extname(normalized)) || 'untitled';
    return resolveWorkspaceFilePath(sourceDir, `${fileName}.published.mdx`);
  }

  private async writeProvenanceRecord(record: ProvenanceRecord): Promise<void> {
    await ensureDirectory(this.baseDir);
    const provenancePath = this.getProvenancePath();
    await detachFileLink(provenancePath);
    const line = `${JSON.stringify(record)}\n`;
    await fs.appendFile(provenancePath, line, 'utf-8');
  }

  private async updateBacklinkIndex(
    canonicalUrl: string,
    backlinks: BacklinkRecord[]
  ): Promise<void> {
    const backlinkIndex = await readJsonFile<BacklinkIndex>(this.getBacklinkIndexPath(), {});
    backlinkIndex[canonicalUrl] = backlinks;
    await atomicWrite(this.getBacklinkIndexPath(), JSON.stringify(backlinkIndex, null, 2));
  }

  /**
   * Serializes provenance append + backlink index writes to prevent concurrent
   * read-modify-write loss while keeping provenance append-only.
   */
  private enqueuePersistenceOperation<T>(operation: () => Promise<T>): Promise<T> {
    const runOperation = async (): Promise<T> => operation();
    const queuedOperation = this.persistenceQueue.then(runOperation, runOperation);
    this.persistenceQueue = queuedOperation.then(
      () => undefined,
      () => undefined
    );
    return queuedOperation;
  }

  public async listProvenance(sourcePath?: string): Promise<ProvenanceRecord[]> {
    try {
      const provenancePath = this.getProvenancePath();
      const info = await fs.lstat(provenancePath);
      if (info.isSymbolicLink() || !info.isFile()) {
        return [];
      }
      const content = await fs.readFile(provenancePath, 'utf-8');
      const records = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as ProvenanceRecord);

      if (!sourcePath) {
        return records;
      }
      return records.filter((record) => record.sourceDocument.path === sourcePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  public async getBacklinks(canonicalUrl: string): Promise<BacklinkRecord[]> {
    const index = await readJsonFile<BacklinkIndex>(this.getBacklinkIndexPath(), {});
    return index[canonicalUrl] ?? [];
  }

  public async publish(request: PublishRequest): Promise<PublishResponse> {
    const outputPath = this.getDefaultOutputPath(request.sourcePath);
    await ensureDirectory(path.dirname(outputPath));
    await atomicWrite(outputPath, request.content);

    const canonicalUrl = pathToFileURL(outputPath).toString();
    const checksum = computeChecksum(request.content);
    const artifactId = randomUUID();
    const eventId = randomUUID();
    const backlinks = [
      ...extractMarkdownBacklinks(request.content, canonicalUrl),
      ...extractFrontmatterBacklinks(request.frontmatter, canonicalUrl),
    ];

    const provenance: ProvenanceRecord = {
      eventId,
      timestamp: new Date().toISOString(),
      actor: { type: 'system', id: 'mdxpad' },
      sourceDocument: {
        path: request.sourcePath ?? outputPath,
        checksum,
      },
      transformationChain: [
        {
          step: `publish.${request.providerId}`,
          actorId: 'mdxpad',
          inputChecksum: checksum,
          outputChecksum: checksum,
        },
      ],
      publishTarget: {
        providerId: request.providerId,
        artifactId,
        canonicalUrl,
      },
      backlinks,
    };

    await this.enqueuePersistenceOperation(async () => {
      await this.writeProvenanceRecord(provenance);
      await this.updateBacklinkIndex(canonicalUrl, backlinks);
    });

    return {
      ok: true,
      canonicalUrl,
      artifactId,
      checksum,
      provenanceEventId: eventId,
      backlinks,
    };
  }
}
