import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  AddLinkRequest,
  AddLinkResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  GetBacklinksRequest,
  GetBacklinksResponse,
  OpenWorkspaceRequest,
  OpenWorkspaceResponse,
  SaveWorkspaceRequest,
  SaveWorkspaceResponse,
} from '@shared/contracts/workspace-schemas';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import { ProjectDialog } from './ProjectDialog';

vi.mock('@ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="project-dialog">{children}</div> : null,
  DialogContent: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';

interface WorkspaceBridgeMock {
  openWorkspace: ReturnType<
    typeof vi.fn<(request: OpenWorkspaceRequest) => Promise<OpenWorkspaceResponse>>
  >;
  saveWorkspace: ReturnType<
    typeof vi.fn<(request: SaveWorkspaceRequest) => Promise<SaveWorkspaceResponse>>
  >;
  createProject: ReturnType<
    typeof vi.fn<(request: CreateProjectRequest) => Promise<CreateProjectResponse>>
  >;
  addLink: ReturnType<typeof vi.fn<(request: AddLinkRequest) => Promise<AddLinkResponse>>>;
  getBacklinks: ReturnType<
    typeof vi.fn<(request: GetBacklinksRequest) => Promise<GetBacklinksResponse>>
  >;
}

function createWorkspaceBridgeMock(): WorkspaceBridgeMock {
  return {
    openWorkspace: vi.fn<(request: OpenWorkspaceRequest) => Promise<OpenWorkspaceResponse>>(),
    saveWorkspace: vi.fn<(request: SaveWorkspaceRequest) => Promise<SaveWorkspaceResponse>>(),
    createProject: vi.fn<(request: CreateProjectRequest) => Promise<CreateProjectResponse>>(),
    addLink: vi.fn<(request: AddLinkRequest) => Promise<AddLinkResponse>>(),
    getBacklinks: vi.fn<(request: GetBacklinksRequest) => Promise<GetBacklinksResponse>>(),
  };
}

describe('ProjectDialog', () => {
  let previousMdxpad: unknown;
  let mockWorkspaceApi: WorkspaceBridgeMock;

  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    vi.clearAllMocks();
    mockWorkspaceApi = createWorkspaceBridgeMock();

    const windowWithBridge = window as unknown as { mdxpad?: unknown };
    previousMdxpad = windowWithBridge.mdxpad;
    windowWithBridge.mdxpad = mockWorkspaceApi;
  });

  afterEach(() => {
    cleanup();
    useWorkspaceStore.getState().reset();

    const windowWithBridge = window as unknown as { mdxpad?: unknown };
    if (previousMdxpad === undefined) {
      Reflect.deleteProperty(windowWithBridge, 'mdxpad');
    } else {
      windowWithBridge.mdxpad = previousMdxpad;
    }
  });

  it('creates a project from form values and closes on success', async () => {
    mockWorkspaceApi.createProject.mockResolvedValue({
      ok: true,
      value: {
        id: PROJECT_ID,
        workspaceId: WORKSPACE_ID,
        name: 'Project Alpha',
        rootPath: '/workspace/projects/alpha',
        documentIds: [],
        activeDocumentId: null,
        createdAt: '2026-02-20T00:00:00.000Z',
        updatedAt: '2026-02-20T00:00:00.000Z',
      },
    });

    const onClose = vi.fn();
    render(<ProjectDialog isOpen={true} workspaceId={WORKSPACE_ID} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: 'Project Alpha' },
    });
    fireEvent.change(screen.getByLabelText('Project root path'), {
      target: { value: '/workspace/projects/alpha' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => {
      expect(mockWorkspaceApi.createProject).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        name: 'Project Alpha',
        rootPath: '/workspace/projects/alpha',
        documentIds: [],
        activeDocumentId: null,
      });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows store error when project creation fails', async () => {
    mockWorkspaceApi.createProject.mockResolvedValue({
      ok: false,
      error: {
        code: 'UNKNOWN',
        message: 'Unable to create project',
      },
    });

    render(<ProjectDialog isOpen={true} workspaceId={WORKSPACE_ID} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: 'Project Beta' },
    });
    fireEvent.change(screen.getByLabelText('Project root path'), {
      target: { value: '/workspace/projects/beta' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => {
      expect(screen.getByText('Unable to create project')).toBeTruthy();
    });
  });
});
