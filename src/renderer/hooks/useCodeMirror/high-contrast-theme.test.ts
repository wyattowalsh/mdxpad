import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';

import { buildExtensions } from './extensions';

function open(highContrast: boolean): EditorView {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const { extensions } = buildExtensions({ enableHighContrast: highContrast });
  return new EditorView({
    parent: host,
    state: EditorState.create({ doc: 'Hello', extensions }),
  });
}

function themeCss(view: EditorView): string {
  const themeClass = [...view.dom.classList].find((name) => name !== 'cm-editor');
  const css = Array.from(document.querySelectorAll('style'))
    .map((node) => node.textContent ?? '')
    .join('\n');
  if (!themeClass) {
    return '';
  }
  return css
    .split(new RegExp(`(?=\\.${themeClass}\\b)`))
    .filter((part) => part.startsWith(`.${themeClass}`))
    .join('\n');
}

describe('high contrast source editor', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.dom.parentElement?.remove();
      view.destroy();
    }
  });

  it('paints a black page and a yellow caret when the setting is on', () => {
    const view = open(true);
    views.push(view);
    expect(getComputedStyle(view.dom).backgroundColor).toBe('#000000');
    expect(getComputedStyle(view.dom).color).toBe('#ffffff');
    const css = themeCss(view);
    expect(css).toContain('caret-color: #ffff00');
    expect(css).toContain('border-left-color: #ffff00');
  });

  it('keeps the ordinary light page when the setting is off', () => {
    const view = open(false);
    views.push(view);
    expect(getComputedStyle(view.dom).backgroundColor).toBe('#ffffff');
    expect(themeCss(view)).toContain('caret-color: #000000');
  });
});
