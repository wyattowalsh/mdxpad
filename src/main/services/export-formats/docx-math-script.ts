import {
  MathCurlyBrackets,
  MathFraction,
  MathLimitLower,
  MathLimitUpper,
  MathRadical,
  MathRoundBrackets,
  MathRun,
  MathSquareBrackets,
  MathSubScript,
  MathSubSuperScript,
  MathSuperScript,
  type MathComponent,
} from 'docx';

function nestedRoot(value: object): readonly unknown[] | null {
  const root: unknown = Object.getOwnPropertyDescriptor(value, 'root')?.value;
  return Array.isArray(root) ? root : null;
}

function isMathComponent(value: object): value is MathComponent {
  return (
    value instanceof MathRun ||
    value instanceof MathFraction ||
    value instanceof MathSubScript ||
    value instanceof MathSuperScript ||
    value instanceof MathSubSuperScript ||
    value instanceof MathRadical ||
    value instanceof MathRoundBrackets ||
    value instanceof MathSquareBrackets ||
    value instanceof MathCurlyBrackets ||
    value instanceof MathLimitUpper ||
    value instanceof MathLimitLower
  );
}

function collectMath(node: object): MathComponent[] {
  const root = nestedRoot(node);
  if (root === null) {
    return [];
  }
  const children: MathComponent[] = [];
  for (const item of root) {
    if (typeof item === 'object' && item !== null && isMathComponent(item)) {
      children.push(item);
    }
  }
  return children;
}

function pairedScripts(component: MathComponent): {
  base: MathComponent[];
  sub?: MathComponent[];
  sup?: MathComponent[];
} | null {
  const subscript = component instanceof MathSubScript;
  const superscript = component instanceof MathSuperScript;
  if (!subscript && !superscript) {
    return null;
  }
  const root = nestedRoot(component);
  const baseNode = root?.[1];
  const scriptNode = root?.[2];
  if (typeof baseNode !== 'object' || baseNode === null) {
    return null;
  }
  if (typeof scriptNode !== 'object' || scriptNode === null) {
    return null;
  }
  const base = collectMath(baseNode);
  const scripts = collectMath(scriptNode);
  return subscript ? { base, sub: scripts } : { base, sup: scripts };
}

export function scriptBase(
  components: MathComponent[],
  plain: string,
): { plain: string; base: MathComponent[] } {
  const trimmed = plain.trimEnd();
  if (trimmed.length > 0) {
    return { plain: trimmed.slice(0, -1), base: [new MathRun(trimmed.slice(-1))] };
  }
  const previous = components.pop();
  return { plain: '', base: previous ? [previous] : [new MathRun('')] };
}

export function takePrimes(source: string, index: number): { next: number; mark: MathRun } {
  let next = index;
  while (source[next] === "'") next += 1;
  return { next, mark: new MathRun('′'.repeat(next - index)) };
}

export function attachScript(
  base: readonly MathComponent[],
  mark: '^' | '_',
  script: readonly MathComponent[],
): MathComponent {
  const only = base.length === 1 ? base[0] : undefined;
  const paired = only === undefined ? null : pairedScripts(only);
  if (paired !== null) {
    const sub = mark === '_' ? script : paired.sub;
    const sup = mark === '^' ? script : paired.sup;
    if (sub !== undefined && sup !== undefined) {
      return new MathSubSuperScript({
        children: paired.base,
        subScript: sub,
        superScript: sup,
      });
    }
  }
  if (mark === '^') {
    return new MathSuperScript({ children: base, superScript: script });
  }
  return new MathSubScript({ children: base, subScript: script });
}

const INFIX = new Set(['over', 'choose', 'atop', 'brace', 'brack']);

export function infixName(source: string, index: number): string | null {
  if (source[index] !== '\\') {
    return null;
  }
  let cursor = index + 1;
  let name = '';
  while (cursor < source.length && /[A-Za-z]/.test(source[cursor] ?? '')) {
    name += source[cursor] ?? '';
    cursor += 1;
  }
  return INFIX.has(name) ? name : null;
}

export function infixComponent(
  name: string,
  numerator: readonly MathComponent[],
  denominator: readonly MathComponent[],
): MathComponent {
  const fraction = new MathFraction({ numerator, denominator });
  if (name === 'choose') {
    return new MathRoundBrackets({ children: [fraction] });
  }
  if (name === 'brace') {
    return new MathCurlyBrackets({ children: [fraction] });
  }
  if (name === 'brack') {
    return new MathSquareBrackets({ children: [fraction] });
  }
  return fraction;
}

export function takeInfix(
  cursor: { source: string; index: number },
  components: MathComponent[],
  plain: string,
  readRest: () => readonly MathComponent[],
): boolean {
  const infix = infixName(cursor.source, cursor.index);
  if (infix === null) {
    return false;
  }
  const trimmed = plain.trimEnd();
  if (trimmed.length > 0) {
    components.push(new MathRun(trimmed));
  }
  const numerator = components.splice(0, components.length);
  cursor.index += 1 + infix.length;
  while (cursor.source[cursor.index] === ' ' || cursor.source[cursor.index] === '\n') {
    cursor.index += 1;
  }
  components.push(infixComponent(infix, numerator, readRest()));
  return true;
}

export function equationTag(
  cursor: { source: string; index: number },
  readGroup: () => readonly MathComponent[],
): MathComponent[] {
  if (cursor.source[cursor.index] === '*') {
    cursor.index += 1;
  }
  return [new MathRoundBrackets({ children: readGroup() })];
}

export function pushScript(
  cursor: { source: string; index: number },
  components: MathComponent[],
  base: readonly MathComponent[],
  char: '^' | '_' | "'",
  readGroup: () => readonly MathComponent[],
): void {
  if (char === "'") {
    const primes = takePrimes(cursor.source, cursor.index);
    cursor.index = primes.next;
    components.push(attachScript(base, '^', [primes.mark]));
    return;
  }
  cursor.index += 1;
  components.push(attachScript(base, char, readGroup()));
}
