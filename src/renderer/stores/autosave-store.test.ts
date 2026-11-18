/**
 * Tests for Autosave Store.
 *
 * Tests autosave state management including enabled/disabled toggle,
 * save progress tracking, error handling, and pause/resume functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useAutosaveStore,
  selectIsEnabled,
  selectIsSaving,
  selectLastSaveAt,
  selectLastSaveResult,
  selectLastError,
  selectClearError,
  selectIsPaused,
  selectPauseReason,
  selectSetPaused,
} from './autosave-store';

// =============================================================================
// TEST HELPERS
// =============================================================================

const INITIAL_STATE = {
  enabled: true,
  lastSaveAt: null,
  lastSaveResult: null,
  lastError: null,
  isSaving: false,
  pendingSaveDocumentId: null,
  isPaused: false,
  pauseReason: null,
};

// =============================================================================
// TESTS
// =============================================================================

describe('useAutosaveStore', () => {
  beforeEach(() => {
    // Reset store state to initial values before each test
    useAutosaveStore.setState(INITIAL_STATE);
  });

  describe('initial state', () => {
    it('should start with autosave enabled', () => {
      const state = useAutosaveStore.getState();

      expect(state.enabled).toBe(true);
      expect(state.lastSaveAt).toBeNull();
      expect(state.lastSaveResult).toBeNull();
      expect(state.lastError).toBeNull();
      expect(state.isSaving).toBe(false);
      expect(state.pendingSaveDocumentId).toBeNull();
      expect(state.isPaused).toBe(false);
      expect(state.pauseReason).toBeNull();
    });
  });

  describe('setEnabled', () => {
    it('should enable autosave', () => {
      useAutosaveStore.setState({ enabled: false });

      useAutosaveStore.getState().setEnabled(true);
      const state = useAutosaveStore.getState();

      expect(state.enabled).toBe(true);
    });

    it('should disable autosave', () => {
      useAutosaveStore.getState().setEnabled(false);
      const state = useAutosaveStore.getState();

      expect(state.enabled).toBe(false);
    });

    it('should toggle enabled state', () => {
      useAutosaveStore.getState().setEnabled(false);
      expect(useAutosaveStore.getState().enabled).toBe(false);

      useAutosaveStore.getState().setEnabled(true);
      expect(useAutosaveStore.getState().enabled).toBe(true);
    });
  });

  describe('startSave', () => {
    it('should mark save as in progress', () => {
      const documentId = 'doc-123';

      useAutosaveStore.getState().startSave(documentId);
      const state = useAutosaveStore.getState();

      expect(state.isSaving).toBe(true);
      expect(state.pendingSaveDocumentId).toBe(documentId);
    });

    it('should update pending document ID', () => {
      useAutosaveStore.getState().startSave('doc-1');
      useAutosaveStore.getState().startSave('doc-2');

      const state = useAutosaveStore.getState();
      expect(state.pendingSaveDocumentId).toBe('doc-2');
    });

    it('keeps a newer save running when an older one finishes', () => {
      useAutosaveStore.getState().startSave('doc-a');
      useAutosaveStore.getState().startSave('doc-b');

      useAutosaveStore.getState().completeSave(1, 'doc-a');
      expect(useAutosaveStore.getState().isSaving).toBe(true);
      expect(useAutosaveStore.getState().pendingSaveDocumentId).toBe('doc-b');

      useAutosaveStore.getState().failSave('disk full', 'doc-a');
      expect(useAutosaveStore.getState().isSaving).toBe(true);
      expect(useAutosaveStore.getState().lastError).toBeNull();

      useAutosaveStore.getState().completeSave(2, 'doc-b');
      expect(useAutosaveStore.getState().isSaving).toBe(false);
      expect(useAutosaveStore.getState().lastSaveAt).toBe(2);
    });
  });

  describe('completeSave', () => {
    it('should mark save as successfully completed', () => {
      const savedAt = Date.now();
      useAutosaveStore.getState().startSave('doc-123');

      useAutosaveStore.getState().completeSave(savedAt);
      const state = useAutosaveStore.getState();

      expect(state.isSaving).toBe(false);
      expect(state.pendingSaveDocumentId).toBeNull();
      expect(state.lastSaveAt).toBe(savedAt);
      expect(state.lastSaveResult).toBe('success');
      expect(state.lastError).toBeNull();
    });

    it('should clear previous error on success', () => {
      useAutosaveStore.setState({
        ...INITIAL_STATE,
        lastError: 'Previous error',
        lastSaveResult: 'error',
      });

      useAutosaveStore.getState().completeSave(Date.now());
      const state = useAutosaveStore.getState();

      expect(state.lastError).toBeNull();
      expect(state.lastSaveResult).toBe('success');
    });

    it('should update lastSaveAt timestamp', () => {
      const time1 = 1000;
      const time2 = 2000;

      useAutosaveStore.getState().completeSave(time1);
      expect(useAutosaveStore.getState().lastSaveAt).toBe(time1);

      useAutosaveStore.getState().completeSave(time2);
      expect(useAutosaveStore.getState().lastSaveAt).toBe(time2);
    });
  });

  describe('failSave', () => {
    it('should mark save as failed with error', () => {
      const error = 'Disk full';
      useAutosaveStore.getState().startSave('doc-123');

      useAutosaveStore.getState().failSave(error);
      const state = useAutosaveStore.getState();

      expect(state.isSaving).toBe(false);
      expect(state.pendingSaveDocumentId).toBeNull();
      expect(state.lastSaveResult).toBe('error');
      expect(state.lastError).toBe(error);
    });

    it('should preserve lastSaveAt on failure', () => {
      const savedAt = 1000;
      useAutosaveStore.setState({
        ...INITIAL_STATE,
        lastSaveAt: savedAt,
      });

      useAutosaveStore.getState().failSave('Error message');
      const state = useAutosaveStore.getState();

      expect(state.lastSaveAt).toBe(savedAt);
    });

    it('should handle different error messages', () => {
      const errors = [
        'Network error',
        'Permission denied',
        'Invalid file path',
      ];

      errors.forEach((error) => {
        useAutosaveStore.getState().failSave(error);
        expect(useAutosaveStore.getState().lastError).toBe(error);
      });
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useAutosaveStore.setState({
        ...INITIAL_STATE,
        lastError: 'Some error',
        lastSaveResult: 'error',
      });

      useAutosaveStore.getState().clearError();
      const state = useAutosaveStore.getState();

      expect(state.lastError).toBeNull();
      expect(state.lastSaveResult).toBeNull();
    });

    it('should not affect other state', () => {
      useAutosaveStore.setState({
        ...INITIAL_STATE,
        enabled: false,
        lastSaveAt: 1000,
        isSaving: true,
        lastError: 'Error',
      });

      useAutosaveStore.getState().clearError();
      const state = useAutosaveStore.getState();

      expect(state.enabled).toBe(false);
      expect(state.lastSaveAt).toBe(1000);
      expect(state.isSaving).toBe(true);
    });
  });

  describe('setPaused', () => {
    it('should pause autosave with reason', () => {
      const reason = 'Too many failures';

      useAutosaveStore.getState().setPaused(true, reason);
      const state = useAutosaveStore.getState();

      expect(state.isPaused).toBe(true);
      expect(state.pauseReason).toBe(reason);
    });

    it('should pause autosave without reason', () => {
      useAutosaveStore.getState().setPaused(true);
      const state = useAutosaveStore.getState();

      expect(state.isPaused).toBe(true);
      expect(state.pauseReason).toBeNull();
    });

    it('should unpause autosave', () => {
      useAutosaveStore.setState({
        ...INITIAL_STATE,
        isPaused: true,
        pauseReason: 'Some reason',
      });

      useAutosaveStore.getState().setPaused(false);
      const state = useAutosaveStore.getState();

      expect(state.isPaused).toBe(false);
      expect(state.pauseReason).toBeNull();
    });

    it('should clear reason when unpausing', () => {
      useAutosaveStore.getState().setPaused(true, 'Reason 1');
      useAutosaveStore.getState().setPaused(false, 'Reason 2');

      const state = useAutosaveStore.getState();
      expect(state.pauseReason).toBeNull();
    });
  });

  describe('reset', () => {
    it('should return to initial state', () => {
      useAutosaveStore.setState({
        enabled: false,
        lastSaveAt: 1000,
        lastSaveResult: 'error',
        lastError: 'Error',
        isSaving: true,
        pendingSaveDocumentId: 'doc-123',
        isPaused: true,
        pauseReason: 'Reason',
      });

      useAutosaveStore.getState().reset();
      const state = useAutosaveStore.getState();

      expect(state.enabled).toBe(INITIAL_STATE.enabled);
      expect(state.lastSaveAt).toBe(INITIAL_STATE.lastSaveAt);
      expect(state.lastSaveResult).toBe(INITIAL_STATE.lastSaveResult);
      expect(state.lastError).toBe(INITIAL_STATE.lastError);
      expect(state.isSaving).toBe(INITIAL_STATE.isSaving);
      expect(state.pendingSaveDocumentId).toBe(INITIAL_STATE.pendingSaveDocumentId);
      expect(state.isPaused).toBe(INITIAL_STATE.isPaused);
      expect(state.pauseReason).toBe(INITIAL_STATE.pauseReason);
    });
  });

  describe('save lifecycle', () => {
    it('should track complete save lifecycle', () => {
      const documentId = 'doc-123';
      const savedAt = Date.now();

      // Start
      useAutosaveStore.getState().startSave(documentId);
      expect(useAutosaveStore.getState().isSaving).toBe(true);
      expect(useAutosaveStore.getState().pendingSaveDocumentId).toBe(documentId);

      // Complete
      useAutosaveStore.getState().completeSave(savedAt);
      const state = useAutosaveStore.getState();

      expect(state.isSaving).toBe(false);
      expect(state.pendingSaveDocumentId).toBeNull();
      expect(state.lastSaveAt).toBe(savedAt);
      expect(state.lastSaveResult).toBe('success');
    });

    it('should track failed save lifecycle', () => {
      const documentId = 'doc-123';
      const error = 'Network error';

      // Start
      useAutosaveStore.getState().startSave(documentId);
      expect(useAutosaveStore.getState().isSaving).toBe(true);

      // Fail
      useAutosaveStore.getState().failSave(error);
      const state = useAutosaveStore.getState();

      expect(state.isSaving).toBe(false);
      expect(state.pendingSaveDocumentId).toBeNull();
      expect(state.lastSaveResult).toBe('error');
      expect(state.lastError).toBe(error);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useAutosaveStore.setState(INITIAL_STATE);
  });

  describe('selectIsEnabled', () => {
    it('should return enabled state', () => {
      expect(selectIsEnabled(useAutosaveStore.getState())).toBe(true);

      useAutosaveStore.getState().setEnabled(false);
      expect(selectIsEnabled(useAutosaveStore.getState())).toBe(false);
    });
  });

  describe('selectIsSaving', () => {
    it('should return saving state', () => {
      expect(selectIsSaving(useAutosaveStore.getState())).toBe(false);

      useAutosaveStore.getState().startSave('doc-123');
      expect(selectIsSaving(useAutosaveStore.getState())).toBe(true);
    });
  });

  describe('selectLastSaveAt', () => {
    it('should return last save timestamp', () => {
      expect(selectLastSaveAt(useAutosaveStore.getState())).toBeNull();

      const savedAt = Date.now();
      useAutosaveStore.getState().completeSave(savedAt);
      expect(selectLastSaveAt(useAutosaveStore.getState())).toBe(savedAt);
    });
  });

  describe('selectLastSaveResult', () => {
    it('should return last save result', () => {
      expect(selectLastSaveResult(useAutosaveStore.getState())).toBeNull();

      useAutosaveStore.getState().completeSave(Date.now());
      expect(selectLastSaveResult(useAutosaveStore.getState())).toBe('success');

      useAutosaveStore.getState().failSave('Error');
      expect(selectLastSaveResult(useAutosaveStore.getState())).toBe('error');
    });
  });

  describe('selectLastError', () => {
    it('should return last error', () => {
      expect(selectLastError(useAutosaveStore.getState())).toBeNull();

      useAutosaveStore.getState().failSave('Test error');
      expect(selectLastError(useAutosaveStore.getState())).toBe('Test error');
    });
  });

  describe('selectClearError', () => {
    it('should return clearError action', () => {
      const action = selectClearError(useAutosaveStore.getState());
      expect(typeof action).toBe('function');

      useAutosaveStore.getState().failSave('Error');
      action();
      expect(useAutosaveStore.getState().lastError).toBeNull();
    });
  });

  describe('selectIsPaused', () => {
    it('should return paused state', () => {
      expect(selectIsPaused(useAutosaveStore.getState())).toBe(false);

      useAutosaveStore.getState().setPaused(true);
      expect(selectIsPaused(useAutosaveStore.getState())).toBe(true);
    });
  });

  describe('selectPauseReason', () => {
    it('should return pause reason', () => {
      expect(selectPauseReason(useAutosaveStore.getState())).toBeNull();

      useAutosaveStore.getState().setPaused(true, 'Test reason');
      expect(selectPauseReason(useAutosaveStore.getState())).toBe('Test reason');
    });
  });

  describe('selectSetPaused', () => {
    it('should return setPaused action', () => {
      const action = selectSetPaused(useAutosaveStore.getState());
      expect(typeof action).toBe('function');

      action(true, 'Reason');
      expect(useAutosaveStore.getState().isPaused).toBe(true);
    });
  });
});
