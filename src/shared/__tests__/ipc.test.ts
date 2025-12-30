/**
 * Tests for IPC channel definitions.
 * Validates channel structure, types, and uniqueness.
 */

import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../lib/ipc';

describe('IPC_CHANNELS', () => {
  it('has expected structure with app channels', () => {
    expect(IPC_CHANNELS).toHaveProperty('app');
    expect(IPC_CHANNELS.app).toHaveProperty('getVersion');
    expect(IPC_CHANNELS.app).toHaveProperty('getSecurityInfo');
  });

  it('all channels are strings', () => {
    const allChannels = Object.values(IPC_CHANNELS.app);

    for (const channel of allChannels) {
      expect(typeof channel).toBe('string');
    }
  });

  it('all channels follow mdxpad:category:action naming convention', () => {
    const allChannels = Object.values(IPC_CHANNELS.app);
    const channelPattern = /^mdxpad:[a-z]+:[a-z-]+$/;

    for (const channel of allChannels) {
      expect(channel).toMatch(channelPattern);
    }
  });

  it('channels are unique', () => {
    const allChannels = Object.values(IPC_CHANNELS.app);
    const uniqueChannels = new Set(allChannels);

    expect(uniqueChannels.size).toBe(allChannels.length);
  });

  it('channel values match expected strings', () => {
    expect(IPC_CHANNELS.app.getVersion).toBe('mdxpad:app:get-version');
    expect(IPC_CHANNELS.app.getSecurityInfo).toBe('mdxpad:app:get-security-info');
  });
});
