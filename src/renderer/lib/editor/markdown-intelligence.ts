/**
 * Markdown Intelligence for editor diagnostics and anchor completions.
 *
 * Provides:
 * - Heading extraction and slug generation
 * - Link extraction and validation diagnostics
 * - Anchor completion suggestions for markdown links
 * - CodeMirror lint/autocomplete extensions
 */

import type { CompletionContext } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import { linter, type Diagnostic } from '@codemirror/lint';

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const INLINE_LINK_RE = /\[([^\]]*)\]\(([^)]*)\)/g;
const FENCE_RE = /^(```|~~~)/;

export interface MarkdownHeading {
  readonly text: string;
  readonly slug: string;
  readonly depth: number;
  readonly line: number;
  readonly from: number;
  readonly to: number;
}

export interface MarkdownLink {
  readonly text: string;
  readonly target: string;
  readonly line: number;
  readonly from: number;
  readonly to: number;
}

export interface MarkdownDiagnostic {
  readonly message: string;
  readonly severity: 'warning' | 'error' | 'info';
  readonly line: number;
  readonly from: number;
  readonly to: number;
}

export interface MarkdownIntelligenceResult {
  readonly headings: readonly MarkdownHeading[];
  readonly links: readonly MarkdownLink[];
  readonly diagnostics: readonly MarkdownDiagnostic[];
}

export interface AnchorCompletion {
  readonly label: string;
  readonly apply: string;
  readonly detail: string;
}

function stripHeadingMarkup(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}

function slugify(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/_/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'section';
}

function normalizeAnchorTarget(target: string): string {
  const decoded = decodeURIComponent(target).trim().toLowerCase();
  return decoded.replace(/^-+|-+$/g, '');
}

function toCodeMirrorDiagnostic(diagnostic: MarkdownDiagnostic): Diagnostic {
  return {
    from: diagnostic.from,
    to: diagnostic.to,
    severity: diagnostic.severity,
    message: diagnostic.message,
    source: 'markdown-intelligence',
  };
}

function findAnchorCompletionsRange(context: CompletionContext): {
  from: number;
  prefix: string;
} | null {
  const before = context.matchBefore(/\[[^\]]*\]\(#[-\w]*$/);
  if (!before) {
    return null;
  }

  const hashIndex = before.text.lastIndexOf('#');
  if (hashIndex < 0) {
    return null;
  }

  return {
    from: before.from + hashIndex + 1,
    prefix: before.text.slice(hashIndex + 1).toLowerCase(),
  };
}

interface ParseResult {
  readonly headings: MarkdownHeading[];
  readonly links: MarkdownLink[];
  readonly diagnostics: MarkdownDiagnostic[];
}

interface FenceState {
  inFence: boolean;
  activeMarker: string | null;
}

function updateFenceState(line: string, state: FenceState): boolean {
  const fenceMatch = FENCE_RE.exec(line.trim());
  if (!fenceMatch) {
    return false;
  }

  const marker = fenceMatch[1];
  if (marker === undefined) {
    return false;
  }

  if (!state.inFence) {
    state.inFence = true;
    state.activeMarker = marker;
  } else if (state.activeMarker === marker) {
    state.inFence = false;
    state.activeMarker = null;
  }
  return true;
}

function pushHeading(
  line: string,
  lineNumber: number,
  offset: number,
  slugCounts: Map<string, number>,
  result: ParseResult
): void {
  const headingMatch = HEADING_RE.exec(line);
  if (!headingMatch) {
    return;
  }

  const headingPrefix = headingMatch[1];
  const rawHeadingText = headingMatch[2];
  if (headingPrefix === undefined || rawHeadingText === undefined) {
    return;
  }

  const headingText = stripHeadingMarkup(rawHeadingText);
  const baseSlug = slugify(headingText);
  const duplicateCount = slugCounts.get(baseSlug) ?? 0;
  slugCounts.set(baseSlug, duplicateCount + 1);

  const slug = duplicateCount === 0 ? baseSlug : `${baseSlug}-${duplicateCount}`;
  const from = offset + Math.max(0, line.indexOf(rawHeadingText));
  const to = from + rawHeadingText.length;

  result.headings.push({
    text: headingText,
    slug,
    depth: headingPrefix.length,
    line: lineNumber,
    from,
    to,
  });

  if (duplicateCount > 0) {
    result.diagnostics.push({
      message: `Duplicate heading "${headingText}" creates anchor #${slug}`,
      severity: 'info',
      line: lineNumber,
      from,
      to: Math.max(to, from + 1),
    });
  }
}

function pushLinks(line: string, lineNumber: number, offset: number, result: ParseResult): void {
  for (const match of line.matchAll(INLINE_LINK_RE)) {
    const fullMatch = match[0];
    const [, text = '', rawTarget = ''] = match;
    const start = match.index;
    const target = rawTarget.trim();
    const targetOffset = fullMatch.indexOf(target);
    const from = offset + start + Math.max(1, targetOffset);
    const to = Math.max(from + 1, from + target.length);

    result.links.push({
      text,
      target,
      line: lineNumber,
      from,
      to,
    });
  }
}

function parseMarkdownStructure(source: string): ParseResult {
  const result: ParseResult = { headings: [], links: [], diagnostics: [] };
  const slugCounts = new Map<string, number>();
  const fenceState: FenceState = { inFence: false, activeMarker: null };
  let offset = 0;

  const lines = source.split('\n');
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const lineLength = line.length + (index < lines.length - 1 ? 1 : 0);

    if (updateFenceState(line, fenceState)) {
      offset += lineLength;
      continue;
    }

    if (!fenceState.inFence) {
      pushHeading(line, lineNumber, offset, slugCounts, result);
      pushLinks(line, lineNumber, offset, result);
    }

    offset += lineLength;
  }

  return result;
}

function validateLinks(
  headings: readonly MarkdownHeading[],
  links: readonly MarkdownLink[]
): MarkdownDiagnostic[] {
  const diagnostics: MarkdownDiagnostic[] = [];
  const knownAnchors = new Set(headings.map((heading) => heading.slug.toLowerCase()));

  for (const link of links) {
    if (link.target === '') {
      diagnostics.push({
        message: 'Link target is empty',
        severity: 'warning',
        line: link.line,
        from: link.from,
        to: link.to,
      });
      continue;
    }

    if (!link.target.startsWith('#')) {
      continue;
    }

    const anchor = normalizeAnchorTarget(link.target.slice(1));
    if (anchor.length === 0) {
      diagnostics.push({
        message: 'Link anchor is empty',
        severity: 'warning',
        line: link.line,
        from: link.from,
        to: link.to,
      });
    } else if (!knownAnchors.has(anchor)) {
      diagnostics.push({
        message: `Heading anchor "${link.target}" not found in this document`,
        severity: 'warning',
        line: link.line,
        from: link.from,
        to: link.to,
      });
    }
  }

  return diagnostics;
}

export function analyzeMarkdownIntelligence(source: string): MarkdownIntelligenceResult {
  const parsed = parseMarkdownStructure(source);
  const linkDiagnostics = validateLinks(parsed.headings, parsed.links);
  return {
    headings: parsed.headings,
    links: parsed.links,
    diagnostics: [...parsed.diagnostics, ...linkDiagnostics],
  };
}

export function collectAnchorCompletions(source: string, prefix = ''): readonly AnchorCompletion[] {
  const { headings } = analyzeMarkdownIntelligence(source);
  const prefixLower = prefix.toLowerCase();

  return headings
    .filter((heading) => heading.slug.startsWith(prefixLower))
    .map((heading) => ({
      label: heading.text,
      apply: `#${heading.slug}`,
      detail: `L${heading.line}`,
    }));
}

export function anchorCompletionSource(context: CompletionContext) {
  const range = findAnchorCompletionsRange(context);
  if (!range) {
    return null;
  }

  const options = collectAnchorCompletions(context.state.doc.toString(), range.prefix).map(
    (completion) => ({
      label: completion.label,
      apply: completion.apply,
      detail: completion.detail,
      type: 'keyword',
    })
  );

  if (options.length === 0) {
    return null;
  }

  return {
    from: range.from,
    options,
    validFor: /^[-\w]*$/,
  };
}

export function createMarkdownIntelligenceExtension(): readonly Extension[] {
  const markdownLinter = linter((view) => {
    const analysis = analyzeMarkdownIntelligence(view.state.doc.toString());
    return analysis.diagnostics.map(toCodeMirrorDiagnostic);
  });

  return [markdownLinter] as const;
}
