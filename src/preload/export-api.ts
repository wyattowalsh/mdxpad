/**
 * Export Operations API Module
 *
 * Provides export orchestration bridge functions for the renderer process.
 * All methods use validated invoke with shared export contract schemas.
 *
 * @security Uses invoke/handle pattern for all export operations
 * @security All payloads validated with zod on both ends per Constitution III.3
 * @module src/preload/export-api
 */

import {
  ExportJobLifecycleRequestSchema,
  ExportJobLifecycleResponseSchema,
  ExportPresetCrudRequestSchema,
  ExportPresetCrudResponseSchema,
  ExportCliInvokeRequestSchema,
  ExportCliInvokeResponseSchema,
  LlmsGenerationRequestSchema,
  LlmsGenerationResponseSchema,
  type ExportJobLifecycleRequest,
  type ExportJobLifecycleResponse,
  type ExportPresetCrudRequest,
  type ExportPresetCrudResponse,
  type ExportCliInvokeRequest,
  type ExportCliInvokeResponse,
  type LlmsGenerationRequest,
  type LlmsGenerationResponse,
} from '@shared/contracts/export-schemas';
import { validatedInvoke } from './validated-invoke';

export const EXPORT_IPC_CHANNELS = {
  jobLifecycle: 'mdxpad:export:job-lifecycle',
  presetCrud: 'mdxpad:export:preset-crud',
  cliInvoke: 'mdxpad:export:cli-invoke',
  llmsGenerate: 'mdxpad:export:llms-generate',
} as const;

export interface ExportApi {
  jobLifecycle(request: ExportJobLifecycleRequest): Promise<ExportJobLifecycleResponse>;
  presetCrud(request: ExportPresetCrudRequest): Promise<ExportPresetCrudResponse>;
  cliInvoke(request: ExportCliInvokeRequest): Promise<ExportCliInvokeResponse>;
  llmsGenerate(request: LlmsGenerationRequest): Promise<LlmsGenerationResponse>;
}

export const exportApi: ExportApi = {
  jobLifecycle: (request) =>
    validatedInvoke(
      EXPORT_IPC_CHANNELS.jobLifecycle,
      ExportJobLifecycleRequestSchema,
      ExportJobLifecycleResponseSchema,
      request
    ),

  presetCrud: (request) =>
    validatedInvoke(
      EXPORT_IPC_CHANNELS.presetCrud,
      ExportPresetCrudRequestSchema,
      ExportPresetCrudResponseSchema,
      request
    ),

  cliInvoke: (request) =>
    validatedInvoke(
      EXPORT_IPC_CHANNELS.cliInvoke,
      ExportCliInvokeRequestSchema,
      ExportCliInvokeResponseSchema,
      request
    ),

  llmsGenerate: (request) =>
    validatedInvoke(
      EXPORT_IPC_CHANNELS.llmsGenerate,
      LlmsGenerationRequestSchema,
      LlmsGenerationResponseSchema,
      request
    ),
};
