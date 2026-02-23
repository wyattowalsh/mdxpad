/**
 * Tests for template commands.
 *
 * Tests command IDs, shortcuts, execution logic, and enabled predicates
 * for all 4 template commands.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandContext } from '@shared/types/commands';

// =============================================================================
// MOCKS
// =============================================================================

const mockOpenTemplateBrowser = vi.fn();
const mockOpenSaveTemplateDialog = vi.fn();
const mockImportTemplate = vi.fn();

vi.mock('../../stores/template-browser-store', () => ({
  useTemplateBrowserModalStore: {
    getState: () => ({
      openTemplateBrowser: mockOpenTemplateBrowser,
      openSaveTemplateDialog: mockOpenSaveTemplateDialog,
    }),
  },
}));

vi.mock('../../stores/template-store', () => ({
  useTemplateStore: {
    getState: () => ({
      importTemplate: mockImportTemplate,
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
import {
  TEMPLATE_COMMAND_IDS,
  newFromTemplateCommand,
  browseTemplatesCommand,
  saveAsTemplateCommand,
  importTemplateCommand,
  TEMPLATE_COMMANDS,
  registerTemplateCommands,
} from '../template-commands';

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

describe('TEMPLATE_COMMAND_IDS', () => {
  it('should have correct command IDs', () => {
    expect(TEMPLATE_COMMAND_IDS.newFromTemplate).toBe('file.new-from-template');
    expect(TEMPLATE_COMMAND_IDS.browseTemplates).toBe('template.browse');
    expect(TEMPLATE_COMMAND_IDS.saveAsTemplate).toBe('template.save-as-template');
    expect(TEMPLATE_COMMAND_IDS.importTemplate).toBe('template.import');
  });
});

describe('TEMPLATE_COMMANDS', () => {
  it('should contain 4 commands', () => {
    expect(TEMPLATE_COMMANDS).toHaveLength(4);
  });

  it('should have unique IDs', () => {
    const ids = TEMPLATE_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('newFromTemplateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct ID', () => {
    expect(newFromTemplateCommand.id).toBe(TEMPLATE_COMMAND_IDS.newFromTemplate);
  });

  it('should have Cmd+Shift+N shortcut', () => {
    expect(newFromTemplateCommand.shortcut).toEqual({ key: 'n', modifiers: ['Mod', 'Shift'] });
  });

  it('should open template browser on execute', () => {
    const ctx = createMockContext();
    const result = newFromTemplateCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockOpenTemplateBrowser).toHaveBeenCalledTimes(1);
  });

  it('should always be enabled', () => {
    const ctx = createMockContext();
    expect(newFromTemplateCommand.enabled?.(ctx)).toBe(true);
  });
});

describe('browseTemplatesCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct ID', () => {
    expect(browseTemplatesCommand.id).toBe(TEMPLATE_COMMAND_IDS.browseTemplates);
  });

  it('should open template browser on execute', () => {
    const ctx = createMockContext();
    const result = browseTemplatesCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockOpenTemplateBrowser).toHaveBeenCalledTimes(1);
  });

  it('should always be enabled', () => {
    const ctx = createMockContext();
    expect(browseTemplatesCommand.enabled?.(ctx)).toBe(true);
  });
});

describe('saveAsTemplateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct ID', () => {
    expect(saveAsTemplateCommand.id).toBe(TEMPLATE_COMMAND_IDS.saveAsTemplate);
  });

  it('should open save template dialog when content exists', () => {
    const ctx = createMockContext({
      document: { fileId: null, filePath: null, content: '# Hello', isDirty: false },
    });
    const result = saveAsTemplateCommand.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(mockOpenSaveTemplateDialog).toHaveBeenCalledTimes(1);
  });

  it('should warn and return error when document is empty', () => {
    const ctx = createMockContext({
      document: { fileId: null, filePath: null, content: '', isDirty: false },
    });
    const result = saveAsTemplateCommand.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'Empty document' });
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'Cannot save empty document as template',
    });
    expect(mockOpenSaveTemplateDialog).not.toHaveBeenCalled();
  });

  it('should warn when document is only whitespace', () => {
    const ctx = createMockContext({
      document: { fileId: null, filePath: null, content: '   \n  \t  ', isDirty: false },
    });
    const result = saveAsTemplateCommand.execute(ctx);

    expect(result).toEqual({ ok: false, error: 'Empty document' });
  });

  it('should be disabled when document is empty', () => {
    const ctx = createMockContext({
      document: { fileId: null, filePath: null, content: '', isDirty: false },
    });
    expect(saveAsTemplateCommand.enabled?.(ctx)).toBe(false);
  });

  it('should be enabled when document has content', () => {
    const ctx = createMockContext({
      document: { fileId: null, filePath: null, content: '# Content', isDirty: false },
    });
    expect(saveAsTemplateCommand.enabled?.(ctx)).toBe(true);
  });
});

describe('importTemplateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct ID', () => {
    expect(importTemplateCommand.id).toBe(TEMPLATE_COMMAND_IDS.importTemplate);
  });

  it('should always be enabled', () => {
    const ctx = createMockContext();
    expect(importTemplateCommand.enabled?.(ctx)).toBe(true);
  });
});

describe('registerTemplateCommands', () => {
  it('should return an unregister function', () => {
    const unregister = registerTemplateCommands();
    expect(typeof unregister).toBe('function');
  });
});
