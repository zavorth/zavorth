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
    label: 'local',
    shortLabel: 'local',
    kind: 'folder',
    path: null,
  },
];

function asScope(value: unknown): DesktopWorkspaceScope | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = String(record.id || '').trim();
  if (!id) return null;
  const kind = record.kind === 'folder' ? 'folder' : 'chat';
  const label = String(record.label || id).trim() || id;
  const shortLabel = String(record.shortLabel || label).trim() || label;
  const path = record.path == null ? null : String(record.path);
  return { id, label, shortLabel, kind, path };
}

/**
 * Normalize arbitrary workspace-scope payloads into a unique, render-safe list.
 * Falls back to defaults when input is empty/invalid.
 */
export function normalizeWorkspaceScopes(input: unknown): DesktopWorkspaceScope[] {
  if (!Array.isArray(input)) {
    return defaultWorkspaceScopes.map((scope) => ({ ...scope }));
  }

  const seen = new Set<string>();
  const scopes: DesktopWorkspaceScope[] = [];
  for (const entry of input) {
    const scope = asScope(entry);
    if (!scope || seen.has(scope.id)) continue;
    seen.add(scope.id);
    scopes.push(scope);
  }

  return scopes.length > 0
    ? scopes
    : defaultWorkspaceScopes.map((scope) => ({ ...scope }));
}

export function workspaceScopeForMetadata(scope: DesktopWorkspaceScope) {
  return {
    id: scope.id,
    label: scope.label,
    kind: scope.kind,
    path: scope.path,
    confinement: scope.kind === 'folder' ? 'folder-boundary' : 'chat-only',
  };
}
