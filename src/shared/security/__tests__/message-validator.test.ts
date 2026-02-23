/**
 * Tests for Message Validator
 *
 * Covers Zod-based postMessage validation, size limits, schema enforcement,
 * error message sanitization in runtime-error messages, and the secure
 * message handler integration.
 *
 * @module shared/security/__tests__/message-validator.test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  validateParentToIframeMessage,
  validateIframeToParentMessage,
  createSecureMessageHandler,
} from '../message-validator';
import { SECURITY_CONSTANTS } from '../constants';
import { createRateLimiter } from '../rate-limiter';

describe('validateParentToIframeMessage', () => {
  describe('render command', () => {
    it('should accept valid render command', () => {
      const result = validateParentToIframeMessage({
        type: 'render',
        code: 'console.log("hello")',
        frontmatter: { title: 'Test' },
      });
      expect(result.valid).toBe(true);
      expect(result.data?.type).toBe('render');
    });

    it('should accept render command with empty frontmatter', () => {
      const result = validateParentToIframeMessage({
        type: 'render',
        code: '',
        frontmatter: {},
      });
      expect(result.valid).toBe(true);
    });

    it('should reject render command with unknown top-level keys', () => {
      const result = validateParentToIframeMessage({
        type: 'render',
        code: 'console.log("hello")',
        frontmatter: { title: 'Test' },
        injected: 'malicious',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message failed schema validation');
    });

    it('should allow dynamic frontmatter keys while keeping envelope strict', () => {
      const result = validateParentToIframeMessage({
        type: 'render',
        code: 'console.log("hello")',
        frontmatter: {
          title: 'Test',
          nested: { level: 2 },
          tags: ['a', 'b'],
          customFlag: true,
        },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('theme command', () => {
    it('should accept valid light theme', () => {
      const result = validateParentToIframeMessage({
        type: 'theme',
        value: 'light',
      });
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ type: 'theme', value: 'light' });
    });

    it('should accept valid dark theme', () => {
      const result = validateParentToIframeMessage({
        type: 'theme',
        value: 'dark',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid theme value', () => {
      const result = validateParentToIframeMessage({
        type: 'theme',
        value: 'sepia',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message failed schema validation');
    });
  });

  describe('scroll command', () => {
    it('should accept valid scroll command', () => {
      const result = validateParentToIframeMessage({
        type: 'scroll',
        ratio: 0.5,
      });
      expect(result.valid).toBe(true);
    });

    it('should accept ratio at boundary 0', () => {
      const result = validateParentToIframeMessage({
        type: 'scroll',
        ratio: 0,
      });
      expect(result.valid).toBe(true);
    });

    it('should accept ratio at boundary 1', () => {
      const result = validateParentToIframeMessage({
        type: 'scroll',
        ratio: 1,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject ratio below 0', () => {
      const result = validateParentToIframeMessage({
        type: 'scroll',
        ratio: -0.1,
      });
      expect(result.valid).toBe(false);
    });

    it('should reject ratio above 1', () => {
      const result = validateParentToIframeMessage({
        type: 'scroll',
        ratio: 1.1,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('invalid messages', () => {
    it('should reject null', () => {
      const result = validateParentToIframeMessage(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message must be a non-null object');
    });

    it('should reject undefined', () => {
      const result = validateParentToIframeMessage(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message must be a non-null object');
    });

    it('should reject primitives', () => {
      expect(validateParentToIframeMessage('string').valid).toBe(false);
      expect(validateParentToIframeMessage(42).valid).toBe(false);
      expect(validateParentToIframeMessage(true).valid).toBe(false);
    });

    it('should reject empty object', () => {
      const result = validateParentToIframeMessage({});
      expect(result.valid).toBe(false);
    });

    it('should reject unknown message type', () => {
      const result = validateParentToIframeMessage({
        type: 'unknown-type',
        data: 'something',
      });
      expect(result.valid).toBe(false);
    });

    it('should reject message missing required fields', () => {
      const result = validateParentToIframeMessage({
        type: 'render',
        // missing code and frontmatter
      });
      expect(result.valid).toBe(false);
    });

    it('should reject circular references', () => {
      const obj: Record<string, unknown> = { type: 'render' };
      obj.self = obj;
      const result = validateParentToIframeMessage(obj);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message is not JSON-serializable');
    });
  });

  describe('size limits', () => {
    it('should reject messages exceeding max size', () => {
      const largeMessage = {
        type: 'render',
        code: 'x'.repeat(SECURITY_CONSTANTS.maxMessageSize + 1),
        frontmatter: {},
      };
      const result = validateParentToIframeMessage(largeMessage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum size');
    });

    it('should accept messages within size limit', () => {
      const result = validateParentToIframeMessage({
        type: 'render',
        code: 'x'.repeat(1000),
        frontmatter: {},
      });
      expect(result.valid).toBe(true);
    });
  });
});

describe('validateIframeToParentMessage', () => {
  describe('ready signal', () => {
    it('should accept valid ready signal', () => {
      const result = validateIframeToParentMessage({ type: 'ready' });
      expect(result.valid).toBe(true);
      expect(result.data?.type).toBe('ready');
    });

    it('should reject ready signal with unknown top-level keys', () => {
      const result = validateIframeToParentMessage({
        type: 'ready',
        injected: 'malicious',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message failed schema validation');
    });
  });

  describe('size signal', () => {
    it('should accept valid size signal', () => {
      const result = validateIframeToParentMessage({
        type: 'size',
        height: 500,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject non-numeric height', () => {
      const result = validateIframeToParentMessage({
        type: 'size',
        height: 'tall',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('runtime-error signal', () => {
    it('should accept valid runtime error', () => {
      const result = validateIframeToParentMessage({
        type: 'runtime-error',
        message: 'Something went wrong',
      });
      expect(result.valid).toBe(true);
      expect(result.data?.type).toBe('runtime-error');
    });

    it('should accept runtime error with component stack', () => {
      const result = validateIframeToParentMessage({
        type: 'runtime-error',
        message: 'Error occurred',
        componentStack: '  at MyComponent\n  at App',
      });
      expect(result.valid).toBe(true);
    });

    it('should sanitize error message in runtime-error', () => {
      const result = validateIframeToParentMessage({
        type: 'runtime-error',
        message: '<script>alert("xss")</script>',
      });
      expect(result.valid).toBe(true);
      if (result.data?.type === 'runtime-error') {
        expect(result.data.message).not.toContain('<script>');
      }
    });

    it('should sanitize component stack in runtime-error', () => {
      const result = validateIframeToParentMessage({
        type: 'runtime-error',
        message: 'error',
        componentStack: '<script>bad</script> at Component',
      });
      expect(result.valid).toBe(true);
      if (result.data?.type === 'runtime-error' && result.data.componentStack) {
        expect(result.data.componentStack).not.toContain('<script>');
      }
    });

    it('should sanitize file paths in error messages', () => {
      const result = validateIframeToParentMessage({
        type: 'runtime-error',
        message: 'Error in /Users/secret/project/src/app.ts:42:10',
      });
      expect(result.valid).toBe(true);
      if (result.data?.type === 'runtime-error') {
        expect(result.data.message).not.toContain('/Users/secret');
      }
    });
  });

  describe('scroll-report signal', () => {
    it('should accept valid scroll report', () => {
      const result = validateIframeToParentMessage({
        type: 'scroll-report',
        ratio: 0.5,
        scrollTop: 100,
        scrollHeight: 500,
        clientHeight: 300,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject scroll report with out-of-range ratio', () => {
      const result = validateIframeToParentMessage({
        type: 'scroll-report',
        ratio: 1.5,
        scrollTop: 100,
        scrollHeight: 500,
        clientHeight: 300,
      });
      expect(result.valid).toBe(false);
    });

    it('should reject negative scroll values', () => {
      const result = validateIframeToParentMessage({
        type: 'scroll-report',
        ratio: 0.5,
        scrollTop: -10,
        scrollHeight: 500,
        clientHeight: 300,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('invalid messages', () => {
    it('should reject null', () => {
      const result = validateIframeToParentMessage(null);
      expect(result.valid).toBe(false);
    });

    it('should reject unknown type', () => {
      const result = validateIframeToParentMessage({
        type: 'malicious',
        payload: 'data',
      });
      expect(result.valid).toBe(false);
    });
  });
});

describe('createSecureMessageHandler', () => {
  function createMockMessageEvent(data: unknown, origin: string = 'file://'): MessageEvent {
    return { data, origin } as MessageEvent;
  }

  it('should call onMessage for valid messages from allowed origins', () => {
    const onMessage = vi.fn();
    const handler = createSecureMessageHandler(
      {
        isDev: false,
        currentOrigin: 'file://',
      },
      validateParentToIframeMessage,
      onMessage
    );

    const event = createMockMessageEvent({ type: 'theme', value: 'dark' }, 'file://');
    handler(event);

    expect(onMessage).toHaveBeenCalledOnce();
    expect(onMessage).toHaveBeenCalledWith({ type: 'theme', value: 'dark' }, event);
  });

  it('should reject messages from disallowed origins', () => {
    const onMessage = vi.fn();
    const onOriginRejected = vi.fn();
    const handler = createSecureMessageHandler(
      {
        isDev: false,
        currentOrigin: 'file://',
        onOriginRejected,
      },
      validateParentToIframeMessage,
      onMessage
    );

    handler(createMockMessageEvent({ type: 'theme', value: 'dark' }, 'https://evil.com'));

    expect(onMessage).not.toHaveBeenCalled();
    expect(onOriginRejected).toHaveBeenCalledOnce();
  });

  it('should enforce rate limiting', () => {
    const onMessage = vi.fn();
    const onRateLimitExceeded = vi.fn();
    const rateLimiter = createRateLimiter({ maxMessages: 2, windowMs: 60000 });

    const handler = createSecureMessageHandler(
      {
        isDev: false,
        currentOrigin: 'file://',
        rateLimiter,
        onRateLimitExceeded,
      },
      validateParentToIframeMessage,
      onMessage
    );

    const validEvent = createMockMessageEvent({ type: 'theme', value: 'dark' }, 'file://');

    // First two should succeed
    handler(validEvent);
    handler(validEvent);
    expect(onMessage).toHaveBeenCalledTimes(2);

    // Third should be rate limited
    handler(validEvent);
    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onRateLimitExceeded).toHaveBeenCalledOnce();
  });

  it('should reject invalid messages and call onValidationFailed', () => {
    const onMessage = vi.fn();
    const onValidationFailed = vi.fn();
    const handler = createSecureMessageHandler(
      {
        isDev: false,
        currentOrigin: 'file://',
        onValidationFailed,
      },
      validateParentToIframeMessage,
      onMessage
    );

    handler(createMockMessageEvent({ type: 'invalid' }, 'file://'));

    expect(onMessage).not.toHaveBeenCalled();
    expect(onValidationFailed).toHaveBeenCalledOnce();
  });

  it('should allow localhost origins in dev mode', () => {
    const onMessage = vi.fn();
    const handler = createSecureMessageHandler(
      {
        isDev: true,
        currentOrigin: 'http://localhost:5173',
      },
      validateParentToIframeMessage,
      onMessage
    );

    handler(createMockMessageEvent({ type: 'theme', value: 'light' }, 'http://localhost:5173'));

    expect(onMessage).toHaveBeenCalledOnce();
  });
});
