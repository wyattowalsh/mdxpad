/**
 * Citation management service.
 * Parses BibTeX and manages citation entries.
 *
 * @module citation-service
 */

import type { CitationEntry, ParseBibtexResponse } from '@shared/contracts/citation-schemas';

export class CitationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CitationParseError';
  }
}

/**
 * Parse a BibTeX string into citation entries.
 * Implements a lightweight BibTeX parser to avoid dependency issues.
 */
export function parseBibtex(bibtex: string): ParseBibtexResponse {
  const warnings: string[] = [];
  const entries: CitationEntry[] = [];

  // Find entry starts: @type{
  const entryStartRegex = /@(\w+)\s*\{/g;
  let startMatch: RegExpExecArray | null;

  while ((startMatch = entryStartRegex.exec(bibtex)) !== null) {
    const type = startMatch[1]?.toLowerCase() ?? '';
    const braceStart = startMatch.index + startMatch[0].length;

    // Find matching closing brace (handle nesting)
    let depth = 1;
    let pos = braceStart;
    while (pos < bibtex.length && depth > 0) {
      if (bibtex[pos] === '{') depth++;
      else if (bibtex[pos] === '}') depth--;
      pos++;
    }

    if (depth !== 0) continue; // Unmatched brace

    const innerContent = bibtex.slice(braceStart, pos - 1);

    // Skip non-entry types like @comment, @preamble, @string
    if (['comment', 'preamble', 'string'].includes(type)) {
      // Update regex lastIndex to continue after this entry
      entryStartRegex.lastIndex = pos;
      continue;
    }

    // Split into id and body at first comma
    const commaIdx = innerContent.indexOf(',');
    if (commaIdx === -1) {
      warnings.push(`Skipped entry with no fields`);
      entryStartRegex.lastIndex = pos;
      continue;
    }

    const id = innerContent.slice(0, commaIdx).trim();
    const body = innerContent.slice(commaIdx + 1);

    if (!id) {
      warnings.push(`Skipped entry with empty ID`);
      entryStartRegex.lastIndex = pos;
      continue;
    }

    const fields = parseFields(body);
    const entry = buildEntry(id, type, fields);
    entries.push(entry);

    entryStartRegex.lastIndex = pos;
  }

  if (entries.length === 0 && bibtex.includes('@')) {
    warnings.push('No valid BibTeX entries found');
  }

  return { entries, warnings };
}

interface FieldValue {
  readonly text: string;
  readonly next: number;
}

function stripGroupingBraces(value: string): string {
  return value.replaceAll(/[{}]/g, '').trim();
}

function readBraced(body: string, start: number): FieldValue | null {
  let depth = 0;
  for (let index = start; index < body.length; index += 1) {
    const char = body[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (char === '}' && depth === 0) {
      return { text: stripGroupingBraces(body.slice(start + 1, index)), next: index + 1 };
    }
  }
  return null;
}

function readQuoted(body: string, start: number): FieldValue | null {
  for (let index = start + 1; index < body.length; index += 1) {
    if (body[index] === '\\') {
      index += 1;
      continue;
    }
    if (body[index] === '"') {
      return { text: stripGroupingBraces(body.slice(start + 1, index)), next: index + 1 };
    }
  }
  return null;
}

function readFieldValue(body: string, start: number): FieldValue | null {
  const char = body[start];
  if (char === '{') return readBraced(body, start);
  if (char === '"') return readQuoted(body, start);
  const number = /^\d+/.exec(body.slice(start));
  if (number?.[0] === undefined) return null;
  return { text: number[0], next: start + number[0].length };
}

function parseFields(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  let index = 0;
  while (index < body.length) {
    while (index < body.length && /[\s,]/.test(body[index] ?? '')) index += 1;
    const keyMatch = /^(\w+)\s*=\s*/.exec(body.slice(index));
    const key = keyMatch?.[1];
    if (keyMatch === null || key === undefined) {
      index += 1;
      continue;
    }
    const value = readFieldValue(body, index + keyMatch[0].length);
    if (value === null) {
      index += keyMatch[0].length;
      continue;
    }
    fields.set(key.toLowerCase(), value.text);
    index = value.next;
  }
  return fields;
}

function parseAuthors(
  authorStr: string
): { given?: string | undefined; family?: string | undefined }[] {
  return authorStr.split(/\s+and\s+/i).map((name) => {
    const trimmed = name.trim();
    if (trimmed.includes(',')) {
      // "Last, First" format
      const parts = trimmed.split(',').map((p) => p.trim());
      const family = parts[0] ?? '';
      const given = parts[1];
      return given ? { family, given } : { family };
    }
    // "First Last" format
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return { family: parts[0] ?? '' };
    }
    return {
      given: parts.slice(0, -1).join(' '),
      family: parts[parts.length - 1] ?? '',
    };
  });
}

function buildEntry(id: string, type: string, fields: Map<string, string>): CitationEntry {
  const entry: CitationEntry = { id, type };

  const title = fields.get('title');
  if (title) entry.title = title;

  const author = fields.get('author');
  if (author) entry.author = parseAuthors(author);

  const year = fields.get('year');
  if (year) {
    const parsed = parseInt(year, 10);
    if (!isNaN(parsed)) entry.year = parsed;
  }

  const journal = fields.get('journal');
  if (journal) entry.journal = journal;

  const volume = fields.get('volume');
  if (volume) entry.volume = volume;

  const issue = fields.get('number') ?? fields.get('issue');
  if (issue) entry.issue = issue;

  const pages = fields.get('pages');
  if (pages) entry.pages = pages.replaceAll('--', '-');

  const publisher = fields.get('publisher');
  if (publisher) entry.publisher = publisher;

  const doi = fields.get('doi');
  if (doi) entry.doi = doi;

  const url = fields.get('url');
  if (url) entry.url = url;

  return entry;
}
