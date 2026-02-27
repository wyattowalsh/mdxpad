/**
 * ThemePicker Component
 *
 * Grid of theme previews with apply-on-click functionality.
 * Shows built-in and user-installed themes.
 *
 * @module renderer/features/plugins/ThemePicker
 */

import { useCallback, useEffect, useState } from 'react';

import type { ThemeDefinition } from '@shared/contracts/plugin-schemas';

import { getAllThemes, getActiveThemeId, applyTheme, resetTheme } from './theme-manager';

// ============================================================================
// Component
// ============================================================================

export function ThemePicker() {
  const [themes, setThemes] = useState<ThemeDefinition[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setThemes(getAllThemes());
    setActiveId(getActiveThemeId());
  }, []);

  const handleApply = useCallback((themeId: string) => {
    const success = applyTheme(themeId);
    if (success) {
      setActiveId(themeId);
    }
  }, []);

  const handleReset = useCallback(() => {
    resetTheme();
    setActiveId(null);
  }, []);

  const builtIn = themes.filter((t) => t.builtIn);
  const custom = themes.filter((t) => !t.builtIn);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Themes</h3>
        {activeId && (
          <button
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            onClick={handleReset}
          >
            Reset to Default
          </button>
        )}
      </div>

      {/* Built-in themes */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Built-in</h4>
        <div className="grid grid-cols-3 gap-3">
          {builtIn.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={theme.id === activeId}
              onApply={handleApply}
            />
          ))}
        </div>
      </div>

      {/* Custom themes */}
      {custom.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Custom</h4>
          <div className="grid grid-cols-3 gap-3">
            {custom.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={theme.id === activeId}
                onApply={handleApply}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Theme Card
// ============================================================================

function ThemeCard({
  theme,
  isActive,
  onApply,
}: {
  theme: ThemeDefinition;
  isActive: boolean;
  onApply: (themeId: string) => void;
}) {
  return (
    <button
      className={`
        flex flex-col rounded-lg border-2 overflow-hidden cursor-pointer transition-all
        ${
          isActive
            ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
        }
      `}
      onClick={() => onApply(theme.id)}
    >
      {/* Color preview */}
      <div
        className="h-16 p-2 flex flex-col gap-0.5"
        style={{ backgroundColor: theme.tokens.background }}
      >
        <div className="flex gap-1">
          <span style={{ color: theme.tokens.keyword, fontSize: '10px', fontFamily: 'monospace' }}>
            const
          </span>
          <span style={{ color: theme.tokens.variable, fontSize: '10px', fontFamily: 'monospace' }}>
            hello
          </span>
          <span style={{ color: theme.tokens.operator, fontSize: '10px', fontFamily: 'monospace' }}>
            =
          </span>
        </div>
        <div className="flex gap-1">
          <span style={{ color: theme.tokens.string, fontSize: '10px', fontFamily: 'monospace' }}>
            &quot;world&quot;
          </span>
        </div>
        <div>
          <span style={{ color: theme.tokens.comment, fontSize: '10px', fontFamily: 'monospace' }}>
            // comment
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="px-2 py-1.5 bg-gray-50 dark:bg-gray-800 text-center">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{theme.name}</span>
        {isActive && (
          <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(active)</span>
        )}
      </div>
    </button>
  );
}
