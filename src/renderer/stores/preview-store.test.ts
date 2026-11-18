/**
 * Tests for Preview Store.
 *
 * Tests preview state machine (idle -> compiling -> success | error)
 * and error recovery with last successful render caching.
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
  selectOutlineAST,
  selectIsStale,
} from './preview-store';
import type { CompileSuccess, CompileError } from '@shared/types/preview';

const INITIAL_STATE = {
  state: { status: 'idle' as const },
  lastSuccessfulRender: null,
  lastSuccessfulRenderAt: null,
  lastSuccessfulDocumentKey: null,
  scrollRatio: 0,
};

function createMockSuccess(): CompileSuccess {
  return {
    ok: true,
    code: 'export default () => <div>Hello</div>',
    frontmatter: {},
    outline: {
      headings: [],
      components: [],
      frontmatter: null,
    },
  };
}

function createMockError(): CompileError {
  return {
    message: 'Syntax error',
    line: 5,
    column: 10,
  };
}

describe('usePreviewStore', () => {
  beforeEach(() => {
    usePreviewStore.setState(INITIAL_STATE);
  });

  describe('initial state', () => {
    it('should start in idle state', () => {
      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('idle');
      expect(state.lastSuccessfulRender).toBeNull();
      expect(state.scrollRatio).toBe(0);
    });
  });

  describe('startCompiling', () => {
    it('should transition to compiling state', () => {
      usePreviewStore.getState().startCompiling();
      expect(usePreviewStore.getState().state.status).toBe('compiling');
    });

    it('should clear previous state', () => {
      usePreviewStore.setState({ state: { status: 'error', errors: [createMockError()] } });
      usePreviewStore.getState().startCompiling();
      expect(usePreviewStore.getState().state.status).toBe('compiling');
    });
  });

  describe('setSuccess', () => {
    it('should transition to success state', () => {
      const result = createMockSuccess();
      usePreviewStore.getState().setSuccess(result);

      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('success');
      if (state.state.status === 'success') {
        expect(state.state.result).toBe(result);
      }
    });

    it('should cache last successful render', () => {
      const result = createMockSuccess();
      usePreviewStore.getState().setSuccess(result);

      expect(usePreviewStore.getState().lastSuccessfulRender).toBe(result);
    });

    it('should update last successful render timestamp', () => {
      const before = Date.now();
      usePreviewStore.getState().setSuccess(createMockSuccess());
      const after = Date.now();

      const timestamp = usePreviewStore.getState().lastSuccessfulRenderAt;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should replace previous successful render', () => {
      const result1 = createMockSuccess();
      const result2 = { ...createMockSuccess(), code: 'different code' };

      usePreviewStore.getState().setSuccess(result1);
      usePreviewStore.getState().setSuccess(result2);

      expect(usePreviewStore.getState().lastSuccessfulRender).toBe(result2);
    });
  });

  describe('setError', () => {
    it('should transition to error state', () => {
      const errors = [createMockError()];
      usePreviewStore.getState().setError(errors);

      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('error');
      if (state.state.status === 'error') {
        expect(state.state.errors).toEqual(errors);
      }
    });

    it('remembers which document failed to compile', () => {
      usePreviewStore.getState().setError([createMockError()], '/docs/a.md');
      expect(usePreviewStore.getState().errorDocumentKey).toBe('/docs/a.md');

      usePreviewStore.getState().setError([createMockError()], '/docs/b.md');
      expect(usePreviewStore.getState().errorDocumentKey).toBe('/docs/b.md');
    });

    it('should preserve last successful render for recovery', () => {
      const success = createMockSuccess();
      usePreviewStore.getState().setSuccess(success);
      usePreviewStore.getState().setError([createMockError()]);

      expect(usePreviewStore.getState().lastSuccessfulRender).toBe(success);
    });

    it('should handle multiple errors', () => {
      const errors = [createMockError(), { message: 'Another error', line: 10, column: 5 }];
      usePreviewStore.getState().setError(errors);

      const state = usePreviewStore.getState();
      if (state.state.status === 'error') {
        expect(state.state.errors).toHaveLength(2);
      }
    });
  });

  describe('reset', () => {
    it('should return to initial state', () => {
      usePreviewStore.getState().setSuccess(createMockSuccess());
      usePreviewStore.getState().setScrollRatio(0.5);
      usePreviewStore.getState().reset();

      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('idle');
      expect(state.lastSuccessfulRender).toBeNull();
      expect(state.lastSuccessfulRenderAt).toBeNull();
      expect(state.scrollRatio).toBe(0);
    });
  });

  describe('setScrollRatio', () => {
    it('should update scroll ratio', () => {
      usePreviewStore.getState().setScrollRatio(0.5);
      expect(usePreviewStore.getState().scrollRatio).toBe(0.5);
    });

    it('should clamp ratio to [0, 1]', () => {
      usePreviewStore.getState().setScrollRatio(1.5);
      expect(usePreviewStore.getState().scrollRatio).toBe(1);

      usePreviewStore.getState().setScrollRatio(-0.5);
      expect(usePreviewStore.getState().scrollRatio).toBe(0);
    });
  });

  describe('state machine transitions', () => {
    it('should handle idle -> compiling -> success', () => {
      expect(usePreviewStore.getState().state.status).toBe('idle');

      usePreviewStore.getState().startCompiling();
      expect(usePreviewStore.getState().state.status).toBe('compiling');

      usePreviewStore.getState().setSuccess(createMockSuccess());
      expect(usePreviewStore.getState().state.status).toBe('success');
    });

    it('should handle idle -> compiling -> error', () => {
      expect(usePreviewStore.getState().state.status).toBe('idle');

      usePreviewStore.getState().startCompiling();
      expect(usePreviewStore.getState().state.status).toBe('compiling');

      usePreviewStore.getState().setError([createMockError()]);
      expect(usePreviewStore.getState().state.status).toBe('error');
    });

    it('should handle error recovery', () => {
      const success = createMockSuccess();
      usePreviewStore.getState().setSuccess(success);
      usePreviewStore.getState().setError([createMockError()]);

      expect(selectRenderableContent(usePreviewStore.getState())).toBe(success);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    usePreviewStore.setState(INITIAL_STATE);
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
      usePreviewStore.getState().setError([createMockError()]);
      expect(selectIsError(usePreviewStore.getState())).toBe(true);
    });
  });

  describe('selectIsSuccess', () => {
    it('should return true when in success state', () => {
      usePreviewStore.getState().setSuccess(createMockSuccess());
      expect(selectIsSuccess(usePreviewStore.getState())).toBe(true);
    });
  });

  describe('selectErrors', () => {
    it('should return errors when in error state', () => {
      const errors = [createMockError()];
      usePreviewStore.getState().setError(errors);
      expect(selectErrors(usePreviewStore.getState())).toEqual(errors);
    });

    it('should return empty array when not in error state', () => {
      expect(selectErrors(usePreviewStore.getState())).toEqual([]);
    });
  });

  describe('selectSuccessResult', () => {
    it('should return result when in success state', () => {
      const result = createMockSuccess();
      usePreviewStore.getState().setSuccess(result);
      expect(selectSuccessResult(usePreviewStore.getState())).toBe(result);
    });

    it('should return null when not in success state', () => {
      expect(selectSuccessResult(usePreviewStore.getState())).toBeNull();
    });
  });

  describe('selectRenderableContent', () => {
    it('should return current success result', () => {
      const result = createMockSuccess();
      usePreviewStore.getState().setSuccess(result);
      expect(selectRenderableContent(usePreviewStore.getState())).toBe(result);
    });

    it('should fallback to last successful render on error', () => {
      const result = createMockSuccess();
      usePreviewStore.getState().setSuccess(result);
      usePreviewStore.getState().setError([createMockError()]);
      expect(selectRenderableContent(usePreviewStore.getState())).toBe(result);
    });
  });

  describe('selectOutlineAST', () => {
    it('should return outline from success result', () => {
      const result = createMockSuccess();
      usePreviewStore.getState().setSuccess(result);
      expect(selectOutlineAST(usePreviewStore.getState())).toBe(result.outline);
    });

    it('should return null when state is error even with cached success', () => {
      const result = createMockSuccess();
      usePreviewStore.getState().setSuccess(result);
      usePreviewStore.getState().setError([createMockError()]);

      expect(selectOutlineAST(usePreviewStore.getState())).toBeNull();
    });
  });

  describe('selectIsStale', () => {
    it('should return false for recent render', () => {
      usePreviewStore.getState().setSuccess(createMockSuccess());
      expect(selectIsStale(usePreviewStore.getState())).toBe(false);
    });

    it('should return true for old render', () => {
      usePreviewStore.setState({
        ...INITIAL_STATE,
        lastSuccessfulRenderAt: Date.now() - 40000, // 40 seconds ago
      });
      expect(selectIsStale(usePreviewStore.getState())).toBe(true);
    });
  });
});
