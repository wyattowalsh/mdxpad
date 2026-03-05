import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockElectronLaunch, mockExistsSync, mockMkdirSync, mockRmSync } = vi.hoisted(() => ({
  mockElectronLaunch: vi.fn(),
  mockExistsSync: vi.fn(() => true),
  mockMkdirSync: vi.fn(),
  mockRmSync: vi.fn(),
}));

vi.mock('playwright', () => ({
  _electron: {
    launch: mockElectronLaunch,
  },
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  rmSync: mockRmSync,
}));

vi.mock('node:crypto', () => ({
  randomUUID: () => 'test-uuid',
}));

vi.mock('node:os', () => ({
  tmpdir: () => '/tmp',
}));

import { launchMdxpadAndWait } from '../e2e/utils/electron-lifecycle';

describe('launchMdxpadAndWait', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  it('cleans up launched resources if first window acquisition fails', async () => {
    const firstWindowError = new Error('first window failed');
    const app = {
      firstWindow: vi.fn().mockRejectedValue(firstWindowError),
      close: vi.fn().mockResolvedValue(undefined),
      process: vi.fn(() => ({ pid: undefined })),
    };
    mockElectronLaunch.mockResolvedValue(app);

    await expect(launchMdxpadAndWait()).rejects.toThrow('first window failed');

    expect(app.close).toHaveBeenCalledTimes(1);
    expect(mockRmSync).toHaveBeenCalledTimes(1);
  });
});
