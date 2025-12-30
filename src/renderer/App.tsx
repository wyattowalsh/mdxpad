/**
 * Root application component.
 * Shows basic shell UI with app info.
 */

import React, { useEffect, useState } from 'react';

/**
 * Main App component.
 * Displays mdxpad title and version from main process.
 */
export function App(): React.ReactElement {
  const [version, setVersion] = useState<string>('...');

  useEffect(() => {
    // Fetch version from main process via preload API
    void window.mdxpad.getVersion().then(setVersion);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Titlebar drag region for macOS hiddenInset */}
      <div className="h-8 w-full" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-neutral-900">mdxpad</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Version {version} • {window.mdxpad.platform.os} {window.mdxpad.platform.arch}
          </p>
        </div>
      </main>
    </div>
  );
}
