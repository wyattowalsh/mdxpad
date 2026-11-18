/** The source editor registers the text it is showing, including unstored keystrokes. */
let readLiveSource: (() => string | null) | null = null;

export function registerLiveSourceText(read: (() => string | null) | null): void {
  readLiveSource = read;
}

export function liveSourceText(): string | null {
  return readLiveSource?.() ?? null;
}
