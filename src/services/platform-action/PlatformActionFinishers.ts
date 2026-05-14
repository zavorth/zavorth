import type {
  ZavorthPlatformRegistryCollection,
  ZavorthPlatformRegistryEntry,
  ZavorthPlatformRegistryRecipe,
  ZavorthPlatformRegistrySnapshot,
} from '../ZavorthPlatformRegistryService.js';
import type { ZavorthPluginActionExecution } from '../ZavorthPluginActionService.js';
import type { LearningPlaneActionExecution } from '../ZavorthLearningPlaneService.js';
import type { ZavorthPlatformActionExecution } from '../ZavorthPlatformActionService.js';

type RegistrySnapshotReader = Pick<{ buildSnapshot: (input?: any) => ZavorthPlatformRegistrySnapshot }, 'buildSnapshot'>;

export function finishPlatformEntry(
  platformRegistry: RegistrySnapshotReader,
  now: () => Date,
  actionId: ZavorthPlatformActionExecution['actionId'],
  selected: ZavorthPlatformRegistryEntry,
  status: ZavorthPlatformActionExecution['status'],
  summary: string,
  details: string[],
): ZavorthPlatformActionExecution {
  const snapshot = platformRegistry.buildSnapshot({ selectedId: selected.id });
  return {
    generatedAt: now().toISOString(),
    entryId: selected.id,
    actionId,
    status,
    ok: status !== 'blocked',
    summary,
    details,
    selected: snapshot.selected,
    selectedCollection: snapshot.selectedCollection,
    selectedRecipe: snapshot.selectedRecipe,
    snapshot,
    delegated: null,
    learningDelegated: null,
  };
}

export function finishPlatformCollection(
  platformRegistry: RegistrySnapshotReader,
  now: () => Date,
  actionId: ZavorthPlatformActionExecution['actionId'],
  selectedCollection: ZavorthPlatformRegistryCollection,
  status: ZavorthPlatformActionExecution['status'],
  summary: string,
  details: string[],
): ZavorthPlatformActionExecution {
  const snapshot = platformRegistry.buildSnapshot({ selectedId: selectedCollection.id });
  return {
    generatedAt: now().toISOString(),
    entryId: selectedCollection.id,
    actionId,
    status,
    ok: status !== 'blocked',
    summary,
    details,
    selected: snapshot.selected,
    selectedCollection: snapshot.selectedCollection,
    selectedRecipe: snapshot.selectedRecipe,
    snapshot,
    delegated: null,
    learningDelegated: null,
  };
}

export function finishPlatformRecipe(
  platformRegistry: RegistrySnapshotReader,
  now: () => Date,
  actionId: ZavorthPlatformActionExecution['actionId'],
  selectedRecipe: ZavorthPlatformRegistryRecipe,
  status: ZavorthPlatformActionExecution['status'],
  summary: string,
  details: string[],
): ZavorthPlatformActionExecution {
  const snapshot = platformRegistry.buildSnapshot({ selectedId: selectedRecipe.id });
  return {
    generatedAt: now().toISOString(),
    entryId: selectedRecipe.id,
    actionId,
    status,
    ok: status !== 'blocked',
    summary,
    details,
    selected: snapshot.selected,
    selectedCollection: snapshot.selectedCollection,
    selectedRecipe: snapshot.selectedRecipe,
    snapshot,
    delegated: null,
    learningDelegated: null,
  };
}

export function finishPluginDelegatedPlatformAction(input: {
  delegated: ZavorthPluginActionExecution;
  now: () => Date;
  platformRegistry: RegistrySnapshotReader;
  selected: ZavorthPlatformRegistryEntry;
  actionId: ZavorthPlatformActionExecution['actionId'];
}): ZavorthPlatformActionExecution {
  const snapshot = input.platformRegistry.buildSnapshot({ selectedId: input.selected.id });
  return {
    generatedAt: input.now().toISOString(),
    entryId: input.selected.id,
    actionId: input.actionId,
    status: input.delegated.status,
    ok: input.delegated.ok,
    summary: input.delegated.summary,
    details: input.delegated.details.slice(),
    selected: snapshot.selected,
    selectedCollection: snapshot.selectedCollection,
    selectedRecipe: snapshot.selectedRecipe,
    snapshot,
    delegated: input.delegated,
    learningDelegated: null,
  };
}

export function finishLearningDelegatedPlatformAction(input: {
  delegated: LearningPlaneActionExecution;
  platformRegistry: RegistrySnapshotReader;
  selected: ZavorthPlatformRegistryEntry;
}): ZavorthPlatformActionExecution {
  const snapshot = input.platformRegistry.buildSnapshot({ selectedId: input.selected.id });
  return {
    generatedAt: input.delegated.generatedAt,
    entryId: input.selected.id,
    actionId: input.delegated.actionId === 'approve'
      ? 'install'
      : input.delegated.actionId === 'promote'
        ? 'trust'
        : 'review',
    status: input.delegated.status === 'blocked' ? 'blocked' : input.delegated.status === 'noop' ? 'noop' : 'applied',
    ok: input.delegated.ok,
    summary: input.delegated.summary,
    details: input.delegated.details.slice(),
    selected: snapshot.selected,
    selectedCollection: snapshot.selectedCollection,
    selectedRecipe: snapshot.selectedRecipe,
    snapshot,
    delegated: null,
    learningDelegated: input.delegated,
  };
}
