/**
 * Diagram Store
 *
 * Zustand + Immer store for managing diagram generation state.
 * Tracks natural language input, generated Mermaid code, and status.
 *
 * @module src/renderer/features/diagrams/diagram-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { editorDocumentKey } from '@renderer/lib/editor-document-key';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

// =============================================================================
// STATE
// =============================================================================

export type DiagramStatus = 'idle' | 'generating' | 'success' | 'error';

export interface DiagramState {
  description: string;
  mermaidCode: string;
  documentKey: string | null;
  status: DiagramStatus;
  error: string | null;
  history: { description: string; mermaidCode: string; timestamp: string }[];
}

export interface DiagramActions {
  setDescription: (description: string) => void;
  generate: () => Promise<void>;
  clearGenerated: () => void;
  clearError: () => void;
  reset: () => void;
}

export type DiagramStore = DiagramState & DiagramActions;

// =============================================================================
// INITIAL STATE
// =============================================================================

let diagramRequestId = 0;

const INITIAL_STATE: DiagramState = {
  description: '',
  mermaidCode: '',
  documentKey: null,
  status: 'idle',
  error: null,
  history: [],
};

// =============================================================================
// STORE
// =============================================================================

export const useDiagramStore = create<DiagramStore>()(
  immer((set, get) => ({
    ...INITIAL_STATE,

    setDescription: (description: string) => {
      set((draft) => {
        draft.description = description;
      });
    },

    generate: async () => {
      const description = get().description.trim();
      if (!description) return;
      const requestId = ++diagramRequestId;
      const documentKey = editorDocumentKey(
        useDocumentStore.getState().filePath,
        useTabStore.getState().activeTabId
      );

      if (typeof window === 'undefined' || !('mdxpad' in window)) {
        set((draft) => {
          draft.documentKey = documentKey;
          draft.status = 'error';
          draft.error = 'Diagram generation is not available';
        });
        return;
      }

      set((draft) => {
        draft.documentKey = documentKey;
        draft.status = 'generating';
        draft.error = null;
        draft.mermaidCode = '';
      });

      try {
        const response = await window.mdxpad.ai.generateText({
          prompt: description,
          systemPrompt: DIAGRAM_SYSTEM_PROMPT,
          temperature: 0.3,
        });
        if (requestId !== diagramRequestId) {
          return;
        }

        const mermaidCode =
          response.success && response.text ? extractMermaidCode(response.text) : '';
        if (!mermaidCode) {
          set((draft) => {
            draft.error = response.error?.message ?? 'The model did not return a diagram';
            draft.status = 'error';
          });
          return;
        }

        set((draft) => {
          draft.mermaidCode = mermaidCode;
          draft.status = 'success';
          draft.history.push({
            description,
            mermaidCode,
            timestamp: new Date().toISOString(),
          });
          if (draft.history.length > 20) {
            draft.history = draft.history.slice(-20);
          }
        });
      } catch (error) {
        if (requestId !== diagramRequestId) {
          return;
        }
        set((draft) => {
          draft.error = error instanceof Error ? error.message : 'Generation failed';
          draft.status = 'error';
        });
      }
    },

    clearGenerated: () => {
      set((draft) => {
        draft.mermaidCode = '';
        draft.documentKey = null;
        draft.status = 'idle';
      });
    },

    clearError: () => {
      set((draft) => {
        draft.error = null;
      });
    },

    reset: () => {
      diagramRequestId += 1;
      set(() => ({ ...INITIAL_STATE }));
    },
  }))
);

// =============================================================================
// HELPERS
// =============================================================================

const DIAGRAM_SYSTEM_PROMPT = `You are a Mermaid diagram generator. Given a natural language description, produce valid Mermaid diagram syntax. Rules:
1. Output ONLY the Mermaid code, wrapped in a \`\`\`mermaid code fence.
2. Use the most appropriate diagram type (flowchart, sequence, class, state, ER, gantt, pie, etc.).
3. Keep diagrams clean and readable.
4. Use descriptive labels for nodes and edges.
5. Do not include any explanation or commentary outside the code fence.`;

/**
 * Extracts Mermaid code from AI response text.
 * Handles both fenced code blocks and raw Mermaid syntax.
 */
export function extractMermaidCode(text: string): string {
  // Try to extract from ```mermaid code fence
  const fenceMatch = /```mermaid\s*\n([\s\S]*?)```/.exec(text);
  if (fenceMatch) {
    return (fenceMatch[1] ?? '').trim();
  }

  // Try to extract from generic code fence
  const genericMatch = /```\s*\n([\s\S]*?)```/.exec(text);
  if (genericMatch) {
    return (genericMatch[1] ?? '').trim();
  }

  // Return trimmed text as-is (might be raw Mermaid)
  return text.trim();
}

// =============================================================================
// SELECTORS
// =============================================================================

export const selectDescription = (s: DiagramStore): string => s.description;
export const selectMermaidCode = (s: DiagramStore): string => s.mermaidCode;
export const selectDiagramStatus = (s: DiagramStore): DiagramStatus => s.status;
export const selectDiagramError = (s: DiagramStore): string | null => s.error;
export const selectIsGenerating = (s: DiagramStore): boolean => s.status === 'generating';
