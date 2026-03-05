/**
 * AI Provider & Credential IPC Handlers
 *
 * Handles provider CRUD (list, add, update, remove, set-active, validate)
 * and credential management (set, has, clear).
 *
 * @module src/main/ipc/ai-provider-handlers
 */

import { ipcMain, type BrowserWindow } from 'electron';

import { AIChannels } from '@shared/ai/ipc-channels';
import * as schemas from '@shared/ai/schemas';
import type { AIServices } from '@main/services/ai';
import type {
  ProviderConfig,
  SidecarConfig,
  SidecarLifecycleStatusResponse,
} from '@shared/ai/types';

import { toErrorResponse } from './ai-handler-utils';
import { assertAuthorizedIpcSender } from './ipc-sender-authorization';

// =============================================================================
// REQUEST BUILDERS
// =============================================================================

/**
 * Builds provider updates filtering out undefined values.
 */
function buildProviderUpdates(updates: {
  displayName?: string | undefined;
  baseUrl?: string | undefined;
  sidecarConfig?: schemas.SidecarConfigSchemaType | undefined;
  isActive?: boolean | undefined;
}): Partial<ProviderConfig> {
  const result: Partial<ProviderConfig> = {};
  if (updates.displayName !== undefined) {
    result.displayName = updates.displayName;
  }
  if (updates.baseUrl !== undefined) {
    result.baseUrl = updates.baseUrl;
  }
  if (updates.sidecarConfig !== undefined) {
    result.sidecarConfig = normalizeSidecarConfig(updates.sidecarConfig);
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
    const sidecarConfig =
      request.sidecarConfig !== undefined
        ? normalizeSidecarConfig(request.sidecarConfig)
        : undefined;

    const provider = await services.providerService.addProvider(
      {
        displayName: request.displayName,
        type: request.type,
        ...(request.baseUrl !== undefined && { baseUrl: request.baseUrl }),
        ...(sidecarConfig !== undefined && { sidecarConfig }),
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
 * Handles SIDECAR_CONFIGURE: Configure and start sidecar runtime.
 */
async function handleSidecarConfigure(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.SidecarConfigureResponseSchemaType> {
  try {
    const request = schemas.SidecarConfigureRequestSchema.parse(rawRequest);
    const config = normalizeSidecarConfig(request.config);
    await services.sidecarService.configure(config);
    const status = await services.sidecarService.start(config);
    await syncActiveSidecarProviderEndpoint(services, config, status);
    return schemas.SidecarConfigureResponseSchema.parse(status);
  } catch (error) {
    return schemas.SidecarConfigureResponseSchema.parse(
      createSidecarErrorResponse(error)
    );
  }
}

/**
 * Handles SIDECAR_STATUS: Return current sidecar lifecycle status.
 */
function handleSidecarStatus(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.SidecarStatusResponseSchemaType> {
  try {
    schemas.SidecarStatusRequestSchema.parse(rawRequest);
    const status = services.sidecarService.getStatus();
    return Promise.resolve(schemas.SidecarStatusResponseSchema.parse(status));
  } catch (error) {
    return Promise.resolve(
      schemas.SidecarStatusResponseSchema.parse(createSidecarErrorResponse(error))
    );
  }
}

/**
 * Handles SIDECAR_START: Start sidecar runtime with optional config.
 */
async function handleSidecarStart(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.SidecarStartResponseSchemaType> {
  try {
    const request = schemas.SidecarStartRequestSchema.parse(rawRequest ?? {});
    const config =
      request.config !== undefined
        ? normalizeSidecarConfig(request.config)
        : undefined;
    const status = await services.sidecarService.start(config);
    await syncActiveSidecarProviderEndpoint(services, config, status);
    return schemas.SidecarStartResponseSchema.parse(status);
  } catch (error) {
    return schemas.SidecarStartResponseSchema.parse(createSidecarErrorResponse(error));
  }
}

/**
 * Handles SIDECAR_STOP: Stop sidecar runtime.
 */
async function handleSidecarStop(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.SidecarStopResponseSchemaType> {
  try {
    schemas.SidecarStopRequestSchema.parse(rawRequest);
    const status = await services.sidecarService.stop();
    return schemas.SidecarStopResponseSchema.parse(status);
  } catch (error) {
    return schemas.SidecarStopResponseSchema.parse(createSidecarErrorResponse(error));
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
  try {
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
  } catch {
    return schemas.HasCredentialResponseSchema.parse({ exists: false });
  }
}

/**
 * Handles CREDENTIAL_CLEAR: Remove a credential.
 */
async function handleCredentialClear(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.ClearCredentialResponseSchemaType> {
  try {
    const request = schemas.ClearCredentialRequestSchema.parse(rawRequest);
    await services.credentialService.clearCredential(request.providerId);

    return schemas.ClearCredentialResponseSchema.parse({ success: true });
  } catch (error) {
    return schemas.ClearCredentialResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
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
 * Registers a sender-authorized IPC handler for a single channel.
 */
function registerAuthorizedHandler(
  channel: string,
  window: BrowserWindow,
  handler: (request: unknown) => Promise<unknown>
): void {
  ipcMain.handle(channel, (event, request) => {
    assertAuthorizedIpcSender(event, window, channel);
    return handler(request);
  });
}

/**
 * Registers provider management handlers.
 */
function registerProviderManagementHandlers(
  services: AIServices,
  window: BrowserWindow
): void {
  registerAuthorizedHandler(AIChannels.PROVIDER_LIST, window, () =>
    handleProviderList(services)
  );
  registerAuthorizedHandler(AIChannels.PROVIDER_ADD, window, (request) =>
    handleProviderAdd(services, request)
  );
  registerAuthorizedHandler(AIChannels.PROVIDER_UPDATE, window, (request) =>
    handleProviderUpdate(services, request)
  );
  registerAuthorizedHandler(AIChannels.PROVIDER_REMOVE, window, (request) =>
    handleProviderRemove(services, request)
  );
  registerAuthorizedHandler(AIChannels.PROVIDER_SET_ACTIVE, window, (request) =>
    handleProviderSetActive(services, request)
  );
  registerAuthorizedHandler(AIChannels.PROVIDER_VALIDATE, window, (request) =>
    handleProviderValidate(services, request)
  );
}

/**
 * Registers sidecar lifecycle handlers.
 */
function registerSidecarHandlers(
  services: AIServices,
  window: BrowserWindow
): void {
  registerAuthorizedHandler(AIChannels.SIDECAR_CONFIGURE, window, (request) =>
    handleSidecarConfigure(services, request)
  );
  registerAuthorizedHandler(AIChannels.SIDECAR_STATUS, window, (request) =>
    handleSidecarStatus(services, request)
  );
  registerAuthorizedHandler(AIChannels.SIDECAR_START, window, (request) =>
    handleSidecarStart(services, request)
  );
  registerAuthorizedHandler(AIChannels.SIDECAR_STOP, window, (request) =>
    handleSidecarStop(services, request)
  );
}

/**
 * Registers credential management handlers.
 */
function registerCredentialHandlers(
  services: AIServices,
  window: BrowserWindow
): void {
  registerAuthorizedHandler(AIChannels.CREDENTIAL_SET, window, (request) =>
    handleCredentialSet(services, request)
  );
  registerAuthorizedHandler(AIChannels.CREDENTIAL_HAS, window, (request) =>
    handleCredentialHas(services, request)
  );
  registerAuthorizedHandler(AIChannels.CREDENTIAL_CLEAR, window, (request) =>
    handleCredentialClear(services, request)
  );
}

/**
 * Registers capability detection handlers.
 */
function registerCapabilityHandlers(
  services: AIServices,
  window: BrowserWindow
): void {
  registerAuthorizedHandler(AIChannels.CAPABILITY_GET, window, (request) =>
    handleCapabilityGet(services, request)
  );
  registerAuthorizedHandler(AIChannels.CAPABILITY_LIST_MODELS, window, (request) =>
    handleCapabilityListModels(services, request)
  );
  registerAuthorizedHandler(AIChannels.CAPABILITY_REFRESH, window, (request) =>
    handleCapabilityRefresh(services, request)
  );
}

/**
 * Registers all provider, credential, and capability IPC handlers.
 */
export function registerProviderHandlers(
  services: AIServices,
  window: BrowserWindow
): void {
  registerProviderManagementHandlers(services, window);
  registerSidecarHandlers(services, window);
  registerCredentialHandlers(services, window);
  registerCapabilityHandlers(services, window);
}

function createSidecarErrorResponse(error: unknown): SidecarLifecycleStatusResponse {
  const normalizedError = toErrorResponse(error);
  return {
    success: false,
    status: 'error',
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
    },
  };
}

function normalizeSidecarConfig(config: schemas.SidecarConfigSchemaType): SidecarConfig {
  return {
    modelPath: config.modelPath,
    ...(config.binaryPath !== undefined && { binaryPath: config.binaryPath }),
    ...(config.contextSize !== undefined && { contextSize: config.contextSize }),
    ...(config.gpuLayers !== undefined && { gpuLayers: config.gpuLayers }),
    ...(config.threads !== undefined && { threads: config.threads }),
    ...(config.port !== undefined && { port: config.port }),
  };
}

async function syncActiveSidecarProviderEndpoint(
  services: AIServices,
  config: SidecarConfig | undefined,
  status: SidecarLifecycleStatusResponse
): Promise<void> {
  const configToPersist = config ?? status.config;
  if (!status.endpoint || !configToPersist) {
    return;
  }

  const activeProvider = await services.providerService.getActiveProvider();
  if (activeProvider?.type !== 'sidecar') {
    return;
  }

  await services.providerService.updateProvider(activeProvider.id, {
    baseUrl: status.endpoint,
    sidecarConfig: configToPersist,
  });
}
