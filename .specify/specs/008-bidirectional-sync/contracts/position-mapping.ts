/**
 * Position Mapping Contracts
 *
 * Feature: 008-bidirectional-sync
 * Type definitions for editor ↔ preview position mapping.
 */

import { z } from 'zod';
import type { PositionMapping, MappingConfidence } from './sync-store';

// =============================================================================
// AST-Based Mapping
// =============================================================================

/**
 * Source position from AST node.
 */
export interface ASTSourcePosition {
  /** Line number (1-indexed) */
  readonly line: number;

  /** Column number (1-indexed) */
  readonly column: number;
}

/**
 * Heading node with source position.
 */
export interface HeadingWithPosition {
  /** Heading depth (1-6) */
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6;

  /** Heading text content */
  readonly text: string;

  /** Source position in editor */
  readonly position: ASTSourcePosition;
}

/**
 * Component node with source position.
 */
export interface ComponentWithPosition {
  /** Component name */
  readonly name: string;

  /** Source position in editor */
  readonly position: ASTSourcePosition;
}

/**
 * Line mapping from AST data.
 */
export interface ASTLineMapping {
  /** Editor line number (1-indexed) */
  readonly editorLine: number;

  /** Type of AST node at this line */
  readonly nodeType: 'heading' | 'component' | 'frontmatter';

  /** Additional metadata (heading depth, component name) */
  readonly metadata?: string;
}

// =============================================================================
// Position Cache
// =============================================================================

/**
 * Cache entry with TTL.
 */
export interface CacheEntry<T> {
  /** Cached value */
  readonly value: T;

  /** When this entry was created */
  readonly timestamp: number;

  /** Time-to-live in milliseconds */
  readonly ttl: number;
}

/**
 * Position cache interface.
 */
export interface PositionCache {
  /** Get cached position for editor line */
  readonly get: (editorLine: number) => PositionMapping | null;

  /** Set cached position for editor line */
  readonly set: (editorLine: number, mapping: PositionMapping) => void;

  /** Check if entry exists and is valid */
  readonly has: (editorLine: number) => boolean;

  /** Invalidate specific entry */
  readonly invalidate: (editorLine: number) => void;

  /** Clear all entries */
  readonly clear: () => void;

  /** Get cache size */
  readonly size: () => number;

  /** Get all entries (for debugging) */
  readonly entries: () => ReadonlyMap<number, PositionMapping>;
}

/**
 * Options for position cache.
 */
export interface PositionCacheOptions {
  /** Time-to-live for entries in milliseconds */
  readonly ttl: number;

  /** Maximum number of entries (LRU eviction) */
  readonly maxSize?: number;

  /** Callback when entry expires */
  readonly onExpire?: (line: number, mapping: PositionMapping) => void;
}

// =============================================================================
// Position Mapper
// =============================================================================

/**
 * Position mapper interface.
 */
export interface PositionMapper {
  /**
   * Map editor line to preview scroll position.
   * Uses three-tier strategy: AST → DOM → Proportional
   */
  readonly editorToPreview: (editorLine: number) => PositionMapping;

  /**
   * Map preview scroll position to editor line.
   */
  readonly previewToEditor: (scrollTop: number) => PositionMapping;

  /**
   * Update AST data for mapping.
   */
  readonly updateAST: (headings: readonly HeadingWithPosition[]) => void;

  /**
   * Update preview scroll height.
   */
  readonly updatePreviewHeight: (scrollHeight: number, clientHeight: number) => void;

  /**
   * Update editor total lines.
   */
  readonly updateEditorLines: (totalLines: number) => void;

  /**
   * Clear all mappings (on document change).
   */
  readonly reset: () => void;
}

/**
 * Options for position mapper.
 */
export interface PositionMapperOptions {
  /** Cache for position mappings */
  readonly cache: PositionCache;

  /** Tolerance for position matching (lines) */
  readonly tolerance: number;
}

/**
 * Default tolerance for position matching.
 */
export const DEFAULT_POSITION_TOLERANCE = 5;

// =============================================================================
// Mapping Strategies
// =============================================================================

/**
 * Strategy for position mapping.
 */
export type MappingStrategy = 'ast' | 'dom' | 'proportional';

/**
 * Mapping strategy result.
 */
export interface MappingStrategyResult {
  /** Strategy used */
  readonly strategy: MappingStrategy;

  /** Resulting position mapping */
  readonly mapping: PositionMapping;

  /** Whether this is a fallback result */
  readonly isFallback: boolean;
}

/**
 * AST mapping strategy.
 * Uses source positions from MDX compilation.
 */
export interface ASTMappingStrategy {
  /** Find mapping for editor line from AST */
  readonly findMapping: (
    line: number,
    headings: readonly HeadingWithPosition[]
  ) => PositionMapping | null;

  /** Confidence level for this strategy */
  readonly confidence: MappingConfidence;
}

/**
 * DOM mapping strategy.
 * Uses data-line attributes on preview elements.
 */
export interface DOMMappingStrategy {
  /** Query preview DOM for line mapping */
  readonly findMapping: (
    line: number,
    previewDocument: Document
  ) => PositionMapping | null;

  /** Confidence level for this strategy */
  readonly confidence: MappingConfidence;
}

/**
 * Proportional mapping strategy.
 * Uses scroll ratio as fallback.
 */
export interface ProportionalMappingStrategy {
  /** Calculate proportional mapping */
  readonly calculateMapping: (
    line: number,
    totalLines: number,
    scrollHeight: number
  ) => PositionMapping;

  /** Confidence level for this strategy */
  readonly confidence: MappingConfidence;
}

// =============================================================================
// Scroll Ratio Utilities
// =============================================================================

/**
 * Calculate scroll ratio from line position.
 */
export type CalculateRatio = (
  line: number,
  totalLines: number
) => number;

/**
 * Calculate line from scroll ratio.
 */
export type CalculateLine = (
  ratio: number,
  totalLines: number
) => number;

/**
 * Clamp value to range.
 */
export type ClampValue = (
  value: number,
  min: number,
  max: number
) => number;

// =============================================================================
// Schemas
// =============================================================================

export const ASTSourcePositionSchema = z.object({
  line: z.number().int().min(1),
  column: z.number().int().min(1),
});

export const HeadingWithPositionSchema = z.object({
  depth: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  text: z.string(),
  position: ASTSourcePositionSchema,
});

export const ComponentWithPositionSchema = z.object({
  name: z.string().min(1),
  position: ASTSourcePositionSchema,
});

// =============================================================================
// Helper Functions (Type Signatures)
// =============================================================================

/**
 * Build line-to-heading map from AST.
 */
export type BuildLineMap = (
  headings: readonly HeadingWithPosition[]
) => ReadonlyMap<number, HeadingWithPosition>;

/**
 * Find nearest heading for a given line.
 */
export type FindNearestHeading = (
  line: number,
  lineMap: ReadonlyMap<number, HeadingWithPosition>,
  tolerance: number
) => HeadingWithPosition | null;

/**
 * Estimate preview position from heading.
 * Requires preview DOM access.
 */
export type EstimatePreviewPosition = (
  heading: HeadingWithPosition,
  previewDocument: Document
) => number | null;

/**
 * Calculate proportional scroll position.
 */
export type CalculateProportionalPosition = (
  line: number,
  totalLines: number,
  scrollHeight: number,
  clientHeight: number
) => number;
