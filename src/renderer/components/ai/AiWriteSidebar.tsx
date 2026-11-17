import { selectWorkspaceModel, useWorkspaceStore } from '@renderer/stores/workspace-store';
import { AIChatWritePanel } from './AIChatWritePanel';

export function AiWriteSidebar(): React.JSX.Element {
  const model = useWorkspaceStore(selectWorkspaceModel);
  const workspaceId = model?.workspace.id;
  const workspaceRootPath = model?.workspace.rootPath;

  return (
    <AIChatWritePanel
      {...(workspaceId ? { workspaceId } : {})}
      {...(workspaceRootPath ? { workspaceRootPath } : {})}
    />
  );
}
