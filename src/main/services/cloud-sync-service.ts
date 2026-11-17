import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

import { computeChecksum } from '@shared/lib/checksum';
import { atomicWrite } from '@shared/lib/atomic-write';
import type {
  CloudSyncCapabilities,
  CloudSyncConnectResponse,
  CloudSyncProvider,
  CloudSyncProviderId,
  CloudSyncPullRequest,
  CloudSyncPullResponse,
  CloudSyncPushRequest,
  CloudSyncPushResponse,
  CloudSyncStatus,
} from '@shared/contracts/platform-schemas';

interface RemoteDocumentRecord {
  readonly documentId: string;
  readonly filePath: string;
  readonly content: string;
  readonly checksum: string;
  readonly revision: number;
  readonly updatedAt: number;
}

const DEFAULT_STATUS: CloudSyncStatus = {
  state: 'offline',
  lastSyncAt: null,
  message: 'Provider is not connected',
};

const PROVIDER_CAPABILITIES: Record<CloudSyncProviderId, CloudSyncCapabilities> = {
  'mock-cloud': {
    deltaPull: true,
    remoteLocking: false,
    etag: true,
    revisions: true,
    webhooks: false,
  },
  github: {
    deltaPull: true,
    remoteLocking: false,
    etag: true,
    revisions: true,
    webhooks: true,
  },
  dropbox: {
    deltaPull: true,
    remoteLocking: false,
    etag: true,
    revisions: true,
    webhooks: true,
  },
  onedrive: {
    deltaPull: true,
    remoteLocking: true,
    etag: true,
    revisions: true,
    webhooks: true,
  },
  'git-remote': {
    deltaPull: true,
    remoteLocking: false,
    etag: false,
    revisions: true,
    webhooks: false,
  },
  custom: {
    deltaPull: true,
    remoteLocking: false,
    etag: false,
    revisions: false,
    webhooks: false,
  },
};

const PROVIDER_LABELS: Record<CloudSyncProviderId, string> = {
  'mock-cloud': 'Mock Cloud (Local Adapter)',
  github: 'GitHub',
  dropbox: 'Dropbox',
  onedrive: 'OneDrive',
  'git-remote': 'Git Remote',
  custom: 'Custom Provider',
};

const SUPPORTED_PROVIDER: CloudSyncProviderId = 'mock-cloud';

interface ConnectionState {
  readonly connectedProviders: CloudSyncProviderId[];
}

async function ensureDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function getDefaultBaseDir(): string {
  return path.join(app.getPath('userData'), 'cloud-sync');
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

export class CloudSyncService {
  private readonly baseDir: string;
  private readonly pushQueues = new Map<string, Promise<void>>();

  public constructor(baseDir: string = getDefaultBaseDir()) {
    this.baseDir = baseDir;
  }

  private getConnectionPath(): string {
    return path.join(this.baseDir, 'connections.json');
  }

  private getProviderDir(providerId: CloudSyncProviderId): string {
    return path.join(this.baseDir, providerId);
  }

  private getProviderStatusPath(providerId: CloudSyncProviderId): string {
    return path.join(this.getProviderDir(providerId), 'status.json');
  }

  private getDocumentPath(providerId: CloudSyncProviderId, documentId: string): string {
    return path.join(this.getProviderDir(providerId), 'documents', `${documentId}.json`);
  }

  private getPushQueueKey(providerId: CloudSyncProviderId, documentId: string): string {
    return `${providerId}:${documentId}`;
  }

  private enqueuePushOperation<T>(
    providerId: CloudSyncProviderId,
    documentId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const queueKey = this.getPushQueueKey(providerId, documentId);
    const previousOperation = this.pushQueues.get(queueKey) ?? Promise.resolve();
    const queuedOperation = previousOperation.then(operation, operation);
    const queueTail = queuedOperation.then(
      () => undefined,
      () => undefined
    );

    this.pushQueues.set(queueKey, queueTail);
    void queueTail.finally(() => {
      if (this.pushQueues.get(queueKey) === queueTail) {
        this.pushQueues.delete(queueKey);
      }
    });

    return queuedOperation;
  }

  private async readConnections(): Promise<Set<CloudSyncProviderId>> {
    await ensureDirectory(this.baseDir);
    const fallback: ConnectionState = { connectedProviders: [] };
    const parsed = await readJsonFile(this.getConnectionPath(), fallback);
    return new Set(parsed.connectedProviders);
  }

  private async writeConnections(connections: Set<CloudSyncProviderId>): Promise<void> {
    await ensureDirectory(this.baseDir);
    const content = JSON.stringify({ connectedProviders: [...connections] }, null, 2);
    await atomicWrite(this.getConnectionPath(), content);
  }

  private async readStatus(providerId: CloudSyncProviderId): Promise<CloudSyncStatus> {
    const statusPath = this.getProviderStatusPath(providerId);
    return readJsonFile(statusPath, DEFAULT_STATUS);
  }

  private async writeStatus(
    providerId: CloudSyncProviderId,
    status: CloudSyncStatus
  ): Promise<void> {
    await ensureDirectory(this.getProviderDir(providerId));
    await atomicWrite(this.getProviderStatusPath(providerId), JSON.stringify(status, null, 2));
  }

  private async isConnected(providerId: CloudSyncProviderId): Promise<boolean> {
    const connections = await this.readConnections();
    return connections.has(providerId);
  }

  public async listProviders(): Promise<CloudSyncProvider[]> {
    const connections = await this.readConnections();
    return [SUPPORTED_PROVIDER].map((id) => ({
      id,
      label: PROVIDER_LABELS[id],
      connected: connections.has(id),
      capabilities: PROVIDER_CAPABILITIES[id],
    }));
  }

  public async connectProvider(providerId: CloudSyncProviderId): Promise<CloudSyncConnectResponse> {
    if (providerId !== SUPPORTED_PROVIDER) {
      const status: CloudSyncStatus = {
        state: 'error',
        lastSyncAt: null,
        message: `${providerId} adapter is not implemented yet`,
      };
      await this.writeStatus(providerId, status);
      return { ok: false, status };
    }

    const connections = await this.readConnections();
    connections.add(providerId);
    await this.writeConnections(connections);

    const status: CloudSyncStatus = {
      state: 'idle',
      lastSyncAt: Date.now(),
      message: null,
    };
    await this.writeStatus(providerId, status);
    return { ok: true, status };
  }

  public async getStatus(providerId: CloudSyncProviderId): Promise<CloudSyncStatus> {
    const connected = await this.isConnected(providerId);
    if (!connected) {
      return DEFAULT_STATUS;
    }
    return this.readStatus(providerId);
  }

  public async pushDocument(request: CloudSyncPushRequest): Promise<CloudSyncPushResponse> {
    const connected = await this.isConnected(request.providerId);
    if (!connected) {
      return {
        ok: false,
        revision: 0,
        checksum: computeChecksum(request.content),
        conflicts: ['Provider is not connected'],
      };
    }

    return this.enqueuePushOperation(request.providerId, request.documentId, async () => {
      const documentPath = this.getDocumentPath(request.providerId, request.documentId);
      await ensureDirectory(path.dirname(documentPath));

      const current = await readJsonFile<RemoteDocumentRecord | null>(documentPath, null);
      const conflicts: string[] = [];

      if (
        current !== null &&
        request.baseRevision !== undefined &&
        request.baseRevision < current.revision
      ) {
        conflicts.push(
          `Remote revision ${current.revision} is newer than base revision ${request.baseRevision}`
        );
      }

      const revision = (current?.revision ?? 0) + 1;
      const checksum = computeChecksum(request.content);
      const next: RemoteDocumentRecord = {
        documentId: request.documentId,
        filePath: request.filePath,
        content: request.content,
        checksum,
        revision,
        updatedAt: Date.now(),
      };

      await atomicWrite(documentPath, JSON.stringify(next, null, 2));
      await this.writeStatus(request.providerId, {
        state: conflicts.length > 0 ? 'conflicted' : 'idle',
        lastSyncAt: Date.now(),
        message: conflicts.length > 0 ? conflicts.join('; ') : null,
      });

      return {
        ok: true,
        revision,
        checksum,
        conflicts,
      };
    });
  }

  public async pullDocument(request: CloudSyncPullRequest): Promise<CloudSyncPullResponse> {
    const connected = await this.isConnected(request.providerId);
    if (!connected) {
      return {
        ok: false,
        content: null,
        revision: null,
        checksum: null,
      };
    }

    const record = await readJsonFile<RemoteDocumentRecord | null>(
      this.getDocumentPath(request.providerId, request.documentId),
      null
    );
    await this.writeStatus(request.providerId, {
      state: 'idle',
      lastSyncAt: Date.now(),
      message: null,
    });

    if (record === null) {
      return {
        ok: true,
        content: null,
        revision: null,
        checksum: null,
      };
    }

    return {
      ok: true,
      content: record.content,
      revision: record.revision,
      checksum: record.checksum,
    };
  }
}
