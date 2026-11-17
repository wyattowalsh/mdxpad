const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

function updateFence(fence: string | null, line: string): string | null {
  const match = FENCE_LINE.exec(line);
  if (!match) {
    return fence;
  }
  const marker = match[2] ?? '';
  const info = (match[3] ?? '').trim();
  if (fence === null) {
    return marker;
  }
  if (info.length === 0 && marker.startsWith(fence[0] ?? '') && marker.length >= fence.length) {
    return null;
  }
  return fence;
}

function copyCodeSpan(value: string, index: number): { text: string; next: number } | null {
  if (value[index] !== '`') {
    return null;
  }
  let ticks = 0;
  while (value[index + ticks] === '`') {
    ticks += 1;
  }
  const closer = value.indexOf('`'.repeat(ticks), index + ticks);
  if (closer === -1) {
    return { text: value.slice(index), next: value.length };
  }
  return { text: value.slice(index, closer + ticks), next: closer + ticks };
}

function replaceTexMath(prose: string): string {
  let result = '';
  let index = 0;
  while (index < prose.length) {
    const code = copyCodeSpan(prose, index);
    if (code) {
      result += code.text;
      index = code.next;
      continue;
    }
    if (prose.startsWith('\\[', index)) {
      const end = prose.indexOf('\\]', index + 2);
      if (end !== -1 && end > index + 2) {
        result += `$$${prose.slice(index + 2, end)}$$`;
        index = end + 2;
        continue;
      }
    }
    if (prose.startsWith('\\(', index)) {
      const end = prose.indexOf('\\)', index + 2);
      if (end !== -1 && end > index + 2) {
        result += `$${prose.slice(index + 2, end)}$`;
        index = end + 2;
        continue;
      }
    }
    result += prose[index] ?? '';
    index += 1;
  }
  return result;
}

/** Turn TeX `\\(...\\)` and `\\[...\\]` into `$` math outside code. */
export function normalizeTexMath(content: string): string {
  const output: string[] = [];
  const prose: string[] = [];
  let fence: string | null = null;
  const flush = (): void => {
    if (prose.length === 0) {
      return;
    }
    output.push(replaceTexMath(prose.join('\n')));
    prose.length = 0;
  };
  for (const line of content.split('\n')) {
    const next = updateFence(fence, line);
    const boundary = fence !== next;
    if (boundary || next !== null) {
      flush();
      output.push(line);
    } else {
      prose.push(line);
    }
    fence = next;
  }
  flush();
  return output.join('\n');
}
