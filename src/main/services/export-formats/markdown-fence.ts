export { fenceIndentedCode } from '@shared/lib/indented-code';

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

/** The opening marker of a backtick or tilde fence, such as ` ``` ` or `~~~`. */
export function openingFence(line: string): string | null {
  return FENCE_LINE.exec(line)?.[2] ?? null;
}

/** The info word on an opening fence, such as `ts` in ` ```ts `. */
export function fenceLanguage(line: string): string {
  const token = (FENCE_LINE.exec(line)?.[3] ?? '').trim().split(/\s+/, 1)[0] ?? '';
  return /^[A-Za-z0-9_+#.-]+$/.test(token) ? token : '';
}

export function closesFence(line: string, open: string): boolean {
  const match = FENCE_LINE.exec(line);
  const marker = match?.[2];
  if (!marker || !marker.startsWith(open.charAt(0)) || marker.length < open.length) {
    return false;
  }
  return (match[3] ?? '').trim().length === 0;
}

/** Move a fence cursor: a marker while inside, or null outside. */
export function advanceFence(line: string, open: string | null): string | null {
  if (open) {
    return closesFence(line, open) ? null : open;
  }
  return openingFence(line);
}
