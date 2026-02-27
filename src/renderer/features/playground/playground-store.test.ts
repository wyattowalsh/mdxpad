/**
 * Unit tests for Playground Store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  usePlaygroundStore,
  selectPropsValid,
  selectHasContent,
  parsePropsJson,
  DEFAULT_CODE,
  DEFAULT_PROPS_JSON,
} from './playground-store';

describe('parsePropsJson', () => {
  it('parses valid JSON object', () => {
    const result = parsePropsJson('{"name": "test"}');
    expect(result).toEqual({ name: 'test' });
  });

  it('returns empty object for empty string', () => {
    const result = parsePropsJson('');
    expect(result).toEqual({});
  });

  it('returns empty object for whitespace-only string', () => {
    const result = parsePropsJson('   ');
    expect(result).toEqual({});
  });

  it('returns null for invalid JSON', () => {
    const result = parsePropsJson('{invalid}');
    expect(result).toBeNull();
  });

  it('returns null for JSON array', () => {
    const result = parsePropsJson('[1, 2, 3]');
    expect(result).toBeNull();
  });

  it('returns null for JSON string', () => {
    const result = parsePropsJson('"hello"');
    expect(result).toBeNull();
  });

  it('returns null for JSON number', () => {
    const result = parsePropsJson('42');
    expect(result).toBeNull();
  });

  it('parses nested objects', () => {
    const result = parsePropsJson('{"nested": {"key": "value"}}');
    expect(result).toEqual({ nested: { key: 'value' } });
  });

  it('parses empty object', () => {
    const result = parsePropsJson('{}');
    expect(result).toEqual({});
  });
});

describe('usePlaygroundStore', () => {
  beforeEach(() => {
    usePlaygroundStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = usePlaygroundStore.getState();
    expect(state.code).toBe(DEFAULT_CODE);
    expect(state.propsJson).toBe(DEFAULT_PROPS_JSON);
    expect(state.parsedProps).toEqual({});
    expect(state.isRendering).toBe(false);
    expect(state.renderError).toBeNull();
    expect(state.isOpen).toBe(false);
    expect(state.autoRefresh).toBe(true);
  });

  describe('setCode', () => {
    it('updates code', () => {
      usePlaygroundStore.getState().setCode('<div>test</div>');
      expect(usePlaygroundStore.getState().code).toBe('<div>test</div>');
    });

    it('clears render error on code change', () => {
      usePlaygroundStore.getState().setRenderError('some error');
      usePlaygroundStore.getState().setCode('new code');
      expect(usePlaygroundStore.getState().renderError).toBeNull();
    });
  });

  describe('setPropsJson', () => {
    it('updates propsJson and parsedProps for valid JSON', () => {
      usePlaygroundStore.getState().setPropsJson('{"key": "value"}');
      const state = usePlaygroundStore.getState();
      expect(state.propsJson).toBe('{"key": "value"}');
      expect(state.parsedProps).toEqual({ key: 'value' });
    });

    it('sets parsedProps to null for invalid JSON', () => {
      usePlaygroundStore.getState().setPropsJson('not json');
      const state = usePlaygroundStore.getState();
      expect(state.propsJson).toBe('not json');
      expect(state.parsedProps).toBeNull();
    });
  });

  describe('setIsRendering', () => {
    it('sets rendering state', () => {
      usePlaygroundStore.getState().setIsRendering(true);
      expect(usePlaygroundStore.getState().isRendering).toBe(true);
    });
  });

  describe('setRenderError', () => {
    it('sets error message', () => {
      usePlaygroundStore.getState().setRenderError('render failed');
      expect(usePlaygroundStore.getState().renderError).toBe('render failed');
    });

    it('clears error with null', () => {
      usePlaygroundStore.getState().setRenderError('error');
      usePlaygroundStore.getState().setRenderError(null);
      expect(usePlaygroundStore.getState().renderError).toBeNull();
    });
  });

  describe('toggleOpen', () => {
    it('toggles isOpen from false to true', () => {
      usePlaygroundStore.getState().toggleOpen();
      expect(usePlaygroundStore.getState().isOpen).toBe(true);
    });

    it('toggles isOpen from true to false', () => {
      usePlaygroundStore.getState().open();
      usePlaygroundStore.getState().toggleOpen();
      expect(usePlaygroundStore.getState().isOpen).toBe(false);
    });
  });

  describe('open/close', () => {
    it('opens the playground', () => {
      usePlaygroundStore.getState().open();
      expect(usePlaygroundStore.getState().isOpen).toBe(true);
    });

    it('closes the playground', () => {
      usePlaygroundStore.getState().open();
      usePlaygroundStore.getState().close();
      expect(usePlaygroundStore.getState().isOpen).toBe(false);
    });
  });

  describe('toggleAutoRefresh', () => {
    it('toggles autoRefresh', () => {
      usePlaygroundStore.getState().toggleAutoRefresh();
      expect(usePlaygroundStore.getState().autoRefresh).toBe(false);
      usePlaygroundStore.getState().toggleAutoRefresh();
      expect(usePlaygroundStore.getState().autoRefresh).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets to default state', () => {
      usePlaygroundStore.getState().setCode('custom code');
      usePlaygroundStore.getState().setPropsJson('{"a":1}');
      usePlaygroundStore.getState().setIsRendering(true);
      usePlaygroundStore.getState().setRenderError('err');

      usePlaygroundStore.getState().reset();

      const state = usePlaygroundStore.getState();
      expect(state.code).toBe(DEFAULT_CODE);
      expect(state.propsJson).toBe(DEFAULT_PROPS_JSON);
      expect(state.parsedProps).toEqual({});
      expect(state.isRendering).toBe(false);
      expect(state.renderError).toBeNull();
      expect(state.autoRefresh).toBe(true);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    usePlaygroundStore.getState().reset();
  });

  describe('selectPropsValid', () => {
    it('returns true for valid props', () => {
      expect(selectPropsValid(usePlaygroundStore.getState())).toBe(true);
    });

    it('returns false for invalid props', () => {
      usePlaygroundStore.getState().setPropsJson('invalid');
      expect(selectPropsValid(usePlaygroundStore.getState())).toBe(false);
    });
  });

  describe('selectHasContent', () => {
    it('returns true when code has content', () => {
      expect(selectHasContent(usePlaygroundStore.getState())).toBe(true);
    });

    it('returns false when code is empty', () => {
      usePlaygroundStore.getState().setCode('');
      expect(selectHasContent(usePlaygroundStore.getState())).toBe(false);
    });

    it('returns false when code is whitespace', () => {
      usePlaygroundStore.getState().setCode('   \n  ');
      expect(selectHasContent(usePlaygroundStore.getState())).toBe(false);
    });
  });
});
