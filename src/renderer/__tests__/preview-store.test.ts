/**
 * Tests for preview store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  usePreviewStore,
  selectStatus,
  selectIsCompiling,
  selectIsError,
  selectIsSuccess,
  selectErrors,
  selectSuccessResult,
  selectRenderableContent,
  selectLastSuccessfulRender,
  selectScrollRatio,
} from '../stores/preview-store';
import type { CompileSuccess, CompileError } from '@shared/types/preview';

describe('usePreviewStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    usePreviewStore.getState().reset();
  });

  describe('initial state', () => {
    it('should start with idle status', () => {
      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('idle');
    });

    it('should start with null lastSuccessfulRender', () => {
      const state = usePreviewStore.getState();
      expect(state.lastSuccessfulRender).toBeNull();
    });

    it('should start with scrollRatio of 0', () => {
      const state = usePreviewStore.getState();
      expect(state.scrollRatio).toBe(0);
    });
  });

  describe('startCompiling', () => {
    it('should transition to compiling state', () => {
      usePreviewStore.getState().startCompiling();
      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('compiling');
    });

    it('should preserve lastSuccessfulRender when starting compilation', () => {
      const successResult: CompileSuccess = {
        ok: true,
        code: 'compiled code',
        frontmatter: { title: 'Test' },
      };

      usePreviewStore.getState().setSuccess(successResult);
      usePreviewStore.getState().startCompiling();

      const state = usePreviewStore.getState();
      expect(state.lastSuccessfulRender).toEqual(successResult);
    });
  });

  describe('setSuccess', () => {
    it('should transition to success state with result', () => {
      const successResult: CompileSuccess = {
        ok: true,
        code: 'compiled code',
        frontmatter: { title: 'Test' },
      };

      usePreviewStore.getState().setSuccess(successResult);
      const state = usePreviewStore.getState();

      expect(state.state.status).toBe('success');
      if (state.state.status === 'success') {
        expect(state.state.result).toEqual(successResult);
      }
    });

    it('should update lastSuccessfulRender', () => {
      const successResult: CompileSuccess = {
        ok: true,
        code: 'compiled code',
        frontmatter: { title: 'Test' },
      };

      usePreviewStore.getState().setSuccess(successResult);
      const state = usePreviewStore.getState();

      expect(state.lastSuccessfulRender).toEqual(successResult);
    });
  });

  describe('setError', () => {
    it('should transition to error state with errors', () => {
      const errors: CompileError[] = [
        { message: 'Syntax error', line: 5, column: 10 },
      ];

      usePreviewStore.getState().setError(errors);
      const state = usePreviewStore.getState();

      expect(state.state.status).toBe('error');
      if (state.state.status === 'error') {
        expect(state.state.errors).toEqual(errors);
      }
    });

    it('should preserve lastSuccessfulRender for error recovery', () => {
      const successResult: CompileSuccess = {
        ok: true,
        code: 'compiled code',
        frontmatter: {},
      };
      const errors: CompileError[] = [{ message: 'New syntax error' }];

      usePreviewStore.getState().setSuccess(successResult);
      usePreviewStore.getState().setError(errors);

      const state = usePreviewStore.getState();
      expect(state.lastSuccessfulRender).toEqual(successResult);
    });
  });

  describe('reset', () => {
    it('should reset state to idle', () => {
      usePreviewStore.getState().startCompiling();
      usePreviewStore.getState().reset();

      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('idle');
    });

    it('should clear lastSuccessfulRender', () => {
      const successResult: CompileSuccess = {
        ok: true,
        code: 'compiled code',
        frontmatter: {},
      };

      usePreviewStore.getState().setSuccess(successResult);
      usePreviewStore.getState().reset();

      const state = usePreviewStore.getState();
      expect(state.lastSuccessfulRender).toBeNull();
    });

    it('should reset scrollRatio to 0', () => {
      usePreviewStore.getState().setScrollRatio(0.5);
      usePreviewStore.getState().reset();

      const state = usePreviewStore.getState();
      expect(state.scrollRatio).toBe(0);
    });
  });

  describe('setScrollRatio', () => {
    it('should update scroll ratio', () => {
      usePreviewStore.getState().setScrollRatio(0.5);
      const state = usePreviewStore.getState();
      expect(state.scrollRatio).toBe(0.5);
    });

    it('should clamp ratio to minimum of 0', () => {
      usePreviewStore.getState().setScrollRatio(-0.5);
      const state = usePreviewStore.getState();
      expect(state.scrollRatio).toBe(0);
    });

    it('should clamp ratio to maximum of 1', () => {
      usePreviewStore.getState().setScrollRatio(1.5);
      const state = usePreviewStore.getState();
      expect(state.scrollRatio).toBe(1);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    usePreviewStore.getState().reset();
  });

  describe('selectStatus', () => {
    it('should return current status', () => {
      expect(selectStatus(usePreviewStore.getState())).toBe('idle');

      usePreviewStore.getState().startCompiling();
      expect(selectStatus(usePreviewStore.getState())).toBe('compiling');
    });
  });

  describe('selectIsCompiling', () => {
    it('should return true when compiling', () => {
      usePreviewStore.getState().startCompiling();
      expect(selectIsCompiling(usePreviewStore.getState())).toBe(true);
    });

    it('should return false when not compiling', () => {
      expect(selectIsCompiling(usePreviewStore.getState())).toBe(false);
    });
  });

  describe('selectIsError', () => {
    it('should return true when in error state', () => {
      usePreviewStore.getState().setError([{ message: 'error' }]);
      expect(selectIsError(usePreviewStore.getState())).toBe(true);
    });

    it('should return false when not in error state', () => {
      expect(selectIsError(usePreviewStore.getState())).toBe(false);
    });
  });

  describe('selectIsSuccess', () => {
    it('should return true when in success state', () => {
      usePreviewStore
        .getState()
        .setSuccess({ ok: true, code: '', frontmatter: {} });
      expect(selectIsSuccess(usePreviewStore.getState())).toBe(true);
    });

    it('should return false when not in success state', () => {
      expect(selectIsSuccess(usePreviewStore.getState())).toBe(false);
    });
  });

  describe('selectErrors', () => {
    it('should return errors when in error state', () => {
      const errors: CompileError[] = [{ message: 'error' }];
      usePreviewStore.getState().setError(errors);
      expect(selectErrors(usePreviewStore.getState())).toEqual(errors);
    });

    it('should return empty array when not in error state', () => {
      expect(selectErrors(usePreviewStore.getState())).toEqual([]);
    });
  });

  describe('selectSuccessResult', () => {
    it('should return result when in success state', () => {
      const result: CompileSuccess = { ok: true, code: 'code', frontmatter: {} };
      usePreviewStore.getState().setSuccess(result);
      expect(selectSuccessResult(usePreviewStore.getState())).toEqual(result);
    });

    it('should return null when not in success state', () => {
      expect(selectSuccessResult(usePreviewStore.getState())).toBeNull();
    });
  });

  describe('selectRenderableContent', () => {
    it('should return current success result when in success state', () => {
      const result: CompileSuccess = { ok: true, code: 'code', frontmatter: {} };
      usePreviewStore.getState().setSuccess(result);
      expect(selectRenderableContent(usePreviewStore.getState())).toEqual(
        result
      );
    });

    it('should return lastSuccessfulRender when in error state', () => {
      const result: CompileSuccess = { ok: true, code: 'code', frontmatter: {} };
      usePreviewStore.getState().setSuccess(result);
      usePreviewStore.getState().setError([{ message: 'error' }]);

      expect(selectRenderableContent(usePreviewStore.getState())).toEqual(
        result
      );
    });

    it('should return lastSuccessfulRender when compiling', () => {
      const result: CompileSuccess = { ok: true, code: 'code', frontmatter: {} };
      usePreviewStore.getState().setSuccess(result);
      usePreviewStore.getState().startCompiling();

      expect(selectRenderableContent(usePreviewStore.getState())).toEqual(
        result
      );
    });

    it('should return null when no successful render exists', () => {
      expect(selectRenderableContent(usePreviewStore.getState())).toBeNull();
    });
  });

  describe('selectLastSuccessfulRender', () => {
    it('should return last successful render', () => {
      const result: CompileSuccess = { ok: true, code: 'code', frontmatter: {} };
      usePreviewStore.getState().setSuccess(result);
      expect(selectLastSuccessfulRender(usePreviewStore.getState())).toEqual(
        result
      );
    });
  });

  describe('selectScrollRatio', () => {
    it('should return scroll ratio', () => {
      usePreviewStore.getState().setScrollRatio(0.75);
      expect(selectScrollRatio(usePreviewStore.getState())).toBe(0.75);
    });
  });
});
