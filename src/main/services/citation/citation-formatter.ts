/**
 * Citation formatting utilities.
 * Formats citations in various academic styles.
 *
 * @module citation-formatter
 */

import type {
  CitationEntry,
  CitationStyle,
  FormatCitationResponse,
  GenerateBibliographyResponse,
} from '@shared/contracts/citation-schemas';

interface AuthorRef {
  given?: string | undefined;
  family?: string | undefined;
}

function formatAuthors(authors: AuthorRef[], style: CitationStyle): string {
  if (authors.length === 0) return 'Unknown Author';

  const formatOne = (a: AuthorRef): string => {
    switch (style) {
      case 'apa':
        return a.given ? `${a.family}, ${a.given[0]}.` : (a.family ?? 'Unknown');
      case 'mla':
        return a.given ? `${a.family}, ${a.given}` : (a.family ?? 'Unknown');
      case 'chicago':
        return a.given ? `${a.family}, ${a.given}` : (a.family ?? 'Unknown');
      case 'ieee':
        return a.given ? `${a.given[0]}. ${a.family}` : (a.family ?? 'Unknown');
    }
  };

  const first = authors[0];
  if (authors.length === 1 && first) return formatOne(first);

  if (style === 'apa' && authors.length > 7) {
    const first6 = authors.slice(0, 6).map(formatOne);
    const lastAuthor = authors[authors.length - 1];
    return `${first6.join(', ')}, ... & ${lastAuthor ? formatOne(lastAuthor) : 'Unknown'}`;
  }

  if (style === 'ieee') {
    return authors.map(formatOne).join(', ');
  }

  const allButLast = authors.slice(0, -1).map(formatOne);
  const lastAuthor = authors[authors.length - 1];
  const last = lastAuthor ? formatOne(lastAuthor) : 'Unknown';
  const separator = style === 'apa' ? ', & ' : ', and ';
  return `${allButLast.join(', ')}${separator}${last}`;
}

const MONTHS: Readonly<Record<string, string>> = {
  jan: 'January',
  feb: 'February',
  mar: 'March',
  apr: 'April',
  may: 'May',
  jun: 'June',
  jul: 'July',
  aug: 'August',
  sep: 'September',
  oct: 'October',
  nov: 'November',
  dec: 'December',
};

function monthName(value: string | undefined): string | undefined {
  const text = value?.trim() ?? '';
  if (text.length === 0) {
    return undefined;
  }
  return MONTHS[text.toLowerCase()] ?? text;
}

function fullTitle(entry: CitationEntry): string {
  const title = entry.title?.trim() ?? '';
  const subtitle = entry.subtitle?.trim() ?? '';
  if (title.length === 0) {
    return subtitle;
  }
  if (subtitle.length === 0) {
    return title;
  }
  return `${title}: ${subtitle}`;
}

function addBooktitle(parts: string[], entry: CitationEntry, rendered: string): void {
  if (entry.booktitle) {
    parts.push(rendered);
  }
}

function addSentence(parts: string[], value: string | undefined): void {
  const text = value?.trim() ?? '';
  if (text.length === 0) {
    return;
  }
  parts.push(text.endsWith('.') ? text : `${text}.`);
}

function editionLabel(edition: string | undefined): string | undefined {
  const text = edition?.trim() ?? '';
  if (text.length === 0) {
    return undefined;
  }
  return /ed/i.test(text) ? text : `${text} ed.`;
}

const MONTH_NUMBERS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function accessedLabel(value: string | undefined): string | undefined {
  const text = value?.trim() ?? '';
  if (text.length === 0) {
    return undefined;
  }
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(text);
  const month = match?.[2] === undefined ? undefined : MONTH_NUMBERS[Number(match[2]) - 1];
  if (match?.[1] === undefined || month === undefined) {
    return `Accessed ${text}`;
  }
  const day = match[3] === undefined ? '' : String(Number(match[3]));
  const when =
    day.length > 0 && day !== 'NaN' ? `${day} ${month} ${match[1]}` : `${month} ${match[1]}`;
  return `Accessed ${when}`;
}

function versionLabel(value: string | undefined): string | undefined {
  const text = value?.trim() ?? '';
  if (text.length === 0) {
    return undefined;
  }
  return /version/i.test(text) ? text : `Version ${text}`;
}

function pageCount(value: string | undefined): string | undefined {
  const text = value?.trim() ?? '';
  if (text.length === 0) {
    return undefined;
  }
  return /^\d+$/.test(text) ? `${text} pp.` : text;
}

function addContext(parts: string[], entry: CitationEntry): void {
  addSentence(parts, entry.school);
  addSentence(parts, entry.institution);
  addSentence(parts, entry.editor ? `Ed. ${entry.editor}` : undefined);
  addSentence(parts, entry.series);
  addSentence(parts, entry.address);
  addSentence(parts, editionLabel(entry.edition));
  addSentence(parts, entry.organization);
  addSentence(parts, entry.chapter ? `Ch. ${entry.chapter}` : undefined);
  addSentence(parts, monthName(entry.month));
  addSentence(parts, entry.translator ? `Trans. ${entry.translator}` : undefined);
  addSentence(parts, entry.isbn ? `ISBN ${entry.isbn}` : undefined);
  addSentence(parts, entry.issn ? `ISSN ${entry.issn}` : undefined);
  addSentence(parts, entry.url);
  addSentence(parts, accessedLabel(entry.urldate));
  addSentence(parts, entry.language);
  addSentence(parts, versionLabel(entry.version));
  addSentence(parts, entry.venue);
  addSentence(parts, entry.eid);
  addSentence(parts, pageCount(entry.pagetotal));
  addSentence(parts, entry.howpublished);
  addSentence(parts, entry.note);
}

function formatApa(entry: CitationEntry): string {
  const parts: string[] = [];
  const authors = entry.author ? formatAuthors(entry.author, 'apa') : 'Unknown Author';
  const year = entry.year ? `(${entry.year})` : '(n.d.)';
  parts.push(`${authors} ${year}.`);
  const apaTitle = fullTitle(entry);
  if (apaTitle.length > 0) parts.push(`${apaTitle}.`);
  if (entry.journal) {
    let journalPart = `_${entry.journal}_`;
    if (entry.volume) journalPart += `, _${entry.volume}_`;
    if (entry.issue) journalPart += `(${entry.issue})`;
    if (entry.pages) journalPart += `, ${entry.pages}`;
    parts.push(`${journalPart}.`);
  } else if (entry.publisher) {
    parts.push(`${entry.publisher}.`);
  }
  addBooktitle(parts, entry, `In ${entry.booktitle}.`);
  if (entry.doi) parts.push(`https://doi.org/${entry.doi}`);
  addContext(parts, entry);
  return parts.join(' ');
}

function formatMla(entry: CitationEntry): string {
  const parts: string[] = [];
  const authors = entry.author ? formatAuthors(entry.author, 'mla') : 'Unknown Author';
  parts.push(`${authors}.`);
  const mlaTitle = fullTitle(entry);
  if (mlaTitle.length > 0) parts.push(`"${mlaTitle}."`);
  if (entry.journal) {
    let journalPart = `_${entry.journal}_`;
    if (entry.volume) journalPart += `, vol. ${entry.volume}`;
    if (entry.issue) journalPart += `, no. ${entry.issue}`;
    if (entry.year) journalPart += `, ${entry.year}`;
    if (entry.pages) journalPart += `, pp. ${entry.pages}`;
    parts.push(`${journalPart}.`);
  } else {
    if (entry.publisher) parts.push(`${entry.publisher},`);
    if (entry.year) parts.push(`${entry.year}.`);
  }
  addBooktitle(parts, entry, `_${entry.booktitle}_.`);
  addContext(parts, entry);
  return parts.join(' ');
}

function formatChicago(entry: CitationEntry): string {
  const parts: string[] = [];
  const authors = entry.author ? formatAuthors(entry.author, 'chicago') : 'Unknown Author';
  parts.push(`${authors}.`);
  const chicagoTitle = fullTitle(entry);
  if (chicagoTitle.length > 0) {
    if (entry.journal) {
      parts.push(`"${chicagoTitle}."`);
    } else {
      parts.push(`_${chicagoTitle}_.`);
    }
  }
  if (entry.journal) {
    let journalPart = `_${entry.journal}_`;
    if (entry.volume) journalPart += ` ${entry.volume}`;
    if (entry.issue) journalPart += `, no. ${entry.issue}`;
    if (entry.year) journalPart += ` (${entry.year})`;
    if (entry.pages) journalPart += `: ${entry.pages}`;
    parts.push(`${journalPart}.`);
  } else {
    if (entry.publisher) parts.push(`${entry.publisher},`);
    if (entry.year) parts.push(`${entry.year}.`);
  }
  addBooktitle(parts, entry, `_${entry.booktitle}_.`);
  addContext(parts, entry);
  return parts.join(' ');
}

function formatIeee(entry: CitationEntry): string {
  const parts: string[] = [];
  const authors = entry.author ? formatAuthors(entry.author, 'ieee') : 'Unknown Author';
  parts.push(`${authors},`);
  const ieeeTitle = fullTitle(entry);
  if (ieeeTitle.length > 0) parts.push(`"${ieeeTitle},"`);
  if (entry.journal) {
    let journalPart = `_${entry.journal}_`;
    if (entry.volume) journalPart += `, vol. ${entry.volume}`;
    if (entry.issue) journalPart += `, no. ${entry.issue}`;
    if (entry.pages) journalPart += `, pp. ${entry.pages}`;
    if (entry.year) journalPart += `, ${entry.year}`;
    parts.push(`${journalPart}.`);
  } else {
    if (entry.publisher) parts.push(`${entry.publisher},`);
    if (entry.year) parts.push(`${entry.year}.`);
  }
  addBooktitle(parts, entry, `in _${entry.booktitle}_.`);
  addContext(parts, entry);
  return parts.join(' ');
}

export function formatCitation(entry: CitationEntry, style: CitationStyle): FormatCitationResponse {
  const formatters: Record<CitationStyle, (e: CitationEntry) => string> = {
    apa: formatApa,
    mla: formatMla,
    chicago: formatChicago,
    ieee: formatIeee,
  };

  const formatted = formatters[style](entry);
  const inlineRef = createInlineRef(entry, style);

  return { formatted, inlineRef };
}

function createInlineRef(entry: CitationEntry, style: CitationStyle): string {
  const firstAuthor = entry.author?.[0]?.family ?? 'Unknown';
  const year = entry.year ?? 'n.d.';

  switch (style) {
    case 'apa':
      return `(${firstAuthor}, ${year})`;
    case 'mla': {
      const pages = entry.pages?.trim() ?? '';
      return pages.length > 0 ? `(${firstAuthor} ${pages})` : `(${firstAuthor})`;
    }
    case 'chicago':
      return `(${firstAuthor} ${year})`;
    case 'ieee':
      return `[${entry.id}]`;
  }
}

export function generateBibliography(
  entries: CitationEntry[],
  style: CitationStyle
): GenerateBibliographyResponse {
  const sorted = [...entries].sort((a, b) => {
    const aFamily = a.author?.[0]?.family ?? '';
    const bFamily = b.author?.[0]?.family ?? '';
    return aFamily.localeCompare(bFamily);
  });

  const lines = sorted.map((entry, index) => {
    const formatted = formatCitation(entry, style).formatted;
    if (style === 'ieee') {
      return `[${index + 1}] ${formatted}`;
    }
    return formatted;
  });

  return {
    bibliography: lines.join('\n\n'),
    entryCount: entries.length,
  };
}
