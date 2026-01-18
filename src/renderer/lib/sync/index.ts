/**
 * Bidirectional Preview Sync Library
 *
 * Feature: 008-bidirectional-sync
 *
 * This module provides synchronization utilities for bidirectional
 * scrolling between the editor and preview panes.
 *
 * Exports:
 * - SYNC_CONSTANTS: Performance and timing constants
 * - SYNC_STORAGE_KEYS: LocalStorage keys for persistence
 * - SYNC_MODE_LABELS: Display labels for sync modes
 * - createScrollLock: Factory for scroll lock controllers (feedback loop prevention)
 * - createPositionCache: Factory for TTL-based position caching
 * - createPositionMapper: Factory for editor/preview position mapping
 *
 * @module renderer/lib/sync
 */

// Core constants and configuration
export { SYNC_CONSTANTS, SYNC_STORAGE_KEYS, SYNC_MODE_LABELS } from './constants';

// Scroll lock controller for preventing feedback loops
export * from './scroll-lock';

// Position caching for scroll state persistence
export * from './position-cache';

// Position mapping between editor lines and preview elements
export * from './position-mapper';
