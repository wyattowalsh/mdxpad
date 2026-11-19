/**
 * A share link is `mdxpad://share/<token>`.
 * The token identifies a snapshot stored on this machine.
 */

const SHARE_TOKEN = /^[A-Za-z0-9]{16,128}$/;

/** The token in a share URL, or null when the URL is not a share link. */
export function shareTokenFromUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'mdxpad:' ||
    parsed.hostname !== 'share' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    return null;
  }
  const token = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  return SHARE_TOKEN.test(token) ? token : null;
}

/** The first share URL in a process argument list. */
export function shareUrlFromArgv(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (shareTokenFromUrl(arg) !== null) {
      return arg.trim();
    }
  }
  return null;
}
