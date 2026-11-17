export const VOICE_TOGGLE_EVENT = 'mdxpad:toggle-voice';

export function requestVoiceToggle(): void {
  window.dispatchEvent(new Event(VOICE_TOGGLE_EVENT));
}
