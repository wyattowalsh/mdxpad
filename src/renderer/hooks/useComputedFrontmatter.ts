/**
 * useComputedFrontmatter Hook
 *
 * Auto-computes document metadata fields: wordCount, characterCount,
 * readingTime, and lastModified. Subscribes to document content changes
 * with debounce for performance.
 *
 * @module renderer/hooks/useComputedFrontmatter
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDocumentStore } from '../stores/document-store';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Computed frontmatter fields derived from document content.
 */
export interface ComputedFrontmatter {
  readonly wordCount: number;
  readonly characterCount: number;
  readonly readingTime: number;
  readonly lastModified: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Average words per minute for reading time estimation. */
const WORDS_PER_MINUTE = 200;

/** Debounce delay in ms for recomputation. */
const DEBOUNCE_MS = 300;

// =============================================================================
// PURE COMPUTATION FUNCTIONS (exported for testing)
// =============================================================================

/**
 * Count words in text content.
 * Handles edge cases: empty strings, multiple spaces, newlines.
 */
export function computeWordCount(content: string): number {
  const trimmed = content.trim();
  if (trimmed.length === 0) return 0;
  // Split on whitespace and filter empty strings
  return trimmed.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Count characters in text content (excluding leading/trailing whitespace).
 */
export function computeCharacterCount(content: string): number {
  return content.length;
}

/**
 * Estimate reading time in minutes based on word count.
 * Returns at least 1 minute for non-empty content.
 */
export function computeReadingTime(wordCount: number): number {
  if (wordCount === 0) return 0;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

/**
 * Get current ISO date string for lastModified.
 */
export function computeLastModified(): string {
  return new Date().toISOString();
}

/**
 * Compute all frontmatter fields from content.
 */
export function computeAllFields(content: string): ComputedFrontmatter {
  const wordCount = computeWordCount(content);
  return {
    wordCount,
    characterCount: computeCharacterCount(content),
    readingTime: computeReadingTime(wordCount),
    lastModified: computeLastModified(),
  };
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const INITIAL_COMPUTED: ComputedFrontmatter = {
  wordCount: 0,
  characterCount: 0,
  readingTime: 0,
  lastModified: '',
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook that computes frontmatter metadata from the current document content.
 * Debounces recomputation to avoid excessive calculations during typing.
 *
 * @returns Computed frontmatter fields
 *
 * @example
 * ```tsx
 * function StatusBar() {
 *   const { wordCount, readingTime } = useComputedFrontmatter();
 *   return <span>{wordCount} words ({readingTime} min read)</span>;
 * }
 * ```
 */
export function useComputedFrontmatter(): ComputedFrontmatter {
  const content = useDocumentStore((state) => state.content);
  const [computed, setComputed] = useState<ComputedFrontmatter>(INITIAL_COMPUTED);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const recompute = useCallback((text: string) => {
    setComputed(computeAllFields(text));
  }, []);

  useEffect(() => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      recompute(content);
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, recompute]);

  return computed;
}
