export type DesktopWorkspaceScope = {
  id: string;
  label: string;
  shortLabel: string;
  kind: 'chat' | 'folder';
  path: string | null;
};

export const defaultWorkspaceScopes: DesktopWorkspaceScope[] = [
  {
    id: 'chat',
    label: 'Chats',
    shortLabel: 'Sem pasta',
    kind: 'chat',
    path: null,
  },
  {
    id: 'local',
    label: 'Local',
    shortLabel: 'Local',
    kind: 'folder',
    path: null,
  },
  {
    id: 'active-projects',
    label: '1_PROJETOS_ATIVOS',
    shortLabel: '1_PROJETOS_ATIVOS',
    kind: 'folder',
    path: 'C:\\TESTES DEV\\1_PROJETOS_ATIVOS',
  },
  {
    id: 'zavorth',
    label: 'Zavorth',
    shortLabel: 'Zavorth',
    kind: 'folder',
    path: 'C:\\TESTES DEV\\1_PROJETOS_ATIVOS\\Zavorth',
  },
];

export function workspaceScopeForMetadata(scope: DesktopWorkspaceScope) {
  return {
    id: scope.id,
    label: scope.label,
    kind: scope.kind,
    path: scope.path,
    confinement: scope.kind === 'folder' ? 'folder-boundary' : 'chat-only',
  };
}
