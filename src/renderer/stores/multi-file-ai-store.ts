/**
 * Multi-File AI Store
 *
 * Zustand store with Immer middleware for managing AI-driven edits
 * across multiple files. Tracks per-file edit status (pending, applied, rejected).
 *
 * @module renderer/stores/multi-file-ai-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Draft } from 'immer';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Status of a single file edit within a multi-file operation.
 */
export type FileEditStatus = 'pending' | 'applied' | 'rejected';

/**
 * An individual file edit entry.
 */
export interface FileEdit {
  readonly path: string;
  readonly original: string;
  readonly modified: string;
  readonly status: FileEditStatus;
}

// =============================================================================
// STATE INTERFACE
// =============================================================================

export interface MultiFileAiState {
  readonly fileEdits: readonly FileEdit[];
  readonly isActive: boolean;
  readonly sessionId: string | null;
}

// =============================================================================
// ACTIONS INTERFACE
// =============================================================================

export interface MultiFileAiStoreActions {
  readonly startMultiFileEdit: (
    sessionId: string,
    edits: readonly Omit<FileEdit, 'status'>[]
  ) => void;
  readonly applyEdit: (path: string) => void;
  readonly rejectEdit: (path: string) => void;
  readonly applyAll: () => void;
  readonly rejectAll: () => void;
  readonly reset: () => void;
}

export type MultiFileAiStore = MultiFileAiState & MultiFileAiStoreActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

const INITIAL_STATE: MultiFileAiState = {
  fileEdits: [],
  isActive: false,
  sessionId: null,
};

// =============================================================================
// STORE CREATION
// =============================================================================

// =============================================================================
// ACTION HELPERS
// =============================================================================

type AiSetter = (fn: (draft: Draft<MultiFileAiState>) => void) => void;

function createEditActions(set: AiSetter) {
  return {
    startMultiFileEdit: (sessionId: string, edits: readonly Omit<FileEdit, 'status'>[]): void => {
      set((draft) => {
        draft.sessionId = sessionId;
        draft.isActive = true;
        draft.fileEdits = edits.map((edit) => ({
          ...edit,
          status: 'pending' as const,
        }));
      });
    },

    applyEdit: (path: string): void => {
      set((draft) => {
        const edit = draft.fileEdits.find((e) => e.path === path);
        if (edit?.status === 'pending') {
          edit.status = 'applied';
        }
      });
    },

    rejectEdit: (path: string): void => {
      set((draft) => {
        const edit = draft.fileEdits.find((e) => e.path === path);
        if (edit?.status === 'pending') {
          edit.status = 'rejected';
        }
      });
    },
  };
}

function createBulkActions(set: AiSetter) {
  return {
    applyAll: (): void => {
      set((draft) => {
        for (const edit of draft.fileEdits) {
          if (edit.status === 'pending') {
            edit.status = 'applied';
          }
        }
      });
    },

    rejectAll: (): void => {
      set((draft) => {
        for (const edit of draft.fileEdits) {
          if (edit.status === 'pending') {
            edit.status = 'rejected';
          }
        }
      });
    },

    reset: (): void => {
      set(() => ({ ...INITIAL_STATE }));
    },
  };
}

export const useMultiFileAiStore = create<MultiFileAiStore>()(
  immer((set) => ({
    ...INITIAL_STATE,
    ...createEditActions(set),
    ...createBulkActions(set),
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectFileEdits = (state: MultiFileAiStore): readonly FileEdit[] => state.fileEdits;

export const selectIsActive = (state: MultiFileAiStore): boolean => state.isActive;

export const selectSessionId = (state: MultiFileAiStore): string | null => state.sessionId;

export const selectPendingEdits = (state: MultiFileAiStore): readonly FileEdit[] =>
  state.fileEdits.filter((e) => e.status === 'pending');

export const selectAppliedEdits = (state: MultiFileAiStore): readonly FileEdit[] =>
  state.fileEdits.filter((e) => e.status === 'applied');

export const selectRejectedEdits = (state: MultiFileAiStore): readonly FileEdit[] =>
  state.fileEdits.filter((e) => e.status === 'rejected');

export const selectEditByPath =
  (path: string) =>
  (state: MultiFileAiStore): FileEdit | undefined =>
    state.fileEdits.find((e) => e.path === path);

export const selectProgress = (
  state: MultiFileAiStore
): { readonly total: number; readonly completed: number; readonly pending: number } => {
  const total = state.fileEdits.length;
  const pending = state.fileEdits.filter((e) => e.status === 'pending').length;
  return { total, completed: total - pending, pending };
};
