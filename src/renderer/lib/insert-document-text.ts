/**
 * Insert generated text into the open document without dropping existing content.
 */

export function insertDiagramFence(current: string, fence: string): string {
  if (current.length === 0) {
    return fence;
  }
  if (current.endsWith('\n')) {
    return `${current}\n${fence}`;
  }
  return `${current}\n\n${fence}`;
}

export function joinVoiceTranscript(current: string, addition: string): string {
  if (addition.length === 0) {
    return current;
  }
  if (current.length === 0 || /\s$/.test(current) || /^\s/.test(addition)) {
    return `${current}${addition}`;
  }
  return `${current} ${addition}`;
}
