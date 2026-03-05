import { describe, expect, it, vi } from 'vitest';

const { mockExposeInMainWorld } = vi.hoisted(() => ({
  mockExposeInMainWorld: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: mockExposeInMainWorld,
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
}));

import '../index';

describe('preload index api composition', () => {
  it('exposes plugin api on window.mdxpad', () => {
    expect(mockExposeInMainWorld).toHaveBeenCalledWith(
      'mdxpad',
      expect.objectContaining({
        plugin: expect.objectContaining({
          list: expect.any(Function),
          install: expect.any(Function),
          uninstall: expect.any(Function),
          enable: expect.any(Function),
          disable: expect.any(Function),
        }),
      })
    );
  });

  it('exposes semanticSearch api on window.mdxpad', () => {
    expect(mockExposeInMainWorld).toHaveBeenCalledWith(
      'mdxpad',
      expect.objectContaining({
        semanticSearch: expect.objectContaining({
          search: expect.any(Function),
          indexWorkspace: expect.any(Function),
          getIndexStatus: expect.any(Function),
        }),
      })
    );
  });
});
