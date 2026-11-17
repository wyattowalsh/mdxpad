import type { RefObject } from 'react';
import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useCommentsStore } from '@renderer/stores/comments-store';
import { selectWorkspaceModel, useWorkspaceStore } from '@renderer/stores/workspace-store';
import {
  selectActiveUtilityPanel,
  useUtilityPanelStore,
  type UtilityPanelId,
} from '@renderer/stores/utility-panel-store';
import { CommentPanel } from '@renderer/components/comments/CommentPanel';
import { ExportPanel } from '@renderer/components/export/ExportPanel';
import { ShortcutEditor } from '@renderer/components/shortcuts/ShortcutEditor';
import { TagTreePanel } from '@renderer/components/tags/TagTreePanel';
import { WorkspacePanel } from '@renderer/components/workspace/WorkspacePanel';
import { SemanticSearchPanel } from '@renderer/features/semantic-search/SemanticSearchPanel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { useTagStore } from '@renderer/stores/tag-store';
import { openFileFromPath } from '@renderer/lib/open-file-from-path';
import { HistoryUtilityPanel } from './HistoryUtilityPanel';
import { PublishUtilityPanel } from './PublishUtilityPanel';
import { ShareUtilityPanel } from './ShareUtilityPanel';

const PANEL_TITLES: Record<UtilityPanelId, string> = {
  workspace: 'Workspace',
  export: 'Export',
  comments: 'Comments',
  share: 'Share',
  history: 'Version history',
  tags: 'Tags',
  shortcuts: 'Keyboard shortcuts',
  publish: 'Publish',
  'semantic-search': 'Semantic search',
};

function revealCommentThread(view: EditorView, anchorFrom: number): void {
  view.dispatch({
    selection: EditorSelection.cursor(anchorFrom),
    scrollIntoView: true,
  });
}

function PanelBody({
  panel,
  editorRef,
}: {
  readonly panel: UtilityPanelId;
  readonly editorRef: RefObject<EditorView | null>;
}): React.JSX.Element {
  const content = useDocumentStore((state) => state.content);
  const filePath = useDocumentStore((state) => state.filePath);
  const threads = useCommentsStore((state) => state.threads);
  const activeThreadId = useCommentsStore((state) => state.activeThreadId);
  const model = useWorkspaceStore(selectWorkspaceModel);

  switch (panel) {
    case 'comments':
      return (
        <CommentPanel
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={(threadId) => useCommentsStore.getState().setActiveThread(threadId)}
          onNavigateToThread={(threadId) => {
            useCommentsStore.getState().setActiveThread(threadId);
            const thread = threads.find((item) => item.id === threadId);
            const view = editorRef.current;
            if (thread && view) {
              revealCommentThread(view, thread.anchorFrom);
            }
          }}
        />
      );
    case 'share':
      return <ShareUtilityPanel />;
    case 'history':
      return <HistoryUtilityPanel />;
    case 'tags':
      return (
        <TagTreePanel onTagClick={(tagId) => useTagStore.getState().toggleSelectedTag(tagId)} />
      );
    case 'shortcuts':
      return <ShortcutEditor />;
    case 'publish':
      return <PublishUtilityPanel />;
    case 'export':
      return <ExportPanel content={content} sourcePath={filePath} />;
    case 'workspace':
      return (
        <WorkspacePanel
          rootPath={model?.workspace.rootPath ?? null}
          activeDocumentId={model?.workspace.activeDocumentId ?? null}
        />
      );
    case 'semantic-search':
      return (
        <SemanticSearchPanel
          workspacePath={model?.workspace.rootPath ?? ''}
          onNavigateToFile={(path) => {
            void openFileFromPath(path);
          }}
        />
      );
    default: {
      const unreachable: never = panel;
      return unreachable;
    }
  }
}

export function MountedUtilityPanels({
  editorRef,
}: {
  readonly editorRef: RefObject<EditorView | null>;
}): React.JSX.Element | null {
  const panel = useUtilityPanelStore(selectActiveUtilityPanel);
  if (panel === null) {
    return null;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) useUtilityPanelStore.getState().setActiveUtilityPanel(null);
      }}
    >
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto" data-testid="utility-panel">
        <DialogHeader>
          <DialogTitle>{PANEL_TITLES[panel]}</DialogTitle>
          <DialogDescription className="sr-only">{PANEL_TITLES[panel]}</DialogDescription>
        </DialogHeader>
        <PanelBody panel={panel} editorRef={editorRef} />
      </DialogContent>
    </Dialog>
  );
}
