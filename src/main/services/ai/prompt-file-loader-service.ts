import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';

import {
  AISessionModelSelectionSchema,
  AIPromptFileMetadataSchema,
  type AIPromptFileMetadata,
} from '@shared/contracts/ai-schemas';
import { trustedDirectoryError } from '@main/ipc/trusted-directory';
import { readFileWithoutFollowingLinks } from '@main/services/file-service';
import { computeChecksum } from '@shared/lib/checksum';

const PROMPT_DIRECTORY_CANDIDATES = ['.mdxpad/prompts', '.mdxpad/ai/prompts', 'prompts'] as const;
const PROMPT_FILE_EXTENSIONS = new Set(['.md', '.mdx']);
const VARIABLE_TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

const PromptDiscoveryContextSchema = z.object({
  workspaceRootPath: z.string().min(1).optional(),
  projectRootPath: z.string().min(1).optional(),
});

export type PromptDiscoveryContext = z.infer<typeof PromptDiscoveryContextSchema>;

const PromptFrontmatterSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    variables: z.array(z.string().min(1)).optional(),
    systemPrompt: z.string().optional(),
    modelSelection: AISessionModelSelectionSchema.partial().optional(),
  })
  .passthrough();

function isNotFoundError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function isPromptFile(filePath: string): boolean {
  return PROMPT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function derivePromptTitle(content: string, fileName: string): string {
  const heading = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '));
  if (heading) {
    return heading.slice(2).trim();
  }
  return path.parse(fileName).name;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function extractTemplateVariables(content: string): string[] {
  const names: string[] = [];
  for (const match of content.matchAll(VARIABLE_TOKEN_PATTERN)) {
    const variable = match[1]?.trim();
    if (variable) {
      names.push(variable);
    }
  }
  return uniqueStrings(names).sort((left, right) => left.localeCompare(right));
}

function toStablePromptId(filePath: string): string {
  return `prompt-${computeChecksum(path.resolve(filePath)).slice(0, 16)}`;
}

function toIsoTimestamp(value: Date): string {
  return value.toISOString();
}

export interface IAIPromptFileLoaderService {
  discoverPromptFiles(context?: PromptDiscoveryContext): Promise<AIPromptFileMetadata[]>;
}

export class AIPromptFileLoaderService implements IAIPromptFileLoaderService {
  public async discoverPromptFiles(
    context: PromptDiscoveryContext = {}
  ): Promise<AIPromptFileMetadata[]> {
    const validatedContext = PromptDiscoveryContextSchema.parse(context);
    const contextRoots = this.resolveContextRoots(validatedContext);
    if (contextRoots.length === 0) {
      return [];
    }

    const promptsById = new Map<string, AIPromptFileMetadata>();
    for (const rootPath of contextRoots) {
      for (const relativePromptDir of PROMPT_DIRECTORY_CANDIDATES) {
        const promptDirPath = path.join(rootPath, relativePromptDir);
        const promptFilePaths = await this.findPromptFiles(promptDirPath);
        for (const promptFilePath of promptFilePaths) {
          const metadata = await this.parsePromptMetadata(promptFilePath);
          if (!metadata || promptsById.has(metadata.id)) {
            continue;
          }
          promptsById.set(metadata.id, metadata);
        }
      }
    }

    return [...promptsById.values()].sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    );
  }

  private resolveContextRoots(context: PromptDiscoveryContext): string[] {
    const orderedRoots = [
      context.projectRootPath ? path.resolve(context.projectRootPath) : null,
      context.workspaceRootPath ? path.resolve(context.workspaceRootPath) : null,
    ].filter((rootPath): rootPath is string => rootPath !== null);

    return uniqueStrings(orderedRoots).filter(
      (rootPath) => trustedDirectoryError(rootPath) === null
    );
  }

  private async findPromptFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        // Skip symlinks to prevent traversal outside workspace
        if (entry.isSymbolicLink()) {
          continue;
        }

        if (entry.isDirectory()) {
          files.push(...(await this.findPromptFiles(entryPath)));
          continue;
        }
        if (entry.isFile() && isPromptFile(entryPath)) {
          files.push(entryPath);
        }
      }

      return files;
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  }

  private async parsePromptMetadata(filePath: string): Promise<AIPromptFileMetadata | null> {
    try {
      const read = await readFileWithoutFollowingLinks(filePath);
      if (!read.ok) {
        return null;
      }
      const rawContent = read.value;
      const fileStats = await fs.lstat(filePath);
      if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
        return null;
      }
      const parsedMatter = matter(rawContent);
      const parsedFrontmatter = PromptFrontmatterSchema.safeParse(parsedMatter.data);

      if (!parsedFrontmatter.success) {
        return null;
      }

      const frontmatter = parsedFrontmatter.data;
      const variables =
        frontmatter.variables && frontmatter.variables.length > 0
          ? uniqueStrings(frontmatter.variables).sort((left, right) => left.localeCompare(right))
          : extractTemplateVariables(parsedMatter.content);
      const metadata = AIPromptFileMetadataSchema.safeParse({
        id: frontmatter.id ?? toStablePromptId(filePath),
        kind: 'prompt',
        filePath: path.resolve(filePath),
        fileName: path.basename(filePath),
        checksum: computeChecksum(rawContent),
        createdAt: toIsoTimestamp(fileStats.birthtime),
        updatedAt: toIsoTimestamp(fileStats.mtime),
        title:
          frontmatter.title ?? derivePromptTitle(parsedMatter.content, path.basename(filePath)),
        ...(frontmatter.description ? { description: frontmatter.description } : {}),
        variables,
        ...(frontmatter.systemPrompt ? { systemPrompt: frontmatter.systemPrompt } : {}),
        ...(frontmatter.modelSelection ? { modelSelection: frontmatter.modelSelection } : {}),
      });

      return metadata.success ? metadata.data : null;
    } catch {
      return null;
    }
  }
}
