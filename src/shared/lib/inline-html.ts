const SIMPLE_TAG =
  /<(em|i|strong|b|code|del|s|strike|sub|sup|a)(\s[^<>]*)?>([^<>]*)<\/\1>/gi;

const SUBSCRIPT: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  h: 'ₕ',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  l: 'ₗ',
  m: 'ₘ',
  n: 'ₙ',
  o: 'ₒ',
  p: 'ₚ',
  r: 'ᵣ',
  s: 'ₛ',
  t: 'ₜ',
  u: 'ᵤ',
  v: 'ᵥ',
  x: 'ₓ',
};

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
};

function mappedScript(inner: string, table: Record<string, string>): string | null {
  let result = '';
  for (const char of inner) {
    const mapped = table[char];
    if (mapped === undefined) {
      return null;
    }
    result += mapped;
  }
  return result.length > 0 ? result : null;
}

function markdownHref(attrs: string): string | null {
  const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(attrs);
  const href = match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
  if (href.length === 0 || /^(?:javascript|data|file):/i.test(href)) {
    return null;
  }
  return href;
}

function promotedTag(name: string, attrs: string, inner: string): string | null {
  switch (name.toLowerCase()) {
    case 'em':
    case 'i':
      return `*${inner}*`;
    case 'strong':
    case 'b':
      return `**${inner}**`;
    case 'del':
    case 's':
    case 'strike':
      return `~~${inner}~~`;
    case 'code':
      return inner.includes('`') ? null : `\`${inner}\``;
    case 'sub':
      return mappedScript(inner, SUBSCRIPT);
    case 'sup':
      return mappedScript(inner, SUPERSCRIPT);
    case 'a': {
      if (inner.includes('[') || inner.includes(']')) {
        return null;
      }
      const href = markdownHref(attrs);
      return href === null ? inner : `[${inner}](${href})`;
    }
    default:
      return null;
  }
}

/** Turn simple inline HTML into markdown so every export can format it. */
export function promoteInlineHtml(value: string): string {
  let current = value;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = current.replace(SIMPLE_TAG, (match, name: string, attrs: string | undefined, inner: string) => {
      return promotedTag(name, attrs ?? '', inner) ?? match;
    });
    if (next === current) {
      return current;
    }
    current = next;
  }
  return current;
}
