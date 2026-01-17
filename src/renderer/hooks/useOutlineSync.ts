/**
 * useOutlineSync Hook
 *
 * Synchronizes the outline store with the preview store by subscribing
 * to AST changes. When a successful compilation occurs with an outline AST,
 * it updates the outline store.
 *
 * @module renderer/hooks/useOutlineSync
 */

import { useEffect } from 'react';
import { usePreviewStore, selectOutlineAST, selectIsCompiling } from '@renderer/stores/preview-store';
import { useOutlineStore } from '@renderer/stores/outline-store';

/**
 * Hook that synchronizes the outline store with AST from preview store.
 *
 * This hook subscribes to the preview store and automatically updates
 * the outline store when:
 * 1. A successful compilation produces a new outline AST
 * 2. The outline AST changes
 *
 * During compilation, it sets isParsing to true.
 * After compilation, it either updates with new AST or sets a parse error.
 *
 * @example
 * ```tsx
 * function App() {
 *   useOutlineSync();
 *   return <OutlinePanel />;
 * }
 * ```
 */
export function useOutlineSync(): void {
  const outlineAST = usePreviewStore(selectOutlineAST);
  const isCompiling = usePreviewStore(selectIsCompiling);
  const { updateFromAST, setIsParsing, setParseError } = useOutlineStore();

  // Track compilation state
  useEffect(() => {
    setIsParsing(isCompiling);
  }, [isCompiling, setIsParsing]);

  // Update outline when AST changes
  useEffect(() => {
    if (outlineAST) {
      updateFromAST(outlineAST);
    }
  }, [outlineAST, updateFromAST]);
}

export default useOutlineSync;
