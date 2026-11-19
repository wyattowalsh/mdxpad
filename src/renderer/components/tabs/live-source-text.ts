interface ReadableSourceEditor {
  readonly state: { readonly doc: { toString(): string } };
}

/**
 * Text from a source editor that is still on the page.
 * CodeMirror sets `destroyed`. Older doubles set `isDestroyed`.
 */
export function readOpenSourceEditor(
  view: ReadableSourceEditor | null | undefined
): string | null {
  if (view === null || view === undefined) {
    return null;
  }
  const closed = view as ReadableSourceEditor & {
    readonly destroyed?: boolean;
    readonly isDestroyed?: boolean;
  };
  if (closed.destroyed === true || closed.isDestroyed === true) {
    return null;
  }
  return view.state.doc.toString();
}

/** The source editor registers the text it is showing, including unstored keystrokes. */
let readLiveSource: (() => string | null) | null = null;

export function registerLiveSourceText(read: (() => string | null) | null): void {
  readLiveSource = read;
}

export function liveSourceText(): string | null {
  return readLiveSource?.() ?? null;
}
