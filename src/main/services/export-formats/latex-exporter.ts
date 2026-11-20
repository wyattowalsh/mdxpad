import { writeRegularFile } from './write-regular-file';

import {
  allocateHeadingSlug,
  normalizedHeadingFragment,
  parseAtxHeading,
} from '@shared/lib/markdown-heading';
import { linkedDisplaySpan, linkedDollarSpan, type LinkedDollarPart } from './markdown-linked-math';
import { mathDelimiterAt, mathSpanEnd } from './markdown-math-span';
import {
  disarmLatexFileRead,
  omitTexPictureSyntax,
  texPicturePathUnsafe,
} from './latex-file-command';
import { stripLeadingFrontmatter } from '@shared/lib/frontmatter';
import { prepareMarkdownSource } from '@shared/lib/markdown-math';
import { displayFenceCloses, displayPrefixCloses } from '@shared/lib/promote-display-math';
import { displayMathPrefix, unescapedDelimiterIndex } from '@shared/lib/math-span';
import { renderableMathTex } from '@shared/lib/renderable-math';

import { inlineLocalImages } from './export-image';
import { sanitizeMarkdownHtmlBlocks } from './markdown-html';
import { findHighlight } from './markdown-highlight';
import { nextPhraseTag, type PhraseTag } from './markdown-phrase-tags';

import { isTableRow, markdownTableToLatex, parseMarkdownTable } from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { closesFence, fenceLanguage, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { preparedExportSource } from './markdown-simple-html';
import { renderedSegments } from './markdown-marks';
import { readListContinuation, readSourceLine, type SourceLine } from './markdown-paragraph';
import { latexVerbatimLines } from './latex-verbatim';
import {
  continuesQuote,
  storedQuoteLine,
  takeQuoteContinuation,
  quoteBody,
  quoteFenceOpen,
  quoteHoldsDelimiter,
  quoteMarkerLine,
  quoteToLatex,
} from './markdown-quote';
import { autolinkLength, protectAutolinks, replaceAutolinks } from './markdown-autolink';
import {
  coveredTargetEnd,
  findCodeSpan,
  protectEscapes,
  readCodeSpan,
  restoreEscapes,
} from './markdown-escape';
import { collectEmphasis, renderEmphasis } from './markdown-emphasis';
import { decodeHtmlEntities } from './markdown-entity';
import { safeLinkAddress } from './markdown-export-address';
import { omitLocalMarkdownTargets } from './omit-local-markdown-targets';
import {
  findMarkdownTarget,
  linkDestination,
  linkTitle,
  readMarkdownTarget,
  type MarkdownTarget,
} from './markdown-link';
import {
  isListContinuation,
  listContentColumn,
  nestedListText,
  parseListItem,
  proseStillOpen,
  shouldOpenListItem,
  type ListDelimiter,
  type MarkdownListItem,
} from './markdown-list';
import {
  dedentToColumn,
  listDisplayCloses,
  listFenceOnMarker,
  listMarkerBlock,
  listIndentedCode,
  listThematicBreak,
  openListFence,
  readListFenceLine,
  readListQuoteLine,
  readOpenListQuote,
  type ListFenceState,
} from './markdown-list-fence';
import { splitTaskItem, taskItemLatex } from './markdown-task';
import type { Exporter, ExportOptions, ExportResult } from './types';

const LATEX_BACKSLASH = '\uE000';

const SUPERSCRIPT_DIGIT: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

function latexSuperscripts(text: string): string {
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (run) => {
    const digits = run.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (char) => SUPERSCRIPT_DIGIT[char] ?? '');
    return `\\textsuperscript{${digits}}`;
  });
}

function escapeLatex(text: string): string {
  return latexSuperscripts(
    text
      .replaceAll('\\', LATEX_BACKSLASH)
      .replaceAll('&', '\\&')
      .replaceAll('%', '\\%')
      .replaceAll('$', '\\$')
      .replaceAll('#', '\\#')
      .replaceAll('_', '\\_')
      .replaceAll('{', '\\{')
      .replaceAll('}', '\\}')
      .replaceAll('~', '\\textasciitilde{}')
      .replaceAll('^', '\\textasciicircum{}')
      .replaceAll(LATEX_BACKSLASH, '\\textbackslash{}')
  );
}

function wrapLatex(command: string, content: string): string {
  return `\\${command}{${escapeLatex(content)}}`;
}

const MATH_MARK = '\uE001';

function latexLinkedPart(part: LinkedDollarPart, slots: string[]): string {
  if (part.kind === 'link') {
    return part.text;
  }
  if (part.tex.trim().length === 0) {
    return part.tex;
  }
  slots.push(disarmLatexFileRead(`$${part.tex}$`));
  return `${MATH_MARK}${slots.length - 1}${MATH_MARK}`;
}

function protectLinkedDollar(raw: string, index: number, slots: string[]): { text: string; end: number } | null {
  const linked = linkedDollarSpan(raw, index);
  if (!linked) {
    return null;
  }
  let text = '';
  for (const part of linked.parts) {
    text += latexLinkedPart(part, slots);
  }
  return { text, end: linked.end };
}

function protectLinkLabel(
  raw: string,
  index: number,
  slots: string[]
): { text: string; end: number } | null {
  const target = readMarkdownTarget(raw, index);
  if (target?.start !== index) {
    return null;
  }
  const openLength = raw[index] === '!' ? 2 : 1;
  const labelStart = index + openLength;
  const labelEnd = labelStart + target.label.length;
  const label = appendProtected(raw.slice(labelStart, labelEnd), slots);
  const text = `${raw.slice(index, labelStart)}${label}${raw.slice(labelEnd, target.end)}`;
  return { text, end: target.end };
}

function appendProtected(raw: string, slots: string[]): string {
  let text = '';
  let index = 0;
  while (index < raw.length) {
    if (raw[index] === '`') {
      const span = readCodeSpan(raw, index);
      const end = span ? span.end : index + 1;
      text += raw.slice(index, end);
      index = end;
      continue;
    }
    const link = protectLinkLabel(raw, index, slots);
    if (link) {
      text += link.text;
      index = link.end;
      continue;
    }
    const autolink = autolinkLength(raw, index);
    if (autolink > 0) {
      text += raw.slice(index, index + autolink);
      index += autolink;
      continue;
    }
    const display = linkedDisplaySpan(raw, index);
    if (display) {
      for (const part of display.parts) {
        text += latexLinkedPart(part, slots);
      }
      index = display.end;
      continue;
    }
    const delimiter = mathDelimiterAt(raw, index);
    const end = delimiter === null ? -1 : mathSpanEnd(raw, index, delimiter);
    if (delimiter !== null && end !== -1) {
      slots.push(disarmLatexFileRead(raw.slice(index, end)));
      text += `${MATH_MARK}${slots.length - 1}${MATH_MARK}`;
      index = end;
      continue;
    }
    const linked = raw[index] === '$' ? protectLinkedDollar(raw, index, slots) : null;
    if (linked) {
      text += linked.text;
      index = linked.end;
      continue;
    }
    text += raw[index] ?? '';
    index += 1;
  }
  return text;
}

function protectMath(raw: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  return { text: appendProtected(raw, slots), slots };
}

function restoreMath(formatted: string, slots: readonly string[]): string {
  return formatted.replaceAll(
    new RegExp(`${MATH_MARK}(\\d+)${MATH_MARK}`, 'g'),
    (_match, slotIndex: string) => slots[Number(slotIndex)] ?? ''
  );
}

function convertInlineFormatting(raw: string): string {
  const protectedMath = protectMath(raw);
  return restoreMath(formatInline(protectedMath.text), protectedMath.slots);
}

function latexFilename(src: string): string {
  let value = src;
  try {
    value = decodeURI(src);
  } catch {
    value = src;
  }
  value = value.replaceAll('\\', '/').replaceAll('%', '\\%').replaceAll('}', '');
  return value.includes('_') ? `\\detokenize{${value}}` : value;
}

function decodedGraphicsPath(src: string): string {
  let current = src;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) {
        return current;
      }
      current = next;
    } catch {
      return current;
    }
  }
  return current;
}

function containedGraphicsPath(src: string): string | null {
  const decoded = decodedGraphicsPath(src).replaceAll('\\', '/');
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) {
    return null;
  }
  if (decoded.split('/').some((part) => part === '..')) {
    return null;
  }
  if (texPicturePathUnsafe(src)) {
    return null;
  }
  return src;
}

function latexUrl(value: string): string {
  let result = '';
  for (const char of value) {
    if (char === '\\' || char === '{' || char === '}' || char === ' ') {
      result += `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
      continue;
    }
    result += char;
  }
  return result;
}

function latexTitleBody(title: string): string {
  let result = '';
  let index = 0;
  while (index < title.length) {
    if (title.startsWith('\\(', index)) {
      const end = unescapedDelimiterIndex(title, index + 2, '\\)');
      if (end !== -1) {
        result += `$${renderableMathTex(title.slice(index + 2, end))}$`;
        index = end + 2;
        continue;
      }
    }
    const next = title.indexOf('\\(', index);
    const end = next === -1 ? title.length : next;
    result += escapeLatex(title.slice(index, end));
    index = end;
  }
  return result;
}

function latexCaption(title: string | null): string {
  return title ? ` \\textit{${latexTitleBody(title)}}` : '';
}

function latexImage(src: string, alt: string, title: string | null): string {
  const caption = latexCaption(title);
  if (/^https?:\/\//i.test(src)) {
    const label = alt.length > 0 ? formatProtected(alt) : escapeLatex(src);
    return `\\href{${latexUrl(src)}}{${label}}${caption}`;
  }
  const local = containedGraphicsPath(src);
  if (local === null) {
    const label = alt.length > 0 ? formatProtected(alt) : escapeLatex(src);
    return `${label}${caption}`;
  }
  const described = alt.length > 0 && alt !== src ? ` ${formatProtected(alt)}` : '';
  return `\\includegraphics{${latexFilename(local)}}${described}${caption}`;
}

function restoreLatexAutolinks(
  value: string,
  links: ReturnType<typeof protectAutolinks>['links']
): string {
  return replaceAutolinks(value, links, (link, nested) =>
    nested ? escapeLatex(link.text) : `\\href{${latexUrl(link.href)}}{${escapeLatex(link.text)}}`
  );
}

function nextRawStrike(raw: string, from: number): number {
  let index = from;
  while (index < raw.length) {
    const code = findCodeSpan(raw, index);
    if (code?.start === index) {
      index = code.end;
      continue;
    }
    if (raw.startsWith('~~', index)) {
      return index;
    }
    index += 1;
  }
  return -1;
}

function insideEmphasis(raw: string, point: number): boolean {
  return collectEmphasis(raw).some((match) => match.start < point && match.end > point);
}

function nextProtectedBoundary(raw: string, from: number): number {
  for (let index = from; index < raw.length; index += 1) {
    const code = findCodeSpan(raw, index);
    const atCode = code?.start === index;
    if (!atCode && !raw.startsWith('~~', index)) {
      continue;
    }
    if (insideEmphasis(raw, index)) {
      if (code !== null && code.start === index) {
        index = code.end - 1;
      }
      continue;
    }
    return coveredTargetEnd(raw, index) ?? index;
  }
  return raw.length;
}

function formatProtected(raw: string): string {
  let result = '';
  let index = 0;
  while (index < raw.length) {
    const code = findCodeSpan(raw, index);
    if (code?.start === index) {
      result += wrapLatex('texttt', code.text);
      index = code.end;
      continue;
    }
    if (raw.startsWith('~~', index)) {
      const end = nextRawStrike(raw, index + 2);
      if (end !== -1) {
        result += `\\sout{${formatProtected(raw.slice(index + 2, end))}}`;
        index = end + 2;
        continue;
      }
    }
    const next = nextProtectedBoundary(raw, index + 1);
    result += formatInlineMarks(raw.slice(index, next));
    index = next;
  }
  return result;
}

function latexTarget(prefix: string, target: MarkdownTarget): string {
  const before = latexText(prefix);
  if (target.image) {
    const path = linkDestination(decodeHtmlEntities(target.destination));
    const alt = target.label.length > 0 ? target.label : path;
    return before + latexImage(path, alt, linkTitle(decodeHtmlEntities(target.destination)));
  }
  return before + latexHref(target.label, target.destination);
}

function latexPhraseWrap(kind: PhraseTag['kind'], inner: string): string {
  switch (kind) {
    case 'underline':
      return `\\uline{${inner}}`;
    case 'mark':
      return `\\colorbox{yellow}{${inner}}`;
    case 'superscript':
      return `\\textsuperscript{${inner}}`;
    case 'subscript':
      return `\\textsubscript{${inner}}`;
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

function latexPhrase(value: string, tag: PhraseTag): string {
  const before = tag.start > 0 ? latexText(value.slice(0, tag.start)) : '';
  const inner = latexText(tag.inner);
  const after = tag.end < value.length ? latexText(value.slice(tag.end)) : '';
  return `${before}${latexPhraseWrap(tag.kind, inner)}${after}`;
}

function latexText(value: string): string {
  const highlight = findHighlight(value, 0);
  if (highlight) {
    const before = highlight.start > 0 ? latexText(value.slice(0, highlight.start)) : '';
    const inner = latexText(highlight.inner);
    const after = highlight.end < value.length ? latexText(value.slice(highlight.end)) : '';
    return `${before}\\colorbox{yellow}{${inner}}${after}`;
  }
  const tag = nextPhraseTag(value, 0);
  if (tag) {
    return latexPhrase(value, tag);
  }
  return value
    .split(/<br\s*\/?>/gi)
    .map((part) => escapeLatex(decodeHtmlEntities(part)).replaceAll('\\textasciitilde{}', '~'))
    .join('\\newline ');
}

function formatLatexPlain(raw: string): string {
  let result = '';
  let cursor = 0;
  while (cursor < raw.length) {
    const code = findCodeSpan(raw, cursor);
    const target = findMarkdownTarget(raw, cursor);
    const codeAt = code?.start ?? raw.length;
    const targetAt = target?.start ?? raw.length;
    if (code && codeAt <= targetAt) {
      result += latexText(raw.slice(cursor, code.start));
      result += wrapLatex('texttt', code.text);
      cursor = code.end;
      continue;
    }
    if (target) {
      result += latexTarget(raw.slice(cursor, target.start), target);
      cursor = target.end;
      continue;
    }
    return result + latexText(raw.slice(cursor));
  }
  return result;
}

function applyLatexStrike(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (!value.startsWith('~~', index)) {
      result += value[index] ?? '';
      index += 1;
      continue;
    }
    const end = value.indexOf('~~', index + 2);
    if (end === -1) {
      return result + value.slice(index);
    }
    result += `\\sout{${value.slice(index + 2, end)}}`;
    index = end + 2;
  }
  return result;
}

function formatInlineMarks(raw: string): string {
  const emphasized = renderEmphasis(raw, formatLatexPlain, (size, inner) =>
    size === 2 ? `\\textbf{${inner}}` : `\\textit{${inner}}`
  );
  return applyLatexStrike(emphasized).replaceAll('~', '\\textasciitilde{}');
}

function latexLinkTitle(rawHref: string): string {
  return latexCaption(linkTitle(decodeHtmlEntities(rawHref)));
}

function latexHref(label: string, rawHref: string): string {
  const destination = linkDestination(decodeHtmlEntities(rawHref));
  const caption = latexLinkTitle(rawHref);
  const anchor = normalizedHeadingFragment(destination);
  if (anchor) {
    return `\\hyperref[${anchor}]{${formatProtected(label)}}${caption}`;
  }
  const safe = safeLinkAddress(destination);
  if (safe === null || safe.startsWith('/') || safe.startsWith('\\')) {
    return `${formatProtected(label)}${caption}`;
  }
  return `\\href{${latexUrl(safe)}}{${formatProtected(label)}}${caption}`;
}

function formatInline(source: string): string {
  const escaped = protectEscapes(source);
  const protectedLinks = protectAutolinks(escaped.text);
  return restoreEscapes(
    restoreLatexAutolinks(formatProtected(protectedLinks.text), protectedLinks.links),
    escaped.chars,
    escapeLatex
  );
}

const HEADING_COMMANDS: Record<number, string> = {
  1: 'section',
  2: 'subsection',
  3: 'subsubsection',
  4: 'paragraph',
  5: 'subparagraph',
  6: 'subparagraph',
};

function getHeadingCommand(level: number): string {
  return HEADING_COMMANDS[level] ?? 'subparagraph';
}

interface LatexListFrame {
  readonly ordered: boolean;
  readonly level: number;
  readonly delimiter: '' | ListDelimiter;
  column: number;
}

function sameLatexList(frame: LatexListFrame, item: MarkdownListItem): boolean {
  return (
    frame.level === item.level &&
    frame.ordered === item.ordered &&
    frame.delimiter === (item.delimiter ?? '')
  );
}

interface ListState {
  stack: LatexListFrame[];
  break: boolean;
  itemLines: SourceLine[];
  column: number | null;
  itemFence: ListFenceState | null;
  itemQuote: string[] | null;
  itemTable: string[] | null;
  itemMath: string[] | null;
  itemCode: string[] | null;
  sealed: boolean;
  paragraphBreak: boolean;
  tailLines: SourceLine[] | null;
  laterLines: readonly string[];
  laterIndex: number;
}

function closeLatexFrame(output: string[], stack: LatexListFrame[]): void {
  const frame = stack.pop();
  output.push(frame?.ordered ? '\\end{enumerate}' : '\\end{itemize}');
}

function closeLatexLists(output: string[], stack: LatexListFrame[]): void {
  while (stack.length > 0) {
    closeLatexFrame(output, stack);
  }
}

function closeLatexListsTo(output: string[], stack: LatexListFrame[], depth: number): void {
  while (stack.length - 1 > depth) {
    closeLatexFrame(output, stack);
  }
}

function listDepthForIndent(stack: readonly LatexListFrame[], line: string): number {
  const spaces = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
  let depth = stack.length - 1;
  while (depth >= 0 && spaces < (stack[depth]?.column ?? 0)) {
    depth -= 1;
  }
  return depth;
}

function latexVerbatim(lines: readonly string[]): string[] {
  return latexVerbatimLines(lines);
}

function processCodeBlockLine(
  line: string,
  output: string[],
  fence: string | null,
  listState: ListState,
  codeLines: string[]
): string | null {
  if (fence) {
    if (!closesFence(line, fence)) {
      return fence;
    }
    output.push(...latexVerbatim(codeLines));
    codeLines.length = 0;
    return null;
  }
  const marker = openingFence(line);
  if (!marker) {
    return null;
  }
  closeLatexLists(output, listState.stack);
  const language = fenceLanguage(line);
  if (language.length > 0) {
    output.push(`{\\footnotesize\\ttfamily ${escapeLatex(language)}}`);
  }
  return marker;
}

function resetListState(output: string[], listState: ListState): void {
  closeLatexLists(output, listState.stack);
}

function latexItemLabel(item: MarkdownListItem): string {
  if (item.delimiter === '+') {
    return '+';
  }
  if (item.delimiter === '*') {
    return '*';
  }
  return '';
}

function openLatexEnvironment(output: string[], item: MarkdownListItem): void {
  output.push(item.ordered ? '\\begin{enumerate}' : '\\begin{itemize}');
  if (!item.ordered || item.delimiter !== ')') {
    return;
  }
  const labels = [
    'labelenumi',
    'labelenumii',
    'labelenumiii',
    'labelenumiv',
    'labelenumv',
    'labelenumvi',
  ];
  const refs = ['theenumi', 'theenumii', 'theenumiii', 'theenumiv', 'theenumv', 'theenumvi'];
  const label = labels[item.level] ?? 'labelenumi';
  const ref = refs[item.level] ?? 'theenumi';
  output.push(`\\renewcommand{\\${label}}{\\${ref})}`);
}

function openLatexListItem(
  output: string[],
  stack: LatexListFrame[],
  item: MarkdownListItem,
  formatted: string,
  column: number
): void {
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (!top || sameLatexList(top, item) || top.level < item.level) {
      break;
    }
    output.push(top.ordered ? '\\end{enumerate}' : '\\end{itemize}');
    stack.pop();
  }
  const top = stack[stack.length - 1];
  if (!top || top.level < item.level) {
    openLatexEnvironment(output, item);
    if (item.ordered && item.start !== 1) {
      const counters = ['enumi', 'enumii', 'enumiii', 'enumiv', 'enumv', 'enumvi'];
      const counter = counters[item.level] ?? 'enumi';
      output.push(`\\setcounter{${counter}}{${item.start - 1}}`);
    }
    stack.push({
      ordered: item.ordered,
      level: item.level,
      column,
      delimiter: item.delimiter ?? '',
    });
  } else if (top.level === item.level) {
    top.column = column;
  }
  const label = latexItemLabel(item);
  output.push(label.length > 0 ? `  \\item[${label}] ${formatted}` : `  \\item ${formatted}`);
}

function renderLatexItem(lines: readonly SourceLine[]): string {
  const first = lines[0] ?? { text: '', hardBreak: false };
  const task = splitTaskItem(first.text);
  const body = task ? [{ text: task.body, hardBreak: first.hardBreak }, ...lines.slice(1)] : lines;
  const formatted = renderedSegments(body)
    .map((text, index) => {
      const piece = convertInlineFormatting(text);
      return index === 0 ? piece : `\\\\\n${piece}`;
    })
    .join('');
  return task ? taskItemLatex(task.checked, formatted) : formatted;
}

function takeLatexMarkerMath(
  raw: string,
  item: MarkdownListItem,
  output: string[],
  listState: ListState
): boolean {
  const lead = item.text.trim() === '$$' ? '' : displayMathPrefix(item.text);
  const column = listContentColumn(raw) ?? 2;
  if (
    lead === null ||
    !listDisplayCloses(listState.laterLines, listState.laterIndex, column)
  ) {
    return false;
  }
  listState.itemLines =
    lead.length > 0 ? [{ text: lead, hardBreak: readSourceLine(raw).hardBreak }] : [];
  listState.itemMath = [];
  listState.paragraphBreak = false;
  listState.tailLines = null;
  listState.sealed = false;
  const formatted = lead.length > 0 ? renderLatexItem(listState.itemLines) : '';
  openLatexListItem(output, listState.stack, item, formatted, column);
  listState.column = column;
  return true;
}

function takeLatexNestedMarker(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>,
  columnOverride?: number
): boolean {
  const item = parseListItem(raw);
  if (!item || isThematicBreak(item.text) || !nestedListText(item.text)) {
    return false;
  }
  const column = columnOverride ?? listContentColumn(raw) ?? 2;
  openLatexListItem(output, listState.stack, item, '', column);
  listState.itemLines = [];
  listState.column = column;
  listState.paragraphBreak = false;
  listState.tailLines = null;
  listState.sealed = false;
  const child = `${' '.repeat(column)}${item.text}`;
  if (!takeLatexNestedMarker(child, output, listState, counts, column)) {
    processListItem(child, output, listState, counts, column);
  }
  listState.column = column;
  return true;
}

function processListItem(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>,
  columnOverride?: number
): boolean {
  const item = parseListItem(raw);
  if (!item) {
    return false;
  }
  if (columnOverride === undefined && takeLatexNestedMarker(raw, output, listState, counts)) {
    return true;
  }
  if (takeLatexMarkerMath(raw, item, output, listState)) {
    return true;
  }
  const heading = parseAtxHeading(item.text);
  listState.itemLines = heading
    ? []
    : [{ text: item.text, hardBreak: readSourceLine(raw).hardBreak }];
  listState.paragraphBreak = heading !== null;
  listState.tailLines = null;
  listState.sealed = heading !== null;
  const formatted = heading
    ? latexLabeledHeading(
        getHeadingCommand(heading.depth),
        convertInlineFormatting(heading.text),
        heading.text,
        counts
      )
    : renderLatexItem(listState.itemLines);
  const column = columnOverride ?? listContentColumn(raw) ?? 2;
  openLatexListItem(output, listState.stack, item, formatted, column);
  listState.column = column;
  return true;
}

function writeLatexTail(output: string[], listState: ListState, raw: string): void {
  const source = readListContinuation(raw, listState.column ?? 2);
  if (listState.paragraphBreak || !listState.tailLines) {
    listState.tailLines = [source];
    listState.paragraphBreak = false;
    output.push(renderLatexItem(listState.tailLines));
    return;
  }
  listState.tailLines.push(source);
  output[output.length - 1] = renderLatexItem(listState.tailLines);
}

function latexListFrames(stack: readonly LatexListFrame[]): {
  level: number;
  kind: 'ul' | 'ol';
  delimiter: '' | ListDelimiter;
}[] {
  return stack.map((frame) => ({
    level: frame.level,
    kind: frame.ordered ? 'ol' : 'ul',
    delimiter: frame.delimiter,
  }));
}

function latexProseOpen(prose: readonly SourceLine[], listState: ListState): boolean {
  return proseStillOpen(
    prose.length > 0,
    listState.break,
    listState.itemLines.some((line) => line.text.trim().length > 0)
  );
}

function indentedIntoList(raw: string, column: number): boolean {
  const spaces = /^ */.exec(raw.replaceAll('\t', '    '))?.[0].length ?? 0;
  return raw.trim().length > 0 && spaces >= column;
}

function takeLatexListContinuation(raw: string, output: string[], listState: ListState): boolean {
  const column = listState.column ?? 2;
  const marker = parseListItem(raw);
  const itemOpen = latexProseOpen([], listState);
  const joinsMarker =
    marker !== null &&
    !shouldOpenListItem(marker, latexListFrames(listState.stack), listState.break, itemOpen) &&
    indentedIntoList(raw, column);
  if (listState.stack.length === 0 || (!isListContinuation(raw, column) && !joinsMarker)) {
    return false;
  }
  if (listState.sealed) {
    output.push(convertInlineFormatting(readSourceLine(raw).text));
    return true;
  }
  if (listState.paragraphBreak || listState.tailLines) {
    writeLatexTail(output, listState, raw);
    return true;
  }
  const last = output[output.length - 1];
  if (!last?.includes('\\item ')) {
    return false;
  }
  listState.itemLines.push(readListContinuation(raw, column));
  const at = last.lastIndexOf('\\item ');
  const prefix = last.slice(0, at + '\\item '.length);
  output[output.length - 1] = `${prefix}${renderLatexItem(listState.itemLines)}`;
  return true;
}

function latexLabeledHeading(
  command: string,
  formatted: string,
  slugSource: string,
  counts: Map<string, number>
): string {
  return `\\${command}{${formatted}}\\label{${allocateHeadingSlug(slugSource, counts)}}`;
}

function flushLatexProse(output: string[], prose: SourceLine[]): void {
  if (prose.length === 0) {
    return;
  }
  const segments = renderedSegments(prose);
  prose.length = 0;
  segments.forEach((text, index) => {
    const formatted = convertInlineFormatting(text);
    output.push(index < segments.length - 1 ? `${formatted}\\\\` : formatted);
  });
}

function takeLatexSetext(
  output: string[],
  raw: string,
  counts: Map<string, number>,
  prose: SourceLine[]
): boolean {
  const level = setextLevel(raw);
  if (level === null || prose.length === 0) {
    return false;
  }
  const text = prose
    .map((line) => line.text)
    .filter((line) => line.length > 0)
    .join(' ');
  prose.length = 0;
  if (text.length === 0) {
    return false;
  }
  const command = level === 1 ? 'section' : 'subsection';
  output.push(latexLabeledHeading(command, convertInlineFormatting(text), text, counts));
  return true;
}

function returnLatexListItem(raw: string, output: string[], listState: ListState): void {
  const depth = listDepthForIndent(listState.stack, raw);
  if (depth < 0) {
    resetListState(output, listState);
    return;
  }
  closeLatexListsTo(output, listState.stack, depth);
  const frame = listState.stack[depth];
  if (frame) {
    listState.column = frame.column;
  }
  listState.sealed = false;
  listState.itemLines = [];
  listState.paragraphBreak = true;
  listState.tailLines = null;
}

function takeLatexListBreak(raw: string, output: string[], listState: ListState): boolean {
  const source = readSourceLine(raw);
  if (source.text !== '') {
    if (
      listState.break &&
      parseListItem(raw) === null &&
      !isListContinuation(raw, listState.column ?? 2)
    ) {
      returnLatexListItem(raw, output, listState);
    }
    listState.break = false;
    return false;
  }
  if (listState.stack.length > 0) {
    listState.break = true;
    listState.paragraphBreak = true;
    listState.tailLines = null;
  } else {
    resetListState(output, listState);
    listState.break = false;
  }
  output.push('');
  return true;
}

function takeLatexHeading(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>,
  prose: SourceLine[]
): boolean {
  const trimmed = readSourceLine(raw).text;
  const heading = parseAtxHeading(trimmed);
  if (heading && listState.stack.length > 0 && isListContinuation(raw, listState.column ?? 2)) {
    flushLatexProse(output, prose);
    const cmd = getHeadingCommand(heading.depth);
    output.push(
      latexLabeledHeading(cmd, convertInlineFormatting(heading.text), heading.text, counts)
    );
    listState.break = false;
    listState.paragraphBreak = true;
    listState.itemLines = [];
    return true;
  }
  if (heading) {
    flushLatexProse(output, prose);
    resetListState(output, listState);
    const cmd = getHeadingCommand(heading.depth);
    output.push(
      latexLabeledHeading(cmd, convertInlineFormatting(heading.text), heading.text, counts)
    );
    return true;
  }
  if (!isThematicBreak(trimmed)) {
    return false;
  }
  flushLatexProse(output, prose);
  resetListState(output, listState);
  output.push('\\noindent\\rule{\\textwidth}{0.4pt}');
  return true;
}

function takeLatexTailSetext(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>
): boolean {
  if (!listState.tailLines || listState.tailLines.length === 0 || listState.column === null) {
    return false;
  }
  const level = setextLevel(dedentToColumn(raw, listState.column));
  if (level === null) {
    return false;
  }
  const tail = listState.tailLines
    .map((item) => item.text)
    .filter((item) => item.length > 0)
    .join(' ');
  if (tail.length === 0) {
    return false;
  }
  output.pop();
  const command = getHeadingCommand(level);
  output.push(latexLabeledHeading(command, convertInlineFormatting(tail), tail, counts));
  listState.tailLines = null;
  listState.sealed = true;
  listState.paragraphBreak = true;
  listState.break = false;
  return true;
}

function replaceLatexItemHeading(
  output: string[],
  listState: ListState,
  counts: Map<string, number>,
  level: 1 | 2,
  text: string
): boolean {
  const last = output[output.length - 1];
  if (!last?.includes('\\item ')) {
    return false;
  }
  const at = last.lastIndexOf('\\item ');
  const command = getHeadingCommand(level);
  const heading = latexLabeledHeading(command, convertInlineFormatting(text), text, counts);
  output[output.length - 1] = `${last.slice(0, at)}\\item ${heading}`;
  listState.itemLines = [];
  listState.sealed = true;
  listState.paragraphBreak = true;
  listState.break = false;
  return true;
}

function takeLatexItemSetext(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>
): boolean {
  if (
    listState.itemFence ||
    listState.itemQuote ||
    listState.itemTable ||
    listState.itemMath ||
    listState.itemCode
  ) {
    return false;
  }
  if (takeLatexTailSetext(raw, output, listState, counts)) {
    return true;
  }
  if (
    listState.stack.length === 0 ||
    listState.column === null ||
    listState.break ||
    listState.sealed ||
    listState.paragraphBreak ||
    listState.itemLines.length === 0
  ) {
    return false;
  }
  const level = setextLevel(dedentToColumn(raw, listState.column));
  if (level === null) {
    return false;
  }
  const text = listState.itemLines
    .map((item) => item.text)
    .filter((item) => item.length > 0)
    .join(' ');
  if (text.length === 0) {
    return false;
  }
  return replaceLatexItemHeading(output, listState, counts, level, text);
}

function takeLatexItemRule(raw: string, output: string[], listState: ListState): boolean {
  if (
    listState.stack.length === 0 ||
    listState.column === null ||
    listState.itemFence ||
    listState.itemQuote ||
    listState.itemTable ||
    listState.itemMath ||
    listState.itemCode ||
    !listThematicBreak(raw, listState.column)
  ) {
    return false;
  }
  output.push('\\noindent\\rule{\\textwidth}{0.4pt}');
  listState.sealed = true;
  listState.paragraphBreak = true;
  listState.break = false;
  return true;
}

function processMarkdownLine(
  raw: string,
  output: string[],
  listState: ListState,
  counts: Map<string, number>,
  prose: SourceLine[]
): void {
  if (takeLatexSetext(output, raw, counts, prose)) {
    return;
  }
  if (readSourceLine(raw).text.length === 0) {
    flushLatexProse(output, prose);
  }
  if (takeLatexListBreak(raw, output, listState)) {
    return;
  }
  if (
    takeLatexItemSetext(raw, output, listState, counts) ||
    takeLatexItemRule(raw, output, listState)
  ) {
    return;
  }
  if (takeLatexHeading(raw, output, listState, counts, prose)) {
    return;
  }
  const source = readSourceLine(raw);
  const marker = parseListItem(raw);
  const openMarker =
    marker !== null &&
    shouldOpenListItem(
      marker,
      latexListFrames(listState.stack),
      listState.break,
      latexProseOpen(prose, listState)
    );
  if (openMarker) {
    flushLatexProse(output, prose);
  }
  if (openMarker && processListItem(raw, output, listState, counts)) {
    listState.column = listContentColumn(raw);
    openLatexMarkerBlock(raw, output, listState);
    return;
  }
  if (takeLatexListContinuation(raw, output, listState)) {
    return;
  }

  prose.push(source);
}

function flushLatexTable(output: string[], tableLines: string[]): void {
  if (tableLines.length === 0) {
    return;
  }
  const lines = tableLines.splice(0, tableLines.length);
  const table = parseMarkdownTable(lines);
  if (!table) {
    for (const line of lines) {
      output.push(convertInlineFormatting(line));
    }
    return;
  }
  output.push(markdownTableToLatex(table, convertInlineFormatting));
}

function flushLatexQuote(
  output: string[],
  quoteLines: string[],
  slugs?: Map<string, number>
): void {
  if (quoteLines.length === 0) {
    return;
  }
  const lines = quoteLines.splice(0, quoteLines.length);
  output.push(quoteToLatex(lines, convertInlineFormatting, slugs));
}

function takeLatexItemQuote(build: LatexBuild, line: string): boolean {
  const list = build.listState;
  if (list.itemFence || build.fence) {
    return false;
  }
  if (list.itemQuote) {
    const text = readListQuoteLine(line, list.column ?? 2);
    if (text === null) {
      build.output.push(quoteToLatex(list.itemQuote, convertInlineFormatting, build.slugCounts));
      list.itemQuote = null;
      list.sealed = true;
      return false;
    }
    list.itemQuote.push(quoteMarkerLine(text));
    return true;
  }
  if (list.stack.length === 0 || list.column === null) {
    return false;
  }
  const opened = readOpenListQuote(line, list.column);
  if (opened === null) {
    return false;
  }
  list.itemQuote = [opened];
  list.break = false;
  return true;
}

function takeLatexQuote(
  output: string[],
  line: string,
  quoteLines: string[],
  slugs?: Map<string, number>
): boolean {
  const body = quoteBody(line);
  if (body !== null) {
    quoteLines.push(storedQuoteLine(quoteLines, line));
    return true;
  }
  if (takeQuoteContinuation(quoteLines, line)) {
    return true;
  }
  if (quoteLines.length > 0) {
    flushLatexQuote(output, quoteLines, slugs);
  }
  return false;
}

function takeLatexItemCode(build: LatexBuild, line: string): boolean {
  const list = build.listState;
  if (list.itemFence || list.itemQuote || list.itemTable || list.itemMath || build.fence) {
    return false;
  }
  const column = list.column ?? 2;
  if (list.itemCode) {
    if (line.trim().length === 0) {
      list.itemCode.push('');
      return true;
    }
    const body = listIndentedCode(line, column);
    if (body !== null) {
      list.itemCode.push(body);
      return true;
    }
    while (list.itemCode[list.itemCode.length - 1] === '') {
      list.itemCode.pop();
    }
    build.output.push(...latexVerbatim(list.itemCode));
    list.itemCode = null;
    list.sealed = true;
    list.paragraphBreak = true;
    return false;
  }
  if (list.stack.length === 0 || list.column === null) {
    return false;
  }
  const opened = listIndentedCode(line, column);
  if (opened === null || !list.break) {
    return false;
  }
  list.itemCode = [opened];
  list.break = false;
  return true;
}

function takeLatexItemMath(build: LatexBuild, line: string): boolean {
  const list = build.listState;
  if (list.itemFence || list.itemQuote || list.itemTable || build.fence) {
    return false;
  }
  const column = list.column ?? 2;
  if (list.itemMath) {
    const body = dedentToColumn(line, column);
    const closing = body.trim() === '$$' ? '' : displayMathPrefix(body);
    if (closing !== null) {
      if (closing.length > 0) {
        list.itemMath.push(closing);
      }
      build.output.push('$$', ...disarmedMathLines(list.itemMath), '$$');
      list.itemMath = null;
      list.sealed = true;
      return true;
    }
    list.itemMath.push(body);
    return true;
  }
  if (list.stack.length === 0 || list.column === null || !isListContinuation(line, column)) {
    return false;
  }
  const opened = dedentToColumn(line, column);
  if (quoteBody(opened) !== null) {
    return false;
  }
  const lead = opened.trim() === '$$' ? '' : displayMathPrefix(opened);
  if (lead === null || !listDisplayCloses(list.laterLines, list.laterIndex, column)) {
    return false;
  }
  if (lead.length > 0) {
    const formatted = convertInlineFormatting(lead);
    const last = build.output[build.output.length - 1] ?? '';
    if (!list.break && last.includes('\\item')) {
      build.output[build.output.length - 1] = `${last} ${formatted}`;
    } else {
      build.output.push(formatted);
    }
  }
  list.itemMath = [];
  list.break = false;
  return true;
}

function takeLatexItemTable(build: LatexBuild, line: string): boolean {
  const list = build.listState;
  if (list.itemFence || list.itemQuote || build.fence) {
    return false;
  }
  const column = list.column ?? 2;
  if (list.itemTable) {
    if (isListContinuation(line, column) && isTableRow(line.trim())) {
      list.itemTable.push(line.trim());
      return true;
    }
    const rows = list.itemTable;
    list.itemTable = null;
    const table = parseMarkdownTable(rows);
    build.output.push(
      table ? markdownTableToLatex(table, convertInlineFormatting) : rows.join('\n')
    );
    list.sealed = true;
    return false;
  }
  if (list.stack.length === 0 || list.column === null) {
    return false;
  }
  if (!isListContinuation(line, column) || !isTableRow(line.trim())) {
    return false;
  }
  list.itemTable = [line.trim()];
  list.break = false;
  return true;
}

function takeLatexTable(output: string[], line: string, tableLines: string[]): boolean {
  if (isTableRow(line)) {
    tableLines.push(line);
    return true;
  }
  if (tableLines.length > 0) {
    flushLatexTable(output, tableLines);
  }
  return false;
}

interface LatexBuild {
  output: string[];
  prose: SourceLine[];
  fence: string | null;
  codeLines: string[];
  inDisplayMath: boolean;
  displayLines: string[];
  laterLines: readonly string[];
  laterIndex: number;
  tableLines: string[];
  quoteLines: string[];
  listState: ListState;
  slugCounts: Map<string, number>;
}

function clearLatexItemText(output: string[]): void {
  const last = output[output.length - 1];
  if (!last?.includes('\\item ')) {
    return;
  }
  const at = last.lastIndexOf('\\item ');
  output[output.length - 1] = last.slice(0, at + '\\item '.length).trimEnd();
}

function openLatexMarkerBlock(raw: string, output: string[], listState: ListState): void {
  openLatexMarkerFence(raw, output, listState);
  if (listState.itemFence) {
    return;
  }
  const block = listMarkerBlock(parseListItem(raw)?.text ?? '');
  if (block === null) {
    return;
  }
  if (block.kind === 'math' && block.lead) {
    listState.itemMath = [];
    return;
  }
  clearLatexItemText(output);
  listState.itemLines = [];
  if (block.kind === 'rule') {
    output.push('\\noindent\\rule{\\textwidth}{0.4pt}');
    listState.sealed = true;
    return;
  }
  if (block.kind === 'math' && block.lines.length > 0) {
    output.push('$$', ...block.lines.map(disarmLatexFileRead), '$$');
    listState.sealed = true;
    return;
  }
  if (block.kind === 'math') {
    listState.itemMath = [];
    return;
  }
  if (block.kind === 'table') {
    listState.itemTable = [block.row];
    return;
  }
  listState.itemQuote = [quoteMarkerLine(block.text)];
}

function openLatexMarkerFence(raw: string, output: string[], listState: ListState): void {
  const fence = listFenceOnMarker(raw, listState.column ?? 2);
  listState.sealed = fence !== null;
  listState.itemFence = null;
  if (!fence) {
    return;
  }
  const last = output[output.length - 1];
  if (last?.includes('\\item ')) {
    const at = last.lastIndexOf('\\item ');
    output[output.length - 1] = last.slice(0, at + '\\item '.length).trimEnd();
  }
  listState.itemLines = [];
  listState.itemFence = {
    marker: fence.marker,
    language: fence.language,
    indent: fence.indent,
    lines: [],
  };
}

function writeLatexItemFence(output: string[], fence: ListFenceState): void {
  if (fence.language.length > 0) {
    output.push(`{\\footnotesize\\ttfamily ${escapeLatex(fence.language)}}`);
  }
  output.push(...latexVerbatim(fence.lines));
}

function takeLatexItemFence(build: LatexBuild, line: string): boolean {
  const list = build.listState;
  if (list.itemFence) {
    if (readListFenceLine(list.itemFence, line, list.column ?? 2) === 'closed') {
      writeLatexItemFence(build.output, list.itemFence);
      list.itemFence = null;
      list.sealed = true;
    }
    return true;
  }
  if (list.stack.length === 0 || list.column === null || build.fence) {
    return false;
  }
  const opened = openListFence(line, list.column);
  if (!opened) {
    return false;
  }
  list.itemFence = {
    marker: opened.marker,
    language: opened.language,
    indent: opened.indent,
    lines: [],
  };
  list.break = false;
  return true;
}

function disarmedMathLines(lines: readonly string[]): string[] {
  if (lines.length === 0) {
    return [];
  }
  return disarmLatexFileRead(lines.join('\n')).split('\n');
}

function flushDisplayMath(build: LatexBuild): void {
  build.output.push(...disarmedMathLines(build.displayLines));
  build.displayLines = [];
}

function closeOpenDisplayMath(build: LatexBuild): void {
  if (!build.inDisplayMath) {
    return;
  }
  flushDisplayMath(build);
  build.output.push('$$');
}

function openDisplayMath(build: LatexBuild): void {
  flushLatexProse(build.output, build.prose);
  flushLatexTable(build.output, build.tableLines);
  flushLatexQuote(build.output, build.quoteLines, build.slugCounts);
  resetListState(build.output, build.listState);
  build.output.push('$$');
  build.inDisplayMath = true;
}

function takeOpenedDisplay(build: LatexBuild, line: string): boolean {
  const trimmed = line.trim();
  if (build.inDisplayMath || !trimmed.startsWith('$$') || trimmed === '$$') {
    return false;
  }
  if (mathSpanEnd(trimmed, 0, '$$') === trimmed.length) {
    return false;
  }
  openDisplayMath(build);
  const rest = trimmed.slice(2).trim();
  if (rest.length > 0) {
    build.displayLines.push(rest);
  }
  return true;
}

function latexDisplayStaysText(build: LatexBuild, line: string, prefix: string | null): boolean {
  if (build.inDisplayMath) {
    return false;
  }
  if (prefix !== null) {
    return !displayPrefixCloses(build.laterLines, build.laterIndex);
  }
  return (
    line.trim() === '$$' &&
    !quoteHoldsDelimiter(build.quoteLines, line) &&
    !displayFenceCloses(build.laterLines, build.laterIndex)
  );
}

function takeLatexDisplay(build: LatexBuild, line: string): boolean {
  if (takeOpenedDisplay(build, line)) {
    return true;
  }
  const quoted = quoteBody(line) !== null || quoteBody(line.trimStart()) !== null;
  const prefix = !quoted && parseListItem(line) === null ? displayMathPrefix(line) : null;
  if (latexDisplayStaysText(build, line, prefix)) {
    return false;
  }
  if (prefix !== null && !build.inDisplayMath) {
    build.prose.push(readSourceLine(prefix));
    openDisplayMath(build);
    return true;
  }
  if (prefix !== null && build.inDisplayMath) {
    build.displayLines.push(prefix);
    flushDisplayMath(build);
    build.output.push('$$');
    build.inDisplayMath = false;
    return true;
  }
  if (line.trim() !== '$$' && !build.inDisplayMath) {
    return false;
  }
  if (line.trim() === '$$') {
    if (!build.inDisplayMath && quoteHoldsDelimiter(build.quoteLines, line)) {
      return false;
    }
    flushLatexProse(build.output, build.prose);
    flushLatexTable(build.output, build.tableLines);
    flushLatexQuote(build.output, build.quoteLines, build.slugCounts);
    if (build.inDisplayMath) {
      flushDisplayMath(build);
    }
    if (!build.inDisplayMath) {
      resetListState(build.output, build.listState);
    }
    build.output.push('$$');
    build.inDisplayMath = !build.inDisplayMath;
    return true;
  }
  build.displayLines.push(line);
  return true;
}

function holdQuoteFence(build: LatexBuild, line: string): boolean {
  if (!quoteFenceOpen(build.quoteLines)) {
    return false;
  }
  build.quoteLines.push(storedQuoteLine(build.quoteLines, line));
  return true;
}

function appendLatexSourceLine(build: LatexBuild, line: string): void {
  if (takeLatexItemCode(build, line) || takeLatexItemFence(build, line) || holdQuoteFence(build, line)) {
    return;
  }
  const wasInCodeBlock = build.fence;
  build.fence = processCodeBlockLine(
    line,
    build.output,
    build.fence,
    build.listState,
    build.codeLines
  );
  if (wasInCodeBlock !== build.fence) {
    flushLatexProse(build.output, build.prose);
    flushLatexTable(build.output, build.tableLines);
    flushLatexQuote(build.output, build.quoteLines, build.slugCounts);
    return;
  }
  if (build.fence) {
    build.codeLines.push(line);
    return;
  }
  if (takeLatexItemMath(build, line) || takeLatexDisplay(build, line)) {
    return;
  }
  if (takeLatexItemTable(build, line)) {
    return;
  }
  if (
    !continuesQuote(build.quoteLines, line) &&
    takeLatexTable(build.output, line.trim(), build.tableLines)
  ) {
    flushLatexProse(build.output, build.prose);
    flushLatexQuote(build.output, build.quoteLines, build.slugCounts);
    resetListState(build.output, build.listState);
    return;
  }
  if (takeLatexItemQuote(build, line)) {
    return;
  }
  if (takeLatexQuote(build.output, line, build.quoteLines, build.slugCounts)) {
    flushLatexProse(build.output, build.prose);
    resetListState(build.output, build.listState);
    return;
  }
  processMarkdownLine(line, build.output, build.listState, build.slugCounts, build.prose);
}

function emptyListState(): ListState {
  return {
    stack: [],
    break: false,
    itemLines: [],
    column: null,
    itemFence: null,
    itemQuote: null,
    itemTable: null,
    itemMath: null,
    itemCode: null,
    sealed: false,
    paragraphBreak: false,
    tailLines: null,
    laterLines: [],
    laterIndex: 0,
  };
}

function writeLatexItemQuote(build: LatexBuild): void {
  if (!build.listState.itemQuote) {
    return;
  }
  build.output.push(
    quoteToLatex(build.listState.itemQuote, convertInlineFormatting, build.slugCounts)
  );
}

function writeLatexLines(build: LatexBuild, lines: readonly string[]): void {
  build.laterLines = lines;
  build.listState.laterLines = lines;
  for (let index = 0; index < lines.length; index += 1) {
    build.laterIndex = index + 1;
    build.listState.laterIndex = index + 1;
    appendLatexSourceLine(build, lines[index] ?? '');
  }
}

function contentToLatex(content: string): string {
  const build: LatexBuild = {
    output: [],
    prose: [],
    fence: null,
    codeLines: [],
    inDisplayMath: false,
    displayLines: [],
    laterLines: [],
    laterIndex: 0,
    tableLines: [],
    quoteLines: [],
    listState: emptyListState(),
    slugCounts: new Map<string, number>(),
  };

  writeLatexLines(
    build,
    preparedExportSource(prepareMarkdownSource(content, { preserveHtml: true })).split('\n')
  );

  closeOpenDisplayMath(build);
  flushLatexProse(build.output, build.prose);
  flushLatexTable(build.output, build.tableLines);
  flushLatexQuote(build.output, build.quoteLines, build.slugCounts);
  if (build.fence) {
    build.output.push(...latexVerbatim(build.codeLines));
  }
  if (build.listState.itemFence) {
    writeLatexItemFence(build.output, build.listState.itemFence);
  }
  writeLatexItemQuote(build);
  if (build.listState.itemCode) {
    while (build.listState.itemCode[build.listState.itemCode.length - 1] === '') {
      build.listState.itemCode.pop();
    }
    build.output.push(...latexVerbatim(build.listState.itemCode));
  }
  if (build.listState.itemMath) {
    build.output.push('$$', ...disarmedMathLines(build.listState.itemMath), '$$');
  }
  if (build.listState.itemTable) {
    const table = parseMarkdownTable(build.listState.itemTable);
    build.output.push(
      table
        ? markdownTableToLatex(table, convertInlineFormatting)
        : build.listState.itemTable.join('\n')
    );
  }
  closeLatexLists(build.output, build.listState.stack);

  return build.output.join('\n');
}

const LATEX_CLASSES = new Set(['article', 'report', 'book', 'letter']);
const LATEX_SIZES = new Set(['10pt', '11pt', '12pt']);
const LATEX_PACKAGE = /^[A-Za-z][A-Za-z0-9-]*$/;
const BUILTIN_LATEX_PACKAGES = new Set([
  'inputenc',
  'fontenc',
  'hyperref',
  'amsmath',
  'amssymb',
  'graphicx',
  'ulem',
]);

function latexChoice(
  metadata: Record<string, unknown> | undefined,
  key: string,
  allowed: ReadonlySet<string>,
  fallback: string
): string {
  const value = metadata?.[key];
  return typeof value === 'string' && allowed.has(value) ? value : fallback;
}

function extraLatexPackages(metadata: Record<string, unknown> | undefined): string[] {
  const value = metadata?.packages;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is string =>
      typeof item === 'string' && LATEX_PACKAGE.test(item) && !BUILTIN_LATEX_PACKAGES.has(item)
  );
}

function buildLatexDocument(content: string, options: ExportOptions): string {
  const title = options.title ?? 'Untitled';
  const author = options.author ?? '';
  const metadata = options.metadata;
  const documentClass = latexChoice(metadata, 'documentClass', LATEX_CLASSES, 'article');
  const fontSize = latexChoice(metadata, 'fontSize', LATEX_SIZES, '11pt');

  const preamble = [
    `\\documentclass[${fontSize}]{${documentClass}}`,
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage{xcolor}',
    '\\usepackage{hyperref}',
    '\\usepackage{amsmath}',
    '\\usepackage{amssymb}',
    '\\usepackage{graphicx}',
    '\\usepackage[normalem]{ulem}',
    ...extraLatexPackages(metadata).map((name) => `\\usepackage{${name}}`),
    '',
    `\\title{${escapeLatex(title)}}`,
    `\\author{${escapeLatex(author)}}`,
    '\\date{\\today}',
    '',
  ];

  const body = contentToLatex(content);

  return [
    ...preamble,
    '\\begin{document}',
    '\\maketitle',
    '',
    body,
    '',
    '\\end{document}',
    '',
  ].join('\n');
}

export class LatexExporter implements Exporter {
  readonly format = 'latex';
  readonly label = 'LaTeX';
  readonly extension = 'tex';
  readonly mimeType = 'application/x-latex';

  async export(options: ExportOptions): Promise<ExportResult> {
    const warnings: string[] = [];

    try {
      const content = omitTexPictureSyntax(
        sanitizeMarkdownHtmlBlocks(
          omitLocalMarkdownTargets(
            await inlineLocalImages(
              stripLeadingFrontmatter(options.content),
              options.sourcePath,
              'absolute'
            ),
            options.sourcePath
          )
        )
      );
      const latex = buildLatexDocument(content, options);
      await writeRegularFile(options.outputPath, latex);
      return { ok: true, outputPath: options.outputPath, warnings };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'LaTeX export failed',
        warnings,
      };
    }
  }
}
