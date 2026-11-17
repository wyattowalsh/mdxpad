import hljs from 'highlight.js';

export const CODE_HIGHLIGHT_CSS = `
.hljs-keyword, .hljs-selector-tag { color: #7c3aed; }
.hljs-string, .hljs-attr { color: #047857; }
.hljs-number, .hljs-literal { color: #b45309; }
.hljs-comment { color: #6b7280; }
.hljs-title, .hljs-section { color: #1d4ed8; }
`.trim();

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeFence(source: string, language: string): string {
  const className = language.length > 0 ? ` class="language-${language}"` : '';
  return `<pre><code${className}>${escapeHtml(source)}</code></pre>`;
}

/** Highlighted HTML for a known language, or null when the fence stays plain. */
export function highlightCodeHtml(language: string, source: string): string | null {
  if (language.length === 0 || !hljs.getLanguage(language)) {
    return null;
  }
  try {
    return hljs.highlight(source, { language, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
}

/** Render a fenced code block, coloring a known language. */
export function renderFencedCode(language: string, lines: readonly string[]): string {
  const source = lines.join('\n');
  const highlighted = highlightCodeHtml(language, source);
  if (!highlighted) {
    return escapeFence(source, language);
  }
  return `<pre><code class="language-${language}">${highlighted}</code></pre>`;
}
