/**
 * Component Playground
 *
 * Live component preview panel with code editor, props editor,
 * and hot-reloading preview area. Allows experimenting with
 * JSX components in real-time.
 *
 * @module renderer/features/playground/ComponentPlayground
 */

import React, { useCallback, useEffect, useState } from 'react';

import { usePlaygroundStore, selectPropsValid } from './playground-store';
import { PlaygroundPreview } from './PlaygroundPreview';

// =============================================================================
// Component
// =============================================================================

/**
 * Component Playground panel with code editor, props input, and live preview.
 */
export const ComponentPlayground: React.FC = () => {
  const {
    code,
    propsJson,
    parsedProps,
    isRendering,
    renderError,
    autoRefresh,
    refreshDelayMs,
    setCode,
    setPropsJson,
    setIsRendering,
    setRenderError,
    toggleAutoRefresh,
    reset,
  } = usePlaygroundStore();

  const propsValid = usePlaygroundStore(selectPropsValid);
  const [previewCode, setPreviewCode] = useState(code);
  const [previewProps, setPreviewProps] = useState(parsedProps);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setPreviewCode(code);
      setPreviewProps(parsedProps);
    }, refreshDelayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [autoRefresh, code, parsedProps, refreshDelayMs]);

  const refreshPreview = useCallback(() => {
    setPreviewCode(code);
    setPreviewProps(parsedProps);
  }, [code, parsedProps]);

  const handleReset = useCallback(() => {
    reset();
    const next = usePlaygroundStore.getState();
    setPreviewCode(next.code);
    setPreviewProps(next.parsedProps);
  }, [reset]);

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCode(e.target.value);
    },
    [setCode]
  );

  const handlePropsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPropsJson(e.target.value);
    },
    [setPropsJson]
  );

  const handleRenderStart = useCallback(() => {
    setIsRendering(true);
  }, [setIsRendering]);

  const handleRenderEnd = useCallback(
    (error: string | null) => {
      setIsRendering(false);
      setRenderError(error);
    },
    [setIsRendering, setRenderError]
  );

  return (
    <div className="flex h-full flex-col bg-zinc-900 text-zinc-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
        <span className="text-xs font-medium text-zinc-400">Component Playground</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={toggleAutoRefresh}
              className="h-3 w-3"
            />
            Auto
          </label>
          <button
            type="button"
            onClick={refreshPreview}
            className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden border-b border-zinc-700">
          <div className="flex h-full flex-col">
            <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Component Code (JSX)
            </div>
            <textarea
              value={code}
              onChange={handleCodeChange}
              className="flex-1 resize-none bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 outline-none"
              spellCheck={false}
              placeholder="Enter JSX code..."
            />
          </div>
        </div>

        {/* Props Editor */}
        <div className="h-24 shrink-0 overflow-hidden border-b border-zinc-700">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Props (JSON)
              </span>
              {!propsValid && <span className="text-[10px] text-red-400">Invalid JSON</span>}
            </div>
            <textarea
              value={propsJson}
              onChange={handlePropsChange}
              className={`flex-1 resize-none bg-zinc-950 px-3 py-2 font-mono text-xs outline-none ${
                propsValid ? 'text-zinc-200' : 'text-red-300'
              }`}
              spellCheck={false}
              placeholder="{}"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Preview
            </span>
            {isRendering && <span className="text-[10px] text-blue-400">Rendering...</span>}
            {renderError && !isRendering && <span className="text-[10px] text-red-400">Error</span>}
          </div>
          <div className="px-3 pb-3">
            <PlaygroundPreview
              code={previewCode}
              props={previewProps}
              onRenderStart={handleRenderStart}
              onRenderEnd={handleRenderEnd}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

ComponentPlayground.displayName = 'ComponentPlayground';
