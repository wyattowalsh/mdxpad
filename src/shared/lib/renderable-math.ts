import { mathDelimiterAt, mathSpanEnd } from './math-span';

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
export function renderableMathTex(source: string): string {
  let result = '';
  const alignment: boolean[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? '';
    if (char === '\\') {
      const environment = takeEnvironment(source, index, alignment);
      if (environment !== null) {
        result += environment;
        index += environment.length - 1;
        continue;
      }
      const next = source[index + 1] ?? '';
      result += `${char}${next}`;
      if (next.length > 0) {
        index += 1;
      }
      continue;
    }
    if (char === '#' || char === '%' || (char === '&' && alignment.at(-1) !== true)) {
      result += `\\${char}`;
      continue;
    }
    result += char;
  }
  return result;
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
