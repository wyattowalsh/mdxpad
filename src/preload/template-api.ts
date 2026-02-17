/**
 * Template Operations API Module
 *
 * Provides template management bridge functions for the renderer process.
 * All methods use validated invoke with schema validation on both ends.
 *
 * @security Uses invoke/handle pattern for all template operations
 * @security All payloads validated with zod on both ends per Constitution III.3
 * @module src/preload/template-api
 */

import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import {
  TemplateListRequestSchema,
  TemplateGetRequestSchema,
  TemplateSaveRequestSchema,
  TemplateDeleteRequestSchema,
  TemplateImportRequestSchema,
  TemplateExportRequestSchema,
  TemplateValidateRequestSchema,
  CreateFromTemplateRequestSchema,
  TemplateOpenDialogRequestSchema,
  TemplateSaveDialogRequestSchema,
  TemplateListResponseSchema,
  TemplateGetResponseSchema,
  TemplateSaveResponseSchema,
  TemplateDeleteResponseSchema,
  TemplateImportResponseSchema,
  TemplateExportResponseSchema,
  TemplateValidateResponseSchema,
  CreateFromTemplateResponseSchema,
  TemplateOpenDialogResponseSchema,
  TemplateSaveDialogResponseSchema,
  TemplateErrorResponseSchema,
} from '@shared/contracts/template-schemas';
import type { Template } from '@shared/contracts/template-schemas';
import type { MdxpadAPI } from './api';

// ============================================================================
// Template API
// ============================================================================

export const templateApi: MdxpadAPI['template'] = {
  list: async (source: 'all' | 'builtin' | 'custom' = 'all') => {
    const request = { action: 'list' as const, source };
    const reqParsed = TemplateListRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
    }

    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.list, request);
    const resParsed = TemplateListResponseSchema.safeParse(response);
    if (resParsed.success) {
      return { success: true, data: resParsed.data.templates };
    }
    const errParsed = TemplateErrorResponseSchema.safeParse(response);
    if (errParsed.success) {
      return errParsed.data;
    }
    return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
  },

  get: async (id: string) => {
    const request = { action: 'get' as const, id };
    const reqParsed = TemplateGetRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
    }

    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.get, request);
    const resParsed = TemplateGetResponseSchema.safeParse(response);
    if (resParsed.success) {
      return { success: true, data: resParsed.data.template };
    }
    const errParsed = TemplateErrorResponseSchema.safeParse(response);
    if (errParsed.success) {
      return errParsed.data;
    }
    return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
  },

  save: async (template: Template, replace = false) => {
    const request = { action: 'save' as const, template, replace };
    const reqParsed = TemplateSaveRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
    }

    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.save, request);
    const resParsed = TemplateSaveResponseSchema.safeParse(response);
    if (resParsed.success) {
      return { success: true, data: resParsed.data.template };
    }
    const errParsed = TemplateErrorResponseSchema.safeParse(response);
    if (errParsed.success) {
      return errParsed.data;
    }
    return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
  },

  delete: async (id: string) => {
    const request = { action: 'delete' as const, id };
    const reqParsed = TemplateDeleteRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
    }

    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.delete, request);
    const resParsed = TemplateDeleteResponseSchema.safeParse(response);
    if (resParsed.success) {
      return { success: true, data: { id: resParsed.data.id } };
    }
    const errParsed = TemplateErrorResponseSchema.safeParse(response);
    if (errParsed.success) {
      return errParsed.data;
    }
    return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
  },

  import: async (path: string, replace = false) => {
    const request = { action: 'import' as const, path, replace };
    const reqParsed = TemplateImportRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
    }

    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.import, request);
    const resParsed = TemplateImportResponseSchema.safeParse(response);
    if (resParsed.success) {
      return { success: true, data: resParsed.data.template };
    }
    const errParsed = TemplateErrorResponseSchema.safeParse(response);
    if (errParsed.success) {
      return errParsed.data;
    }
    return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
  },

  export: async (id: string, path: string) => {
    const request = { action: 'export' as const, id, path };
    const reqParsed = TemplateExportRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
    }

    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.export, request);
    const resParsed = TemplateExportResponseSchema.safeParse(response);
    if (resParsed.success) {
      return { success: true, data: { path: resParsed.data.path } };
    }
    const errParsed = TemplateErrorResponseSchema.safeParse(response);
    if (errParsed.success) {
      return errParsed.data;
    }
    return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
  },

  validate: async (content: string) => {
    const request = { action: 'validate' as const, content };
    const reqParsed = TemplateValidateRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
    }

    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.validate, request);
    const resParsed = TemplateValidateResponseSchema.safeParse(response);
    if (resParsed.success) {
      return { success: true, data: { valid: resParsed.data.valid, errors: resParsed.data.errors } };
    }
    const errParsed = TemplateErrorResponseSchema.safeParse(response);
    if (errParsed.success) {
      return errParsed.data;
    }
    return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
  },

  createFromTemplate: async (
    templateId: string,
    variables: Record<string, string>,
    savePath?: string
  ) => {
    const request = { templateId, variables, savePath };
    const reqParsed = CreateFromTemplateRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
    }

    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.createFromTemplate, request);
    const resParsed = CreateFromTemplateResponseSchema.safeParse(response);
    if (resParsed.success) {
      const data: { content: string; path?: string } = { content: resParsed.data.content };
      if (resParsed.data.path !== undefined) {
        data.path = resParsed.data.path;
      }
      return { success: true, data };
    }
    const errParsed = TemplateErrorResponseSchema.safeParse(response);
    if (errParsed.success) {
      return errParsed.data;
    }
    return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
  },

  showOpenDialog: async () => {
    const request = { action: 'showOpenDialog' as const };
    const reqParsed = TemplateOpenDialogRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
    }

    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.showOpenDialog, request);
    const resParsed = TemplateOpenDialogResponseSchema.safeParse(response);
    if (resParsed.success) {
      return { success: true, data: { path: resParsed.data.path, canceled: resParsed.data.canceled } };
    }
    const errParsed = TemplateErrorResponseSchema.safeParse(response);
    if (errParsed.success) {
      return errParsed.data;
    }
    return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
  },

  showSaveDialog: async (defaultName?: string) => {
    const request = { action: 'showSaveDialog' as const, defaultName };
    const reqParsed = TemplateSaveDialogRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
    }

    const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.showSaveDialog, request);
    const resParsed = TemplateSaveDialogResponseSchema.safeParse(response);
    if (resParsed.success) {
      return { success: true, data: { path: resParsed.data.path, canceled: resParsed.data.canceled } };
    }
    const errParsed = TemplateErrorResponseSchema.safeParse(response);
    if (errParsed.success) {
      return errParsed.data;
    }
    return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
  },
};
