/**
 * AI Provider & Credential IPC Handlers
 *
 * Handles provider CRUD (list, add, update, remove, set-active, validate)
 * and credential management (set, has, clear).
 *
 * @module src/main/ipc/ai-provider-handlers
 */

import { ipcMain } from 'electron';

import { AIChannels } from '@shared/ai/ipc-channels';
import * as schemas from '@shared/ai/schemas';
import type { AIServices } from '@main/services/ai';
import type { ProviderConfig } from '@shared/ai/types';

import { toErrorResponse } from './ai-handler-utils';

// =============================================================================
// REQUEST BUILDERS
// =============================================================================

/**
 * Builds provider updates filtering out undefined values.
 */
function buildProviderUpdates(updates: {
  displayName?: string | undefined;
  baseUrl?: string | undefined;
  isActive?: boolean | undefined;
}): Partial<ProviderConfig> {
  const result: Partial<ProviderConfig> = {};
  if (updates.displayName !== undefined) {
    result.displayName = updates.displayName;
  }
  if (updates.baseUrl !== undefined) {
    result.baseUrl = updates.baseUrl;
  }
  if (updates.isActive !== undefined) {
    result.isActive = updates.isActive;
  }
  return result;
}

// =============================================================================
// PROVIDER MANAGEMENT HANDLERS
// =============================================================================

/**
 * Handles PROVIDER_LIST: List all configured AI providers.
 */
async function handleProviderList(
  services: AIServices
): Promise<schemas.ProviderListResponseSchemaType> {
  const providers = await services.providerService.getProviders();
  const activeProvider = await services.providerService.getActiveProvider();

  return schemas.ProviderListResponseSchema.parse({
    providers,
    activeProviderId: activeProvider?.id ?? null,
  });
}

/**
 * Handles PROVIDER_ADD: Add a new AI provider.
 */
async function handleProviderAdd(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.AddProviderResponseSchemaType> {
  try {
    const request = schemas.AddProviderRequestSchema.parse(rawRequest);

    const provider = await services.providerService.addProvider(
      {
        displayName: request.displayName,
        type: request.type,
        ...(request.baseUrl !== undefined && { baseUrl: request.baseUrl }),
        isActive: false,
      },
      request.apiKey
    );

    return schemas.AddProviderResponseSchema.parse({
      success: true,
      provider,
    });
  } catch (error) {
    return schemas.AddProviderResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles PROVIDER_UPDATE: Update an existing AI provider.
 */
async function handleProviderUpdate(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.UpdateProviderResponseSchemaType> {
  try {
    const request = schemas.UpdateProviderRequestSchema.parse(rawRequest);

    const provider = await services.providerService.updateProvider(
      request.id,
      buildProviderUpdates(request.updates)
    );

    return schemas.UpdateProviderResponseSchema.parse({
      success: true,
      provider,
    });
  } catch (error) {
    return schemas.UpdateProviderResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles PROVIDER_REMOVE: Remove an AI provider.
 */
async function handleProviderRemove(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.RemoveProviderResponseSchemaType> {
  try {
    const request = schemas.RemoveProviderRequestSchema.parse(rawRequest);
    await services.providerService.removeProvider(request.id);

    return schemas.RemoveProviderResponseSchema.parse({ success: true });
  } catch (error) {
    return schemas.RemoveProviderResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles PROVIDER_SET_ACTIVE: Set the active AI provider.
 */
async function handleProviderSetActive(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.SetActiveProviderResponseSchemaType> {
  try {
    const request = schemas.SetActiveProviderRequestSchema.parse(rawRequest);
    await services.providerService.setActiveProvider(request.id);

    return schemas.SetActiveProviderResponseSchema.parse({
      success: true,
      activeProviderId: request.id,
    });
  } catch (error) {
    return schemas.SetActiveProviderResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles PROVIDER_VALIDATE: Validate an AI provider's credentials.
 */
async function handleProviderValidate(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ValidateProviderResponseSchemaType> {
  try {
    const request = schemas.ValidateProviderRequestSchema.parse(rawRequest);
    const result = await services.providerService.validateProvider(request.id);

    return schemas.ValidateProviderResponseSchema.parse({
      success: result.valid,
      status: result.status,
      models: result.models,
      error: result.error,
    });
  } catch (error) {
    return schemas.ValidateProviderResponseSchema.parse({
      success: false,
      status: 'error',
      error: toErrorResponse(error),
    });
  }
}

// =============================================================================
// CREDENTIAL MANAGEMENT HANDLERS
// =============================================================================

/**
 * Handles CREDENTIAL_SET: Store a credential securely.
 */
async function handleCredentialSet(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.SetCredentialResponseSchemaType> {
  try {
    const request = schemas.SetCredentialRequestSchema.parse(rawRequest);
    const result = await services.credentialService.setCredential(
      request.providerId,
      request.apiKey
    );

    return schemas.SetCredentialResponseSchema.parse({
      success: result.success,
      storageType: result.storageType,
      keyPreview: result.metadata.keyPreview,
    });
  } catch (error) {
    return schemas.SetCredentialResponseSchema.parse({
      success: false,
      storageType: 'session',
      keyPreview: '****',
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles CREDENTIAL_HAS: Check if a credential exists.
 */
async function handleCredentialHas(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.HasCredentialResponseSchemaType> {
  const request = schemas.HasCredentialRequestSchema.parse(rawRequest);
  const metadata = await services.credentialService.hasCredential(
    request.providerId
  );

  if (!metadata) {
    return schemas.HasCredentialResponseSchema.parse({ exists: false });
  }

  return schemas.HasCredentialResponseSchema.parse({
    exists: true,
    storageType: metadata.storageType,
    keyPreview: metadata.keyPreview,
  });
}

/**
 * Handles CREDENTIAL_CLEAR: Remove a credential.
 */
async function handleCredentialClear(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ClearCredentialResponseSchemaType> {
  const request = schemas.ClearCredentialRequestSchema.parse(rawRequest);
  await services.credentialService.clearCredential(request.providerId);

  return schemas.ClearCredentialResponseSchema.parse({ success: true });
}

// =============================================================================
// CAPABILITY DETECTION HANDLERS
// =============================================================================

/**
 * Handles CAPABILITY_GET: Get model capabilities.
 */
async function handleCapabilityGet(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.GetCapabilityResponseSchemaType> {
  try {
    const request = schemas.GetCapabilityRequestSchema.parse(rawRequest);
    const capabilities = await services.capabilityService.getCapabilities(
      request.providerId,
      request.modelId
    );

    return schemas.GetCapabilityResponseSchema.parse({
      success: true,
      capabilities: {
        modelId: capabilities.modelId,
        capabilities: Array.from(capabilities.capabilities),
        contextWindow: capabilities.contextWindow,
        maxOutputTokens: capabilities.maxOutputTokens,
        constraints: capabilities.constraints,
      },
    });
  } catch (error) {
    return schemas.GetCapabilityResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles CAPABILITY_LIST_MODELS: List available models for a provider.
 */
async function handleCapabilityListModels(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ListModelsResponseSchemaType> {
  try {
    const request = schemas.ListModelsRequestSchema.parse(rawRequest);
    const models = await services.capabilityService.listModels(
      request.providerId
    );

    return schemas.ListModelsResponseSchema.parse({
      success: true,
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        capabilities: m.capabilities,
      })),
    });
  } catch (error) {
    return schemas.ListModelsResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles CAPABILITY_REFRESH: Refresh capability cache for a provider.
 */
async function handleCapabilityRefresh(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.RefreshCapabilityResponseSchemaType> {
  try {
    const request = schemas.RefreshCapabilityRequestSchema.parse(rawRequest);
    await services.capabilityService.refreshCapabilities(request.providerId);

    return schemas.RefreshCapabilityResponseSchema.parse({ success: true });
  } catch (error) {
    return schemas.RefreshCapabilityResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Registers all provider, credential, and capability IPC handlers.
 */
export function registerProviderHandlers(services: AIServices): void {
  // Provider management
  ipcMain.handle(AIChannels.PROVIDER_LIST, () =>
    handleProviderList(services)
  );
  ipcMain.handle(AIChannels.PROVIDER_ADD, (_, request) =>
    handleProviderAdd(services, request)
  );
  ipcMain.handle(AIChannels.PROVIDER_UPDATE, (_, request) =>
    handleProviderUpdate(services, request)
  );
  ipcMain.handle(AIChannels.PROVIDER_REMOVE, (_, request) =>
    handleProviderRemove(services, request)
  );
  ipcMain.handle(AIChannels.PROVIDER_SET_ACTIVE, (_, request) =>
    handleProviderSetActive(services, request)
  );
  ipcMain.handle(AIChannels.PROVIDER_VALIDATE, (_, request) =>
    handleProviderValidate(services, request)
  );

  // Credential management
  ipcMain.handle(AIChannels.CREDENTIAL_SET, (_, request) =>
    handleCredentialSet(services, request)
  );
  ipcMain.handle(AIChannels.CREDENTIAL_HAS, (_, request) =>
    handleCredentialHas(services, request)
  );
  ipcMain.handle(AIChannels.CREDENTIAL_CLEAR, (_, request) =>
    handleCredentialClear(services, request)
  );

  // Capability detection
  ipcMain.handle(AIChannels.CAPABILITY_GET, (_, request) =>
    handleCapabilityGet(services, request)
  );
  ipcMain.handle(AIChannels.CAPABILITY_LIST_MODELS, (_, request) =>
    handleCapabilityListModels(services, request)
  );
  ipcMain.handle(AIChannels.CAPABILITY_REFRESH, (_, request) =>
    handleCapabilityRefresh(services, request)
  );
}
