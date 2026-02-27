import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

import {
  AIInstructionFileMetadataSchema,
  AIInstructionScopeSchema,
} from '@shared/contracts/ai-schemas';
import { computeChecksum } from '@shared/lib/checksum';
import type { AIInstructionFileMetadata } from '@shared/types/ai-session';

import type { IAISessionStorageService } from './ai-session-storage-service';

const REPO_INSTRUCTION_FILE_NAMES = ['AGENTS.md', 'CLAUDE.md'] as const;
const DOCUMENT_INSTRUCTION_SUFFIXES = ['.instructions.md', '.instruction.md'] as const;

const InstructionLoaderOptionsSchema = z.object({
  scope: AIInstructionScopeSchema.optional(),
  projectRootPath: z.string().min(1).optional(),
  workspaceRootPath: z.string().min(1).optional(),
  documentPath: z.string().min(1).optional(),
});
export type InstructionLoaderOptions = z.infer<typeof InstructionLoaderOptionsSchema>;

export interface LoadedInstructionFile {
  readonly metadata: AIInstructionFileMetadata;
  readonly content: string;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

function buildInstructionId(
  scope: z.infer<typeof AIInstructionScopeSchema>,
  filePath: string
): string {
  return `instruction:${scope}:${computeChecksum(`${scope}:${filePath.toLowerCase()}`)}`;
}

function shouldDiscoverScope(
  requestedScope: z.infer<typeof AIInstructionScopeSchema> | undefined,
  targetScope: z.infer<typeof AIInstructionScopeSchema>
): boolean {
  return requestedScope === undefined || requestedScope === targetScope;
}

function toDocumentInstructionCandidates(documentPath: string): string[] {
  const resolvedDocumentPath = path.resolve(documentPath);
  const parsed = path.parse(resolvedDocumentPath);
  const candidates = new Set<string>();

  for (const suffix of DOCUMENT_INSTRUCTION_SUFFIXES) {
    candidates.add(path.resolve(`${resolvedDocumentPath}${suffix}`));
    candidates.add(path.resolve(parsed.dir, `${parsed.name}${suffix}`));
  }

  return [...candidates];
}

function toInstructionMetadata(
  filePath: string,
  scope: z.infer<typeof AIInstructionScopeSchema>,
  content: string,
  stats: {
    birthtime: Date;
    mtime: Date;
  },
  appliesToDocumentIds?: readonly string[]
): AIInstructionFileMetadata {
  return AIInstructionFileMetadataSchema.parse({
    id: buildInstructionId(scope, filePath),
    kind: 'instruction',
    scope,
    filePath,
    fileName: path.basename(filePath),
    checksum: computeChecksum(content),
    createdAt: stats.birthtime.toISOString(),
    updatedAt: stats.mtime.toISOString(),
    ...(appliesToDocumentIds && appliesToDocumentIds.length > 0 ? { appliesToDocumentIds } : {}),
  }) as AIInstructionFileMetadata;
}

export interface IInstructionLoaderService {
  listInstructionFiles(options?: InstructionLoaderOptions): Promise<AIInstructionFileMetadata[]>;
  loadInstructionFile(instructionFileId: string): Promise<LoadedInstructionFile | null>;
}

export class InstructionLoaderService implements IInstructionLoaderService {
  public constructor(private readonly sessionStorageService: IAISessionStorageService) {}

  public async listInstructionFiles(
    options: InstructionLoaderOptions = {}
  ): Promise<AIInstructionFileMetadata[]> {
    const validatedOptions = InstructionLoaderOptionsSchema.parse(options);
    await this.discoverInstructionFiles(validatedOptions);

    return this.sessionStorageService.listInstructionFiles(
      validatedOptions.scope ? { scope: validatedOptions.scope } : {}
    );
  }

  public async loadInstructionFile(
    instructionFileId: string
  ): Promise<LoadedInstructionFile | null> {
    const metadata = await this.sessionStorageService.getInstructionFile(instructionFileId);
    if (!metadata) {
      return null;
    }

    const loaded = await this.tryReadInstructionFile(
      metadata.filePath,
      metadata.scope,
      metadata.appliesToDocumentIds
    );
    if (!loaded) {
      await this.sessionStorageService.removeInstructionFile(instructionFileId);
      return null;
    }

    await this.sessionStorageService.upsertInstructionFile(loaded.metadata);
    return loaded;
  }

  private async discoverInstructionFiles(options: InstructionLoaderOptions): Promise<void> {
    const discovered: AIInstructionFileMetadata[] = [];

    if (options.projectRootPath && shouldDiscoverScope(options.scope, 'global')) {
      discovered.push(
        ...(await this.discoverDirectoryInstructionFiles(options.projectRootPath, 'global'))
      );
    }

    if (options.workspaceRootPath && shouldDiscoverScope(options.scope, 'workspace')) {
      discovered.push(
        ...(await this.discoverDirectoryInstructionFiles(options.workspaceRootPath, 'workspace'))
      );
    }

    if (options.documentPath && shouldDiscoverScope(options.scope, 'document')) {
      discovered.push(...(await this.discoverDocumentInstructionFiles(options.documentPath)));
    }

    if (discovered.length === 0) {
      return;
    }

    await Promise.all(
      discovered.map((instruction) => this.sessionStorageService.upsertInstructionFile(instruction))
    );
  }

  private async discoverDirectoryInstructionFiles(
    directoryPath: string,
    scope: z.infer<typeof AIInstructionScopeSchema>
  ): Promise<AIInstructionFileMetadata[]> {
    const resolvedDirectoryPath = path.resolve(directoryPath);
    const discovered = await Promise.all(
      REPO_INSTRUCTION_FILE_NAMES.map((fileName) =>
        this.tryReadInstructionFile(path.join(resolvedDirectoryPath, fileName), scope)
      )
    );

    return discovered
      .map((entry) => entry?.metadata ?? null)
      .filter((entry): entry is AIInstructionFileMetadata => entry !== null);
  }

  private async discoverDocumentInstructionFiles(
    documentPath: string
  ): Promise<AIInstructionFileMetadata[]> {
    const discovered = await Promise.all(
      toDocumentInstructionCandidates(documentPath).map((candidatePath) =>
        this.tryReadInstructionFile(candidatePath, 'document')
      )
    );

    return discovered
      .map((entry) => entry?.metadata ?? null)
      .filter((entry): entry is AIInstructionFileMetadata => entry !== null);
  }

  private async tryReadInstructionFile(
    filePath: string,
    scope: z.infer<typeof AIInstructionScopeSchema>,
    appliesToDocumentIds?: readonly string[]
  ): Promise<LoadedInstructionFile | null> {
    const resolvedFilePath = path.resolve(filePath);
    try {
      const [stats, content] = await Promise.all([
        fs.stat(resolvedFilePath),
        fs.readFile(resolvedFilePath, 'utf-8'),
      ]);

      if (!stats.isFile()) {
        return null;
      }

      return {
        metadata: toInstructionMetadata(
          resolvedFilePath,
          scope,
          content,
          {
            birthtime: stats.birthtime,
            mtime: stats.mtime,
          },
          appliesToDocumentIds
        ),
        content,
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }
}
