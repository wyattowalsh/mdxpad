import { mathDelimiterAt, mathSpanEnd } from './math-span';

const TEXT_COMMANDS = new Set([
  'emph',
  'hbox',
  'mbox',
  'text',
  'textbf',
  'textit',
  'textmd',
  'textnormal',
  'textrm',
  'textsf',
  'texttt',
  'textsc',
  'textsl',
  'textup',
]);

interface BraceGroup {
  text: boolean;
  depth: number;
}

const ALIGNMENT_ENVIRONMENTS = new Set([
  'align',
  'align*',
  'aligned',
  'alignedat',
  'alignat',
  'alignat*',
  'array',
  'bmatrix',
  'Bmatrix',
  'cases',
  'CD',
  'dcases',
  'drcases',
  'eqnarray',
  'eqnarray*',
  'flalign',
  'flalign*',
  'matrix',
  'pmatrix',
  'rcases',
  'smallmatrix',
  'split',
  'subarray',
  'vmatrix',
  'Vmatrix',
  'xalignat',
  'xalignat*',
  'xxalignat',
]);

function commandName(source: string, index: number): string {
  let cursor = index + 1;
  let name = '';
  while (/[A-Za-z]/.test(source[cursor] ?? '')) {
    name += source[cursor] ?? '';
    cursor += 1;
  }
  return name;
}

function environmentEnd(source: string, index: number): { name: string; end: number } | null {
  let cursor = index;
  while (source[cursor] === ' ' || source[cursor] === '\n') {
    cursor += 1;
  }
  if (source[cursor] !== '{') {
    return null;
  }
  const close = source.indexOf('}', cursor + 1);
  if (close === -1) {
    return null;
  }
  const name = source.slice(cursor + 1, close).trim();
  if (!/^[A-Za-z*]+$/.test(name)) {
    return null;
  }
  return { name, end: close + 1 };
}

function textCommandOpen(source: string, index: number): number {
  const name = commandName(source, index);
  if (!TEXT_COMMANDS.has(name)) {
    return -1;
  }
  let cursor = index + 1 + name.length;
  while (source[cursor] === ' ' || source[cursor] === '\n') {
    cursor += 1;
  }
  return source[cursor] === '{' ? cursor : -1;
}

function inText(groups: readonly BraceGroup[]): boolean {
  return groups.some((group) => group.text);
}

function textSpecial(char: string, groups: readonly BraceGroup[], alignment: readonly boolean[]): string | null {
  if (inText(groups) && char === '^') {
    return '\\textasciicircum{}';
  }
  if (inText(groups) && (char === '_' || char === '&')) {
    return `\\${char}`;
  }
  if (char === '#' || char === '%' || (char === '&' && alignment.at(-1) !== true)) {
    return `\\${char}`;
  }
  return null;
}

function takeEnvironment(source: string, index: number, alignment: boolean[]): string | null {
  const name = commandName(source, index);
  if (name !== 'begin' && name !== 'end') {
    return null;
  }
  const env = environmentEnd(source, index + 1 + name.length);
  if (!env) {
    return null;
  }
  if (name === 'begin') {
    alignment.push(ALIGNMENT_ENVIRONMENTS.has(env.name));
  } else if (alignment.length > 0) {
    alignment.pop();
  }
  return source.slice(index, env.end);
}

/** Escape `#`, `%`, and an `&` that is not an alignment tab, so KaTeX and LaTeX can render the formula. */
function takeTextCommand(source: string, index: number, groups: BraceGroup[]): string | null {
  const open = textCommandOpen(source, index);
  if (open === -1) {
    return null;
  }
  groups.push({ text: true, depth: 1 });
  return source.slice(index, open + 1);
}

function trackBrace(char: string, groups: BraceGroup[]): boolean {
  if (groups.length === 0 || (char !== '{' && char !== '}')) {
    return false;
  }
  const current = groups[groups.length - 1];
  if (!current) {
    return false;
  }
  if (char === '{') {
    current.depth += 1;
    return true;
  }
  current.depth -= 1;
  if (current.depth === 0) {
    groups.pop();
  }
  return true;
}

export function renderableMathTex(source: string): string {
  let result = '';
  const alignment: boolean[] = [];
  const groups: BraceGroup[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? '';
    if (char === '\\') {
      const environment = takeEnvironment(source, index, alignment);
      const text = environment === null ? takeTextCommand(source, index, groups) : null;
      const taken = environment ?? text;
      if (taken !== null) {
        result += taken;
        index += taken.length - 1;
        continue;
      }
      const next = source[index + 1] ?? '';
      result += `${char}${next}`;
      if (next.length > 0) {
        index += 1;
      }
      continue;
    }
    if (trackBrace(char, groups)) {
      result += char;
      continue;
    }
    result += textSpecial(char, groups, alignment) ?? char;
  }
  return result;
}

const KATEX_ENVIRONMENT_ALIAS: Readonly<Record<string, string>> = {
  multline: 'gather',
  'multline*': 'gather*',
  flalign: 'align',
  'flalign*': 'align*',
};

/** KaTeX names for environments and text commands it does not implement. */
export function katexMathTex(source: string): string {
  const aliased = source.replace(
    /\\(begin|end)\{(multline\*|multline|flalign\*|flalign)\}/g,
    (match: string, edge: string, name: string) => {
      const alias = KATEX_ENVIRONMENT_ALIAS[name];
      return alias === undefined ? match : `\\${edge}{${alias}}`;
    }
  );
  return aliased.replace(/\\(mbox|textsc|textsl)(?![A-Za-z])/g, '\\text');
}

export function repairedMathSpan(
  source: string,
  index: number
): { text: string; end: number } | null {
  const delimiter = mathDelimiterAt(source, index);
  if (delimiter === null) {
    return null;
  }
  const end = mathSpanEnd(source, index, delimiter);
  if (end === -1) {
    return null;
  }
  const interior = source.slice(index + delimiter.length, end - delimiter.length);
  return { text: `${delimiter}${renderableMathTex(interior)}${delimiter}`, end };
}
