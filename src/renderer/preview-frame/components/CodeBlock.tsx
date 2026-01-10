/**
 * CodeBlock Component
 *
 * Displays syntax-highlighted code blocks with copy-to-clipboard functionality.
 * Uses rehype-highlight CSS classes for syntax highlighting.
 *
 * @module preview-frame/components/CodeBlock
 * @see FR-010
 */

import * as React from 'react';

const { useState, useCallback, useMemo, useRef, useEffect } = React;

/**
 * Props for the CodeBlock component.
 * Provides syntax-highlighted code display with copy functionality.
 */
export interface CodeBlockProps {
  /** Code content to display */
  readonly children: string;
  /** Language for syntax highlighting (e.g., "typescript", "javascript") */
  readonly language?: string;
  /** Optional filename/title to display above the code block */
  readonly title?: string;
  /** Show line numbers */
  readonly showLineNumbers?: boolean;
  /** Highlight specific lines (1-indexed, e.g., [1, 3, 5]) */
  readonly highlightLines?: number[];
  /** CSS class (may contain language class from rehype-highlight: "language-{lang}") */
  readonly className?: string;
}

/** Props for the CopyButton component. */
interface CopyButtonProps {
  /** Code content to copy to clipboard */
  readonly code: string;
}

/** Props for the CodeBlockHeader component. */
interface CodeBlockHeaderProps {
  /** Optional title/filename to display */
  readonly title?: string | undefined;
  /** Language name for the badge display */
  readonly language?: string | undefined;
}

/** Props for the CodeBlockLineNumbers component. */
interface CodeBlockLineNumbersProps {
  /** Number of lines to display */
  readonly count: number;
  /** Set of line numbers to highlight (1-indexed) */
  readonly highlightedLines: Set<number>;
}

/**
 * Copy icon SVG component.
 */
function CopyIcon(): React.JSX.Element {
  return (
    <svg
      className="code-block-copy-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * Check icon SVG component (shown after successful copy).
 */
function CheckIcon(): React.JSX.Element {
  return (
    <svg
      className="code-block-copy-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Extracts language from className string.
 * Handles both "language-ts" and "ts" formats.
 */
function extractLanguage(className?: string, explicitLanguage?: string): string | undefined {
  if (explicitLanguage) {
    return explicitLanguage;
  }
  if (!className) {
    return undefined;
  }
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : undefined;
}

/**
 * Formats language name for display.
 */
function formatLanguageDisplay(language: string): string {
  const displayNames: Record<string, string> = {
    js: 'JavaScript',
    ts: 'TypeScript',
    jsx: 'JSX',
    tsx: 'TSX',
    py: 'Python',
    rb: 'Ruby',
    rs: 'Rust',
    go: 'Go',
    md: 'Markdown',
    mdx: 'MDX',
    sh: 'Shell',
    bash: 'Bash',
    zsh: 'Zsh',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sql: 'SQL',
  };
  return displayNames[language.toLowerCase()] ?? language.toUpperCase();
}

/**
 * Copy-to-clipboard button with visual feedback state.
 * Shows a check icon for 2 seconds after successful copy.
 * Includes aria-live region for screen reader announcements.
 */
function CopyButton({ code }: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [code]);

  return (
    <>
      <button
        type="button"
        className="code-block-copy"
        onClick={copyToClipboard}
        data-copied={copied ? 'true' : 'false'}
        aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
        aria-pressed={copied}
        title={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      {/* Screen reader announcement for copy status */}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
      >
        {copied ? 'Code copied to clipboard' : ''}
      </span>
    </>
  );
}

/**
 * Header component displaying title and language badge.
 */
function CodeBlockHeader({ title, language }: CodeBlockHeaderProps): React.JSX.Element {
  return (
    <div className="code-block-header">
      <span className="code-block-title">{title ?? ''}</span>
      {language && (
        <span className="code-block-language">
          {formatLanguageDisplay(language)}
        </span>
      )}
    </div>
  );
}

/**
 * Line numbers column component.
 * Renders line numbers with optional highlighting.
 */
function CodeBlockLineNumbers({
  count,
  highlightedLines,
}: CodeBlockLineNumbersProps): React.JSX.Element {
  return (
    <div className="code-block-line-numbers" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={`code-block-line-number ${
            highlightedLines.has(index + 1) ? 'highlighted' : ''
          }`}
        >
          {index + 1}
        </span>
      ))}
    </div>
  );
}

/**
 * CodeBlock component for displaying syntax-highlighted code.
 *
 * Features:
 * - Syntax highlighting via rehype-highlight CSS classes
 * - Copy-to-clipboard button with visual feedback
 * - Optional title/filename display
 * - Optional line numbers
 * - Language badge display
 * - Support for highlighting specific lines
 * - Dark/light theme via CSS variables
 */
export function CodeBlock({
  children,
  language,
  title,
  showLineNumbers = false,
  highlightLines = [],
  className,
}: CodeBlockProps): React.JSX.Element {
  const detectedLanguage = useMemo(
    () => extractLanguage(className, language),
    [className, language]
  );

  const codeClassName = useMemo(() => {
    const classes = ['hljs'];
    if (detectedLanguage) {
      classes.push(`language-${detectedLanguage}`);
    }
    return classes.join(' ');
  }, [detectedLanguage]);

  const code = useMemo(() => {
    return typeof children === 'string' ? children : String(children);
  }, [children]);

  const lineCount = useMemo(() => code.split('\n').length, [code]);
  const highlightedLineSet = useMemo(() => new Set(highlightLines), [highlightLines]);
  const showHeader = Boolean(title) || Boolean(detectedLanguage);

  // Generate descriptive label for screen readers
  const codeBlockLabel = useMemo(() => {
    const parts: string[] = ['Code block'];
    if (detectedLanguage) {
      parts.push(`in ${formatLanguageDisplay(detectedLanguage)}`);
    }
    if (title) {
      parts.push(`titled ${title}`);
    }
    parts.push(`with ${lineCount} line${lineCount === 1 ? '' : 's'}`);
    return parts.join(' ');
  }, [detectedLanguage, title, lineCount]);

  return (
    <figure
      className={`code-block ${className ?? ''}`}
      data-line-numbers={showLineNumbers ? 'true' : 'false'}
      role="figure"
      aria-label={codeBlockLabel}
    >
      {showHeader && <CodeBlockHeader title={title} language={detectedLanguage} />}
      {showLineNumbers && (
        <CodeBlockLineNumbers count={lineCount} highlightedLines={highlightedLineSet} />
      )}
      <pre tabIndex={0} aria-label={`Code: ${title ?? detectedLanguage ?? 'snippet'}`}>
        <code className={codeClassName}>{code}</code>
      </pre>
      <CopyButton code={code} />
    </figure>
  );
}

export default CodeBlock;
