/**
 * CSS Injector Tests
 *
 * @module renderer/features/plugins/__tests__/css-injector.test
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  injectCss,
  updateCss,
  removeCss,
  removeAllCss,
  getInjectedIds,
  getInjectedCss,
} from '../css-injector';
import { getPreviewCss } from '../preview-css';

describe('css-injector', () => {
  afterEach(() => {
    removeAllCss();
  });

  describe('injectCss', () => {
    it('injects a style element into the document', () => {
      injectCss('test-1', 'body { color: red; }');

      const style = document.querySelector('[data-mdxpad-injected="test-1"]');
      expect(style).not.toBeNull();
      expect(style?.textContent).toBe('body { color: red; }');
    });

    it('keeps preview CSS when a different style is applied to the app', () => {
      injectCss('preview-css', 'p { color: red; }', 'preview');
      injectCss('mdxpad-theme', ':root { --cm-background: #111; }', 'app');

      expect(getPreviewCss()).toBe('p { color: red; }');
      expect(
        document.querySelector('[data-mdxpad-injected="mdxpad-theme"]')?.textContent
      ).toContain('--cm-background');
    });

    it('sends preview CSS to the preview document unchanged', () => {
      injectCss('test-scoped', '.content { font-size: 16px; }', 'preview');

      expect(document.querySelector('[data-mdxpad-injected="test-scoped"]')).toBeNull();
      expect(getPreviewCss()).toBe('.content { font-size: 16px; }');
      expect(getInjectedCss('test-scoped')).toBe('.content { font-size: 16px; }');

      removeCss('test-scoped');
      expect(getPreviewCss()).toBe('');
    });

    it('replaces existing injection with same ID', () => {
      injectCss('replace-test', 'body { color: red; }');
      injectCss('replace-test', 'body { color: blue; }');

      const styles = document.querySelectorAll('[data-mdxpad-injected="replace-test"]');
      expect(styles).toHaveLength(1);
      expect(styles[0]?.textContent).toBe('body { color: blue; }');
    });
  });

  describe('updateCss', () => {
    it('updates existing injection', () => {
      injectCss('update-test', 'body { color: red; }');
      updateCss('update-test', 'body { color: green; }');

      const style = document.querySelector('[data-mdxpad-injected="update-test"]');
      expect(style?.textContent).toBe('body { color: green; }');
    });

    it('creates new injection if not exists', () => {
      updateCss('new-update', 'body { color: purple; }');

      const style = document.querySelector('[data-mdxpad-injected="new-update"]');
      expect(style).not.toBeNull();
    });
  });

  describe('removeCss', () => {
    it('removes an injected style', () => {
      injectCss('remove-test', 'body { color: red; }');
      removeCss('remove-test');

      const style = document.querySelector('[data-mdxpad-injected="remove-test"]');
      expect(style).toBeNull();
    });

    it('is a no-op for non-existent ID', () => {
      removeCss('nonexistent');
      // Should not throw
    });
  });

  describe('removeAllCss', () => {
    it('removes all injected styles', () => {
      injectCss('all-1', 'body { color: red; }');
      injectCss('all-2', 'body { color: blue; }');

      removeAllCss();

      expect(getInjectedIds()).toHaveLength(0);
    });
  });

  describe('getInjectedIds', () => {
    it('returns all injected IDs', () => {
      injectCss('id-a', 'a {}');
      injectCss('id-b', 'b {}');

      const ids = getInjectedIds();
      expect(ids).toContain('id-a');
      expect(ids).toContain('id-b');
    });
  });

  describe('getInjectedCss', () => {
    it('returns CSS for an injected ID', () => {
      injectCss('css-get', 'body { margin: 0; }');
      const css = getInjectedCss('css-get');
      expect(css).toBe('body { margin: 0; }');
    });

    it('returns undefined for non-existent ID', () => {
      const css = getInjectedCss('nonexistent');
      expect(css).toBeUndefined();
    });
  });
});
