/**
 * useTextStats Hook
 *
 * Subscribes to document store content and computes text statistics
 * with debouncing for performance.
 *
 * @module renderer/hooks/useTextStats
 */

import { useMemo } from 'react';
import { useDocumentStore } from '@renderer/stores/document-store';
import { countWords, countCharacters, estimateReadingTime } from '@renderer/lib/text-stats';

export interface TextStats {
  readonly wordCount: number;
  readonly charCount: number;
  readonly readingTime: { readonly minutes: number; readonly seconds: number };
}

/**
 * Hook that computes text statistics from the current document content.
 * Derives word count, character count, and reading time from the document store.
 *
 * @returns Text statistics object
 */
export function useTextStats(): TextStats {
  const content = useDocumentStore((state) => state.content);

  return useMemo(() => {
    const wordCount = countWords(content);
    const charCount = countCharacters(content);
    const readingTime = estimateReadingTime(content);
    return { wordCount, charCount, readingTime };
  }, [content]);
}
