import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';

import type { AIServices } from '@main/services/ai';
import { registerAIHandlers } from '../ai-handlers';
import { registerProviderHandlers } from '../ai-provider-handlers';
import { registerGenerationHandlers } from '../ai-generation-handlers';
import { registerUsageHandlers } from '../ai-usage-handlers';
import { registerSessionHandlers } from '../ai-session-handlers';
import { registerSemanticSearchHandlers } from '@main/services/ai/semantic-search-handlers';
import { registerAgentHandlers } from '../agent-handlers';

vi.mock('../ai-provider-handlers', () => ({
  registerProviderHandlers: vi.fn(),
}));

vi.mock('../ai-generation-handlers', () => ({
  registerGenerationHandlers: vi.fn(),
}));

vi.mock('../ai-usage-handlers', () => ({
  registerUsageHandlers: vi.fn(),
}));

vi.mock('../ai-session-handlers', () => ({
  registerSessionHandlers: vi.fn(),
}));

vi.mock('@main/services/ai/semantic-search-handlers', () => ({
  registerSemanticSearchHandlers: vi.fn(),
}));

vi.mock('../agent-handlers', () => ({
  registerAgentHandlers: vi.fn(),
}));

vi.mock('@main/services/ai/agent-service', () => ({
  AgentService: class {
    setWindow(): void {
      return undefined;
    }
  },
}));

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 1,
      mainFrame: { routingId: 10 },
    },
  } as unknown as BrowserWindow;
}

describe('registerAIHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes BrowserWindow to all AI handler registration modules', () => {
    const services = { embeddingService: {} } as AIServices;
    const window = createMockWindow();

    registerAIHandlers(services, window);

    expect(registerProviderHandlers).toHaveBeenCalledWith(services, window);
    expect(registerSessionHandlers).toHaveBeenCalledWith(services, window);
    expect(registerGenerationHandlers).toHaveBeenCalledWith(services, window);
    expect(registerUsageHandlers).toHaveBeenCalledWith(services, window);
    expect(registerSemanticSearchHandlers).toHaveBeenCalledWith(services.embeddingService, window);
    expect(registerAgentHandlers).toHaveBeenCalledWith(expect.any(Object), window);
  });
});
