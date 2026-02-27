import type { LlmsTarget } from '@shared/contracts/export-schemas';
import { extractDocumentMetadata } from '@shared/lib/metadata';

const MAX_SUMMARY_LENGTH = 280;
const HEADING_REGEX = /^(#{1,6})\s+(.+?)\s*$/;
const INLINE_TAG_REGEX = /(?:^|\s)#([a-z0-9_-]+)/gi;
const TAGS_DIRECTIVE_REGEX = /\[tags?\s*:\s*([^\]]+)\]/i;

interface LlmsSection {
  readonly heading: string;
  readonly tags: readonly string[];
  readonly raw: string;
}

interface ParsedSections {
  readonly preamble: string;
  readonly sections: readonly LlmsSection[];
}

interface LlmsSelection {
  readonly normalizedFilter: readonly string[];
  readonly sourceTags: readonly string[];
  readonly matchedSourceTags: readonly string[];
  readonly selectedSections: readonly LlmsSection[];
  readonly includesDocument: boolean;
}

export interface LlmsGenerationContentInput {
  readonly target: LlmsTarget;
  readonly sourcePath?: string | null;
  readonly content: string;
  readonly tagFilter?: readonly string[];
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function normalizeTagFilter(tagFilter: readonly string[] | undefined): string[] {
  const normalized = tagFilter
    ? tagFilter.map((tag) => normalizeTag(tag)).filter((tag) => tag.length > 0)
    : [];
  return [...new Set(normalized)];
}

function hasTagIntersection(left: readonly string[], right: readonly string[]): boolean {
  if (left.length === 0 || right.length === 0) {
    return false;
  }
  const rightSet = new Set(right);
  return left.some((tag) => rightSet.has(tag));
}

function parseDirectiveTags(heading: string): string[] {
  const directive = TAGS_DIRECTIVE_REGEX.exec(heading)?.[1];
  if (!directive) {
    return [];
  }
  return directive
    .split(',')
    .map((tag) => normalizeTag(tag))
    .filter((tag) => tag.length > 0);
}

function parseInlineTags(heading: string): string[] {
  const tags: string[] = [];
  let match: RegExpExecArray | null = INLINE_TAG_REGEX.exec(heading);
  while (match) {
    const parsed = normalizeTag(match[1] ?? '');
    if (parsed.length > 0) {
      tags.push(parsed);
    }
    match = INLINE_TAG_REGEX.exec(heading);
  }
  INLINE_TAG_REGEX.lastIndex = 0;
  return tags;
}

function parseSectionTags(heading: string, sourceTags: readonly string[]): string[] {
  const tags = [...parseDirectiveTags(heading), ...parseInlineTags(heading)];
  if (tags.length === 0) {
    return [...sourceTags];
  }
  return [...new Set(tags)];
}

function parseSections(body: string, sourceTags: readonly string[]): ParsedSections {
  const lines = body.split(/\r?\n/);
  const preambleLines: string[] = [];
  const sections: LlmsSection[] = [];

  let currentHeading = '';
  let currentTags: readonly string[] = [];
  let currentLines: string[] = [];

  const commitSection = (): void => {
    if (!currentHeading) {
      return;
    }
    sections.push({
      heading: currentHeading,
      tags: currentTags,
      raw: [currentHeading, ...currentLines].join('\n').trim(),
    });
  };

  for (const line of lines) {
    const headingMatch = HEADING_REGEX.exec(line);
    if (headingMatch) {
      commitSection();
      currentHeading = line.trimEnd();
      currentTags = parseSectionTags(headingMatch[2] ?? '', sourceTags);
      currentLines = [];
      continue;
    }

    if (!currentHeading) {
      preambleLines.push(line);
    } else {
      currentLines.push(line);
    }
  }

  commitSection();

  return {
    preamble: preambleLines.join('\n').trim(),
    sections,
  };
}

function selectByTags(
  parsedSections: ParsedSections,
  sourceTags: readonly string[],
  tagFilter: readonly string[]
): LlmsSelection {
  const normalizedFilter = normalizeTagFilter(tagFilter);
  const normalizedSourceTags = [...new Set(sourceTags.map((tag) => normalizeTag(tag)))];
  const matchedSourceTags = normalizedSourceTags.filter((tag) => normalizedFilter.includes(tag));
  const includesDocument =
    normalizedFilter.length === 0 || hasTagIntersection(normalizedSourceTags, normalizedFilter);

  if (includesDocument) {
    return {
      normalizedFilter,
      sourceTags: normalizedSourceTags,
      matchedSourceTags,
      selectedSections: parsedSections.sections,
      includesDocument: true,
    };
  }

  const selectedSections = parsedSections.sections.filter((section) =>
    hasTagIntersection(section.tags, normalizedFilter)
  );

  return {
    normalizedFilter,
    sourceTags: normalizedSourceTags,
    matchedSourceTags,
    selectedSections,
    includesDocument: false,
  };
}

function buildSummary(content: string): string {
  const normalized = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= MAX_SUMMARY_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_SUMMARY_LENGTH).trimEnd()}…`;
}

function buildSelectedBody(
  parsedSections: ParsedSections,
  selection: LlmsSelection,
  includePreamble: boolean
): string {
  const chunks: string[] = [];
  if (includePreamble && parsedSections.preamble.length > 0) {
    chunks.push(parsedSections.preamble);
  }
  for (const section of selection.selectedSections) {
    if (section.raw.length > 0) {
      chunks.push(section.raw);
    }
  }
  return chunks.join('\n\n').trim();
}

function buildLlmsHeader(
  target: LlmsTarget,
  sourcePath: string | null,
  title: string,
  selection: LlmsSelection
): string[] {
  const lines = [
    `# ${target}`,
    `source: ${sourcePath ?? 'untitled'}`,
    `title: ${title}`,
    `tags: ${selection.sourceTags.length > 0 ? selection.sourceTags.join(', ') : 'none'}`,
  ];

  if (selection.normalizedFilter.length > 0) {
    lines.push(`tag-filter: ${selection.normalizedFilter.join(', ')}`);
    lines.push(
      `matched-tags: ${selection.matchedSourceTags.length > 0 ? selection.matchedSourceTags.join(', ') : 'none'}`
    );
  }

  return lines;
}

function buildLlmsBrief(
  sourcePath: string | null,
  title: string,
  parsedSections: ParsedSections,
  selection: LlmsSelection
): string {
  const includePreamble = selection.includesDocument;
  const selectedBody = buildSelectedBody(parsedSections, selection, includePreamble);
  const summary =
    selectedBody.length > 0
      ? buildSummary(selectedBody)
      : 'No content matched the requested tag filter.';

  const header = buildLlmsHeader('llms.txt', sourcePath, title, selection);
  const headings =
    selection.selectedSections.length > 0
      ? selection.selectedSections.map((section) => `- ${section.heading.replace(/^#+\s+/, '')}`)
      : ['- none'];

  return [...header, '', '## Summary', summary, '', '## Headings', ...headings, ''].join('\n');
}

function buildLlmsFull(
  sourcePath: string | null,
  title: string,
  rawFrontmatter: string,
  parsedSections: ParsedSections,
  selection: LlmsSelection
): string {
  const includePreamble = selection.includesDocument;
  const selectedBody = buildSelectedBody(parsedSections, selection, includePreamble);
  const header = buildLlmsHeader('llms-full.txt', sourcePath, title, selection);

  const bodyChunks: string[] = [];
  if (
    rawFrontmatter.length > 0 &&
    (selection.includesDocument || selection.selectedSections.length > 0)
  ) {
    bodyChunks.push(['---', rawFrontmatter, '---'].join('\n'));
  }

  if (selectedBody.length > 0) {
    bodyChunks.push(selectedBody);
  } else {
    bodyChunks.push('No content matched the requested tag filter.');
  }

  return [...header, '', ...bodyChunks, ''].join('\n');
}

export function generateLlmsContent(input: LlmsGenerationContentInput): string {
  const metadata = extractDocumentMetadata(input.content);
  const parsedSections = parseSections(metadata.body, metadata.tags);
  const selection = selectByTags(parsedSections, metadata.tags, input.tagFilter ?? []);
  const sourcePath = input.sourcePath ?? null;
  const title =
    metadata.title ??
    (sourcePath
      ? sourcePath
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.[^/.]+$/, '')
      : null) ??
    'Untitled';

  if (input.target === 'llms-full.txt') {
    return buildLlmsFull(sourcePath, title, metadata.rawFrontmatter, parsedSections, selection);
  }

  return buildLlmsBrief(sourcePath, title, parsedSections, selection);
}
