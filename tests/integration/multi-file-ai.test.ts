/**
 * Integration tests for Multi-File AI Editing.
 *
 * Tests session lifecycle: start session, add file edits,
 * accept/reject per file, apply all, reject all, and progress tracking.
 *
 * @module tests/integration/multi-file-ai.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Import after mocks
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
} from '@renderer/stores/multi-file-ai-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_EDITS = [
  { path: '/src/main.ts', original: 'const x = 1;', modified: 'const x = 2;' },
  { path: '/src/utils.ts', original: 'function a() {}', modified: 'function b() {}' },
  { path: '/src/types.ts', original: 'type A = string;', modified: 'type A = number;' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Multi-File AI Editing Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    act(() => {
      useMultiFileAiStore.getState().reset();
    });
  });

  describe('session lifecycle', () => {
    it('should start a multi-file edit session', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      const state = useMultiFileAiStore.getState();
      expect(selectIsActive(state)).toBe(true);
      expect(selectSessionId(state)).toBe('session-1');
      expect(selectFileEdits(state)).toHaveLength(3);
    });

    it('should initialize all edits as pending', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      const state = useMultiFileAiStore.getState();
      const pending = selectPendingEdits(state);
      expect(pending).toHaveLength(3);
      expect(selectAppliedEdits(state)).toHaveLength(0);
      expect(selectRejectedEdits(state)).toHaveLength(0);
    });
  });

  describe('accept/reject per file', () => {
    it('should apply a single file edit', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      act(() => {
        useMultiFileAiStore.getState().applyEdit('/src/main.ts');
      });

      const state = useMultiFileAiStore.getState();
      const mainEdit = selectEditByPath('/src/main.ts')(state);
      expect(mainEdit?.status).toBe('applied');

      expect(selectAppliedEdits(state)).toHaveLength(1);
      expect(selectPendingEdits(state)).toHaveLength(2);
    });

    it('should reject a single file edit', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      act(() => {
        useMultiFileAiStore.getState().rejectEdit('/src/utils.ts');
      });

      const state = useMultiFileAiStore.getState();
      const utilsEdit = selectEditByPath('/src/utils.ts')(state);
      expect(utilsEdit?.status).toBe('rejected');

      expect(selectRejectedEdits(state)).toHaveLength(1);
      expect(selectPendingEdits(state)).toHaveLength(2);
    });

    it('should not re-apply an already applied edit', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      act(() => {
        useMultiFileAiStore.getState().applyEdit('/src/main.ts');
      });

      // Try to reject an already applied edit -- should remain applied
      act(() => {
        useMultiFileAiStore.getState().rejectEdit('/src/main.ts');
      });

      const state = useMultiFileAiStore.getState();
      expect(selectEditByPath('/src/main.ts')(state)?.status).toBe('applied');
    });

    it('should not re-reject an already rejected edit', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      act(() => {
        useMultiFileAiStore.getState().rejectEdit('/src/main.ts');
      });

      // Try to apply an already rejected edit -- should remain rejected
      act(() => {
        useMultiFileAiStore.getState().applyEdit('/src/main.ts');
      });

      const state = useMultiFileAiStore.getState();
      expect(selectEditByPath('/src/main.ts')(state)?.status).toBe('rejected');
    });
  });

  describe('bulk operations', () => {
    it('should apply all pending edits', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      act(() => {
        useMultiFileAiStore.getState().applyAll();
      });

      const state = useMultiFileAiStore.getState();
      expect(selectAppliedEdits(state)).toHaveLength(3);
      expect(selectPendingEdits(state)).toHaveLength(0);
    });

    it('should reject all pending edits', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      act(() => {
        useMultiFileAiStore.getState().rejectAll();
      });

      const state = useMultiFileAiStore.getState();
      expect(selectRejectedEdits(state)).toHaveLength(3);
      expect(selectPendingEdits(state)).toHaveLength(0);
    });

    it('should only apply remaining pending edits with applyAll', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      // Reject one first
      act(() => {
        useMultiFileAiStore.getState().rejectEdit('/src/main.ts');
      });

      // Apply all remaining
      act(() => {
        useMultiFileAiStore.getState().applyAll();
      });

      const state = useMultiFileAiStore.getState();
      expect(selectRejectedEdits(state)).toHaveLength(1);
      expect(selectAppliedEdits(state)).toHaveLength(2);
      expect(selectPendingEdits(state)).toHaveLength(0);
    });
  });

  describe('progress tracking', () => {
    it('should track progress correctly', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      let progress = selectProgress(useMultiFileAiStore.getState());
      expect(progress.total).toBe(3);
      expect(progress.pending).toBe(3);
      expect(progress.completed).toBe(0);

      act(() => {
        useMultiFileAiStore.getState().applyEdit('/src/main.ts');
      });

      progress = selectProgress(useMultiFileAiStore.getState());
      expect(progress.completed).toBe(1);
      expect(progress.pending).toBe(2);

      act(() => {
        useMultiFileAiStore.getState().rejectEdit('/src/utils.ts');
      });

      progress = selectProgress(useMultiFileAiStore.getState());
      expect(progress.completed).toBe(2);
      expect(progress.pending).toBe(1);
    });
  });

  describe('mixed accept/reject flow', () => {
    it('should handle interleaved accept and reject operations', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      // Accept main.ts
      act(() => {
        useMultiFileAiStore.getState().applyEdit('/src/main.ts');
      });

      // Reject utils.ts
      act(() => {
        useMultiFileAiStore.getState().rejectEdit('/src/utils.ts');
      });

      // Accept types.ts
      act(() => {
        useMultiFileAiStore.getState().applyEdit('/src/types.ts');
      });

      const state = useMultiFileAiStore.getState();

      expect(selectEditByPath('/src/main.ts')(state)?.status).toBe('applied');
      expect(selectEditByPath('/src/utils.ts')(state)?.status).toBe('rejected');
      expect(selectEditByPath('/src/types.ts')(state)?.status).toBe('applied');

      expect(selectAppliedEdits(state)).toHaveLength(2);
      expect(selectRejectedEdits(state)).toHaveLength(1);
      expect(selectPendingEdits(state)).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should reset all session state', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
        useMultiFileAiStore.getState().applyEdit('/src/main.ts');
      });

      act(() => {
        useMultiFileAiStore.getState().reset();
      });

      const state = useMultiFileAiStore.getState();
      expect(selectIsActive(state)).toBe(false);
      expect(selectSessionId(state)).toBeNull();
      expect(selectFileEdits(state)).toHaveLength(0);
    });
  });

  describe('edit content access', () => {
    it('should provide original and modified content per file', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      const state = useMultiFileAiStore.getState();
      const mainEdit = selectEditByPath('/src/main.ts')(state);

      expect(mainEdit?.original).toBe('const x = 1;');
      expect(mainEdit?.modified).toBe('const x = 2;');
    });

    it('should return undefined for unknown path', () => {
      act(() => {
        useMultiFileAiStore.getState().startMultiFileEdit('session-1', SAMPLE_EDITS);
      });

      const state = useMultiFileAiStore.getState();
      expect(selectEditByPath('/nonexistent.ts')(state)).toBeUndefined();
    });
  });
});
