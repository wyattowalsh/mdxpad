/**
 * Tests for Multi-File AI Store.
 *
 * Tests multi-file edit operations, status tracking, and selectors.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useMultiFileAiStore,
  selectFileEdits,
  selectIsActive,
  selectSessionId,
  selectPendingEdits,
  selectAppliedEdits,
  selectRejectedEdits,
  selectEditByPath,
  selectProgress,
} from './multi-file-ai-store';
import type { MultiFileAiState } from './multi-file-ai-store';

// =============================================================================
// SETUP
// =============================================================================

const INITIAL: MultiFileAiState = {
  fileEdits: [],
  isActive: false,
  sessionId: null,
};

const SAMPLE_EDITS = [
  { path: '/src/a.ts', original: 'const a = 1;', modified: 'const a = 2;' },
  { path: '/src/b.ts', original: 'let b = true;', modified: 'const b = true;' },
  { path: '/src/c.ts', original: '// old', modified: '// new' },
];

describe('useMultiFileAiStore', () => {
  beforeEach(() => {
    useMultiFileAiStore.setState(INITIAL);
  });

  describe('startMultiFileEdit', () => {
    it('should initialize a session with pending edits', () => {
      useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      const state = useMultiFileAiStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.sessionId).toBe('session-1');
      expect(state.fileEdits).toHaveLength(3);
      expect(state.fileEdits[0]?.status).toBe('pending');
      expect(state.fileEdits[1]?.status).toBe('pending');
      expect(state.fileEdits[2]?.status).toBe('pending');
    });
  });

  describe('applyEdit', () => {
    it('should mark a specific file edit as applied', () => {
      useMultiFileAiStore.getState().startMultiFileEdit('s1', SAMPLE_EDITS);
      useMultiFileAiStore.getState().applyEdit('/src/a.ts');
      const edit = useMultiFileAiStore.getState().fileEdits.find((e) => e.path === '/src/a.ts');
      expect(edit?.status).toBe('applied');
    });

    it('should not change non-pending edits', () => {
      useMultiFileAiStore.getState().startMultiFileEdit('s1', SAMPLE_EDITS);
      useMultiFileAiStore.getState().rejectEdit('/src/a.ts');
      useMultiFileAiStore.getState().applyEdit('/src/a.ts');
      const edit = useMultiFileAiStore.getState().fileEdits.find((e) => e.path === '/src/a.ts');
      expect(edit?.status).toBe('rejected');
    });
  });

  describe('rejectEdit', () => {
    it('should mark a specific file edit as rejected', () => {
      useMultiFileAiStore.getState().startMultiFileEdit('s1', SAMPLE_EDITS);
      useMultiFileAiStore.getState().rejectEdit('/src/b.ts');
      const edit = useMultiFileAiStore.getState().fileEdits.find((e) => e.path === '/src/b.ts');
      expect(edit?.status).toBe('rejected');
    });
  });

  describe('applyAll', () => {
    it('should apply all pending edits', () => {
      useMultiFileAiStore.getState().startMultiFileEdit('s1', SAMPLE_EDITS);
      useMultiFileAiStore.getState().rejectEdit('/src/a.ts'); // reject one first
      useMultiFileAiStore.getState().applyAll();
      const state = useMultiFileAiStore.getState();
      expect(state.fileEdits.filter((e) => e.status === 'applied')).toHaveLength(2);
      expect(state.fileEdits.filter((e) => e.status === 'rejected')).toHaveLength(1);
    });
  });

  describe('rejectAll', () => {
    it('should reject all pending edits', () => {
      useMultiFileAiStore.getState().startMultiFileEdit('s1', SAMPLE_EDITS);
      useMultiFileAiStore.getState().applyEdit('/src/a.ts'); // apply one first
      useMultiFileAiStore.getState().rejectAll();
      const state = useMultiFileAiStore.getState();
      expect(state.fileEdits.filter((e) => e.status === 'rejected')).toHaveLength(2);
      expect(state.fileEdits.filter((e) => e.status === 'applied')).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      useMultiFileAiStore.getState().startMultiFileEdit('s1', SAMPLE_EDITS);
      useMultiFileAiStore.getState().reset();
      const state = useMultiFileAiStore.getState();
      expect(state.isActive).toBe(false);
      expect(state.sessionId).toBeNull();
      expect(state.fileEdits).toHaveLength(0);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useMultiFileAiStore.setState(INITIAL);
    useMultiFileAiStore.getState().startMultiFileEdit('s1', SAMPLE_EDITS);
  });

  it('selectFileEdits returns all edits', () => {
    expect(selectFileEdits(useMultiFileAiStore.getState())).toHaveLength(3);
  });

  it('selectIsActive returns true when session is active', () => {
    expect(selectIsActive(useMultiFileAiStore.getState())).toBe(true);
  });

  it('selectSessionId returns the session id', () => {
    expect(selectSessionId(useMultiFileAiStore.getState())).toBe('s1');
  });

  it('selectPendingEdits returns only pending edits', () => {
    useMultiFileAiStore.getState().applyEdit('/src/a.ts');
    expect(selectPendingEdits(useMultiFileAiStore.getState())).toHaveLength(2);
  });

  it('selectAppliedEdits returns only applied edits', () => {
    useMultiFileAiStore.getState().applyEdit('/src/a.ts');
    expect(selectAppliedEdits(useMultiFileAiStore.getState())).toHaveLength(1);
  });

  it('selectRejectedEdits returns only rejected edits', () => {
    useMultiFileAiStore.getState().rejectEdit('/src/b.ts');
    expect(selectRejectedEdits(useMultiFileAiStore.getState())).toHaveLength(1);
  });

  it('selectEditByPath returns a specific edit', () => {
    const edit = selectEditByPath('/src/c.ts')(useMultiFileAiStore.getState());
    expect(edit?.original).toBe('// old');
  });

  it('selectProgress returns correct totals', () => {
    useMultiFileAiStore.getState().applyEdit('/src/a.ts');
    useMultiFileAiStore.getState().rejectEdit('/src/b.ts');
    const progress = selectProgress(useMultiFileAiStore.getState());
    expect(progress.total).toBe(3);
    expect(progress.completed).toBe(2);
    expect(progress.pending).toBe(1);
  });
});
