/**
 * Diagram Dialog
 *
 * Dialog UI for generating Mermaid diagrams from natural language.
 * Shows a text input, generate button, Mermaid preview, and insert button.
 *
 * @module src/renderer/features/diagrams/DiagramDialog
 */

import React, { useCallback, useRef } from 'react';
import {
  useDiagramStore,
  selectDescription,
  selectMermaidCode,
  selectDiagramStatus,
  selectDiagramError,
  selectIsGenerating,
} from './diagram-store';

// =============================================================================
// PROPS
// =============================================================================

interface DiagramDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (mermaidCode: string) => void;
}

// =============================================================================
// MERMAID PREVIEW
// =============================================================================

function MermaidPreview({ code }: { code: string }) {
  if (!code) return null;

  return (
    <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Preview</span>
      </div>
      <pre className="overflow-auto rounded bg-gray-50 p-3 text-xs dark:bg-gray-800">{code}</pre>
    </div>
  );
}

// =============================================================================
// DIALOG
// =============================================================================

export function DiagramDialog({ isOpen, onClose, onInsert }: DiagramDialogProps) {
  const description = useDiagramStore(selectDescription);
  const mermaidCode = useDiagramStore(selectMermaidCode);
  const status = useDiagramStore(selectDiagramStatus);
  const error = useDiagramStore(selectDiagramError);
  const isGenerating = useDiagramStore(selectIsGenerating);
  const { setDescription, generate, clearGenerated } = useDiagramStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleGenerate = useCallback(() => {
    void generate();
  }, [generate]);

  const handleInsert = useCallback(() => {
    if (mermaidCode) {
      const fenced = `\`\`\`mermaid\n${mermaidCode}\n\`\`\``;
      onInsert(fenced);
      clearGenerated();
      onClose();
    }
  }, [mermaidCode, onInsert, clearGenerated, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleGenerate();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleGenerate, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-gray-900"
        role="dialog"
        aria-label="Generate Diagram"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-700">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Generate Diagram</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-4">
          {/* Description Input */}
          <div>
            <label
              htmlFor="diagram-description"
              className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              Describe the diagram
            </label>
            <textarea
              id="diagram-description"
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., A flowchart showing user login authentication flow with OAuth2..."
              rows={3}
              className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-400">Press Cmd+Enter to generate</p>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !description.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate Diagram'}
          </button>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Preview */}
          {status === 'success' && <MermaidPreview code={mermaidCode} />}

          {/* Insert Button */}
          {mermaidCode && (
            <button
              type="button"
              onClick={handleInsert}
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
            >
              Insert into Document
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
