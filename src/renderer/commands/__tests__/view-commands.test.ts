/**
 * Tests for view commands.
 *
 * Tests command IDs, shortcuts, execution logic for all 8 view commands
 * (toggle preview/sidebar/outline, zoom in/out/reset, toggle sync, toggle settings).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandContext } from '@shared/types/commands';

// =============================================================================
// MOCKS
// =============================================================================

const mockTogglePreview = vi.fn();
const mockToggleSidebar = vi.fn();
const mockToggleOutline = vi.fn();
const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockResetZoom = vi.fn();

vi.mock('../../stores/ui-layout-store', () => ({
  useUILayoutStore: {
    getState: () => ({
      togglePreview: mockTogglePreview,
      toggleSidebar: mockToggleSidebar,
      toggleOutline: mockToggleOutline,
      zoomIn: mockZoomIn,
      zoomOut: mockZoomOut,
      resetZoom: mockResetZoom,
    }),
  },
}));

const mockToggleSync = vi.fn();
const mockPersist = vi.fn();

vi.mock('../../stores/sync-store', () => ({
  useSyncStore: {
    getState: () => ({
      toggleSync: mockToggleSync,
      persist: mockPersist,
      mode: 'bidirectional',
    }),
  },
}));

vi.mock('../../stores/command-registry-store', () => ({
  useCommandRegistry: {
    getState: () => ({
      register: vi.fn(() => ({ ok: true, command: {} })),
      unregister: vi.fn(() => true),
    }),
  },
}));

// Import after mocking
import { VIEW_COMMANDS, registerViewCommands } from '../view-commands';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    editor: null,
    document: { fileId: null, filePath: null, content: '', isDirty: false },
    ui: { previewVisible: true, sidebarVisible: true, zoomLevel: 100 },
    platform: { isMac: true, isWindows: false, isLinux: false },
    api: {} as CommandContext['api'],
    notify: vi.fn(),
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('VIEW_COMMANDS', () => {
  it('should contain 8 commands', () => {
    expect(VIEW_COMMANDS).toHaveLength(8);
  });

  it('should have unique IDs', () => {
    const ids = VIEW_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('View command IDs', () => {
  const expectedIds = [
    'view.toggle-preview',
    'view.toggle-sidebar',
    'view.toggle-outline',
    'view.zoom-in',
    'view.zoom-out',
    'view.reset-zoom',
    'view.toggle-sync',
    'view.toggle-settings',
  ];

  it('should have all expected command IDs', () => {
    const ids = VIEW_COMMANDS.map((c) => c.id);
    for (const expected of expectedIds) {
      expect(ids).toContain(expected);
    }
  });
});

describe('View command shortcuts', () => {
  const shortcutTests: { id: string; key: string; modifiers: string[] }[] = [
    { id: 'view.toggle-preview', key: '\\', modifiers: ['Mod'] },
    { id: 'view.toggle-sidebar', key: 'b', modifiers: ['Mod', 'Shift'] },
    { id: 'view.toggle-outline', key: 'o', modifiers: ['Mod', 'Shift'] },
    { id: 'view.zoom-in', key: '=', modifiers: ['Mod'] },
    { id: 'view.zoom-out', key: '-', modifiers: ['Mod'] },
    { id: 'view.reset-zoom', key: '0', modifiers: ['Mod'] },
    { id: 'view.toggle-sync', key: 'y', modifiers: ['Mod', 'Shift'] },
    { id: 'view.toggle-settings', key: ',', modifiers: ['Mod'] },
  ];

  for (const { id, key, modifiers } of shortcutTests) {
    it(`${id} should have correct shortcut`, () => {
      const cmd = VIEW_COMMANDS.find((c) => c.id === id);
      expect(cmd?.shortcut).toEqual({ key, modifiers });
    });
  }
});

describe('View command execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggle-preview should call togglePreview', () => {
    const cmd = VIEW_COMMANDS.find((c) => c.id === 'view.toggle-preview')!;
    const ctx = createMockContext();
    const result = cmd.execute(ctx);
    expect(result).toEqual({ ok: true });
    expect(mockTogglePreview).toHaveBeenCalledTimes(1);
  });

  it('toggle-sidebar should call toggleSidebar', () => {
    const cmd = VIEW_COMMANDS.find((c) => c.id === 'view.toggle-sidebar')!;
    const ctx = createMockContext();
    const result = cmd.execute(ctx);
    expect(result).toEqual({ ok: true });
    expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('toggle-outline should call toggleOutline', () => {
    const cmd = VIEW_COMMANDS.find((c) => c.id === 'view.toggle-outline')!;
    const ctx = createMockContext();
    const result = cmd.execute(ctx);
    expect(result).toEqual({ ok: true });
    expect(mockToggleOutline).toHaveBeenCalledTimes(1);
  });

  it('zoom-in should call zoomIn', () => {
    const cmd = VIEW_COMMANDS.find((c) => c.id === 'view.zoom-in')!;
    const ctx = createMockContext();
    const result = cmd.execute(ctx);
    expect(result).toEqual({ ok: true });
    expect(mockZoomIn).toHaveBeenCalledTimes(1);
  });

  it('zoom-out should call zoomOut', () => {
    const cmd = VIEW_COMMANDS.find((c) => c.id === 'view.zoom-out')!;
    const ctx = createMockContext();
    const result = cmd.execute(ctx);
    expect(result).toEqual({ ok: true });
    expect(mockZoomOut).toHaveBeenCalledTimes(1);
  });

  it('reset-zoom should call resetZoom', () => {
    const cmd = VIEW_COMMANDS.find((c) => c.id === 'view.reset-zoom')!;
    const ctx = createMockContext();
    const result = cmd.execute(ctx);
    expect(result).toEqual({ ok: true });
    expect(mockResetZoom).toHaveBeenCalledTimes(1);
  });

  it('toggle-sync should toggle sync, persist, and notify', () => {
    const cmd = VIEW_COMMANDS.find((c) => c.id === 'view.toggle-sync')!;
    const ctx = createMockContext();
    const result = cmd.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockToggleSync).toHaveBeenCalledTimes(1);
    expect(mockPersist).toHaveBeenCalledTimes(1);
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'info',
      message: expect.stringContaining('Preview sync'),
      duration: 2000,
    });
  });
});

describe('registerViewCommands', () => {
  it('should return an unregister function', () => {
    const unregister = registerViewCommands();
    expect(typeof unregister).toBe('function');
  });
});
