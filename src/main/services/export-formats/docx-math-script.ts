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
