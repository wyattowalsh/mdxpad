/**
 * Ghost-text provider for the next-edit extension.
 * Uses the existing text generation API and returns nothing when AI is unavailable.
 */

import { isFeatureEnabled } from '@renderer/stores/feature-flags-store';

const BEFORE_LIMIT = 400;
const AFTER_LIMIT = 200;
const PREDICTION_LIMIT = 80;

export function predictionContext(
  text: string,
  cursorPos: number
): { readonly before: string; readonly after: string } | null {
  const before = text.slice(Math.max(0, cursorPos - BEFORE_LIMIT), cursorPos);
  if (before.trim().length === 0) {
    return null;
  }
  return { before, after: text.slice(cursorPos, cursorPos + AFTER_LIMIT) };
}

export function sanitizePrediction(text: string | undefined): string | null {
  if (text === undefined) {
    return null;
  }
  const line = text.trim().split('\n')[0]?.trim() ?? '';
  const limited = line.slice(0, PREDICTION_LIMIT);
  return limited.length === 0 ? null : limited;
}

export async function predictNextEdit(
  text: string,
  cursorPos: number,
  signal: AbortSignal
): Promise<string | null> {
  if (signal.aborted || !isFeatureEnabled('ai')) {
    return null;
  }
  const context = predictionContext(text, cursorPos);
  if (context === null) {
    return null;
  }

  try {
    const response = await window.mdxpad.ai.generateText({
      prompt: `Before the cursor:\n${context.before}\n\nAfter the cursor:\n${context.after}\n\nWrite only the text to insert at the cursor.`,
      systemPrompt:
        'Continue the markdown at the cursor. Return only the inserted text, on one line, at most 80 characters.',
      maxTokens: 40,
      temperature: 0.2,
    });
    return sanitizePrediction(response.text);
  } catch {
    return null;
  }
}
