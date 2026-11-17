/**
 * Compose the write-panel prompt and the inputs that feed session creation
 * and instruction discovery.
 */

import { z } from 'zod';
import type { AIInstructionScope, AISessionCreateRequest } from '@shared/contracts/ai-schemas';
import type { LoadAttachmentOptions } from '@renderer/stores/ai-session-store';

const documentIdSchema = z.string().uuid();

export const WRITE_ACTION_IDS = ['continue', 'rewrite', 'summarize', 'custom'] as const;

export type WriteActionId = (typeof WRITE_ACTION_IDS)[number];

export const WRITE_ACTION_PROMPTS: Record<WriteActionId, string> = {
  continue: 'Continue writing from the current document context.',
  rewrite: 'Rewrite the selected content for clarity and readability.',
  summarize: 'Summarize the selected content into concise key points.',
  custom: '',
};

export const INSTRUCTION_LOAD_FAILED_MESSAGE = 'The attached instruction could not be loaded';

export const NO_MODELS_AVAILABLE_MESSAGE = 'No models are available for the active provider';

export interface WriteInstruction {
  readonly fileName: string;
  readonly content: string;
}

export interface AttachmentDiscoveryInput {
  readonly workspaceId?: string | undefined;
  readonly workspaceRootPath?: string | undefined;
  readonly projectRootPath?: string | undefined;
  readonly instructionScope?: AIInstructionScope | undefined;
  readonly workspaceRootPathFromStore?: string | null | undefined;
  readonly documentPath?: string | null | undefined;
}

interface ListedModelsResponse {
  readonly success: boolean;
  readonly models?: readonly { readonly id: string }[] | undefined;
  readonly error?: { readonly message: string } | undefined;
}

export type ListedModelResolution =
  | { readonly ok: true; readonly modelId: string }
  | { readonly ok: false; readonly error: string };

function nonEmpty(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null || value.length === 0) {
    return undefined;
  }
  return value;
}

export function buildWriteActionPrompt(action: WriteActionId, input: string): string {
  const basePrompt = WRITE_ACTION_PROMPTS[action];
  const trimmedInput = input.trim();
  if (!basePrompt) {
    return trimmedInput;
  }
  return trimmedInput.length > 0 ? `${basePrompt}\n\n${trimmedInput}` : basePrompt;
}

/**
 * Always includes the action text and the current document. An attached
 * instruction adds a section with its file name and loaded body.
 */
export function buildWritePrompt(
  actionText: string,
  documentPath: string,
  documentText: string,
  instruction: WriteInstruction | null
): string {
  const sections = [actionText, `## Current document\nPath: ${documentPath}\n\n${documentText}`];
  if (instruction) {
    sections.push(`## Instruction\nFile: ${instruction.fileName}\n\n${instruction.content}`);
  }
  return sections.join('\n\n');
}

export function buildAttachmentLoadOptions(
  input: AttachmentDiscoveryInput
): LoadAttachmentOptions | undefined {
  const workspaceRootPath =
    nonEmpty(input.workspaceRootPathFromStore) ?? nonEmpty(input.workspaceRootPath);
  const projectRootPath = nonEmpty(input.projectRootPath);
  const documentPath = nonEmpty(input.documentPath);
  const options: LoadAttachmentOptions = {
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    ...(workspaceRootPath ? { workspaceRootPath } : {}),
    ...(projectRootPath ? { projectRootPath } : {}),
    ...(input.instructionScope ? { instructionScope: input.instructionScope } : {}),
    ...(documentPath ? { documentPath } : {}),
  };
  return Object.keys(options).length > 0 ? options : undefined;
}

export function toContextDocumentIds(fileId: string | null): string[] {
  if (fileId !== null && documentIdSchema.safeParse(fileId).success) {
    return [fileId];
  }
  return [];
}

export function buildCreateSessionRequest(input: {
  readonly workspaceId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly fileId: string | null;
}): AISessionCreateRequest {
  return {
    workspaceId: input.workspaceId,
    providerId: input.providerId,
    modelId: input.modelId,
    contextDocumentIds: toContextDocumentIds(input.fileId),
  };
}

export function resolveListedModelId(response: ListedModelsResponse): ListedModelResolution {
  const modelId = response.models?.[0]?.id ?? '';
  if (response.success && modelId.length > 0) {
    return { ok: true, modelId };
  }
  const reported = response.error?.message ?? '';
  return {
    ok: false,
    error: reported.trim().length > 0 ? reported : NO_MODELS_AVAILABLE_MESSAGE,
  };
}
