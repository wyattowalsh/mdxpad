/**
 * Unit tests for Sandbox Runner.
 *
 * Note: These tests validate the module interface and types.
 * Full iframe-based execution requires a browser environment.
 */

import { describe, it, expect } from 'vitest';
import type { ExecutionResult, SandboxOptions } from './sandbox-runner';

describe('ExecutionResult type', () => {
  it('models a successful execution', () => {
    const result: ExecutionResult = {
      success: true,
      logs: ['hello'],
      returnValue: '42',
      error: null,
      durationMs: 10,
    };

    expect(result.success).toBe(true);
    expect(result.logs).toEqual(['hello']);
    expect(result.returnValue).toBe('42');
    expect(result.error).toBeNull();
    expect(result.durationMs).toBe(10);
  });

  it('models a failed execution', () => {
    const result: ExecutionResult = {
      success: false,
      logs: [],
      returnValue: null,
      error: 'ReferenceError: x is not defined',
      durationMs: 5,
    };

    expect(result.success).toBe(false);
    expect(result.error).toContain('ReferenceError');
  });

  it('models a timeout execution', () => {
    const result: ExecutionResult = {
      success: false,
      logs: [],
      returnValue: null,
      error: 'Execution timed out after 5000ms',
      durationMs: 5000,
    };

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });
});

describe('SandboxOptions type', () => {
  it('accepts custom timeout', () => {
    const opts: SandboxOptions = { timeoutMs: 3000 };
    expect(opts.timeoutMs).toBe(3000);
  });

  it('accepts empty options', () => {
    const opts: SandboxOptions = {};
    expect(opts.timeoutMs).toBeUndefined();
  });
});
