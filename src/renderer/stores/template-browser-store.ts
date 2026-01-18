/**
 * Template Browser Store
 *
 * Zustand store for managing template browser modal state.
 * Handles the flow: browse -> select -> variable dialog -> create document
 *
 * Feature: 016-template-library
 *
 * @module renderer/stores/template-browser-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Template } from '@shared/contracts/template-schemas';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Template browser modal state.
 */
export interface TemplateBrowserModalState {
  /** Whether the template browser modal is open */
  readonly isTemplateBrowserOpen: boolean;
  /** Whether the variable dialog is open */
  readonly isVariableDialogOpen: boolean;
  /** The currently pending template (for variable input) */
  readonly pendingTemplate: Template | null;
  /** Whether the save template dialog is open */
  readonly isSaveTemplateDialogOpen: boolean;
  /** Whether a save operation is in progress */
  readonly isSaving: boolean;
  /** Error message from the last save attempt */
  readonly saveError: string | null;
}

/**
 * Template browser modal actions.
 */
export interface TemplateBrowserModalActions {
  /** Open the template browser modal */
  openTemplateBrowser: () => void;
  /** Close the template browser modal */
  closeTemplateBrowser: () => void;
  /** Start variable collection for a template */
  startVariableDialog: (template: Template) => void;
  /** Close the variable dialog */
  closeVariableDialog: () => void;
  /** Clear the pending template */
  clearPendingTemplate: () => void;
  /** Open the save template dialog */
  openSaveTemplateDialog: () => void;
  /** Close the save template dialog */
  closeSaveTemplateDialog: () => void;
  /** Set the saving state */
  setSaving: (isSaving: boolean) => void;
  /** Set the save error */
  setSaveError: (error: string | null) => void;
  /** Reset all modal state */
  reset: () => void;
}

/**
 * Combined template browser modal store type.
 */
export type TemplateBrowserModalStore = TemplateBrowserModalState & TemplateBrowserModalActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Initial state for the template browser modal store.
 */
const INITIAL_STATE: TemplateBrowserModalState = {
  isTemplateBrowserOpen: false,
  isVariableDialogOpen: false,
  pendingTemplate: null,
  isSaveTemplateDialogOpen: false,
  isSaving: false,
  saveError: null,
};

// =============================================================================
// STORE CREATION
// =============================================================================

/**
 * Template browser modal store hook.
 * Manages the open/close state of template browser and variable dialogs.
 *
 * @example
 * ```tsx
 * const {
 *   isTemplateBrowserOpen,
 *   openTemplateBrowser,
 *   closeTemplateBrowser,
 *   pendingTemplate,
 * } = useTemplateBrowserModalStore();
 *
 * // Open template browser
 * openTemplateBrowser();
 *
 * // Handle template selection (triggers variable dialog if needed)
 * startVariableDialog(selectedTemplate);
 * ```
 */
export const useTemplateBrowserModalStore = create<TemplateBrowserModalStore>()(
  immer((set) => ({
    ...INITIAL_STATE,

    openTemplateBrowser: () =>
      set((draft) => {
        draft.isTemplateBrowserOpen = true;
      }),

    closeTemplateBrowser: () =>
      set((draft) => {
        draft.isTemplateBrowserOpen = false;
        // Clear pending template when closing browser
        draft.pendingTemplate = null;
      }),

    startVariableDialog: (template: Template) =>
      set((draft) => {
        draft.pendingTemplate = template;
        draft.isVariableDialogOpen = true;
        // Close browser when opening variable dialog
        draft.isTemplateBrowserOpen = false;
      }),

    closeVariableDialog: () =>
      set((draft) => {
        draft.isVariableDialogOpen = false;
      }),

    clearPendingTemplate: () =>
      set((draft) => {
        draft.pendingTemplate = null;
      }),

    openSaveTemplateDialog: () =>
      set((draft) => {
        draft.isSaveTemplateDialogOpen = true;
        draft.saveError = null;
      }),

    closeSaveTemplateDialog: () =>
      set((draft) => {
        draft.isSaveTemplateDialogOpen = false;
        draft.isSaving = false;
        draft.saveError = null;
      }),

    setSaving: (isSaving: boolean) =>
      set((draft) => {
        draft.isSaving = isSaving;
      }),

    setSaveError: (error: string | null) =>
      set((draft) => {
        draft.saveError = error;
        draft.isSaving = false;
      }),

    reset: () =>
      set((draft) => {
        draft.isTemplateBrowserOpen = false;
        draft.isVariableDialogOpen = false;
        draft.pendingTemplate = null;
        draft.isSaveTemplateDialogOpen = false;
        draft.isSaving = false;
        draft.saveError = null;
      }),
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Selector for template browser open state.
 *
 * @param state - Template browser modal store state
 * @returns Whether template browser is open
 */
export const selectIsTemplateBrowserOpen = (
  state: TemplateBrowserModalStore
): boolean => state.isTemplateBrowserOpen;

/**
 * Selector for variable dialog open state.
 *
 * @param state - Template browser modal store state
 * @returns Whether variable dialog is open
 */
export const selectIsVariableDialogOpen = (
  state: TemplateBrowserModalStore
): boolean => state.isVariableDialogOpen;

/**
 * Selector for pending template.
 *
 * @param state - Template browser modal store state
 * @returns The pending template or null
 */
export const selectPendingTemplate = (
  state: TemplateBrowserModalStore
): Template | null => state.pendingTemplate;

/**
 * Selector for save template dialog open state.
 *
 * @param state - Template browser modal store state
 * @returns Whether save template dialog is open
 */
export const selectIsSaveTemplateDialogOpen = (
  state: TemplateBrowserModalStore
): boolean => state.isSaveTemplateDialogOpen;

/**
 * Selector for saving state.
 *
 * @param state - Template browser modal store state
 * @returns Whether a save operation is in progress
 */
export const selectIsSaving = (
  state: TemplateBrowserModalStore
): boolean => state.isSaving;

/**
 * Selector for save error.
 *
 * @param state - Template browser modal store state
 * @returns Error message from the last save attempt
 */
export const selectSaveError = (
  state: TemplateBrowserModalStore
): string | null => state.saveError;
