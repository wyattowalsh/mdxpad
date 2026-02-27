/**
 * CssEditorDialog Component
 *
 * Dialog for editing and injecting custom CSS.
 * Provides a textarea for CSS input with live preview support.
 *
 * @module renderer/features/plugins/CssEditorDialog
 */

import { useCallback, useEffect, useState } from 'react';

import { injectCss, removeCss, getInjectedCss } from './css-injector';

// ============================================================================
// Constants
// ============================================================================

const CUSTOM_CSS_ID = 'user-custom-css';
const STORAGE_KEY = 'mdxpad:custom-css';

// ============================================================================
// Types
// ============================================================================

interface CssEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type CssScope = 'app' | 'preview';

// ============================================================================
// Component
// ============================================================================

export function CssEditorDialog({ isOpen, onClose }: CssEditorDialogProps) {
  const [css, setCss] = useState('');
  const [scope, setScope] = useState<CssScope>('preview');
  const [livePreview, setLivePreview] = useState(true);

  // Load saved CSS on mount
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setCss(saved);
      } else {
        const existing = getInjectedCss(CUSTOM_CSS_ID);
        if (existing) {
          setCss(existing);
        }
      }
    }
  }, [isOpen]);

  // Live preview
  useEffect(() => {
    if (livePreview && css.trim()) {
      injectCss(CUSTOM_CSS_ID, css, scope);
    }
  }, [css, scope, livePreview]);

  const handleApply = useCallback(() => {
    if (css.trim()) {
      injectCss(CUSTOM_CSS_ID, css, scope);
      localStorage.setItem(STORAGE_KEY, css);
    } else {
      removeCss(CUSTOM_CSS_ID);
      localStorage.removeItem(STORAGE_KEY);
    }
    onClose();
  }, [css, scope, onClose]);

  const handleClear = useCallback(() => {
    setCss('');
    removeCss(CUSTOM_CSS_ID);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const handleCancel = useCallback(() => {
    // Revert live preview changes
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      injectCss(CUSTOM_CSS_ID, saved, scope);
    } else {
      removeCss(CUSTOM_CSS_ID);
    }
    onClose();
  }, [scope, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Custom CSS</h2>
          <button
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={handleCancel}
          >
            Close
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span>Scope:</span>
            <select
              className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
              value={scope}
              onChange={(e) => setScope(e.target.value as CssScope)}
            >
              <option value="preview">Preview Pane</option>
              <option value="app">Full App</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={livePreview}
              onChange={(e) => setLivePreview(e.target.checked)}
              className="rounded"
            />
            <span>Live preview</span>
          </label>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden px-6 py-4">
          <textarea
            className="w-full h-full min-h-[300px] font-mono text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={css}
            onChange={(e) => setCss(e.target.value)}
            placeholder="/* Enter your custom CSS here */&#10;&#10;.preview-container {&#10;  font-family: 'Georgia', serif;&#10;}"
            spellCheck={false}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
            onClick={handleClear}
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
