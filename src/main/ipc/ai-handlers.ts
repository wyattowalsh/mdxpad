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

import type { AIServices } from '@main/services/ai';
import type { BrowserWindow } from 'electron';

import { registerProviderHandlers } from './ai-provider-handlers';
import { registerGenerationHandlers } from './ai-generation-handlers';
import { registerUsageHandlers } from './ai-usage-handlers';
import { registerSessionHandlers } from './ai-session-handlers';
import { AgentService } from '@main/services/ai/agent-service';
import { registerSemanticSearchHandlers } from '@main/services/ai/semantic-search-handlers';
import { registerAgentHandlers } from './agent-handlers';

// Re-export shared utilities for external consumers
export { toErrorResponse, filterUndefined } from './ai-handler-utils';
export type { ErrorResponse } from './ai-handler-utils';

/**
 * Registers all AI-related IPC handlers.
 * Call this once during app initialization.
 *
 * @param services - The AIServices instance to use for all handlers
 * @param window - BrowserWindow used for sender/frame authorization
 */
export function registerAIHandlers(services: AIServices, window: BrowserWindow): void {
  registerProviderHandlers(services, window);
  registerSessionHandlers(services, window);
  registerGenerationHandlers(services, window);
  registerUsageHandlers(services, window);
  registerSemanticSearchHandlers(services.embeddingService, window);
  const agentService = new AgentService(services.aiService);
  agentService.setWindow(window);
  registerAgentHandlers(agentService, window);

  console.log('[AIHandlers] All AI handlers registered');
}
