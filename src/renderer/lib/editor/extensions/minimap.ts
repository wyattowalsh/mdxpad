/**
 * Minimap Extension for CodeMirror
 *
 * Provides a scaled-down canvas overview of the document with
 * click-to-navigate and viewport highlight.
 *
 * @module renderer/lib/editor/extensions/minimap
 */

import { type Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

// =============================================================================
// Constants
// =============================================================================

/** Width of the minimap panel in pixels */
const MINIMAP_WIDTH = 80;

/** Scale factor for rendering text lines */
const LINE_HEIGHT_SCALE = 2;

/** Color for regular text lines */
const TEXT_COLOR = '#999999';

/** Color for the viewport indicator */
const VIEWPORT_COLOR = 'rgba(100, 149, 237, 0.2)';

/** Color for the viewport border */
const VIEWPORT_BORDER_COLOR = 'rgba(100, 149, 237, 0.5)';

// =============================================================================
// Theme
// =============================================================================

const minimapTheme = EditorView.baseTheme({
  '.cm-minimap-container': {
    position: 'absolute',
    right: '0',
    top: '0',
    bottom: '0',
    width: `${MINIMAP_WIDTH}px`,
    overflow: 'hidden',
    borderLeft: '1px solid rgba(128, 128, 128, 0.2)',
    cursor: 'pointer',
  },
  '.cm-minimap-canvas': {
    width: '100%',
    height: '100%',
  },
  '&.cm-editor': {
    position: 'relative',
  },
  /* Add padding for minimap */
  '& .cm-scroller': {
    paddingRight: `${MINIMAP_WIDTH + 4}px`,
  },
});

// =============================================================================
// Minimap Renderer
// =============================================================================

/**
 * Render the minimap canvas showing a scaled overview of the document.
 */
function renderMinimap(canvas: HTMLCanvasElement, view: EditorView): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { doc } = view.state;
  const totalLines = doc.lines;

  // Set canvas size to match container
  const container = canvas.parentElement;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * (globalThis.devicePixelRatio ?? 1);
  canvas.height = rect.height * (globalThis.devicePixelRatio ?? 1);
  ctx.scale(globalThis.devicePixelRatio ?? 1, globalThis.devicePixelRatio ?? 1);

  // Clear
  ctx.clearRect(0, 0, rect.width, rect.height);

  // Calculate scale so all lines fit
  const maxVisibleLines = Math.floor(rect.height / LINE_HEIGHT_SCALE);
  const scale = totalLines > maxVisibleLines ? maxVisibleLines / totalLines : 1;

  // Render text lines as thin bars
  ctx.fillStyle = TEXT_COLOR;
  for (let i = 1; i <= totalLines; i++) {
    const line = doc.line(i);
    const textLen = line.text.trimEnd().length;
    if (textLen === 0) continue;

    const y = (i - 1) * LINE_HEIGHT_SCALE * scale;
    const barWidth = Math.min((textLen / 80) * (rect.width - 4), rect.width - 4);

    ctx.globalAlpha = 0.4;
    ctx.fillRect(2, y, barWidth, Math.max(1, LINE_HEIGHT_SCALE * scale - 1));
  }

  // Render viewport indicator
  const scrollInfo = view.scrollDOM;
  const scrollTop = scrollInfo.scrollTop;
  const scrollHeight = scrollInfo.scrollHeight;
  const clientHeight = scrollInfo.clientHeight;

  if (scrollHeight > 0) {
    const vpTop = (scrollTop / scrollHeight) * rect.height;
    const vpHeight = (clientHeight / scrollHeight) * rect.height;

    ctx.globalAlpha = 1;
    ctx.fillStyle = VIEWPORT_COLOR;
    ctx.fillRect(0, vpTop, rect.width, vpHeight);
    ctx.strokeStyle = VIEWPORT_BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, vpTop + 0.5, rect.width - 1, vpHeight - 1);
  }

  ctx.globalAlpha = 1;
}

// =============================================================================
// View Plugin
// =============================================================================

const minimapPlugin = ViewPlugin.fromClass(
  class {
    container: HTMLDivElement;
    canvas: HTMLCanvasElement;
    private animFrameId = 0;

    constructor(readonly view: EditorView) {
      this.container = document.createElement('div');
      this.container.className = 'cm-minimap-container';

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'cm-minimap-canvas';
      this.container.appendChild(this.canvas);

      // Click to navigate
      this.container.addEventListener('click', this.handleClick);

      view.dom.appendChild(this.container);
      this.scheduleRender();
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged || update.geometryChanged) {
        this.scheduleRender();
      }
    }

    destroy(): void {
      cancelAnimationFrame(this.animFrameId);
      this.container.removeEventListener('click', this.handleClick);
      this.container.remove();
    }

    private scheduleRender(): void {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = requestAnimationFrame(() => {
        renderMinimap(this.canvas, this.view);
      });
    }

    private handleClick = (e: MouseEvent): void => {
      const rect = this.container.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const ratio = clickY / rect.height;

      const scrollHeight = this.view.scrollDOM.scrollHeight;
      const clientHeight = this.view.scrollDOM.clientHeight;
      const targetScroll = ratio * scrollHeight - clientHeight / 2;

      this.view.scrollDOM.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    };
  }
);

// =============================================================================
// Extension
// =============================================================================

/**
 * Minimap extension for CodeMirror.
 *
 * Renders a scaled-down canvas overview of the document with:
 * - Text lines shown as proportional bars
 * - Viewport indicator showing visible area
 * - Click to navigate to any position
 *
 * @returns CodeMirror Extension
 *
 * @example
 * ```typescript
 * import { minimapExtension } from './minimap';
 *
 * const view = new EditorView({
 *   extensions: [minimapExtension()],
 * });
 * ```
 */
export function minimapExtension(): Extension {
  return [minimapPlugin, minimapTheme];
}
