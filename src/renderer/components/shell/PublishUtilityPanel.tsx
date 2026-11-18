import { useEffect, useState } from 'react';
import type { PublishProgress } from '@shared/contracts/share-schemas';
import { useDocumentStore } from '@renderer/stores/document-store';
import {
  PublishWebPanel,
  type PublishRequestOptions,
} from '@renderer/components/publish/PublishWebPanel';

export function PublishUtilityPanel(): React.JSX.Element {
  const filePath = useDocumentStore((state) => state.filePath);
  const fileName = useDocumentStore((state) => state.fileName);
  const content = useDocumentStore((state) => state.content);
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

  const pageName = fileName.trim().length > 0 ? fileName : 'Untitled';
  const pagePath = filePath ?? `${pageName}.md`;
  const files = [{ path: pagePath, name: pageName, selected: true }];

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
        void window.mdxpad.share
          .chooseDirectory()
          .then((result) => {
            if (!result.canceled && result.path) {
              setOutputDir(result.path);
            }
          })
          .catch((caught: unknown) => {
            setLastResult({
              success: false,
              filesGenerated: 0,
              errors: [
                caught instanceof Error ? caught.message : 'Could not choose an output folder',
              ],
            });
          });
      }}
      onOpenOutput={() => {
        if (!window.mdxpad.share || outputDir.length === 0) return;
        void window.mdxpad.share.openDirectory(outputDir);
      }}
      onPublish={(options: PublishRequestOptions) => {
        if (!window.mdxpad.share || outputDir.length === 0) {
          setLastResult({
            success: false,
            filesGenerated: 0,
            errors: ['Choose an output folder'],
          });
          return;
        }
        setIsPublishing(true);
        setLastResult(null);
        void window.mdxpad.share
          .publish({
            files: [{ path: pagePath, title: pageName, content }],
            outputDir,
            includeStyles: options.includeStyles,
            includeHighlighting: true,
            generateIndex: options.generateIndex,
          })
          .then((result) => {
            setLastResult({
              success: result.success,
              filesGenerated: result.filesGenerated,
              errors:
                result.errors.length > 0 || result.success ? result.errors : ['Publishing failed'],
            });
          })
          .catch((caught: unknown) => {
            setLastResult({
              success: false,
              filesGenerated: 0,
              errors: [caught instanceof Error ? caught.message : 'Publishing failed'],
            });
          })
          .finally(() => {
            setIsPublishing(false);
          });
      }}
    />
  );
}
