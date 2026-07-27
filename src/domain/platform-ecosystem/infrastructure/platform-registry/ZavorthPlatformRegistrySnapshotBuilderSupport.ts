import type {
  ZavorthPlatformRegistryAction,
  ZavorthPlatformRegistryCollection,
  ZavorthPlatformRegistryEntry,
  ZavorthPlatformRegistryRecipe,
} from '../../../../services/ZavorthPlatformRegistryService.js';
import type { PluginStateService, PluginTrustState, StoredPluginState } from '../../../../services/PluginStateService.js';

export function resolvePlatformSelectedEntry(
  filteredEntries: ZavorthPlatformRegistryEntry[],
  allEntries: ZavorthPlatformRegistryEntry[],
  selectedId: string,
  query: string,
): ZavorthPlatformRegistryEntry | null {
  if (!filteredEntries.length && !allEntries.length) {
    return null;
  }

  if (selectedId) {
    return filteredEntries.find((entry) => normalizePlatformValue(entry.id) === selectedId)
      || allEntries.find((entry) => normalizePlatformValue(entry.id) === selectedId)
      || null;
  }

  if (query) {
    const exact = filteredEntries.find((entry) => normalizePlatformValue(entry.id) === query);
    if (exact) {
      return exact;
    }
  }

  return filteredEntries.find((entry) => entry.kind === 'plugin' && entry.readiness === 'ready')
    || filteredEntries.find((entry) => entry.kind === 'skill')
    || filteredEntries.find((entry) => entry.kind === 'mcp' && ['enabled', 'installed'].includes(entry.installState))
    || filteredEntries[0]
    || allEntries[0]
    || null;
}

export function resolvePlatformSelectedCollection(
  collections: ZavorthPlatformRegistryCollection[],
  selectedId: string,
  query: string,
): ZavorthPlatformRegistryCollection | null {
  if (!collections.length) {
    return null;
  }

  if (selectedId) {
    const normalizedCollectionId = normalizePlatformCollectionSelection(selectedId);
    return collections.find((entry) => normalizePlatformValue(entry.id) === normalizedCollectionId) || null;
  }

  if (query) {
    const normalizedCollectionId = normalizePlatformCollectionSelection(query);
    return collections.find((entry) => normalizePlatformValue(entry.id) === normalizedCollectionId) || null;
  }

  return null;
}

export function resolvePlatformSelectedRecipe(
  recipes: ZavorthPlatformRegistryRecipe[],
  selectedId: string,
  query: string,
): ZavorthPlatformRegistryRecipe | null {
  if (!recipes.length) {
    return null;
  }

  if (selectedId) {
    const normalizedRecipeId = normalizePlatformRecipeSelection(selectedId);
    return recipes.find((entry) => normalizePlatformValue(entry.id) === normalizedRecipeId) || null;
  }

  if (query) {
    const normalizedRecipeId = normalizePlatformRecipeSelection(query);
    return recipes.find((entry) => normalizePlatformValue(entry.id) === normalizedRecipeId) || null;
  }

  return null;
}

export function buildPlatformBaseActions(
  entryId: string,
  openLabel: string,
  openCommand: string | null,
): ZavorthPlatformRegistryEntry['actions'] {
  return [
    {
      id: `${entryId}:inspect`,
      label: 'Inspecionar',
      kind: 'inspect',
      command: `/platform ${entryId}`,
    },
    {
      id: `${entryId}:open`,
      label: openLabel,
      kind: 'open',
      command: openCommand,
    },
  ];
}

export function buildPlatformInstallAction(entryId: string, label: string): ZavorthPlatformRegistryAction {
  return {
    id: `${entryId}:install`,
    label,
    kind: 'install',
    command: `/platform install ${entryId}`,
  };
}

export function buildPlatformTrustAction(
  entryId: string,
  trust: ZavorthPlatformRegistryEntry['trust'],
): ZavorthPlatformRegistryAction {
  const actionId = trust === 'trusted' ? 'review' : 'trust';
  return {
    id: `${entryId}:${actionId}`,
    label: actionId === 'trust' ? 'Marcar trusted' : 'Marcar review',
    kind: actionId,
    command: `/platform ${actionId} ${entryId}`,
  };
}

export function buildPlatformRemoveAction(entryId: string, label: string): ZavorthPlatformRegistryAction {
  return {
    id: `${entryId}:remove`,
    label,
    kind: 'remove',
    command: `/platform remove ${entryId}`,
  };
}

export function buildPlatformCollectionActions(
  collectionId: string,
  actionHint: string,
  items: ZavorthPlatformRegistryCollection['items'],
  missingCount: number,
): ZavorthPlatformRegistryAction[] {
  const installableItems = items.filter((item) => !['installed', 'workspace', 'enabled'].includes(item.installState));
  const actions: ZavorthPlatformRegistryAction[] = [
    {
      id: `${collectionId}:inspect`,
      label: 'Inspecionar collection',
      kind: 'inspect',
      command: `/platform ${collectionId}`,
    },
    {
      id: `${collectionId}:open`,
      label: 'Abrir trilha',
      kind: 'open',
      command: actionHint || `/platform ${collectionId}`,
    },
  ];

  if (items.length > 0 || missingCount > 0) {
    actions.push({
      id: `${collectionId}:install`,
      label: installableItems.length > 0 ? 'Adotar collection' : 'Sincronizar collection',
      kind: 'install',
      command: `/platform install ${collectionId}`,
    });
  }

  return actions;
}

export function buildPlatformRecipeActions(
  recipeId: string,
  actionHint: string,
  targets: ZavorthPlatformRegistryRecipe['targets'],
  missingCount: number,
): ZavorthPlatformRegistryAction[] {
  const actionableTargets = targets.filter((target) => !['installed', 'workspace', 'enabled'].includes(target.installState));
  const actions: ZavorthPlatformRegistryAction[] = [
    {
      id: `${recipeId}:inspect`,
      label: 'Inspecionar recipe',
      kind: 'inspect',
      command: `/platform ${recipeId}`,
    },
    {
      id: `${recipeId}:open`,
      label: 'Abrir guia',
      kind: 'open',
      command: actionHint || `/platform ${recipeId}`,
    },
  ];

  if (targets.length > 0 || missingCount > 0) {
    actions.push({
      id: `${recipeId}:install`,
      label: actionableTargets.length > 0 ? 'Apply recipe' : 'Sync recipe',
      kind: 'install',
      command: `/platform install ${recipeId}`,
    });
  }

  return actions;
}

export function resolvePlatformLocalState(
  pluginState: Pick<PluginStateService, 'getState' | 'resolveState'>,
  entryId: string,
  defaults: {
    installed: boolean;
    trust: PluginTrustState;
    installedRevision?: string | null;
  },
): { stored: StoredPluginState | null; resolved: StoredPluginState } {
  return {
    stored: pluginState.getState(entryId),
    resolved: pluginState.resolveState(entryId, defaults),
  };
}

export function normalizePlatformStateTrust(value: ZavorthPlatformRegistryEntry['trust']): PluginTrustState {
  return value === 'trusted' ? 'trusted' : 'review';
}

export function normalizePlatformReadiness(value: string | null | undefined): ZavorthPlatformRegistryEntry['readiness'] {
  const normalized = normalizePlatformValue(value);
  switch (normalized) {
    case 'ready':
    case 'workspace':
      return 'ready';
    case 'configure':
    case 'partial':
      return 'partial';
    case 'disabled':
      return 'disabled';
    default:
      return 'planned';
  }
}

export function normalizePlatformInstallState(value: string | null | undefined): ZavorthPlatformRegistryEntry['installState'] {
  const normalized = normalizePlatformValue(value);
  switch (normalized) {
    case 'installed':
    case 'workspace':
      return normalized;
    default:
      return 'available';
  }
}

export function normalizePlatformSearchText(values: Array<string | null | undefined>): string {
  return values
    .map((value) => normalizePlatformValue(value))
    .filter(Boolean)
    .join(' ');
}

export function normalizePlatformValue(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function normalizePlatformCollectionSelection(value: string | null | undefined): string {
  const normalized = normalizePlatformValue(value);
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('collection:') ? normalized : `collection:${normalized}`;
}

export function normalizePlatformRecipeSelection(value: string | null | undefined): string {
  const normalized = normalizePlatformValue(value);
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('recipe:') ? normalized : `recipe:${normalized}`;
}

export function normalizePlatformActionId(value: string | null | undefined): string {
  const normalized = normalizePlatformValue(value).split(':').pop() || '';
  switch (normalized) {
    case 'inspect':
    case 'open':
    case 'doctor':
    case 'trust':
    case 'review':
    case 'install':
    case 'update':
    case 'remove':
      return normalized;
    default:
      return 'inspect';
  }
}

export function normalizePlatformActionKind(
  value: string | null | undefined,
): ZavorthPlatformRegistryEntry['actions'][number]['kind'] {
  const normalized = normalizePlatformValue(value);
  switch (normalized) {
    case 'inspect':
    case 'open':
    case 'doctor':
    case 'install':
    case 'update':
    case 'remove':
      return normalized;
    case 'trust':
      return 'trust';
    default:
      return normalized === 'review' ? 'review' : 'inspect';
  }
}
