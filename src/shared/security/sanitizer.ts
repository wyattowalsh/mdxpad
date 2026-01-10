/**
 * Content Sanitizer
 *
 * Sanitizes user-provided content to prevent XSS and other injection attacks.
 * @module shared/security/sanitizer
 */

import { SECURITY_CONSTANTS } from './constants';

/**
 * Options for sanitization functions
 */
export interface SanitizeOptions {
  /** Maximum length of output (truncates if exceeded) */
  readonly maxLength?: number;
  /** Whether to allow newlines */
  readonly allowNewlines?: boolean;
  /** Whether to preserve whitespace formatting */
  readonly preserveWhitespace?: boolean;
}

/**
 * Characters that could be dangerous in HTML contexts
 */
const HTML_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Control characters that should be removed (except whitespace)
 */
const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Null bytes and other dangerous sequences
 */
const DANGEROUS_SEQUENCES = [
  '\x00', // Null byte
  '\uFEFF', // BOM
  '\u2028', // Line separator (can break JavaScript)
  '\u2029', // Paragraph separator (can break JavaScript)
];

/**
 * Escapes HTML special characters to prevent XSS.
 *
 * @param str - String to escape
 * @returns Escaped string safe for HTML insertion
 */
function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Removes control characters from a string.
 *
 * Control characters (except tab, newline, carriage return) can cause
 * rendering issues and potential security problems.
 *
 * @param str - String to clean
 * @param allowNewlines - Whether to preserve newlines
 * @returns Cleaned string
 */
function removeControlChars(str: string, allowNewlines: boolean = true): string {
  let result = str.replace(CONTROL_CHAR_REGEX, '');

  // Remove dangerous sequences
  for (const seq of DANGEROUS_SEQUENCES) {
    result = result.split(seq).join('');
  }

  // Optionally remove newlines
  if (!allowNewlines) {
    result = result.replace(/[\r\n]/g, ' ');
  }

  return result;
}

/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }

  // Leave room for ellipsis
  const truncated = str.slice(0, maxLength - 3);

  // Try to break at a word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Normalizes whitespace in a string.
 *
 * - Collapses multiple spaces into one
 * - Normalizes different types of spaces to regular space
 * - Trims leading/trailing whitespace
 *
 * @param str - String to normalize
 * @returns Normalized string
 */
function normalizeWhitespace(str: string): string {
  return str
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // Normalize special spaces
    .replace(/ +/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Sanitizes text content for safe display.
 *
 * Use this for any user-provided text that will be displayed in the UI.
 *
 * @param text - Text to sanitize
 * @param options - Sanitization options
 * @returns Sanitized text
 */
export function sanitizeTextContent(
  text: string,
  options: SanitizeOptions = {}
): string {
  const {
    maxLength = SECURITY_CONSTANTS.maxErrorMessageLength,
    allowNewlines = true,
    preserveWhitespace = false,
  } = options;

  // Step 1: Remove control characters
  let result = removeControlChars(text, allowNewlines);

  // Step 2: Normalize whitespace (if not preserving)
  if (!preserveWhitespace) {
    if (allowNewlines) {
      // Normalize each line separately
      result = result
        .split('\n')
        .map((line) => normalizeWhitespace(line))
        .join('\n');
    } else {
      result = normalizeWhitespace(result);
    }
  }

  // Step 3: Escape HTML characters
  result = escapeHtml(result);

  // Step 4: Truncate if needed
  result = truncate(result, maxLength);

  return result;
}

/**
 * Sanitizes an error message for safe display.
 *
 * Error messages may contain:
 * - Stack traces with file paths
 * - User input that caused the error
 * - Potentially sensitive information
 *
 * This function ensures the message is safe to display without
 * exposing sensitive details.
 *
 * @param message - Error message to sanitize
 * @returns Sanitized error message
 */
export function sanitizeErrorMessage(message: string): string {
  // Apply standard sanitization with no newlines (single line)
  let result = sanitizeTextContent(message, {
    maxLength: SECURITY_CONSTANTS.maxErrorMessageLength,
    allowNewlines: false,
    preserveWhitespace: false,
  });

  // Remove file paths that might expose system structure
  // Match common path patterns but preserve the filename
  result = result.replace(
    /(?:\/(?:Users|home|var|tmp|private)[^\s:]*\/)?([^\/\s:]+\.(ts|tsx|js|jsx|mjs|cjs))/gi,
    '$1'
  );

  // Remove line:column references that might be confusing
  // But preserve them for debugging (just clean format)
  result = result.replace(/:\d+:\d+(?=\s|$|[)\]])/g, '');

  return result;
}

/**
 * Sanitizes a component stack trace for safe display.
 *
 * Component stacks are multi-line and can be long.
 * This preserves the structure while ensuring safety.
 *
 * @param stack - Component stack to sanitize
 * @returns Sanitized component stack
 */
export function sanitizeComponentStack(stack: string): string {
  return sanitizeTextContent(stack, {
    maxLength: SECURITY_CONSTANTS.maxComponentStackLength,
    allowNewlines: true,
    preserveWhitespace: true, // Preserve indentation in stack traces
  });
}
