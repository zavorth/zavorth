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
    shortLabel: 'No Folder',
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
