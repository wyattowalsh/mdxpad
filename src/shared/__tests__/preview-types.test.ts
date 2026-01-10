/**
 * Tests for preview type guards.
 * Validates type guards for preview-iframe and preview-worker message types.
 */

import { describe, it, expect } from 'vitest';

import {
  isParentToIframeMessage,
  isIframeToParentMessage,
  isRenderCommand,
  isThemeCommand,
  isScrollCommand,
  isReadySignal,
  isSizeSignal,
  isRuntimeErrorSignal,
  assertNever,
  type ParentToIframeMessage,
  type IframeToParentMessage,
  type RenderCommand,
  type ThemeCommand,
  type ScrollCommand,
  type ReadySignal,
  type SizeSignal,
  type RuntimeErrorSignal,
} from '../types/preview-iframe';

import {
  isCompileRequest,
  isCompileResponse,
  isCompileSuccess,
  isCompileFailure,
  isRequestId,
  createRequestId,
  assertNeverResponse,
  type CompileRequest,
  type CompileResponse,
  type CompileResponseSuccess,
  type CompileResponseFailure,
  type RequestId,
} from '../types/preview-worker';

// ============================================================================
// Test Fixtures
// ============================================================================

const validRenderCommand: RenderCommand = {
  type: 'render',
  code: 'console.log("hello")',
  frontmatter: { title: 'Test' },
};

const validThemeCommand: ThemeCommand = {
  type: 'theme',
  value: 'dark',
};

const validScrollCommand: ScrollCommand = {
  type: 'scroll',
  ratio: 0.5,
};

const validReadySignal: ReadySignal = {
  type: 'ready',
};

const validSizeSignal: SizeSignal = {
  type: 'size',
  height: 500,
};

const validRuntimeErrorSignal: RuntimeErrorSignal = {
  type: 'runtime-error',
  message: 'Component error',
  componentStack: 'at Component',
};

const validRuntimeErrorSignalMinimal: RuntimeErrorSignal = {
  type: 'runtime-error',
  message: 'Error without stack',
};

// Use a valid UUID v4 string cast as RequestId for test fixtures
const testRequestId = '550e8400-e29b-41d4-a716-446655440000' as RequestId;

const validCompileRequest: CompileRequest = {
  id: testRequestId,
  source: '# Hello MDX',
};

const validCompileSuccess: CompileResponseSuccess = {
  id: testRequestId,
  ok: true,
  code: 'function MDXContent() {}',
  frontmatter: { title: 'Test' },
};

const validCompileFailure: CompileResponseFailure = {
  id: testRequestId,
  ok: false,
  errors: [{ message: 'Syntax error', line: 1, column: 5 }],
};

// ============================================================================
// isParentToIframeMessage Tests
// ============================================================================

describe('isParentToIframeMessage', () => {
  describe('valid inputs', () => {
    it('returns true for RenderCommand', () => {
      expect(isParentToIframeMessage(validRenderCommand)).toBe(true);
    });

    it('returns true for ThemeCommand', () => {
      expect(isParentToIframeMessage(validThemeCommand)).toBe(true);
    });

    it('returns true for ScrollCommand', () => {
      expect(isParentToIframeMessage(validScrollCommand)).toBe(true);
    });

    it('returns true for minimal render command', () => {
      expect(isParentToIframeMessage({ type: 'render' })).toBe(true);
    });

    it('returns true for theme command with light value', () => {
      expect(isParentToIframeMessage({ type: 'theme', value: 'light' })).toBe(true);
    });
  });

  describe('invalid inputs - null and undefined', () => {
    it('returns false for null', () => {
      expect(isParentToIframeMessage(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isParentToIframeMessage(undefined)).toBe(false);
    });
  });

  describe('invalid inputs - wrong types', () => {
    it('returns false for string', () => {
      expect(isParentToIframeMessage('render')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isParentToIframeMessage(42)).toBe(false);
    });

    it('returns false for boolean', () => {
      expect(isParentToIframeMessage(true)).toBe(false);
    });

    it('returns false for array', () => {
      expect(isParentToIframeMessage([{ type: 'render' }])).toBe(false);
    });

    it('returns false for function', () => {
      expect(isParentToIframeMessage(() => {})).toBe(false);
    });
  });

  describe('invalid inputs - wrong object shapes', () => {
    it('returns false for empty object', () => {
      expect(isParentToIframeMessage({})).toBe(false);
    });

    it('returns false for object without type', () => {
      expect(isParentToIframeMessage({ code: 'test' })).toBe(false);
    });

    it('returns false for object with wrong type value', () => {
      expect(isParentToIframeMessage({ type: 'unknown' })).toBe(false);
    });

    it('returns false for object with numeric type', () => {
      expect(isParentToIframeMessage({ type: 1 })).toBe(false);
    });

    it('returns false for iframe-to-parent message types', () => {
      expect(isParentToIframeMessage({ type: 'ready' })).toBe(false);
      expect(isParentToIframeMessage({ type: 'size' })).toBe(false);
      expect(isParentToIframeMessage({ type: 'runtime-error' })).toBe(false);
    });
  });
});

// ============================================================================
// isIframeToParentMessage Tests
// ============================================================================

describe('isIframeToParentMessage', () => {
  describe('valid inputs', () => {
    it('returns true for ReadySignal', () => {
      expect(isIframeToParentMessage(validReadySignal)).toBe(true);
    });

    it('returns true for SizeSignal', () => {
      expect(isIframeToParentMessage(validSizeSignal)).toBe(true);
    });

    it('returns true for RuntimeErrorSignal with componentStack', () => {
      expect(isIframeToParentMessage(validRuntimeErrorSignal)).toBe(true);
    });

    it('returns true for RuntimeErrorSignal without componentStack', () => {
      expect(isIframeToParentMessage(validRuntimeErrorSignalMinimal)).toBe(true);
    });

    it('returns true for minimal signals', () => {
      expect(isIframeToParentMessage({ type: 'ready' })).toBe(true);
      expect(isIframeToParentMessage({ type: 'size' })).toBe(true);
      expect(isIframeToParentMessage({ type: 'runtime-error' })).toBe(true);
    });
  });

  describe('invalid inputs - null and undefined', () => {
    it('returns false for null', () => {
      expect(isIframeToParentMessage(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isIframeToParentMessage(undefined)).toBe(false);
    });
  });

  describe('invalid inputs - wrong types', () => {
    it('returns false for string', () => {
      expect(isIframeToParentMessage('ready')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isIframeToParentMessage(123)).toBe(false);
    });

    it('returns false for boolean', () => {
      expect(isIframeToParentMessage(false)).toBe(false);
    });

    it('returns false for array', () => {
      expect(isIframeToParentMessage([{ type: 'ready' }])).toBe(false);
    });
  });

  describe('invalid inputs - wrong object shapes', () => {
    it('returns false for empty object', () => {
      expect(isIframeToParentMessage({})).toBe(false);
    });

    it('returns false for object without type', () => {
      expect(isIframeToParentMessage({ height: 500 })).toBe(false);
    });

    it('returns false for object with wrong type value', () => {
      expect(isIframeToParentMessage({ type: 'invalid' })).toBe(false);
    });

    it('returns false for parent-to-iframe message types', () => {
      expect(isIframeToParentMessage({ type: 'render' })).toBe(false);
      expect(isIframeToParentMessage({ type: 'theme' })).toBe(false);
      expect(isIframeToParentMessage({ type: 'scroll' })).toBe(false);
    });
  });
});

// ============================================================================
// isRenderCommand Tests
// ============================================================================

describe('isRenderCommand', () => {
  it('returns true for render command', () => {
    expect(isRenderCommand(validRenderCommand)).toBe(true);
  });

  it('returns false for theme command', () => {
    expect(isRenderCommand(validThemeCommand)).toBe(false);
  });

  it('returns false for scroll command', () => {
    expect(isRenderCommand(validScrollCommand)).toBe(false);
  });
});

// ============================================================================
// isThemeCommand Tests
// ============================================================================

describe('isThemeCommand', () => {
  it('returns true for theme command', () => {
    expect(isThemeCommand(validThemeCommand)).toBe(true);
  });

  it('returns true for theme command with light value', () => {
    const lightTheme: ThemeCommand = { type: 'theme', value: 'light' };
    expect(isThemeCommand(lightTheme)).toBe(true);
  });

  it('returns false for render command', () => {
    expect(isThemeCommand(validRenderCommand)).toBe(false);
  });

  it('returns false for scroll command', () => {
    expect(isThemeCommand(validScrollCommand)).toBe(false);
  });
});

// ============================================================================
// isScrollCommand Tests
// ============================================================================

describe('isScrollCommand', () => {
  it('returns true for scroll command', () => {
    expect(isScrollCommand(validScrollCommand)).toBe(true);
  });

  it('returns true for scroll command at 0', () => {
    const scrollStart: ScrollCommand = { type: 'scroll', ratio: 0 };
    expect(isScrollCommand(scrollStart)).toBe(true);
  });

  it('returns true for scroll command at 1', () => {
    const scrollEnd: ScrollCommand = { type: 'scroll', ratio: 1 };
    expect(isScrollCommand(scrollEnd)).toBe(true);
  });

  it('returns false for render command', () => {
    expect(isScrollCommand(validRenderCommand)).toBe(false);
  });

  it('returns false for theme command', () => {
    expect(isScrollCommand(validThemeCommand)).toBe(false);
  });
});

// ============================================================================
// isReadySignal Tests
// ============================================================================

describe('isReadySignal', () => {
  it('returns true for ready signal', () => {
    expect(isReadySignal(validReadySignal)).toBe(true);
  });

  it('returns false for size signal', () => {
    expect(isReadySignal(validSizeSignal)).toBe(false);
  });

  it('returns false for runtime error signal', () => {
    expect(isReadySignal(validRuntimeErrorSignal)).toBe(false);
  });
});

// ============================================================================
// isSizeSignal Tests
// ============================================================================

describe('isSizeSignal', () => {
  it('returns true for size signal', () => {
    expect(isSizeSignal(validSizeSignal)).toBe(true);
  });

  it('returns true for size signal with zero height', () => {
    const zeroHeight: SizeSignal = { type: 'size', height: 0 };
    expect(isSizeSignal(zeroHeight)).toBe(true);
  });

  it('returns false for ready signal', () => {
    expect(isSizeSignal(validReadySignal)).toBe(false);
  });

  it('returns false for runtime error signal', () => {
    expect(isSizeSignal(validRuntimeErrorSignal)).toBe(false);
  });
});

// ============================================================================
// isRuntimeErrorSignal Tests
// ============================================================================

describe('isRuntimeErrorSignal', () => {
  it('returns true for runtime error signal with componentStack', () => {
    expect(isRuntimeErrorSignal(validRuntimeErrorSignal)).toBe(true);
  });

  it('returns true for runtime error signal without componentStack', () => {
    expect(isRuntimeErrorSignal(validRuntimeErrorSignalMinimal)).toBe(true);
  });

  it('returns false for ready signal', () => {
    expect(isRuntimeErrorSignal(validReadySignal)).toBe(false);
  });

  it('returns false for size signal', () => {
    expect(isRuntimeErrorSignal(validSizeSignal)).toBe(false);
  });
});

// ============================================================================
// isCompileRequest Tests
// ============================================================================

describe('isCompileRequest', () => {
  describe('valid inputs', () => {
    it('returns true for valid compile request', () => {
      expect(isCompileRequest(validCompileRequest)).toBe(true);
    });

    it('returns true for minimal valid compile request', () => {
      // Use valid UUID v4 format for id (required by branded RequestId type)
      expect(isCompileRequest({ id: testRequestId, source: '' })).toBe(true);
    });

    it('returns true for request with extra properties', () => {
      expect(isCompileRequest({ id: testRequestId, source: 'test', extra: 'ignored' })).toBe(true);
    });

    it('returns false for non-UUID id string', () => {
      // The branded RequestId type requires valid UUID v4 format
      expect(isCompileRequest({ id: 'abc', source: 'test' })).toBe(false);
    });

    it('returns false for empty string id', () => {
      expect(isCompileRequest({ id: '', source: 'test' })).toBe(false);
    });
  });

  describe('invalid inputs - null and undefined', () => {
    it('returns false for null', () => {
      expect(isCompileRequest(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isCompileRequest(undefined)).toBe(false);
    });
  });

  describe('invalid inputs - wrong types', () => {
    it('returns false for string', () => {
      expect(isCompileRequest('test')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isCompileRequest(42)).toBe(false);
    });

    it('returns false for boolean', () => {
      expect(isCompileRequest(true)).toBe(false);
    });

    it('returns false for array', () => {
      expect(isCompileRequest([validCompileRequest])).toBe(false);
    });
  });

  describe('invalid inputs - partial objects', () => {
    it('returns false for empty object', () => {
      expect(isCompileRequest({})).toBe(false);
    });

    it('returns false for object with only id', () => {
      expect(isCompileRequest({ id: 'test' })).toBe(false);
    });

    it('returns false for object with only source', () => {
      expect(isCompileRequest({ source: 'test' })).toBe(false);
    });

    it('returns false for object with non-string id', () => {
      expect(isCompileRequest({ id: 123, source: 'test' })).toBe(false);
    });

    it('returns false for object with non-string source', () => {
      expect(isCompileRequest({ id: 'test', source: 123 })).toBe(false);
    });

    it('returns false for object with null id', () => {
      expect(isCompileRequest({ id: null, source: 'test' })).toBe(false);
    });

    it('returns false for object with undefined source', () => {
      expect(isCompileRequest({ id: 'test', source: undefined })).toBe(false);
    });
  });
});

// ============================================================================
// isCompileResponse Tests
// ============================================================================

describe('isCompileResponse', () => {
  describe('valid inputs', () => {
    it('returns true for success response', () => {
      expect(isCompileResponse(validCompileSuccess)).toBe(true);
    });

    it('returns true for failure response', () => {
      expect(isCompileResponse(validCompileFailure)).toBe(true);
    });

    it('returns true for minimal success response', () => {
      // Use valid UUID v4 format for id (required by branded RequestId type)
      expect(isCompileResponse({ id: testRequestId, ok: true })).toBe(true);
    });

    it('returns true for minimal failure response', () => {
      expect(isCompileResponse({ id: testRequestId, ok: false })).toBe(true);
    });

    it('returns false for non-UUID id in response', () => {
      // The branded RequestId type requires valid UUID v4 format
      expect(isCompileResponse({ id: 'test', ok: true })).toBe(false);
    });
  });

  describe('invalid inputs - null and undefined', () => {
    it('returns false for null', () => {
      expect(isCompileResponse(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isCompileResponse(undefined)).toBe(false);
    });
  });

  describe('invalid inputs - wrong types', () => {
    it('returns false for string', () => {
      expect(isCompileResponse('success')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isCompileResponse(1)).toBe(false);
    });

    it('returns false for boolean', () => {
      expect(isCompileResponse(true)).toBe(false);
    });

    it('returns false for array', () => {
      expect(isCompileResponse([validCompileSuccess])).toBe(false);
    });
  });

  describe('invalid inputs - partial objects', () => {
    it('returns false for empty object', () => {
      expect(isCompileResponse({})).toBe(false);
    });

    it('returns false for object with only id', () => {
      expect(isCompileResponse({ id: 'test' })).toBe(false);
    });

    it('returns false for object with only ok', () => {
      expect(isCompileResponse({ ok: true })).toBe(false);
    });

    it('returns false for object with non-string id', () => {
      expect(isCompileResponse({ id: 123, ok: true })).toBe(false);
    });

    it('returns false for object with non-boolean ok', () => {
      expect(isCompileResponse({ id: 'test', ok: 'true' })).toBe(false);
    });

    it('returns false for object with null id', () => {
      expect(isCompileResponse({ id: null, ok: true })).toBe(false);
    });

    it('returns false for object with undefined ok', () => {
      expect(isCompileResponse({ id: 'test', ok: undefined })).toBe(false);
    });
  });
});

// ============================================================================
// isCompileSuccess Tests
// ============================================================================

describe('isCompileSuccess', () => {
  it('returns true for success response', () => {
    expect(isCompileSuccess(validCompileSuccess)).toBe(true);
  });

  it('returns false for failure response', () => {
    expect(isCompileFailure(validCompileSuccess)).toBe(false);
  });

  it('correctly narrows type', () => {
    const response: CompileResponse = validCompileSuccess;
    if (isCompileSuccess(response)) {
      // TypeScript should allow access to success-only properties
      expect(response.code).toBe('function MDXContent() {}');
      expect(response.frontmatter).toEqual({ title: 'Test' });
    }
  });
});

// ============================================================================
// isCompileFailure Tests
// ============================================================================

describe('isCompileFailure', () => {
  it('returns true for failure response', () => {
    expect(isCompileFailure(validCompileFailure)).toBe(true);
  });

  it('returns false for success response', () => {
    expect(isCompileFailure(validCompileSuccess)).toBe(false);
  });

  it('correctly narrows type', () => {
    const response: CompileResponse = validCompileFailure;
    if (isCompileFailure(response)) {
      // TypeScript should allow access to failure-only properties
      expect(response.errors).toHaveLength(1);
      const firstError = response.errors[0];
      expect(firstError).toBeDefined();
      expect(firstError!.message).toBe('Syntax error');
    }
  });
});

// ============================================================================
// assertNever Tests
// ============================================================================

describe('assertNever', () => {
  it('throws TypeError with default message', () => {
    // We need to bypass TypeScript's never check for testing
    const unexpectedValue = 'unexpected' as never;
    expect(() => assertNever(unexpectedValue)).toThrow(TypeError);
    expect(() => assertNever(unexpectedValue)).toThrow(
      'Unhandled discriminated union member: "unexpected"'
    );
  });

  it('throws TypeError with custom message', () => {
    const unexpectedValue = { type: 'invalid' } as never;
    expect(() => assertNever(unexpectedValue, 'Custom error message')).toThrow(TypeError);
    expect(() => assertNever(unexpectedValue, 'Custom error message')).toThrow(
      'Custom error message'
    );
  });

  it('includes JSON representation of complex objects', () => {
    const complexObject = { type: 'complex', nested: { data: 123 } } as never;
    expect(() => assertNever(complexObject)).toThrow(
      'Unhandled discriminated union member: {"type":"complex","nested":{"data":123}}'
    );
  });

  it('handles null value in error message', () => {
    const nullValue = null as never;
    expect(() => assertNever(nullValue)).toThrow('Unhandled discriminated union member: null');
  });

  it('handles numeric value in error message', () => {
    const numericValue = 42 as never;
    expect(() => assertNever(numericValue)).toThrow('Unhandled discriminated union member: 42');
  });
});

// ============================================================================
// assertNeverResponse Tests
// ============================================================================

describe('assertNeverResponse', () => {
  it('throws TypeError with default message', () => {
    const unexpectedValue = { id: 'test', ok: 'maybe' } as never;
    expect(() => assertNeverResponse(unexpectedValue)).toThrow(TypeError);
    expect(() => assertNeverResponse(unexpectedValue)).toThrow(
      'Unhandled CompileResponse variant: {"id":"test","ok":"maybe"}'
    );
  });

  it('throws TypeError with custom message', () => {
    const unexpectedValue = { id: 'test' } as never;
    expect(() => assertNeverResponse(unexpectedValue, 'Custom worker error')).toThrow(TypeError);
    expect(() => assertNeverResponse(unexpectedValue, 'Custom worker error')).toThrow(
      'Custom worker error'
    );
  });
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

describe('Edge Cases', () => {
  describe('inherited properties behavior', () => {
    // Note: The current implementation reads properties from the prototype chain.
    // These tests document the current behavior.
    it('isParentToIframeMessage reads inherited type property', () => {
      const objWithInheritedType = Object.create({ type: 'render' });
      expect(isParentToIframeMessage(objWithInheritedType)).toBe(true);
    });

    it('isIframeToParentMessage reads inherited type property', () => {
      const objWithInheritedType = Object.create({ type: 'ready' });
      expect(isIframeToParentMessage(objWithInheritedType)).toBe(true);
    });

    it('isCompileRequest reads inherited properties', () => {
      const objWithInheritedProps = Object.create({ id: '550e8400-e29b-41d4-a716-446655440000', source: 'code' });
      expect(isCompileRequest(objWithInheritedProps)).toBe(true);
    });

    it('isCompileResponse reads inherited properties', () => {
      const objWithInheritedProps = Object.create({ id: '550e8400-e29b-41d4-a716-446655440000', ok: true });
      expect(isCompileResponse(objWithInheritedProps)).toBe(true);
    });
  });

  describe('special object types', () => {
    it('type guards handle Date objects', () => {
      expect(isParentToIframeMessage(new Date())).toBe(false);
      expect(isIframeToParentMessage(new Date())).toBe(false);
      expect(isCompileRequest(new Date())).toBe(false);
      expect(isCompileResponse(new Date())).toBe(false);
    });

    it('type guards handle RegExp objects', () => {
      expect(isParentToIframeMessage(/test/)).toBe(false);
      expect(isIframeToParentMessage(/test/)).toBe(false);
      expect(isCompileRequest(/test/)).toBe(false);
      expect(isCompileResponse(/test/)).toBe(false);
    });

    it('type guards handle Error objects', () => {
      expect(isParentToIframeMessage(new Error('test'))).toBe(false);
      expect(isIframeToParentMessage(new Error('test'))).toBe(false);
      expect(isCompileRequest(new Error('test'))).toBe(false);
      expect(isCompileResponse(new Error('test'))).toBe(false);
    });
  });

  describe('discriminated union exhaustiveness', () => {
    it('all ParentToIframeMessage types are handled', () => {
      const messages: ParentToIframeMessage[] = [
        validRenderCommand,
        validThemeCommand,
        validScrollCommand,
      ];

      for (const msg of messages) {
        const handled =
          isRenderCommand(msg) || isThemeCommand(msg) || isScrollCommand(msg);
        expect(handled).toBe(true);
      }
    });

    it('all IframeToParentMessage types are handled', () => {
      const signals: IframeToParentMessage[] = [
        validReadySignal,
        validSizeSignal,
        validRuntimeErrorSignal,
      ];

      for (const sig of signals) {
        const handled =
          isReadySignal(sig) || isSizeSignal(sig) || isRuntimeErrorSignal(sig);
        expect(handled).toBe(true);
      }
    });

    it('all CompileResponse types are handled', () => {
      const responses: CompileResponse[] = [validCompileSuccess, validCompileFailure];

      for (const res of responses) {
        const handled = isCompileSuccess(res) || isCompileFailure(res);
        expect(handled).toBe(true);
      }
    });
  });
});

// ============================================================================
// RequestId Branded Type Tests
// ============================================================================

describe('isRequestId', () => {
  describe('valid UUIDs', () => {
    it('returns true for valid UUID v4 lowercase', () => {
      expect(isRequestId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('returns true for valid UUID v4 uppercase', () => {
      expect(isRequestId('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('returns true for valid UUID v4 mixed case', () => {
      expect(isRequestId('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
    });

    it('returns true for UUID with variant bits 8, 9, a, or b', () => {
      expect(isRequestId('550e8400-e29b-41d4-8716-446655440000')).toBe(true);
      expect(isRequestId('550e8400-e29b-41d4-9716-446655440000')).toBe(true);
      expect(isRequestId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isRequestId('550e8400-e29b-41d4-b716-446655440000')).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('returns false for non-string values', () => {
      expect(isRequestId(null)).toBe(false);
      expect(isRequestId(undefined)).toBe(false);
      expect(isRequestId(123)).toBe(false);
      expect(isRequestId({})).toBe(false);
      expect(isRequestId([])).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isRequestId('')).toBe(false);
    });

    it('returns false for arbitrary string', () => {
      expect(isRequestId('test-id')).toBe(false);
      expect(isRequestId('random-string')).toBe(false);
    });

    it('returns false for UUID with wrong version (not 4)', () => {
      // Version 1 UUID (time-based)
      expect(isRequestId('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
      // Version 3 UUID (MD5 hash)
      expect(isRequestId('550e8400-e29b-31d4-a716-446655440000')).toBe(false);
      // Version 5 UUID (SHA-1 hash)
      expect(isRequestId('550e8400-e29b-51d4-a716-446655440000')).toBe(false);
    });

    it('returns false for UUID with wrong variant', () => {
      // Variant 0 (NCS backward compatibility)
      expect(isRequestId('550e8400-e29b-41d4-0716-446655440000')).toBe(false);
      // Variant c-f (reserved)
      expect(isRequestId('550e8400-e29b-41d4-c716-446655440000')).toBe(false);
      expect(isRequestId('550e8400-e29b-41d4-d716-446655440000')).toBe(false);
    });

    it('returns false for malformed UUIDs', () => {
      // Missing hyphens
      expect(isRequestId('550e8400e29b41d4a716446655440000')).toBe(false);
      // Too short
      expect(isRequestId('550e8400-e29b-41d4-a716-44665544000')).toBe(false);
      // Too long
      expect(isRequestId('550e8400-e29b-41d4-a716-4466554400000')).toBe(false);
      // Invalid characters
      expect(isRequestId('550g8400-e29b-41d4-a716-446655440000')).toBe(false);
    });
  });
});

describe('createRequestId', () => {
  it('returns a valid RequestId', () => {
    const id = createRequestId();
    expect(isRequestId(id)).toBe(true);
  });

  it('returns unique IDs on each call', () => {
    const id1 = createRequestId();
    const id2 = createRequestId();
    const id3 = createRequestId();
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it('returns IDs that match UUID v4 format', () => {
    const id = createRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
