/**
 * image() and image-set() load a quoted address without a url() wrapper.
 */

function hasPrefix(css: string, index: number, prefix: string): boolean {
  return css.slice(index, index + prefix.length).toLowerCase() === prefix;
}

function isImageFunction(css: string, index: number): boolean {
  if (index > 0 && /[\w-]/i.test(css.charAt(index - 1))) {
    return false;
  }
  return (
    hasPrefix(css, index, '-webkit-image-set(') ||
    hasPrefix(css, index, 'image-set(') ||
    hasPrefix(css, index, 'image(')
  );
}

function skipString(css: string, index: number): number {
  const quote = css.charAt(index);
  for (let cursor = index + 1; cursor < css.length; cursor += 1) {
    if (css.charAt(cursor) === '\\') {
      cursor += 1;
      continue;
    }
    if (css.charAt(cursor) === quote) {
      return cursor;
    }
  }
  return css.length;
}

function matchingParen(css: string, start: number): number {
  let depth = 1;
  for (let index = start; index < css.length; index += 1) {
    const char = css.charAt(index);
    if (char === '"' || char === "'") {
      index = skipString(css, index);
      continue;
    }
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return css.length;
}

function nextImageFunction(css: string, from: number): number {
  for (let index = from; index < css.length; index += 1) {
    const char = css.charAt(index);
    if (char === '"' || char === "'") {
      index = skipString(css, index);
      continue;
    }
    if (isImageFunction(css, index)) {
      return index;
    }
  }
  return -1;
}

function rewriteArguments(body: string, blocked: (address: string) => boolean): string {
  return body.replace(
    /url\(\s*(?:(['"])([\s\S]*?)\1|([^)'"\s]+))\s*\)|(['"])([\s\S]*?)\4|([^\s,()]+)/gi,
    (
      token,
      _quote: string,
      quotedUrl: string | undefined,
      bareUrl: string | undefined,
      _plain: string,
      quoted: string | undefined,
      bare: string | undefined
    ) => {
      const address = (quotedUrl ?? bareUrl ?? quoted ?? bare ?? '').trim();
      return address.length > 0 && blocked(address) ? 'none' : token;
    }
  );
}

/** True when a paint or style value loads an address the caller rejects. */
export function cssValueHasBlockedAddress(
  css: string,
  blocked: (address: string) => boolean
): boolean {
  for (const match of css.matchAll(/url\(\s*(?:(['"])([\s\S]*?)\1|([^)'"\s]+))\s*\)/gi)) {
    const address = (match[2] ?? match[3] ?? '').trim();
    if (address.length > 0 && blocked(address)) {
      return true;
    }
  }
  let found = false;
  replaceCssImageFunctionAddresses(css, (address) => {
    if (address.length > 0 && blocked(address)) {
      found = true;
    }
    return found;
  });
  return found;
}

/** Replace a local file inside image() or image-set() with none. */
export function replaceCssImageFunctionAddresses(
  css: string,
  blocked: (address: string) => boolean
): string {
  let result = '';
  let cursor = 0;
  while (cursor < css.length) {
    const start = nextImageFunction(css, cursor);
    if (start < 0) {
      return result + css.slice(cursor);
    }
    const open = css.indexOf('(', start);
    const close = matchingParen(css, open + 1);
    result += `${css.slice(cursor, open + 1)}${rewriteArguments(css.slice(open + 1, close), blocked)}`;
    result += close < css.length ? ')' : '';
    cursor = close < css.length ? close + 1 : close;
  }
  return result;
}
