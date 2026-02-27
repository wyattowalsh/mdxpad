import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';

import type { AIServices } from '@main/services/ai';
import { registerAIHandlers } from '../ai-handlers';
import { registerProviderHandlers } from '../ai-provider-handlers';
import { registerGenerationHandlers } from '../ai-generation-handlers';
import { registerUsageHandlers } from '../ai-usage-handlers';
import { registerSessionHandlers } from '../ai-session-handlers';

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
    const services = {} as AIServices;
    const window = createMockWindow();

    registerAIHandlers(services, window);

    expect(registerProviderHandlers).toHaveBeenCalledWith(services, window);
    expect(registerSessionHandlers).toHaveBeenCalledWith(services, window);
    expect(registerGenerationHandlers).toHaveBeenCalledWith(services, window);
    expect(registerUsageHandlers).toHaveBeenCalledWith(services, window);
  });
});
