/**
 * Template import and export may use only a path the native dialog just returned.
 */

import { normalizeCapabilityPath } from '@main/ipc/document-capability';

const chosenPaths = new Set<string>();

export function rememberChosenTemplatePath(filePath: string): void {
  const normalized = normalizeCapabilityPath(filePath);
  if (normalized !== null) {
    chosenPaths.add(normalized);
  }
}

export function templatePathWasChosen(filePath: string): boolean {
  const normalized = normalizeCapabilityPath(filePath);
  return normalized !== null && chosenPaths.has(normalized);
}

export function unchosenTemplatePathError(filePath: string): string | null {
  if (templatePathWasChosen(filePath)) {
    return null;
  }
  return 'Choose this file in the template dialog before using it';
}

export function resetChosenTemplatePaths(): void {
  chosenPaths.clear();
}
