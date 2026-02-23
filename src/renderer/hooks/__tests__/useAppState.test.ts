/**
 * Tests for useAppState hook.
 *
 * Tests the centralized application state hook that manages
 * UI layout, document state, template browser, and handlers.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock all store modules before importing the hook
vi.mock('../../stores/ui-layout-store', () => {
  const state = {
    previewVisible: true,
    outlineVisible: false,
    frontmatterVisible: false,
    splitRatio: 0.5,
    setSplitRatio: vi.fn(),
  };
  const store = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state,
  });
  return {
    useUILayoutStore: store,
    selectPreviewVisible: (s: typeof state) => s.previewVisible,
    selectSplitRatio: (s: typeof state) => s.splitRatio,
    selectOutlineVisible: (s: typeof state) => s.outlineVisible,
    selectFrontmatterVisible: (s: typeof state) => s.frontmatterVisible,
  };
});

const mockSetContent = vi.fn();
const mockNewDocument = vi.fn();

vi.mock('../../stores/document-store', () => {
  const state = {
    fileId: 'test-file-id',
    filePath: '/test/file.mdx',
    fileName: 'file.mdx',
    isDirty: false,
    content: '# Hello',
    setContent: mockSetContent,
    newDocument: mockNewDocument,
  };
  const store = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state,
  });
  return {
    useDocumentStore: store,
    selectFileId: (s: typeof state) => s.fileId,
    selectFileName: (s: typeof state) => s.fileName,
    selectFilePath: (s: typeof state) => s.filePath,
    selectIsDirty: (s: typeof state) => s.isDirty,
    selectContent: (s: typeof state) => s.content,
  };
});

const mockOpenTemplateBrowser = vi.fn();
const mockCloseTemplateBrowser = vi.fn();
const mockStartVariableDialog = vi.fn();
const mockCloseVariableDialog = vi.fn();
const mockClearPendingTemplate = vi.fn();
const mockCloseSaveTemplateDialog = vi.fn();
const mockSetSaving = vi.fn();
const mockSetSaveError = vi.fn();

vi.mock('../../stores/template-browser-store', () => {
  const state = {
    isTemplateBrowserOpen: false,
    isVariableDialogOpen: false,
    pendingTemplate: null,
    isSaveTemplateDialogOpen: false,
    isSaving: false,
    saveError: null,
    openTemplateBrowser: mockOpenTemplateBrowser,
    closeTemplateBrowser: mockCloseTemplateBrowser,
    startVariableDialog: mockStartVariableDialog,
    closeVariableDialog: mockCloseVariableDialog,
    clearPendingTemplate: mockClearPendingTemplate,
    closeSaveTemplateDialog: mockCloseSaveTemplateDialog,
    setSaving: mockSetSaving,
    setSaveError: mockSetSaveError,
  };
  const store = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state,
  });
  return {
    useTemplateBrowserModalStore: store,
    selectIsTemplateBrowserOpen: (s: typeof state) => s.isTemplateBrowserOpen,
    selectIsVariableDialogOpen: (s: typeof state) => s.isVariableDialogOpen,
    selectPendingTemplate: (s: typeof state) => s.pendingTemplate,
    selectIsSaveTemplateDialogOpen: (s: typeof state) => s.isSaveTemplateDialogOpen,
    selectIsSaving: (s: typeof state) => s.isSaving,
    selectSaveError: (s: typeof state) => s.saveError,
  };
});

const mockSaveTemplate = vi.fn();

vi.mock('../../stores/template-store', () => {
  const state = {
    templates: [{ name: 'Blog Post' }, { name: 'Notes' }],
    saveTemplate: mockSaveTemplate,
  };
  const store = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state,
  });
  return {
    useTemplateStore: store,
    selectTemplates: (s: typeof state) => s.templates,
  };
});

const mockCloseSettings = vi.fn();

vi.mock('../../stores/settings-store', () => {
  const state = { isOpen: false, close: mockCloseSettings };
  const store = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state,
  });
  return { useSettingsStore: store };
});

vi.mock('../use-autosave', () => ({
  useAutosave: () => ({ enabled: true, interval: 30000 }),
}));

vi.mock('../use-recovery-check', () => ({
  useRecoveryCheck: () => ({ hasRecovery: false }),
}));

vi.mock('../use-recovery-restore', () => ({
  useRecoveryRestore: () => ({ restoreDocuments: vi.fn() }),
}));

vi.mock('../use-recovery-cleanup', () => ({
  useRecoveryCleanup: vi.fn(),
}));

vi.mock('../useOutlineSync', () => ({
  useOutlineSync: vi.fn(),
}));

const mockNavigateToItem = vi.fn();
vi.mock('../useOutlineNavigation', () => ({
  useOutlineNavigation: () => ({ navigateToItem: mockNavigateToItem }),
}));

const mockNavigateToError = vi.fn();
vi.mock('../useErrorNavigation', () => ({
  useErrorNavigation: () => ({ navigateToError: mockNavigateToError }),
}));

vi.mock('../useScrollSync', () => ({
  useScrollSync: () => ({ syncEditorToPreview: vi.fn() }),
}));

vi.mock('../../lib/template-variables', () => ({
  substituteVariables: vi.fn((content: string, _values: Record<string, string>) => content),
  buildVariableValues: vi.fn((_vars: unknown[], values: Record<string, string>) => values),
}));

import { useAppState } from '../useAppState';

describe('useAppState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should return all expected state properties', () => {
      const { result } = renderHook(() => useAppState());

      expect(result.current.previewVisible).toBe(true);
      expect(result.current.outlineVisible).toBe(false);
      expect(result.current.frontmatterVisible).toBe(false);
      expect(result.current.fileId).toBe('test-file-id');
      expect(result.current.filePath).toBe('/test/file.mdx');
      expect(result.current.fileName).toBe('file.mdx');
      expect(result.current.isDirty).toBe(false);
      expect(result.current.documentContent).toBe('# Hello');
    });

    it('should initialize cursor position at line 1 column 1', () => {
      const { result } = renderHook(() => useAppState());
      expect(result.current.cursorPosition).toEqual({ line: 1, column: 1 });
    });

    it('should initialize with empty errors', () => {
      const { result } = renderHook(() => useAppState());
      expect(result.current.errors).toEqual([]);
    });

    it('should initialize with empty announcement', () => {
      const { result } = renderHook(() => useAppState());
      expect(result.current.announcement).toBe('');
    });
  });

  describe('computed values', () => {
    it('should compute editorSize and previewSize from splitRatio', () => {
      const { result } = renderHook(() => useAppState());
      // splitRatio is 0.5, preview is visible
      expect(result.current.editorSize).toBe(50);
      expect(result.current.previewSize).toBe(50);
    });

    it('should return lowercase existing template names', () => {
      const { result } = renderHook(() => useAppState());
      expect(result.current.existingTemplateNames).toEqual(['blog post', 'notes']);
    });
  });

  describe('handleCursorChange', () => {
    it('should update cursor position', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleCursorChange({ line: 5, column: 10 });
      });

      expect(result.current.cursorPosition).toEqual({ line: 5, column: 10 });
    });
  });

  describe('handleErrorsChange', () => {
    it('should update errors', () => {
      const { result } = renderHook(() => useAppState());
      const newErrors = [{ line: 3, column: 1, message: 'Syntax error' }];

      act(() => {
        result.current.handleErrorsChange(newErrors);
      });

      expect(result.current.errors).toEqual(newErrors);
    });
  });

  describe('handleErrorClick', () => {
    it('should navigate to error location', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleErrorClick({ line: 5, column: 3, message: 'Error' });
      });

      expect(mockNavigateToError).toHaveBeenCalledWith({ line: 5, column: 3 });
    });
  });

  describe('handlePreviewErrorClick', () => {
    it('should navigate to line with column defaulting to 1', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handlePreviewErrorClick(10);
      });

      expect(mockNavigateToError).toHaveBeenCalledWith({ line: 10, column: 1 });
    });

    it('should use provided column', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handlePreviewErrorClick(10, 5);
      });

      expect(mockNavigateToError).toHaveBeenCalledWith({ line: 10, column: 5 });
    });
  });

  describe('handleOutlineNavigate', () => {
    it('should call navigateToItem with the outline item', () => {
      const { result } = renderHook(() => useAppState());
      const item = { text: 'Heading', level: 1, line: 5 };

      act(() => {
        result.current.handleOutlineNavigate(item as never);
      });

      expect(mockNavigateToItem).toHaveBeenCalledWith(item);
    });
  });

  describe('handleTemplateSelect', () => {
    it('should create document directly for template without required variables', () => {
      const { result } = renderHook(() => useAppState());
      const template = {
        name: 'Simple',
        content: '# Hello',
        variables: [],
      };

      act(() => {
        result.current.handleTemplateSelect(template as never);
      });

      expect(mockNewDocument).toHaveBeenCalled();
      expect(mockSetContent).toHaveBeenCalled();
      expect(mockCloseTemplateBrowser).toHaveBeenCalled();
    });

    it('should open variable dialog for template with required variables', () => {
      const { result } = renderHook(() => useAppState());
      const template = {
        name: 'Blog',
        content: '# {{title}}',
        variables: [{ name: 'title', required: true, default: '' }],
      };

      act(() => {
        result.current.handleTemplateSelect(template as never);
      });

      expect(mockStartVariableDialog).toHaveBeenCalledWith(template);
    });

    it('should skip variable dialog when all required variables have defaults', () => {
      const { result } = renderHook(() => useAppState());
      const template = {
        name: 'Blog',
        content: '# {{title}}',
        variables: [{ name: 'title', required: true, default: 'Default Title' }],
      };

      act(() => {
        result.current.handleTemplateSelect(template as never);
      });

      expect(mockNewDocument).toHaveBeenCalled();
      expect(mockCloseTemplateBrowser).toHaveBeenCalled();
    });
  });

  describe('handleVariableCancel', () => {
    it('should close dialog, clear pending, and reopen browser', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleVariableCancel();
      });

      expect(mockCloseVariableDialog).toHaveBeenCalled();
      expect(mockClearPendingTemplate).toHaveBeenCalled();
      expect(mockOpenTemplateBrowser).toHaveBeenCalled();
    });
  });

  describe('handleSaveTemplate', () => {
    it('should set saving state and call saveTemplate', async () => {
      mockSaveTemplate.mockResolvedValue(undefined);
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleSaveTemplate({
          name: 'Test',
          description: 'A test template',
          category: 'custom',
          tags: ['test'],
          variables: [],
          content: '# Test',
        });
      });

      expect(mockSetSaving).toHaveBeenCalledWith(true);
      expect(mockSaveTemplate).toHaveBeenCalled();
      expect(mockCloseSaveTemplateDialog).toHaveBeenCalled();
    });

    it('should set error on save failure', async () => {
      mockSaveTemplate.mockRejectedValue(new Error('Save failed'));
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleSaveTemplate({
          name: 'Test',
          description: '',
          category: 'custom',
          tags: [],
          variables: [],
          content: '# Test',
        });
      });

      expect(mockSetSaveError).toHaveBeenCalledWith('Save failed');
    });

    it('should handle non-Error rejection gracefully', async () => {
      mockSaveTemplate.mockRejectedValue('string error');
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleSaveTemplate({
          name: 'Test',
          description: '',
          category: 'custom',
          tags: [],
          variables: [],
          content: '# Test',
        });
      });

      expect(mockSetSaveError).toHaveBeenCalledWith('Failed to save template');
    });
  });

  describe('handleNotification', () => {
    it('should set announcement message', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleNotification({ message: 'File saved' });
      });

      expect(result.current.announcement).toBe('File saved');
    });

    it('should clear announcement after duration', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleNotification({ message: 'Hello', duration: 1000 });
      });

      expect(result.current.announcement).toBe('Hello');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.announcement).toBe('');
    });

    it('should use default 3000ms duration', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleNotification({ message: 'Test' });
      });

      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(result.current.announcement).toBe('Test');

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.announcement).toBe('');
    });

    it('should cancel previous timer on new notification', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleNotification({ message: 'First', duration: 5000 });
      });

      act(() => {
        result.current.handleNotification({ message: 'Second', duration: 1000 });
      });

      expect(result.current.announcement).toBe('Second');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.announcement).toBe('');
    });
  });

  describe('handleLayout', () => {
    it('should convert panel sizes to split ratio', () => {
      const { result } = renderHook(() => useAppState());
      const { setSplitRatio } = require('../../stores/ui-layout-store').useUILayoutStore.getState();

      act(() => {
        result.current.handleLayout([60, 40]);
      });

      expect(setSplitRatio).toHaveBeenCalledWith(0.6);
    });
  });
});
