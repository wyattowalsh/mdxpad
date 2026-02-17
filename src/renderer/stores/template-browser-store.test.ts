/**
 * Tests for Template Browser Store.
 *
 * Tests template browser modal state management including browse flow,
 * variable dialog, and save template dialog.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTemplateBrowserModalStore,
  selectIsTemplateBrowserOpen,
  selectIsVariableDialogOpen,
  selectPendingTemplate,
  selectIsSaveTemplateDialogOpen,
  selectIsSaving,
  selectSaveError,
  type TemplateBrowserModalStore,
} from './template-browser-store';
import type { Template } from '@shared/contracts/template-schemas';

// =============================================================================
// TEST HELPERS
// =============================================================================

const INITIAL_STATE = {
  isTemplateBrowserOpen: false,
  isVariableDialogOpen: false,
  pendingTemplate: null,
  isSaveTemplateDialogOpen: false,
  isSaving: false,
  saveError: null,
};

function createMockTemplate(): Template {
  return {
    id: 'test-template',
    name: 'Test Template',
    description: 'A test template',
    category: 'blog',
    tags: ['test'],
    author: 'Test Author',
    version: '1.0.0',
    isBuiltIn: false,
    content: '# {{title}}',
    variables: [
      {
        name: 'title',
        description: 'Document title',
        required: true,
      },
    ],
    filePath: '/mock/path/test-template.mdxt',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('useTemplateBrowserModalStore', () => {
  beforeEach(() => {
    useTemplateBrowserModalStore.setState(INITIAL_STATE);
  });

  describe('initial state', () => {
    it('should start with all modals closed', () => {
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isTemplateBrowserOpen).toBe(false);
      expect(state.isVariableDialogOpen).toBe(false);
      expect(state.pendingTemplate).toBeNull();
      expect(state.isSaveTemplateDialogOpen).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.saveError).toBeNull();
    });
  });

  describe('openTemplateBrowser', () => {
    it('should open template browser', () => {
      useTemplateBrowserModalStore.getState().openTemplateBrowser();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isTemplateBrowserOpen).toBe(true);
    });

    it('should keep browser open when called multiple times', () => {
      useTemplateBrowserModalStore.getState().openTemplateBrowser();
      useTemplateBrowserModalStore.getState().openTemplateBrowser();

      expect(useTemplateBrowserModalStore.getState().isTemplateBrowserOpen).toBe(true);
    });
  });

  describe('closeTemplateBrowser', () => {
    it('should close template browser', () => {
      useTemplateBrowserModalStore.setState({ isTemplateBrowserOpen: true });

      useTemplateBrowserModalStore.getState().closeTemplateBrowser();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isTemplateBrowserOpen).toBe(false);
    });

    it('should clear pending template when closing', () => {
      const template = createMockTemplate();
      useTemplateBrowserModalStore.setState({
        isTemplateBrowserOpen: true,
        pendingTemplate: template,
      });

      useTemplateBrowserModalStore.getState().closeTemplateBrowser();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.pendingTemplate).toBeNull();
    });
  });

  describe('startVariableDialog', () => {
    it('should open variable dialog with template', () => {
      const template = createMockTemplate();

      useTemplateBrowserModalStore.getState().startVariableDialog(template);
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isVariableDialogOpen).toBe(true);
      expect(state.pendingTemplate).toBe(template);
    });

    it('should close browser when opening variable dialog', () => {
      const template = createMockTemplate();
      useTemplateBrowserModalStore.setState({ isTemplateBrowserOpen: true });

      useTemplateBrowserModalStore.getState().startVariableDialog(template);
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isTemplateBrowserOpen).toBe(false);
      expect(state.isVariableDialogOpen).toBe(true);
    });

    it('should update pending template', () => {
      const template1 = createMockTemplate();
      const template2 = { ...template1, id: 'template-2' };

      useTemplateBrowserModalStore.getState().startVariableDialog(template1);
      expect(useTemplateBrowserModalStore.getState().pendingTemplate).toBe(template1);

      useTemplateBrowserModalStore.getState().startVariableDialog(template2);
      expect(useTemplateBrowserModalStore.getState().pendingTemplate).toBe(template2);
    });
  });

  describe('closeVariableDialog', () => {
    it('should close variable dialog', () => {
      const template = createMockTemplate();
      useTemplateBrowserModalStore.setState({
        isVariableDialogOpen: true,
        pendingTemplate: template,
      });

      useTemplateBrowserModalStore.getState().closeVariableDialog();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isVariableDialogOpen).toBe(false);
      // Pending template should remain for potential retry
      expect(state.pendingTemplate).toBe(template);
    });
  });

  describe('clearPendingTemplate', () => {
    it('should clear pending template', () => {
      const template = createMockTemplate();
      useTemplateBrowserModalStore.setState({ pendingTemplate: template });

      useTemplateBrowserModalStore.getState().clearPendingTemplate();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.pendingTemplate).toBeNull();
    });
  });

  describe('openSaveTemplateDialog', () => {
    it('should open save template dialog', () => {
      useTemplateBrowserModalStore.getState().openSaveTemplateDialog();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isSaveTemplateDialogOpen).toBe(true);
    });

    it('should clear save error when opening', () => {
      useTemplateBrowserModalStore.setState({
        isSaveTemplateDialogOpen: false,
        saveError: 'Previous error',
      });

      useTemplateBrowserModalStore.getState().openSaveTemplateDialog();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.saveError).toBeNull();
    });
  });

  describe('closeSaveTemplateDialog', () => {
    it('should close save template dialog', () => {
      useTemplateBrowserModalStore.setState({
        isSaveTemplateDialogOpen: true,
      });

      useTemplateBrowserModalStore.getState().closeSaveTemplateDialog();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isSaveTemplateDialogOpen).toBe(false);
    });

    it('should reset saving state', () => {
      useTemplateBrowserModalStore.setState({
        isSaveTemplateDialogOpen: true,
        isSaving: true,
      });

      useTemplateBrowserModalStore.getState().closeSaveTemplateDialog();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isSaving).toBe(false);
    });

    it('should clear save error', () => {
      useTemplateBrowserModalStore.setState({
        isSaveTemplateDialogOpen: true,
        saveError: 'Save failed',
      });

      useTemplateBrowserModalStore.getState().closeSaveTemplateDialog();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.saveError).toBeNull();
    });
  });

  describe('setSaving', () => {
    it('should set saving state to true', () => {
      useTemplateBrowserModalStore.getState().setSaving(true);

      expect(useTemplateBrowserModalStore.getState().isSaving).toBe(true);
    });

    it('should set saving state to false', () => {
      useTemplateBrowserModalStore.setState({ isSaving: true });

      useTemplateBrowserModalStore.getState().setSaving(false);

      expect(useTemplateBrowserModalStore.getState().isSaving).toBe(false);
    });
  });

  describe('setSaveError', () => {
    it('should set save error', () => {
      const error = 'Failed to save template';

      useTemplateBrowserModalStore.getState().setSaveError(error);
      const state = useTemplateBrowserModalStore.getState();

      expect(state.saveError).toBe(error);
      expect(state.isSaving).toBe(false);
    });

    it('should clear save error when set to null', () => {
      useTemplateBrowserModalStore.setState({ saveError: 'Error' });

      useTemplateBrowserModalStore.getState().setSaveError(null);

      expect(useTemplateBrowserModalStore.getState().saveError).toBeNull();
    });

    it('should stop saving when error is set', () => {
      useTemplateBrowserModalStore.setState({ isSaving: true });

      useTemplateBrowserModalStore.getState().setSaveError('Error');

      expect(useTemplateBrowserModalStore.getState().isSaving).toBe(false);
    });
  });

  describe('reset', () => {
    it('should return to initial state', () => {
      const template = createMockTemplate();
      useTemplateBrowserModalStore.setState({
        isTemplateBrowserOpen: true,
        isVariableDialogOpen: true,
        pendingTemplate: template,
        isSaveTemplateDialogOpen: true,
        isSaving: true,
        saveError: 'Error',
      });

      useTemplateBrowserModalStore.getState().reset();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isTemplateBrowserOpen).toBe(false);
      expect(state.isVariableDialogOpen).toBe(false);
      expect(state.pendingTemplate).toBeNull();
      expect(state.isSaveTemplateDialogOpen).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.saveError).toBeNull();
    });
  });

  describe('template selection workflow', () => {
    it('should handle browse -> select -> variable flow', () => {
      const template = createMockTemplate();

      // Open browser
      useTemplateBrowserModalStore.getState().openTemplateBrowser();
      expect(useTemplateBrowserModalStore.getState().isTemplateBrowserOpen).toBe(true);

      // Select template (opens variable dialog)
      useTemplateBrowserModalStore.getState().startVariableDialog(template);
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isTemplateBrowserOpen).toBe(false);
      expect(state.isVariableDialogOpen).toBe(true);
      expect(state.pendingTemplate).toBe(template);
    });

    it('should handle cancel during variable dialog', () => {
      const template = createMockTemplate();

      useTemplateBrowserModalStore.getState().startVariableDialog(template);
      useTemplateBrowserModalStore.getState().closeVariableDialog();

      const state = useTemplateBrowserModalStore.getState();
      expect(state.isVariableDialogOpen).toBe(false);
      expect(state.pendingTemplate).toBe(template);
    });

    it('should clear template after complete workflow', () => {
      const template = createMockTemplate();

      useTemplateBrowserModalStore.getState().startVariableDialog(template);
      useTemplateBrowserModalStore.getState().closeVariableDialog();
      useTemplateBrowserModalStore.getState().clearPendingTemplate();

      expect(useTemplateBrowserModalStore.getState().pendingTemplate).toBeNull();
    });
  });

  describe('save template workflow', () => {
    it('should handle open -> save -> success flow', () => {
      useTemplateBrowserModalStore.getState().openSaveTemplateDialog();
      expect(useTemplateBrowserModalStore.getState().isSaveTemplateDialogOpen).toBe(true);

      useTemplateBrowserModalStore.getState().setSaving(true);
      expect(useTemplateBrowserModalStore.getState().isSaving).toBe(true);

      useTemplateBrowserModalStore.getState().closeSaveTemplateDialog();
      const state = useTemplateBrowserModalStore.getState();

      expect(state.isSaveTemplateDialogOpen).toBe(false);
      expect(state.isSaving).toBe(false);
    });

    it('should handle open -> save -> error flow', () => {
      useTemplateBrowserModalStore.getState().openSaveTemplateDialog();
      useTemplateBrowserModalStore.getState().setSaving(true);
      useTemplateBrowserModalStore.getState().setSaveError('Save failed');

      const state = useTemplateBrowserModalStore.getState();
      expect(state.isSaving).toBe(false);
      expect(state.saveError).toBe('Save failed');
      expect(state.isSaveTemplateDialogOpen).toBe(true);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useTemplateBrowserModalStore.setState(INITIAL_STATE);
  });

  describe('selectIsTemplateBrowserOpen', () => {
    it('should return template browser open state', () => {
      expect(selectIsTemplateBrowserOpen(useTemplateBrowserModalStore.getState())).toBe(false);

      useTemplateBrowserModalStore.getState().openTemplateBrowser();
      expect(selectIsTemplateBrowserOpen(useTemplateBrowserModalStore.getState())).toBe(true);
    });
  });

  describe('selectIsVariableDialogOpen', () => {
    it('should return variable dialog open state', () => {
      expect(selectIsVariableDialogOpen(useTemplateBrowserModalStore.getState())).toBe(false);

      const template = createMockTemplate();
      useTemplateBrowserModalStore.getState().startVariableDialog(template);
      expect(selectIsVariableDialogOpen(useTemplateBrowserModalStore.getState())).toBe(true);
    });
  });

  describe('selectPendingTemplate', () => {
    it('should return pending template', () => {
      expect(selectPendingTemplate(useTemplateBrowserModalStore.getState())).toBeNull();

      const template = createMockTemplate();
      useTemplateBrowserModalStore.getState().startVariableDialog(template);
      expect(selectPendingTemplate(useTemplateBrowserModalStore.getState())).toBe(template);
    });
  });

  describe('selectIsSaveTemplateDialogOpen', () => {
    it('should return save dialog open state', () => {
      expect(selectIsSaveTemplateDialogOpen(useTemplateBrowserModalStore.getState())).toBe(false);

      useTemplateBrowserModalStore.getState().openSaveTemplateDialog();
      expect(selectIsSaveTemplateDialogOpen(useTemplateBrowserModalStore.getState())).toBe(true);
    });
  });

  describe('selectIsSaving', () => {
    it('should return saving state', () => {
      expect(selectIsSaving(useTemplateBrowserModalStore.getState())).toBe(false);

      useTemplateBrowserModalStore.getState().setSaving(true);
      expect(selectIsSaving(useTemplateBrowserModalStore.getState())).toBe(true);
    });
  });

  describe('selectSaveError', () => {
    it('should return save error', () => {
      expect(selectSaveError(useTemplateBrowserModalStore.getState())).toBeNull();

      useTemplateBrowserModalStore.getState().setSaveError('Error message');
      expect(selectSaveError(useTemplateBrowserModalStore.getState())).toBe('Error message');
    });
  });
});
