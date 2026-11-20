import {
  MathFraction,
  MathLimitLower,
  MathLimitUpper,
  MathRadical,
  MathRoundBrackets, MathSquareBrackets,
  MathRun,
  MathSubSuperScript,
  type MathComponent,
} from 'docx';

import { endsMatrix, readMatrix, readRawGroup } from './docx-math-matrix';
import { appendGroup, equationTag, liftPrescripts, pushScript, scriptBase, takeInfix } from './docx-math-script';
import {
  ACCENTS,
  ATOM_COMMANDS,
  DELIMITER_COMMANDS,
  NEGATED,
  STYLE_COMMANDS,
  SYMBOLS,
  TEXT_COMMANDS,
} from './docx-math-symbols';
import { readCodeSpan } from './markdown-escape';
import { mathDelimiterAt, mathSpanEnd } from './markdown-math-span';

interface Cursor {
  source: string;
  index: number;
  literal?: number;
}

const LITERAL_ESCAPE: Record<string, string> = {
  '|': '‖',
  ',': '\u2009',
  ':': '\u2004',
  ';': '\u2005',
  '!': '',
  '\\': '\n',
};

export type DocxPiece =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'math'; readonly tex: string };

export function splitDocxPieces(value: string): DocxPiece[] {
  const pieces: DocxPiece[] = [];
  let index = 0;
  let textStart = 0;
  while (index < value.length) {
    if (value[index] === '`') {
      const span = readCodeSpan(value, index);
      index = span ? span.end : index + 1;
      continue;
    }
    const delimiter = mathDelimiterAt(value, index);
    const end = delimiter === null ? -1 : mathSpanEnd(value, index, delimiter);
    if (delimiter !== null && end !== -1) {
      if (index > textStart) {
        pieces.push({ kind: 'text', text: value.slice(textStart, index) });
      }
      pieces.push({
        kind: 'math',
        tex: value.slice(index + delimiter.length, end - delimiter.length),
      });
      index = end;
      textStart = index;
      continue;
    }
    index += 1;
  }
  if (textStart < value.length) {
    pieces.push({ kind: 'text', text: value.slice(textStart) });
  }
  return pieces;
}

function readEscapedSymbol(cursor: Cursor): MathComponent[] {
  const symbol = cursor.source[cursor.index] ?? '';
  if (symbol.length === 0) {
    return [new MathRun('\\')];
  }
  cursor.index += 1;
  const text = LITERAL_ESCAPE[symbol] ?? symbol;
  return text.length > 0 ? [new MathRun(text)] : [];
}

function readCommandName(cursor: Cursor): string {
  let name = '';
  while (
    cursor.index < cursor.source.length &&
    /[A-Za-z]/.test(cursor.source[cursor.index] ?? '')
  ) {
    name += cursor.source[cursor.index] ?? '';
    cursor.index += 1;
  }
  return name;
}

function readNegation(cursor: Cursor): MathComponent[] {
  skipArgumentSpace(cursor);
  if (cursor.source[cursor.index] === '\\') {
    cursor.index += 1;
    const name = readCommandName(cursor);
    return [new MathRun(NEGATED[name] ?? `¬${SYMBOLS[name] ?? name}`)];
  }
  const symbol = cursor.source[cursor.index] ?? '';
  if (symbol.length === 0) {
    return [new MathRun('¬')];
  }
  cursor.index += 1;
  return [new MathRun(NEGATED[symbol] ?? `¬${symbol}`)];
}

function skipDelimiter(cursor: Cursor): void {
  if (cursor.source[cursor.index] === '.') {
    cursor.index += 1;
  }
}

function groupedCommand(cursor: Cursor, name: string): MathComponent[] | null {
  if (DELIMITER_COMMANDS.has(name)) {
    skipDelimiter(cursor);
    return [];
  }
  if (STYLE_COMMANDS.has(name)) {
    return [];
  }
  if (name === 'color') {
    readGroup(cursor);
    return [];
  }
  if (name === 'notag' || name === 'nonumber') return [];
  if (name === 'tag') return equationTag(cursor, () => readGroup(cursor));
  if (TEXT_COMMANDS.has(name) || ATOM_COMMANDS.has(name)) {
    if (cursor.source[cursor.index] === '*') cursor.index += 1;
    if (ATOM_COMMANDS.has(name) && !TEXT_COMMANDS.has(name)) return readGroup(cursor);
    cursor.literal = (cursor.literal ?? 0) + 1;
    const parts = readGroup(cursor);
    cursor.literal = (cursor.literal ?? 1) - 1;
    return parts;
  }
  if (name === 'begin') {
    return readMatrix(cursor, (current, env) => readSequence(current, null, env));
  }
  if (name === 'xrightarrow' || name === 'xleftarrow') {
    return readStretchArrow(cursor, name === 'xrightarrow' ? '→' : '←');
  }
  if (name === 'end') {
    readRawGroup(cursor);
    return [];
  }
  if (name === 'cancel' || name === 'bcancel' || name === 'xcancel') return readMarked(cursor, '\u0336');
  if (name === 'underline') return readMarked(cursor, '\u0332');
  return null;
}
function readMarked(cursor: Cursor, mark: string): MathComponent[] {
  return readGroup(cursor).map((part) => {
    if (!(part instanceof MathRun)) return part;
    let marked = '';
    for (const char of mathRunText(part)) marked += `${char}${mark}`;
    return new MathRun(marked);
  });
}
const PROSE_COMMANDS = new Set([
  'author',
  'caption',
  'ce',
  'chapter',
  'cite',
  'emph',
  'footnote',
  'mbox',
  'paragraph',
  'part',
  'pu',
  'includegraphics',
  'ref',
  'section',
  'subparagraph',
  'subsection',
  'subsubsection',
  'textsc',
  'textsl',
  'thanks',
  'title',
]);

function argumentReady(source: string, index: number): boolean {
  let cursor = index;
  if (source[cursor] === '*') {
    cursor += 1;
  }
  while (source[cursor] === ' ' || source[cursor] === '\n') {
    cursor += 1;
  }
  const char = source[cursor];
  return char === '[' || char === '{';
}

function readBracketNote(cursor: Cursor): string | null {
  skipArgumentSpace(cursor);
  if (cursor.source[cursor.index] !== '[') {
    return null;
  }
  cursor.index += 1;
  let note = '';
  while (cursor.index < cursor.source.length && cursor.source[cursor.index] !== ']') {
    note += cursor.source[cursor.index] ?? '';
    cursor.index += 1;
  }
  if (cursor.source[cursor.index] === ']') {
    cursor.index += 1;
  }
  return note.trim();
}

function proseNotes(cursor: Cursor): string {
  const notes: string[] = [];
  let note = readBracketNote(cursor);
  while (note !== null) {
    if (note.length > 0) {
      notes.push(note);
    }
    note = readBracketNote(cursor);
  }
  return notes.join(', ');
}

function notedParts(parts: MathComponent[], notes: string): MathComponent[] {
  if (notes.length === 0) {
    return parts;
  }
  const suffix = parts.length > 0 ? ` (${notes})` : notes;
  return [...parts, new MathRun(suffix)];
}

function readProseArgument(cursor: Cursor): MathComponent[] | null {
  if (!argumentReady(cursor.source, cursor.index)) {
    return null;
  }
  if (cursor.source[cursor.index] === '*') {
    cursor.index += 1;
  }
  const notes = proseNotes(cursor);
  skipArgumentSpace(cursor);
  if (cursor.source[cursor.index] !== '{') {
    return notes.length > 0 ? [new MathRun(notes)] : null;
  }
  return notedParts(readGroup(cursor), notes);
}

function readItem(cursor: Cursor): MathComponent[] {
  const notes = proseNotes(cursor);
  return [new MathRun(notes.length > 0 ? `\n${notes} ` : '\n')];
}

function readVerb(cursor: Cursor): MathComponent[] {
  let index = cursor.index;
  if (cursor.source[index] === '*') {
    const after = cursor.source[index + 1] ?? '';
    if (after.length > 0 && after !== ' ' && after !== '\n' && !/[A-Za-z]/.test(after)) {
      index += 1;
    }
  }
  const delimiter = cursor.source[index] ?? '';
  if (delimiter.length === 0 || delimiter === ' ' || delimiter === '\n' || /[A-Za-z]/.test(delimiter)) {
    return [new MathRun('verb')];
  }
  cursor.index = index + 1;
  let text = '';
  while (cursor.index < cursor.source.length && cursor.source[cursor.index] !== delimiter) {
    text += cursor.source[cursor.index] ?? '';
    cursor.index += 1;
  }
  if (cursor.source[cursor.index] === delimiter) {
    cursor.index += 1;
  }
  return [new MathRun(text)];
}

function dropLabel(cursor: Cursor): void {
  skipArgumentSpace(cursor);
  if (cursor.source[cursor.index] === '{') {
    readGroup(cursor);
  }
}

function readEquationReference(cursor: Cursor): MathComponent[] {
  const prose = readProseArgument(cursor);
  if (prose === null) {
    return [new MathRun('eqref')];
  }
  return [new MathRun('('), ...prose, new MathRun(')')];
}

function unknownCommand(cursor: Cursor, name: string): MathComponent[] {
  if (name === 'item') {
    return readItem(cursor);
  }
  if (name === 'verb') {
    return readVerb(cursor);
  }
  if (name === 'label') {
    dropLabel(cursor);
    return [];
  }
  if (name === 'eqref') {
    return readEquationReference(cursor);
  }
  const symbol = SYMBOLS[name];
  if (symbol !== undefined) {
    return [new MathRun(symbol)];
  }
  if (PROSE_COMMANDS.has(name)) {
    const prose = readProseArgument(cursor);
    if (prose !== null) {
      return prose;
    }
  }
  return [new MathRun(name)];
}

function commandComponents(cursor: Cursor, name: string): MathComponent[] {
  const grouped = groupedCommand(cursor, name);
  if (grouped !== null) {
    return grouped;
  }
  if (name === 'overbrace' || name === 'underbrace') {
    return readBraceSpan(cursor, name === 'overbrace');
  }
  if (name === 'boxed') return [new MathSquareBrackets({ children: readGroup(cursor) })];
  if (name === 'textcolor' || name === 'colorbox' || name === 'fcolorbox' || name === 'href') {
    readGroup(cursor);
    return readGroup(cursor);
  }
  if (name === 'overset' || name === 'stackrel') {
    return readStack(cursor, true);
  }
  if (name === 'underset') {
    return readStack(cursor, false);
  }
  if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
    return readBinom(cursor);
  }
  if (name === 'pmod') {
    return readMod(cursor, true);
  }
  if (name === 'bmod' || name === 'mod') {
    return readMod(cursor, false);
  }
  if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
    return [new MathFraction({ numerator: readGroup(cursor), denominator: readGroup(cursor) })];
  }
  if (name === 'phantom' || name === 'hphantom' || name === 'vphantom') {
    readGroup(cursor);
    return [new MathRun('')];
  }
  if (name === 'sqrt') {
    return readRadical(cursor);
  }
  if (name === 'not') {
    return readNegation(cursor);
  }
  const accent = ACCENTS[name];
  if (accent !== undefined) {
    return readAccent(cursor, accent);
  }
  return unknownCommand(cursor, name);
}
function readCommand(cursor: Cursor): MathComponent[] {
  cursor.index += 1;
  const name = readCommandName(cursor);
  if (name.length === 0) {
    return readEscapedSymbol(cursor);
  }
  return commandComponents(cursor, name);
}

function skipArgumentSpace(cursor: Cursor): void {
  while (cursor.source[cursor.index] === ' ' || cursor.source[cursor.index] === '\n') cursor.index += 1;
}

function readOptionalBracket(cursor: Cursor): MathComponent[] | null {
  skipArgumentSpace(cursor);
  if (cursor.source[cursor.index] !== '[') {
    return null;
  }
  cursor.index += 1;
  const parts = readSequence(cursor, ']');
  if (cursor.source[cursor.index] === ']') {
    cursor.index += 1;
  }
  return parts;
}

function nestedRoot(value: object): readonly unknown[] | null {
  const root: unknown = Object.getOwnPropertyDescriptor(value, 'root')?.value;
  return Array.isArray(root) ? root : null;
}

function mathRunText(run: MathRun): string {
  const outer = nestedRoot(run);
  const inner = outer?.[0];
  if (typeof inner !== 'object' || inner === null) {
    return '';
  }
  const text = nestedRoot(inner)?.[0];
  return typeof text === 'string' ? text : '';
}

function readAccent(cursor: Cursor, mark: string): MathComponent[] {
  const parts = readGroup(cursor);
  const last = parts[parts.length - 1];
  if (last instanceof MathRun) {
    parts[parts.length - 1] = new MathRun(`${mathRunText(last)}${mark}`);
    return parts;
  }
  return [...parts, new MathRun(mark)];
}

function readMod(cursor: Cursor, parenthesized: boolean): MathComponent[] {
  const word = new MathRun(parenthesized ? 'mod ' : 'mod');
  if (!parenthesized) return [word];
  return [new MathRoundBrackets({ children: [word, ...readGroup(cursor)] })];
}

function readBraceSpan(cursor: Cursor, upper: boolean): MathComponent[] {
  const body = readGroup(cursor);
  const brace = [new MathRun(upper ? '\u23DE' : '\u23DF')];
  return upper
    ? [new MathLimitUpper({ children: body, limit: brace })]
    : [new MathLimitLower({ children: body, limit: brace })];
}

function readStretchArrow(cursor: Cursor, arrow: string): MathComponent[] {
  const below = readOptionalBracket(cursor);
  const above = readGroup(cursor);
  const base = [new MathRun(arrow)];
  if (below !== null && above.length > 0) {
    return [new MathSubSuperScript({ children: base, subScript: below, superScript: above })];
  }
  if (below !== null) {
    return [new MathLimitLower({ children: base, limit: below })];
  }
  if (above.length > 0) {
    return [new MathLimitUpper({ children: base, limit: above })];
  }
  return base;
}

function readStack(cursor: Cursor, upper: boolean): MathComponent[] {
  const annotation = readGroup(cursor);
  const base = readGroup(cursor);
  if (upper) {
    return [new MathLimitUpper({ children: base, limit: annotation })];
  }
  return [new MathLimitLower({ children: base, limit: annotation })];
}

function readBinom(cursor: Cursor): MathComponent[] {
  return [
    new MathRoundBrackets({
      children: [
        new MathFraction({
          numerator: readGroup(cursor),
          denominator: readGroup(cursor),
        }),
      ],
    }),
  ];
}

function readRadical(cursor: Cursor): MathComponent[] {
  const degree = readOptionalBracket(cursor);
  const children = readGroup(cursor);
  if (degree === null) {
    return [new MathRadical({ children })];
  }
  return [new MathRadical({ children, degree })];
}

function readGroup(cursor: Cursor): MathComponent[] {
  skipArgumentSpace(cursor);
  if (cursor.index >= cursor.source.length) {
    return [];
  }
  if (cursor.source[cursor.index] !== '{') {
    return readToken(cursor);
  }
  cursor.index += 1;
  const parts = readSequence(cursor, '}');
  if (cursor.source[cursor.index] === '}') {
    cursor.index += 1;
  }
  return parts;
}

function readToken(cursor: Cursor): MathComponent[] {
  if (cursor.source[cursor.index] === '\\') {
    return readCommand(cursor);
  }
  const char = cursor.source[cursor.index] ?? '';
  cursor.index += 1;
  return char.length > 0 ? [new MathRun(char)] : [];
}

function readSequence(cursor: Cursor, stop: string | null, untilEnd?: string): MathComponent[] {
  const components: MathComponent[] = [];
  let plain = '';
  const flush = (): void => {
    if (plain.length > 0) {
      components.push(new MathRun(plain));
      plain = '';
    }
  };
  while (cursor.index < cursor.source.length) {
    const char = cursor.source[cursor.index] ?? '';
    if (untilEnd !== undefined && endsMatrix(cursor, untilEnd)) {
      break;
    }
    if (stop !== null && char === stop) {
      break;
    }
    if (char === '\\') {
      const readRest = (): MathComponent[] => readSequence(cursor, stop, untilEnd);
      if ((cursor.literal ?? 0) === 0 && takeInfix(cursor, components, plain, readRest)) {
        plain = '';
        break;
      }
      flush();
      components.push(...readCommand(cursor));
      continue;
    }
    if (char === '{') {
      flush();
      appendGroup(cursor, components, readGroup(cursor), () => readGroup(cursor));
      continue;
    }
    if ((cursor.literal ?? 0) === 0 && (char === '^' || char === '_' || char === "'")) {
      const base = scriptBase(components, plain);
      plain = base.plain;
      flush();
      pushScript(cursor, components, base.base, char, () => readGroup(cursor));
      continue;
    }
    plain += untilEnd !== undefined && char === '&' ? '\u2003' : char;
    cursor.index += 1;
  }
  flush();
  return liftPrescripts(components);
}

export function mathComponents(tex: string): MathComponent[] {
  const components = readSequence({ source: tex, index: 0 }, null);
  return components.length > 0 ? components : [new MathRun(tex)];
}
