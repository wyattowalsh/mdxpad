import { EditorView } from '@codemirror/view';
import { type Compartment, type Extension, type StateEffect } from '@codemirror/state';
import { createWordWrapExtension } from '../../lib/editor/extensions/word-wrap';
import { createFontSettingsExtension } from '../../lib/editor/extensions/font-settings';
import { minimapExtension } from '../../lib/editor/extensions/minimap';
import { focusModeExtension } from '../../lib/editor/extensions/focus-mode';
import { spellcheckExtension } from '../../lib/editor/extensions/spellcheck';
import { createKeymapExtension, type KeymapMode } from '../../lib/editor/keymaps';
import { getThemeExtension, type EditorTheme } from './themes';

export interface RuntimeCompartments {
  readonly themeCompartment: Compartment;
  readonly minimapCompartment: Compartment;
  readonly focusModeCompartment: Compartment;
  readonly spellcheckCompartment: Compartment;
  readonly wordWrapCompartment: Compartment;
  readonly fontSettingsCompartment: Compartment;
  readonly keymapCompartment: Compartment;
}

export interface RuntimeReconfigureOptions {
  readonly theme?: EditorTheme | undefined;
  readonly lineWrapping?: boolean | undefined;
  readonly keymapMode?: KeymapMode | undefined;
  readonly enableMinimap?: boolean | undefined;
  readonly enableFocusMode?: boolean | undefined;
  readonly enableSpellcheck?: boolean | undefined;
  readonly fontFamily?: string | undefined;
  readonly fontSize?: number | undefined;
  readonly fontLineHeight?: number | undefined;
  readonly syntaxTheme?: Extension | null | undefined;
}

export function reconfigureRuntimeExtensions(
  view: EditorView,
  compartments: RuntimeCompartments,
  options: RuntimeReconfigureOptions
): void {
  const wordWrap = createWordWrapExtension(options.lineWrapping ?? false);
  const fontSettings = createFontSettingsExtension({
    ...(options.fontFamily !== undefined && { fontFamily: options.fontFamily }),
    ...(options.fontSize !== undefined && { fontSize: options.fontSize }),
    ...(options.fontLineHeight !== undefined && { lineHeight: options.fontLineHeight }),
  });
  const effects: StateEffect<unknown>[] = [
    compartments.themeCompartment.reconfigure(
      options.syntaxTheme ?? getThemeExtension(options.theme ?? 'system')
    ),
    compartments.wordWrapCompartment.reconfigure(wordWrap.extension),
    compartments.fontSettingsCompartment.reconfigure(fontSettings.extension),
    compartments.minimapCompartment.reconfigure(options.enableMinimap ? minimapExtension() : []),
    compartments.focusModeCompartment.reconfigure(
      options.enableFocusMode ? focusModeExtension() : []
    ),
    compartments.spellcheckCompartment.reconfigure(
      options.enableSpellcheck ? spellcheckExtension() : []
    ),
    compartments.keymapCompartment.reconfigure(
      createKeymapExtension(options.keymapMode ?? 'default')
    ),
  ];

  view.dispatch({ effects });
}
