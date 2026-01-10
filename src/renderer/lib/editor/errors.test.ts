/**
 * Unit tests for Editor Error Handling Utilities.
 * Tests structured error creation, logging, and type guards for the editor.
 */

import { describe, it, expect, vi } from 'vitest';
import { createEditorError, isSyntaxError, isCommandError, isExtensionError } from './errors';

describe('createEditorError', () => {
  it('creates error with all fields', () => {
    const error = createEditorError('syntax', 'Test error', { foo: 'bar' });
    expect(error.type).toBe('syntax');
    expect(error.message).toBe('Test error');
    expect(error.timestamp).toBeGreaterThan(0);
    expect(error.context).toEqual({ foo: 'bar' });
  });

  it('creates error without context', () => {
    const error = createEditorError('command', 'No context');
    expect(error.context).toBeUndefined();
  });

  it('logs to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createEditorError('extension', 'Logged error');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('type guards', () => {
  it('isSyntaxError returns true for syntax errors', () => {
    const error = createEditorError('syntax', 'test');
    expect(isSyntaxError(error)).toBe(true);
    expect(isCommandError(error)).toBe(false);
    expect(isExtensionError(error)).toBe(false);
  });

  it('isCommandError returns true for command errors', () => {
    const error = createEditorError('command', 'test');
    expect(isCommandError(error)).toBe(true);
    expect(isSyntaxError(error)).toBe(false);
    expect(isExtensionError(error)).toBe(false);
  });

  it('isExtensionError returns true for extension errors', () => {
    const error = createEditorError('extension', 'test');
    expect(isExtensionError(error)).toBe(true);
    expect(isSyntaxError(error)).toBe(false);
    expect(isCommandError(error)).toBe(false);
  });
});
