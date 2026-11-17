import { useEffect, useState } from 'react';
import type { PublishProgress } from '@shared/contracts/share-schemas';
import { useDocumentStore } from '@renderer/stores/document-store';
import { PublishWebPanel } from '@renderer/components/publish/PublishWebPanel';

export function PublishUtilityPanel(): React.JSX.Element {
  const filePath = useDocumentStore((state) => state.filePath);
  const fileName = useDocumentStore((state) => state.fileName);
  const [outputDir, setOutputDir] = useState('');
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    filesGenerated: number;
    errors: readonly string[];
  } | null>(null);

  useEffect(() => {
    if (!window.mdxpad.share) return undefined;
    return window.mdxpad.share.onPublishProgress(setProgress);
  }, []);

  const files = filePath ? [{ path: filePath, name: fileName, selected: true }] : [];

  return (
    <PublishWebPanel
      files={files}
      outputDir={outputDir}
      progress={progress}
      isPublishing={isPublishing}
      lastResult={lastResult}
      onToggleFile={() => undefined}
      onSelectAll={() => undefined}
      onDeselectAll={() => undefined}
      onChooseOutputDir={() => {
        if (!window.mdxpad.share) return;
        void window.mdxpad.share.chooseDirectory().then((result) => {
          if (!result.canceled && result.path) {
            setOutputDir(result.path);
          }
        });
      }}
      onOpenOutput={() => {
        if (!window.mdxpad.share || outputDir.length === 0) return;
        void window.mdxpad.share.openDirectory(outputDir);
      }}
      onPublish={() => {
        if (!window.mdxpad.share || !filePath || outputDir.length === 0) return;
        setIsPublishing(true);
        void window.mdxpad.share
          .publish({
            files: [{ path: filePath, title: fileName }],
            outputDir,
            includeStyles: true,
            includeHighlighting: true,
            generateIndex: true,
          })
          .then((result) => {
            setLastResult({
              success: result.success,
              filesGenerated: result.filesGenerated,
              errors: result.errors,
            });
          })
          .finally(() => setIsPublishing(false));
      }}
    />
  );
}
