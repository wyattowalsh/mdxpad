/**
 * Tests for Content Sanitizer
 *
 * Covers XSS prevention, HTML entity encoding, control character removal,
 * whitespace normalization, truncation, error message sanitization,
 * and component stack sanitization.
 *
 * @module shared/security/__tests__/sanitizer.test
 */

import { describe, it, expect } from 'vitest';
import { sanitizeTextContent, sanitizeErrorMessage, sanitizeComponentStack } from '../sanitizer';

describe('sanitizeTextContent', () => {
  describe('HTML entity encoding', () => {
    it('should escape ampersands', () => {
      expect(sanitizeTextContent('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape angle brackets', () => {
      expect(sanitizeTextContent('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should escape double quotes', () => {
      expect(sanitizeTextContent('a "quoted" string')).toBe('a &quot;quoted&quot; string');
    });

    it('should escape single quotes', () => {
      expect(sanitizeTextContent("it's")).toBe('it&#x27;s');
    });

    it('should escape backticks', () => {
      expect(sanitizeTextContent('`code`')).toBe('&#x60;code&#x60;');
    });

    it('should escape forward slashes', () => {
      expect(sanitizeTextContent('a/b')).toBe('a&#x2F;b');
    });

    it('should escape equals signs', () => {
      expect(sanitizeTextContent('a=b')).toBe('a&#x3D;b');
    });

    it('should escape all dangerous characters together', () => {
      const input = '<img src="x" onerror=\'alert(1)\'>';
      const result = sanitizeTextContent(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('"');
      expect(result).not.toContain("'");
    });
  });

  describe('XSS attack vectors', () => {
    it('should neutralize script injection', () => {
      const result = sanitizeTextContent('<script>document.cookie</script>');
      expect(result).not.toContain('<script>');
    });

    it('should neutralize event handler injection', () => {
      const result = sanitizeTextContent('<img onerror="alert(1)">');
      // The angle brackets are escaped, so the tag cannot be parsed as HTML
      expect(result).not.toContain('<img');
      expect(result).toContain('&lt;img');
      // Quotes and equals are also escaped
      expect(result).not.toContain('="');
    });

    it('should neutralize javascript: protocol', () => {
      const result = sanitizeTextContent('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain('href=');
    });

    it('should neutralize data: URI with script', () => {
      const result = sanitizeTextContent(
        '<object data="data:text/html,<script>alert(1)</script>">'
      );
      expect(result).not.toContain('<script>');
    });
  });

  describe('control character removal', () => {
    it('should remove null bytes', () => {
      expect(sanitizeTextContent('hello\x00world')).toBe('helloworld');
    });

    it('should remove BOM', () => {
      expect(sanitizeTextContent('\uFEFFhello')).toBe('hello');
    });

    it('should remove line separator (U+2028)', () => {
      expect(sanitizeTextContent('hello\u2028world')).toBe('helloworld');
    });

    it('should remove paragraph separator (U+2029)', () => {
      expect(sanitizeTextContent('hello\u2029world')).toBe('helloworld');
    });

    it('should remove ASCII control characters (except whitespace)', () => {
      expect(sanitizeTextContent('hello\x01\x02\x03world')).toBe('helloworld');
    });

    it('should preserve tabs when allowNewlines is true', () => {
      // Tabs (0x09) are not in the control char regex range [0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F]
      const result = sanitizeTextContent('hello\tworld', { preserveWhitespace: true });
      expect(result).toContain('\t');
    });

    it('should preserve newlines when allowNewlines is true (default)', () => {
      const result = sanitizeTextContent('line1\nline2', { preserveWhitespace: true });
      expect(result).toContain('\n');
    });

    it('should replace newlines with spaces when allowNewlines is false', () => {
      const result = sanitizeTextContent('line1\nline2', { allowNewlines: false });
      expect(result).not.toContain('\n');
    });
  });

  describe('whitespace normalization', () => {
    it('should collapse multiple spaces into one by default', () => {
      expect(sanitizeTextContent('hello   world')).toBe('hello world');
    });

    it('should trim leading and trailing whitespace by default', () => {
      expect(sanitizeTextContent('  hello  ')).toBe('hello');
    });

    it('should normalize non-breaking spaces', () => {
      expect(sanitizeTextContent('hello\u00A0world')).toBe('hello world');
    });

    it('should normalize em spaces', () => {
      expect(sanitizeTextContent('hello\u2003world')).toBe('hello world');
    });

    it('should preserve whitespace when preserveWhitespace is true', () => {
      const result = sanitizeTextContent('hello   world', { preserveWhitespace: true });
      expect(result).toContain('   ');
    });

    it('should normalize each line separately when allowNewlines is true', () => {
      const result = sanitizeTextContent('  line1  \n  line2  ');
      expect(result).toBe('line1\nline2');
    });
  });

  describe('truncation', () => {
    it('should not truncate short text', () => {
      const result = sanitizeTextContent('short', { maxLength: 100 });
      expect(result).toBe('short');
    });

    it('should truncate text exceeding maxLength', () => {
      const longText = 'a'.repeat(200);
      const result = sanitizeTextContent(longText, { maxLength: 50 });
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).toContain('...');
    });

    it('should try to break at word boundary', () => {
      const text = 'the quick brown fox jumps over the lazy dog and more text here';
      const result = sanitizeTextContent(text, { maxLength: 30 });
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(30);
    });

    it('should use default maxLength from SECURITY_CONSTANTS', () => {
      // Default is maxErrorMessageLength (10KB)
      const shortText = 'hello';
      const result = sanitizeTextContent(shortText);
      expect(result).toBe('hello');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(sanitizeTextContent('')).toBe('');
    });

    it('should handle string with only whitespace', () => {
      expect(sanitizeTextContent('   ')).toBe('');
    });

    it('should handle string with only control characters', () => {
      expect(sanitizeTextContent('\x00\x01\x02')).toBe('');
    });

    it('should handle Unicode emoji', () => {
      const result = sanitizeTextContent('Hello 🎉 World');
      expect(result).toContain('🎉');
    });

    it('should handle CJK characters', () => {
      const result = sanitizeTextContent('你好世界');
      expect(result).toBe('你好世界');
    });
  });
});

describe('sanitizeErrorMessage', () => {
  it('should sanitize HTML in error messages', () => {
    const result = sanitizeErrorMessage('<script>alert(1)</script> error');
    expect(result).not.toContain('<script>');
  });

  it('should remove file paths exposing system structure', () => {
    const result = sanitizeErrorMessage('Error in /Users/john/project/src/file.ts');
    expect(result).not.toContain('/Users/john');
    expect(result).toContain('file.ts');
  });

  it('should remove /home paths', () => {
    const result = sanitizeErrorMessage('Error in /home/user/project/module.js');
    expect(result).not.toContain('/home/user');
    expect(result).toContain('module.js');
  });

  it('should remove /var paths', () => {
    const result = sanitizeErrorMessage('Error in /var/app/src/index.tsx');
    expect(result).not.toContain('/var/app');
    expect(result).toContain('index.tsx');
  });

  it('should remove line:column references', () => {
    const result = sanitizeErrorMessage('Error at file.ts:42:10');
    expect(result).not.toMatch(/:42:10/);
  });

  it('should produce single-line output', () => {
    const result = sanitizeErrorMessage('line1\nline2\nline3');
    expect(result).not.toContain('\n');
  });

  it('should handle empty error message', () => {
    expect(sanitizeErrorMessage('')).toBe('');
  });

  it('should respect maxErrorMessageLength', () => {
    const longError = 'Error: ' + 'x'.repeat(20000);
    const result = sanitizeErrorMessage(longError);
    // Should be truncated (maxErrorMessageLength is 10KB)
    expect(result.length).toBeLessThanOrEqual(10 * 1024);
  });
});

describe('sanitizeComponentStack', () => {
  it('should preserve multi-line structure', () => {
    const stack = '  at Component\n  at App\n  at Root';
    const result = sanitizeComponentStack(stack);
    expect(result).toContain('\n');
  });

  it('should preserve indentation', () => {
    const stack = '    at Component\n    at App';
    const result = sanitizeComponentStack(stack);
    // preserveWhitespace is true, so indentation is kept
    expect(result).toContain('    ');
  });

  it('should escape HTML in stack traces', () => {
    const stack = '  at <script> component\n  at App';
    const result = sanitizeComponentStack(stack);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should truncate very long stacks', () => {
    // maxComponentStackLength is 50KB
    const longStack = '  at Component\n'.repeat(10000);
    const result = sanitizeComponentStack(longStack);
    expect(result.length).toBeLessThanOrEqual(50 * 1024);
  });

  it('should handle empty stack', () => {
    expect(sanitizeComponentStack('')).toBe('');
  });

  it('should remove control characters from stack', () => {
    const stack = '  at Component\x00\n  at App';
    const result = sanitizeComponentStack(stack);
    expect(result).not.toContain('\x00');
  });
});
