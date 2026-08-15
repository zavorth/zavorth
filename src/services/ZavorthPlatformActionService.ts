import type {
  ZavorthPlatformRegistryCollection,
  ZavorthPlatformRegistryEntry,
  ZavorthPlatformRegistryRecipe,
  ZavorthPlatformRegistrySnapshot,
} from './ZavorthPlatformRegistryService.js';
import { ZavorthPlatformRegistryService } from './ZavorthPlatformRegistryService.js';
import { PluginStateService } from './PluginStateService.js';
import {
  finishLearningDelegatedPlatformAction,
  finishPlatformCollection,
  finishPlatformEntry,
  finishPlatformRecipe,
  finishPluginDelegatedPlatformAction,
} from './platform-action/PlatformActionFinishers.js';
import {
  buildPlatformLifecycleState,
  extractLearningCandidateId,
  isPlatformLocallyAdopted,
  normalizePlatformActionId,
  normalizePlatformActionValue,
  supportsPlatformLocalLifecycle,
} from './platform-action/PlatformActionSupport.js';

import {
  ZavorthPluginActionService,
  type ZavorthPluginActionExecution,
} from './ZavorthPluginActionService.js';

import {
  ZavorthLearningPlaneService,
  type LearningPlaneActionExecution,
} from './ZavorthLearningPlaneService.js';


type ZavorthPlatformActionRuntime = {
  now?: () => Date;
  platformRegistryService?: Pick<ZavorthPlatformRegistryService, 'buildSnapshot'>;
  pluginActionService?: Pick<ZavorthPluginActionService, 'execute'>;
  pluginStateService?: Pick<PluginStateService, 'upsertState' | 'clearState'>;
  learningPlaneService?: Pick<ZavorthLearningPlaneService, 'executeAction'>;
};

export type ZavorthPlatformActionExecution = {
  generatedAt: string;
  entryId: string;
  actionId: 'inspect' | 'open' | 'doctor' | 'trust' | 'review' | 'install' | 'update' | 'remove';
  status: 'applied' | 'noop' | 'manual' | 'blocked';
  ok: boolean;
  summary: string;
  details: string[];
  selected: ZavorthPlatformRegistryEntry | null;
  selectedCollection: ZavorthPlatformRegistryCollection | null;
  selectedRecipe: ZavorthPlatformRegistryRecipe | null;
  snapshot: ZavorthPlatformRegistrySnapshot;
  delegated: ZavorthPluginActionExecution | null;
  learningDelegated?: LearningPlaneActionExecution | null;
};

export class ZavorthPlatformActionService {
  private readonly now: () => Date;
  private readonly platformRegistry: Pick<ZavorthPlatformRegistryService, 'buildSnapshot'>;
  private readonly pluginActions: Pick<ZavorthPluginActionService, 'execute'>;
  private readonly platformState: Pick<PluginStateService, 'upsertState' | 'clearState'>;
  private readonly learningPlane: Pick<ZavorthLearningPlaneService, 'executeAction'> | null;

  constructor(runtime: ZavorthPlatformActionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.platformRegistry = runtime.platformRegistryService || new ZavorthPlatformRegistryService();
    this.pluginActions = runtime.pluginActionService || new ZavorthPluginActionService();
    this.platformState = runtime.pluginStateService || new PluginStateService();
    this.learningPlane = runtime.learningPlaneService || null;
  }

  public async execute(input: {
    entryId: string;
    actionId: string;
    requestedBy?: string | null;
    workspace?: string | null;
  }): Promise<ZavorthPlatformActionExecution> {
    const entryId = normalizePlatformActionValue(input.entryId);
    const actionId = normalizePlatformActionId(input.actionId);
    if (!entryId) {
      throw new Error('entryId is required.');
    }
    if (!actionId) {
      throw new Error('actionId is required.');
    }

    const snapshot = this.platformRegistry.buildSnapshot({ selectedId: entryId });
    const selectedCollection = snapshot.selectedCollection;
    if (selectedCollection && normalizePlatformActionValue(selectedCollection.id) === entryId) {
      return this.executeCollectionAction(selectedCollection, actionId, input);
    }
    const selectedRecipe = snapshot.selectedRecipe;
    if (selectedRecipe && normalizePlatformActionValue(selectedRecipe.id) === entryId) {
      return this.executeRecipeAction(selectedRecipe, actionId, input);
    }

    const selected = snapshot.selected;
    if (!selected) {
      throw new Error(`Platform plane item not found: ${entryId}.`);
    }

    if (selected.kind === 'plugin') {
      return this.executePluginAction(selected, actionId, input);
    }

    if (selected.source === 'learning-plane' && this.learningPlane) {
      return this.executeLearningAction(selected, actionId);
    }

    switch (actionId) {
      case 'inspect':
        return this.finishEntry(actionId, selected, 'manual', `Inspection ready for ${selected.label}.`, [
          selected.summary,
          `Kind: ${selected.kind}`,
          `Readiness: ${selected.readiness}`,
          `Trust: ${selected.trust}`,
          `Install: ${selected.installState}`,
          ...selected.details.slice(0, 4),
        ]);
      case 'open':
        return this.finishEntry(actionId, selected, 'manual', `${selected.label}: next step ready.`, [
          `Recommended shortcut: ${selected.actionHint || 'n/d'}`,
          selected.summary,
          ...selected.details.slice(0, 4),
        ]);
      case 'doctor':
        return this.finishEntry(actionId, selected, 'manual', `Doctor for ${selected.label} ready.`, [
          selected.summary,
          `Readiness: ${selected.readiness}`,
          `Trust: ${selected.trust}`,
          `Install: ${selected.installState}`,
          `Next step: ${selected.actionHint || 'n/d'}`,
          ...selected.details.slice(0, 3),
        ]);
      case 'trust':
        return this.executeLocalTrust(selected, snapshot, 'trusted');
      case 'review':
        return this.executeLocalTrust(selected, snapshot, 'review');
      case 'install':
        return this.executeLocalInstall(selected, snapshot);
      case 'remove':
        return this.executeLocalRemove(selected);
      default:
        return this.finishEntry(actionId, selected, 'blocked', `${selected.label} does not support ${actionId} no platform plane.`, [
          'This item does not expose mutable lifecycle in the unified plane yet.',
          `Use ${selected.actionHint || 'the dedicated surface'} to proceed manually.`,
        ]);
    }
  }

  private async executeCollectionAction(
    selectedCollection: ZavorthPlatformRegistryCollection,
    actionId: ZavorthPlatformActionExecution['actionId'],
    input: {
      requestedBy?: string | null;
      workspace?: string | null;
    },
  ): Promise<ZavorthPlatformActionExecution> {
    switch (actionId) {
      case 'inspect':
        return this.finishCollection(actionId, selectedCollection, 'manual', `Inspection ready for ${selectedCollection.label}.`, [
          selectedCollection.summary,
          `Items: ${selectedCollection.itemCount}`,
          `Ready: ${selectedCollection.readyCount}`,
          `Adopted: ${selectedCollection.adoptedCount}`,
          `Missing references: ${selectedCollection.missingCount}`,
          ...selectedCollection.details.slice(0, 4),
        ]);
      case 'open':
        return this.finishCollection(actionId, selectedCollection, 'manual', `${selectedCollection.label}: track ready.`, [
          `Recommended shortcut: ${selectedCollection.actionHint || 'n/d'}`,
          selectedCollection.summary,
          ...selectedCollection.details.slice(0, 4),
        ]);
      case 'install':
        return this.executeCollectionInstall(selectedCollection, input);
      default:
        return this.finishCollection(
          actionId,
          selectedCollection,
          'blocked',
          `${selectedCollection.label} does not support ${actionId} as a guided collection.`,
          ['Collections currently expose inspect, open and install as actionable paths.'],
        );
    }
  }

  private async executePluginAction(
    selected: ZavorthPlatformRegistryEntry,
    actionId: ZavorthPlatformActionExecution['actionId'],
    input: {
      requestedBy?: string | null;
      workspace?: string | null;
    },
  ): Promise<ZavorthPlatformActionExecution> {
    const pluginId = selected.id.replace(/^plugin:/i, '').trim();
    const delegated = await this.pluginActions.execute({
      pluginId,
      actionId,
      requestedBy: String(input.requestedBy || '').trim() || null,
      workspace: String(input.workspace || '').trim() || null,
    });

    return finishPluginDelegatedPlatformAction({
      actionId,
      delegated,
      now: this.now,
      platformRegistry: this.platformRegistry,
      selected,
    });
  }

  private finishEntry(
    actionId: ZavorthPlatformActionExecution['actionId'],
    selected: ZavorthPlatformRegistryEntry,
    status: ZavorthPlatformActionExecution['status'],
    summary: string,
    details: string[],
  ): ZavorthPlatformActionExecution {
    return finishPlatformEntry(this.platformRegistry, this.now, actionId, selected, status, summary, details);
  }

  private finishCollection(
    actionId: ZavorthPlatformActionExecution['actionId'],
    selectedCollection: ZavorthPlatformRegistryCollection,
    status: ZavorthPlatformActionExecution['status'],
    summary: string,
    details: string[],
  ): ZavorthPlatformActionExecution {
    return finishPlatformCollection(this.platformRegistry, this.now, actionId, selectedCollection, status, summary, details);
  }

  private finishRecipe(
    actionId: ZavorthPlatformActionExecution['actionId'],
    selectedRecipe: ZavorthPlatformRegistryRecipe,
    status: ZavorthPlatformActionExecution['status'],
    summary: string,
    details: string[],
  ): ZavorthPlatformActionExecution {
    return finishPlatformRecipe(this.platformRegistry, this.now, actionId, selectedRecipe, status, summary, details);
  }

  private async executeLearningAction(
    selected: ZavorthPlatformRegistryEntry,
    actionId: ZavorthPlatformActionExecution['actionId'],
  ): Promise<ZavorthPlatformActionExecution> {
    if (!this.learningPlane) {
      return this.finishEntry(actionId, selected, 'blocked', `${selected.label} does not have an available learning plane.`, [
        'The current runtime did not load the learning plane for this platform action.',
      ]);
    }

    const candidateId = this.extractLearningCandidateId(selected.id);
    if (!candidateId) {
      return this.finishEntry(actionId, selected, 'blocked', `${selected.label} does not expose a valid candidate id.`, [
        'Use /learning candidates to locate the item directly.',
      ]);
    }

    if (actionId === 'install') {
      return this.finishLearningDelegated(selected, await this.learningPlane.executeAction({
        candidateId,
        actionId: 'approve',
      }));
    }
    if (actionId === 'trust') {
      return this.finishLearningDelegated(selected, await this.learningPlane.executeAction({
        candidateId,
        actionId: 'promote',
      }));
    }
    if (actionId === 'review') {
      return this.finishLearningDelegated(selected, await this.learningPlane.executeAction({
        candidateId,
        actionId: 'reject',
      }));
    }
    if (actionId === 'inspect' || actionId === 'open' || actionId === 'doctor') {
      return this.finishEntry(actionId, selected, 'manual', `${selected.label} mapped to the learning plane.`, [
        `Candidate: ${candidateId}`,
        `Next step: /learning candidates`,
        `Promote: /learning promote ${candidateId}`,
        `Quarantine: /learning reject ${candidateId}`,
      ]);
    }

    return this.finishEntry(actionId, selected, 'blocked', `${selected.label} uses the learning plane lifecycle, not ${actionId}.`, [
      'Use install to approve the draft, trust to promote to local trusted, or review to send to quarantine.',
      'The learned-local lifecycle remains fail-closed until explicit promotion.',
    ]);
  }

  private finishLearningDelegated(
    selected: ZavorthPlatformRegistryEntry,
    delegated: LearningPlaneActionExecution,
  ): ZavorthPlatformActionExecution {
    return finishLearningDelegatedPlatformAction({ delegated, platformRegistry: this.platformRegistry, selected });
  }

  private extractLearningCandidateId(entryId: string): string | null {
    return extractLearningCandidateId(entryId);
  }

  private async executeRecipeAction(
    selectedRecipe: ZavorthPlatformRegistryRecipe,
    actionId: ZavorthPlatformActionExecution['actionId'],
    input: {
      requestedBy?: string | null;
      workspace?: string | null;
    },
  ): Promise<ZavorthPlatformActionExecution> {
    switch (actionId) {
      case 'inspect':
        return this.finishRecipe(actionId, selectedRecipe, 'manual', `Inspection ready for ${selectedRecipe.label}.`, [
          selectedRecipe.summary,
          `Targets: ${selectedRecipe.itemCount}`,
          `Ready: ${selectedRecipe.readyCount}`,
          `Adopted: ${selectedRecipe.adoptedCount}`,
          `Missing references: ${selectedRecipe.missingCount}`,
          ...selectedRecipe.details.slice(0, 4),
        ]);
      case 'open':
        return this.finishRecipe(actionId, selectedRecipe, 'manual', `${selectedRecipe.label}: guide ready.`, [
          `Recommended shortcut: ${selectedRecipe.actionHint || 'n/d'}`,
          selectedRecipe.summary,
          ...selectedRecipe.steps.slice(0, 4),
        ]);
      case 'install':
        return this.executeRecipeInstall(selectedRecipe, input);
      default:
        return this.finishRecipe(
          actionId,
          selectedRecipe,
          'blocked',
          `${selectedRecipe.label} does not support ${actionId} as a guided recipe.`,
          ['Currently, recipes expose inspect, open, and install as actionable paths.'],
        );
    }
  }

  private executeLocalTrust(
    selected: ZavorthPlatformRegistryEntry,
    snapshot: ZavorthPlatformRegistrySnapshot,
    trust: 'trusted' | 'review',
  ): ZavorthPlatformActionExecution {
    if (!this.supportsLocalLifecycle(selected)) {
      return this.finishEntry(
        trust === 'trusted' ? 'trust' : 'review',
        selected,
        'blocked',
        `${selected.label} does not expose mutable trust in this plane yet.`,
        ['Only skills and MCPs use this local lifecycle outside the plugin plane.'],
      );
    }

    if (selected.discoveryOnly && !this.isLocallyAdopted(selected)) {
      return this.finishEntry(
        trust === 'trusted' ? 'trust' : 'review',
        selected,
        'blocked',
        `${selected.label} must be registered in the platform plane before changing trust.`,
        ['Use the install action to persist this item in the local lifecycle first.'],
      );
    }

    const lifecycleState = this.buildLifecycleState(selected, snapshot);
    this.platformState.upsertState({
      pluginId: selected.id,
      installed: this.isLocallyAdopted(selected),
      trust,
      installedRevision: lifecycleState.installedRevision,
      sourceDigest: lifecycleState.sourceDigest,
      sourceLocator: lifecycleState.sourceLocator,
      sourceTrusted: lifecycleState.sourceTrusted,
    });

    return this.finishEntry(
      trust === 'trusted' ? 'trust' : 'review',
      selected,
      'applied',
      `${selected.label} marked as ${trust} in the platform plane.`,
      [
        selected.discoveryOnly
          ? 'The local trust was persisted without faking binary installation on the host.'
          : 'The local override was persisted without altering actual host artifacts.',
      ],
    );
  }

  private executeLocalInstall(
    selected: ZavorthPlatformRegistryEntry,
    snapshot: ZavorthPlatformRegistrySnapshot,
  ): ZavorthPlatformActionExecution {
    if (!this.supportsLocalLifecycle(selected)) {
      return this.finishEntry('install', selected, 'blocked', `${selected.label} does not support install on this plane.`, [
        'Only skills and MCPs use the local lifecycle of the platform plane.',
      ]);
    }

    if (this.isLocallyAdopted(selected)) {
      return this.finishEntry('install', selected, 'noop', `${selected.label} is already registered in the platform plane.`, [
        selected.discoveryOnly
          ? 'This item was already adopted locally and continues waiting for external action.'
          : 'This item is already visible on the host and does not need a new local adoption.',
      ]);
    }

    const lifecycleState = this.buildLifecycleState(selected, snapshot);
    this.platformState.upsertState({
      pluginId: selected.id,
      installed: true,
      trust: selected.trust === 'trusted' ? 'trusted' : 'review',
      installedRevision: lifecycleState.installedRevision,
      sourceDigest: lifecycleState.sourceDigest,
      sourceLocator: lifecycleState.sourceLocator,
      sourceTrusted: lifecycleState.sourceTrusted,
    });

    return this.finishEntry('install', selected, 'applied', `${selected.label} registered in the platform plane.`, [
      selected.kind === 'mcp'
        ? 'The local registration was persisted; the MCP manifest was not changed automatically.'
        : 'The local registration was persisted; the actual skill activation still depends on the host.',
      'This step closes the local lifecycle without faking complete remote onboarding.',
    ]);
  }

  private executeLocalRemove(selected: ZavorthPlatformRegistryEntry): ZavorthPlatformActionExecution {
    if (!this.supportsLocalLifecycle(selected)) {
      return this.finishEntry('remove', selected, 'blocked', `${selected.label} does not support remove on this plane.`, [
        'Only skills and MCPs use the local lifecycle of the platform plane.',
      ]);
    }

    const cleared = this.platformState.clearState(selected.id);
    if (!cleared) {
      return this.finishEntry('remove', selected, 'noop', `${selected.label} had no local override to remove.`, [
        selected.discoveryOnly
          ? 'The item remains available only through discovery in the local registry.'
          : 'A native host observation remains active and no extra registration was persisted.',
      ]);
    }

    return this.finishEntry('remove', selected, 'applied', `${selected.label} removed from the local lifecycle.`, [
      selected.discoveryOnly
        ? 'The item remains visible in the catalog, but returned to the pure discovery state.'
        : 'The item remains visible through native observation; only the local override was forgotten.',
    ]);
  }

  private async executeCollectionInstall(
    selectedCollection: ZavorthPlatformRegistryCollection,
    input: {
      requestedBy?: string | null;
      workspace?: string | null;
    },
  ): Promise<ZavorthPlatformActionExecution> {
    const snapshot = this.platformRegistry.buildSnapshot({ selectedId: selectedCollection.id });
    const entries = selectedCollection.entryIds
      .map((entryId) =>
        snapshot.entries.find((entry) => this.normalizeValue(entry.id) === this.normalizeValue(entryId)) || null,
      )
      .filter((entry): entry is ZavorthPlatformRegistryEntry => Boolean(entry));

    if (entries.length === 0) {
      return this.finishCollection(
        'install',
        selectedCollection,
        'blocked',
        `${selectedCollection.label} has not resolved enough items for adoption yet.`,
        ['The collection exists in the catalog, but no items appeared in the current runtime.'],
      );
    }

    const itemResults: ZavorthPlatformActionExecution[] = [];
    for (const entry of entries) {
      itemResults.push(await this.executeCollectionEntryInstall(entry, snapshot, input));
    }

    const appliedCount = itemResults.filter((result) => result.status === 'applied').length;
    const noopCount = itemResults.filter((result) => result.status === 'noop').length;
    const blockedCount = itemResults.filter((result) => result.status === 'blocked').length;
    const manualCount = itemResults.filter((result) => result.status === 'manual').length;

    const status: ZavorthPlatformActionExecution['status'] = appliedCount > 0
      ? 'applied'
      : noopCount > 0 && blockedCount === 0 && manualCount === 0
        ? 'noop'
        : 'blocked';
    const summary = appliedCount > 0
      ? blockedCount > 0 || noopCount > 0
        ? `${selectedCollection.label} partially adopted in the platform plane.`
        : `${selectedCollection.label} adopted in the platform plane.`
      : noopCount > 0 && blockedCount === 0 && manualCount === 0
        ? `${selectedCollection.label} was already aligned in the platform plane.`
        : `${selectedCollection.label} could not be adopted into the platform plane.`;

    return this.finishCollection('install', selectedCollection, status, summary, [
      `Items evaluated: ${entries.length} | applied: ${appliedCount} | noop: ${noopCount} | blocked: ${blockedCount}.`,
      ...(selectedCollection.missingCount > 0
        ? [`Runtime references missing: ${selectedCollection.missingCount}.`]
        : []),
      ...itemResults.map((result) => {
        const label = result.selected?.label || result.entryId;
        return `${label}: ${result.summary}`;
      }),
    ]);
  }

  private async executeCollectionEntryInstall(
    entry: ZavorthPlatformRegistryEntry,
    snapshot: ZavorthPlatformRegistrySnapshot,
    input: {
      requestedBy?: string | null;
      workspace?: string | null;
    },
  ): Promise<ZavorthPlatformActionExecution> {
    if (entry.kind === 'plugin') {
      return this.executePluginAction(entry, 'install', input);
    }
    return this.executeLocalInstall(entry, snapshot);
  }

  private async executeRecipeInstall(
    selectedRecipe: ZavorthPlatformRegistryRecipe,
    input: {
      requestedBy?: string | null;
      workspace?: string | null;
    },
  ): Promise<ZavorthPlatformActionExecution> {
    const snapshot = this.platformRegistry.buildSnapshot({ selectedId: selectedRecipe.id });
    const resolvedTargets = selectedRecipe.targetIds
      .map((targetId) => {
        const normalizedId = this.normalizeValue(targetId);
        const collection = snapshot.collections.find((entry) => this.normalizeValue(entry.id) === normalizedId);
        if (collection) {
          return { kind: 'collection' as const, collection };
        }
        const entry = snapshot.entries.find((candidate) => this.normalizeValue(candidate.id) === normalizedId);
        if (entry) {
          return { kind: 'entry' as const, entry };
        }
        return null;
      })
      .filter(Boolean) as Array<
        | { kind: 'collection'; collection: ZavorthPlatformRegistryCollection }
        | { kind: 'entry'; entry: ZavorthPlatformRegistryEntry }
      >;

    if (resolvedTargets.length === 0) {
      return this.finishRecipe(
        'install',
        selectedRecipe,
        'blocked',
        `${selectedRecipe.label} has not resolved enough targets for application yet.`,
        ['The recipe exists in the catalog, but no targets appeared in the current runtime.'],
      );
    }

    const itemResults: ZavorthPlatformActionExecution[] = [];
    for (const target of resolvedTargets) {
      itemResults.push(
        target.kind === 'collection'
          ? await this.executeCollectionAction(target.collection, 'install', input)
          : await this.executeCollectionEntryInstall(target.entry, snapshot, input),
      );
    }

    const appliedCount = itemResults.filter((result) => result.status === 'applied').length;
    const noopCount = itemResults.filter((result) => result.status === 'noop').length;
    const blockedCount = itemResults.filter((result) => result.status === 'blocked').length;
    const manualCount = itemResults.filter((result) => result.status === 'manual').length;
    const status: ZavorthPlatformActionExecution['status'] = appliedCount > 0
      ? 'applied'
      : noopCount > 0 && blockedCount === 0 && manualCount === 0
        ? 'noop'
        : 'blocked';
    const summary = appliedCount > 0
      ? blockedCount > 0 || noopCount > 0
        ? `${selectedRecipe.label} partially applied in the platform plane.`
        : `${selectedRecipe.label} applied in the platform plane.`
      : noopCount > 0 && blockedCount === 0 && manualCount === 0
        ? `${selectedRecipe.label} was already aligned in the platform plane.`
        : `${selectedRecipe.label} could not be applied in the platform plane.`;

    return this.finishRecipe('install', selectedRecipe, status, summary, [
      `Targets evaluated: ${resolvedTargets.length} | applied: ${appliedCount} | noop: ${noopCount} | blocked: ${blockedCount}.`,
      ...(selectedRecipe.missingCount > 0
        ? [`Missing targets in runtime: ${selectedRecipe.missingCount}.`]
        : []),
      ...itemResults.map((result) => {
        const label = result.selectedCollection?.label
          || result.selectedRecipe?.label
          || result.selected?.label
          || result.entryId;
        return `${label}: ${result.summary}`;
      }),
    ]);
  }

  private supportsLocalLifecycle(selected: ZavorthPlatformRegistryEntry): boolean {
    return supportsPlatformLocalLifecycle(selected);
  }

  private isLocallyAdopted(selected: ZavorthPlatformRegistryEntry): boolean {
    return isPlatformLocallyAdopted(selected);
  }

  private buildLifecycleState(
    selected: ZavorthPlatformRegistryEntry,
    snapshot: ZavorthPlatformRegistrySnapshot,
  ): {
    installedRevision: string;
    sourceDigest: string | null;
    sourceLocator: string | null;
    sourceTrusted: boolean | null;
  } {
    return buildPlatformLifecycleState(selected, snapshot);
  }

  private normalizeActionId(
    value: string | null | undefined,
  ): ZavorthPlatformActionExecution['actionId'] | '' {
    return normalizePlatformActionId(value);
  }

  private normalizeValue(value: string | null | undefined): string {
    return normalizePlatformActionValue(value);
  }
}
