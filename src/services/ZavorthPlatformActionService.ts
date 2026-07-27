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
        return this.finishEntry(actionId, selected, 'manual', `Doctor for ${selected.label} pronto.`, [
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
          `Use ${selected.actionHint || 'the dedicated surface'} para seguir manualmente.`,
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
        return this.finishCollection(actionId, selectedCollection, 'manual', `${selectedCollection.label}: trilha pronta.`, [
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
          `${selectedCollection.label} does not support ${actionId} como guided collection.`,
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
        'Use /learning candidates para localizar o item diretamente.',
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
      return this.finishEntry(actionId, selected, 'manual', `${selected.label} mapeado ao learning plane.`, [
        `Candidate: ${candidateId}`,
        `Next step: /learning candidates`,
        `Promocao: /learning promote ${candidateId}`,
        `Quarentena: /learning reject ${candidateId}`,
      ]);
    }

    return this.finishEntry(actionId, selected, 'blocked', `${selected.label} uses the learning plane lifecycle, not ${actionId}.`, [
      'Use install para aprovar o draft, trust para promover trusted local ou review para mandar para quarentena.',
      'O lifecycle learned-local continua fail-closed ate promocao explicita.',
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
          `Alvos: ${selectedRecipe.itemCount}`,
          `Ready: ${selectedRecipe.readyCount}`,
          `Adopted: ${selectedRecipe.adoptedCount}`,
          `Missing references: ${selectedRecipe.missingCount}`,
          ...selectedRecipe.details.slice(0, 4),
        ]);
      case 'open':
        return this.finishRecipe(actionId, selectedRecipe, 'manual', `${selectedRecipe.label}: guia pronta.`, [
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
          `${selectedRecipe.label} does not support ${actionId} como recipe guiada.`,
          ['No momento, recipes expoem inspect, open e install como trilha acionavel.'],
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
        ['Somente skills e MCPs usam esse lifecycle local fora do plugin plane.'],
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
      `${selected.label} marcado como ${trust} no platform plane.`,
      [
        selected.discoveryOnly
          ? 'O trust local foi persistido sem fingir instalaction binaria no host.'
          : 'O override local foi persistido sem alterar artifacts reais do host.',
      ],
    );
  }

  private executeLocalInstall(
    selected: ZavorthPlatformRegistryEntry,
    snapshot: ZavorthPlatformRegistrySnapshot,
  ): ZavorthPlatformActionExecution {
    if (!this.supportsLocalLifecycle(selected)) {
      return this.finishEntry('install', selected, 'blocked', `${selected.label} does not support install neste plane.`, [
        'Somente skills e MCPs usam o lifecycle local do platform plane.',
      ]);
    }

    if (this.isLocallyAdopted(selected)) {
      return this.finishEntry('install', selected, 'noop', `${selected.label} ja esta registrado no platform plane.`, [
        selected.discoveryOnly
          ? 'Esse item ja foi adotado localmente e continua aguardando ativaction externa.'
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

    return this.finishEntry('install', selected, 'applied', `${selected.label} registrado no platform plane.`, [
      selected.kind === 'mcp'
        ? 'The local registration was persisted; the MCP manifest was not changed automatically.'
        : 'O cadastro local foi persistido; a ativaction real da skill ainda depende do host.',
      'Esse passo fecha o lifecycle local sem fingir onboarding remoto completo.',
    ]);
  }

  private executeLocalRemove(selected: ZavorthPlatformRegistryEntry): ZavorthPlatformActionExecution {
    if (!this.supportsLocalLifecycle(selected)) {
      return this.finishEntry('remove', selected, 'blocked', `${selected.label} does not support remove neste plane.`, [
        'Somente skills e MCPs usam o lifecycle local do platform plane.',
      ]);
    }

    const cleared = this.platformState.clearState(selected.id);
    if (!cleared) {
      return this.finishEntry('remove', selected, 'noop', `${selected.label} had no local override to remove.`, [
        selected.discoveryOnly
          ? 'O item continua disponivel apenas por discovery no registry local.'
          : 'A native host observation remains active and no extra registration was persisted.',
      ]);
    }

    return this.finishEntry('remove', selected, 'applied', `${selected.label} removido do lifecycle local.`, [
      selected.discoveryOnly
        ? 'The item remains visible in the catalog, but returned to the pure discovery state.'
        : 'O item continua visible por observaction nativa; apenas o override local foi esquecido.',
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
        ['A colecao existe no catalogo, mas nenhum item apareceu no runtime atual.'],
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
        ? `${selectedCollection.label} adotada parcialmente no platform plane.`
        : `${selectedCollection.label} adotada no platform plane.`
      : noopCount > 0 && blockedCount === 0 && manualCount === 0
        ? `${selectedCollection.label} ja estava alinhada no platform plane.`
        : `${selectedCollection.label} could not be adopted into the platform plane.`;

    return this.finishCollection('install', selectedCollection, status, summary, [
      `Itens avaliados: ${entries.length} | aplicados: ${appliedCount} | noop: ${noopCount} | blocked: ${blockedCount}.`,
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
        ['A recipe existe no catalogo, mas nenhum alvo apareceu no runtime atual.'],
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
        ? `${selectedRecipe.label} aplicada parcialmente no platform plane.`
        : `${selectedRecipe.label} aplicada no platform plane.`
      : noopCount > 0 && blockedCount === 0 && manualCount === 0
        ? `${selectedRecipe.label} ja estava alinhada no platform plane.`
        : `${selectedRecipe.label} could not be applied in the platform plane.`;

    return this.finishRecipe('install', selectedRecipe, status, summary, [
      `Alvos avaliados: ${resolvedTargets.length} | aplicados: ${appliedCount} | noop: ${noopCount} | blocked: ${blockedCount}.`,
      ...(selectedRecipe.missingCount > 0
        ? [`Alvos ausentes no runtime: ${selectedRecipe.missingCount}.`]
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
