import type { RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import { useDocumentStore } from '@renderer/stores/document-store';
import { selectWorkspaceModel, useWorkspaceStore } from '@renderer/stores/workspace-store';
import {
  selectActiveUtilityPanel,
  useUtilityPanelStore,
  type UtilityPanelId,
} from '@renderer/stores/utility-panel-store';
import { CommentWorkspace } from '@renderer/components/comments/CommentWorkspace';
import { ExportPanel } from '@renderer/components/export/ExportPanel';
import { ShortcutEditor } from '@renderer/components/shortcuts/ShortcutEditor';
import { TagsUtilityPanel } from '@renderer/components/tags/TagsUtilityPanel';
import { WorkspacePanel } from '@renderer/components/workspace/WorkspacePanel';
import { AgentPanel } from '@renderer/features/ai-agent/AgentPanel';
import { DiagramDialog } from '@renderer/features/diagrams/DiagramDialog';
import { MultiFileEditPanel } from '@renderer/components/ai/MultiFileEditPanel';
import { ComponentPlayground } from '@renderer/features/playground/ComponentPlayground';
import { MarketplacePanel } from '@renderer/components/template-marketplace/MarketplacePanel';
import { PluginMarketplace } from '@renderer/features/plugins/PluginMarketplace';
import { CssEditorDialog } from '@renderer/features/plugins/CssEditorDialog';
import { ThemePicker } from '@renderer/features/plugins/ThemePicker';
import { insertTextAtSelection } from '@renderer/lib/insert-document-text';
import { useAgentModeStore } from '@renderer/features/ai-agent/agent-mode-store';
import { SemanticSearchPanel } from '@renderer/features/semantic-search/SemanticSearchPanel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { directoryOfOpenedFile } from '@renderer/hooks/useOpenedFolderFiles';
import { openFileFromPath } from '@renderer/lib/open-file-from-path';
import { insertIntoWysiwyg } from '@renderer/lib/editor/wysiwyg-insert';
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
  agent: 'AI agent',
  diagram: 'Diagram',
  edits: 'AI revisions',
  playground: 'Component playground',
  marketplace: 'Template marketplace',
  css: 'Custom CSS',
  themes: 'Themes',
  plugins: 'Plugins',
};

function PanelBody({
  panel,
  editorRef,
}: {
  readonly panel: Exclude<UtilityPanelId, 'diagram' | 'css'>;
  readonly editorRef: RefObject<EditorView | null>;
}): React.JSX.Element {
  const content = useDocumentStore((state) => state.content);
  const filePath = useDocumentStore((state) => state.filePath);
  const model = useWorkspaceStore(selectWorkspaceModel);

  switch (panel) {
    case 'comments':
      return <CommentWorkspace editorRef={editorRef} />;
    case 'share':
      return <ShareUtilityPanel />;
    case 'history':
      return <HistoryUtilityPanel />;
    case 'tags':
      return <TagsUtilityPanel />;
    case 'shortcuts':
      return <ShortcutEditor />;
    case 'publish':
      return <PublishUtilityPanel />;
    case 'export':
      return <ExportPanel content={content} sourcePath={filePath} />;
    case 'workspace':
      return (
        <WorkspacePanel
          rootPath={model?.workspace.rootPath ?? directoryOfOpenedFile(filePath)}
          activeDocumentId={model?.workspace.activeDocumentId ?? null}
          activeFilePath={filePath}
        />
      );
    case 'semantic-search':
      return (
        <SemanticSearchPanel
          workspacePath={model?.workspace.rootPath ?? directoryOfOpenedFile(filePath) ?? ''}
          onNavigateToFile={(path) => {
            void openFileFromPath(path);
          }}
        />
      );
    case 'edits':
      return <MultiFileEditPanel />;
    case 'playground':
      return (
        <div className="h-[32rem]">
          <ComponentPlayground />
        </div>
      );
    case 'marketplace':
      return <MarketplacePanel />;
    case 'themes':
      return <ThemePicker />;
    case 'plugins':
      return <PluginMarketplace />;
    case 'agent':
      return (
        <div className="h-96">
          <AgentPanel
            {...(model?.workspace.rootPath ? { workspacePath: model.workspace.rootPath } : {})}
            {...(filePath ? { currentFilePath: filePath } : {})}
          />
        </div>
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
  if (panel === 'css') {
    return (
      <CssEditorDialog
        isOpen
        onClose={() => useUtilityPanelStore.getState().setActiveUtilityPanel(null)}
      />
    );
  }
  if (panel === 'diagram') {
    return (
      <DiagramDialog
        isOpen
        onClose={() => useUtilityPanelStore.getState().setActiveUtilityPanel(null)}
        onInsert={(fence) => {
          if (insertIntoWysiwyg(fence)) {
            return;
          }
          const view = editorRef.current;
          const current = view ? view.state.doc.toString() : useDocumentStore.getState().content;
          const selection = view
            ? { from: view.state.selection.main.from, to: view.state.selection.main.to }
            : null;
          useDocumentStore.getState().setContent(insertTextAtSelection(current, fence, selection));
        }}
      />
    );
  }
  if (panel === null) {
    return null;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          if (panel === 'agent') {
            void useAgentModeStore.getState().cancel();
          }
          useUtilityPanelStore.getState().setActiveUtilityPanel(null);
        }
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
