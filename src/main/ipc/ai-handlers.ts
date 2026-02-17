/**
 * AI Provider IPC Handlers - Facade
 *
 * Delegates to focused sub-modules for provider, generation, and usage handlers.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * Sub-modules:
 * - ai-provider-handlers: Provider CRUD, credential management, capability detection
 * - ai-generation-handlers: Text, streaming, embedding, and image generation
 * - ai-usage-handlers: Usage statistics, export, and history management
 * - ai-handler-utils: Shared error handling and filterUndefined utility
 *
 * @module src/main/ipc/ai-handlers
 */

import type { BrowserWindow } from 'electron';

import type { AIServices } from '@main/services/ai';

import { registerProviderHandlers } from './ai-provider-handlers';
import { registerGenerationHandlers } from './ai-generation-handlers';
import { registerUsageHandlers } from './ai-usage-handlers';

// Re-export shared utilities for external consumers
export { toErrorResponse, filterUndefined } from './ai-handler-utils';
export type { ErrorResponse } from './ai-handler-utils';

/**
 * Registers all AI-related IPC handlers.
 * Call this once during app initialization.
 *
 * @param window - The main BrowserWindow instance (used for streaming events)
 * @param services - The AIServices instance to use for all handlers
 */
export function registerAIHandlers(window: BrowserWindow, services: AIServices): void {
  registerProviderHandlers(services);
  registerGenerationHandlers(services);
  registerUsageHandlers(services);

  // Reference window for streaming events
  void window;

  console.log('[AIHandlers] All AI handlers registered (19 channels)');
}
