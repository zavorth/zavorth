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
      throw new Error('entryId obrigatorio.');
    }
    if (!actionId) {
      throw new Error('actionId obrigatorio.');
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
      throw new Error(`Item do platform plane nao encontrado: ${entryId}.`);
    }

    if (selected.kind === 'plugin') {
      return this.executePluginAction(selected, actionId, input);
    }

    if (selected.source === 'learning-plane' && this.learningPlane) {
      return this.executeLearningAction(selected, actionId);
    }

    switch (actionId) {
      case 'inspect':
        return this.finishEntry(actionId, selected, 'manual', `Inspecao pronta para ${selected.label}.`, [
          selected.summary,
          `Kind: ${selected.kind}`,
          `Readiness: ${selected.readiness}`,
          `Trust: ${selected.trust}`,
          `Install: ${selected.installState}`,
          ...selected.details.slice(0, 4),
        ]);
      case 'open':
        return this.finishEntry(actionId, selected, 'manual', `${selected.label}: proximo passo pronto.`, [
          `Atalho recomendado: ${selected.actionHint || 'n/d'}`,
          selected.summary,
          ...selected.details.slice(0, 4),
        ]);
      case 'doctor':
        return this.finishEntry(actionId, selected, 'manual', `Doctor de ${selected.label} pronto.`, [
          selected.summary,
          `Readiness: ${selected.readiness}`,
          `Trust: ${selected.trust}`,
          `Install: ${selected.installState}`,
          `Proximo passo: ${selected.actionHint || 'n/d'}`,
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
        return this.finishEntry(actionId, selected, 'blocked', `${selected.label} nao suporta ${actionId} no platform plane.`, [
          'Esse item ainda nao expoe lifecycle mutavel no plano unificado.',
          `Use ${selected.actionHint || 'a surface dedicada'} para seguir manualmente.`,
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
        return this.finishCollection(actionId, selectedCollection, 'manual', `Inspecao pronta para ${selectedCollection.label}.`, [
          selectedCollection.summary,
          `Itens: ${selectedCollection.itemCount}`,
          `Prontos: ${selectedCollection.readyCount}`,
          `Adotados: ${selectedCollection.adoptedCount}`,
          `Referencias ausentes: ${selectedCollection.missingCount}`,
          ...selectedCollection.details.slice(0, 4),
        ]);
      case 'open':
        return this.finishCollection(actionId, selectedCollection, 'manual', `${selectedCollection.label}: trilha pronta.`, [
          `Atalho recomendado: ${selectedCollection.actionHint || 'n/d'}`,
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
          `${selectedCollection.label} nao suporta ${actionId} como colecao guiada.`,
          ['No momento, colecoes expõem inspect, open e install como trilha acionavel.'],
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

  private executeLearningAction(
    selected: ZavorthPlatformRegistryEntry,
    actionId: ZavorthPlatformActionExecution['actionId'],
  ): Promise<ZavorthPlatformActionExecution> | ZavorthPlatformActionExecution {
    if (!this.learningPlane) {
      return this.finishEntry(actionId, selected, 'blocked', `${selected.label} nao tem learning plane disponivel.`, [
        'A runtime atual nao carregou o learning plane para este platform action.',
      ]);
    }

    const candidateId = this.extractLearningCandidateId(selected.id);
    if (!candidateId) {
      return this.finishEntry(actionId, selected, 'blocked', `${selected.label} nao expoe candidate id valido.`, [
        'Use /learning candidates para localizar o item diretamente.',
      ]);
    }

    if (actionId === 'install') {
      return this.finishLearningDelegated(selected, this.learningPlane.executeAction({
        candidateId,
        actionId: 'approve',
      }));
    }
    if (actionId === 'trust') {
      return this.finishLearningDelegated(selected, this.learningPlane.executeAction({
        candidateId,
        actionId: 'promote',
      }));
    }
    if (actionId === 'review') {
      return this.finishLearningDelegated(selected, this.learningPlane.executeAction({
        candidateId,
        actionId: 'reject',
      }));
    }
    if (actionId === 'inspect' || actionId === 'open' || actionId === 'doctor') {
      return this.finishEntry(actionId, selected, 'manual', `${selected.label} mapeado ao learning plane.`, [
        `Candidate: ${candidateId}`,
        `Proximo passo: /learning candidates`,
        `Promocao: /learning promote ${candidateId}`,
        `Quarentena: /learning reject ${candidateId}`,
      ]);
    }

    return this.finishEntry(actionId, selected, 'blocked', `${selected.label} usa lifecycle do learning plane, nao ${actionId}.`, [
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
        return this.finishRecipe(actionId, selectedRecipe, 'manual', `Inspecao pronta para ${selectedRecipe.label}.`, [
          selectedRecipe.summary,
          `Alvos: ${selectedRecipe.itemCount}`,
          `Prontos: ${selectedRecipe.readyCount}`,
          `Adotados: ${selectedRecipe.adoptedCount}`,
          `Referencias ausentes: ${selectedRecipe.missingCount}`,
          ...selectedRecipe.details.slice(0, 4),
        ]);
      case 'open':
        return this.finishRecipe(actionId, selectedRecipe, 'manual', `${selectedRecipe.label}: guia pronta.`, [
          `Atalho recomendado: ${selectedRecipe.actionHint || 'n/d'}`,
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
          `${selectedRecipe.label} nao suporta ${actionId} como recipe guiada.`,
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
        `${selected.label} ainda nao expoe trust mutavel neste plane.`,
        ['Somente skills e MCPs usam esse lifecycle local fora do plugin plane.'],
      );
    }

    if (selected.discoveryOnly && !this.isLocallyAdopted(selected)) {
      return this.finishEntry(
        trust === 'trusted' ? 'trust' : 'review',
        selected,
        'blocked',
        `${selected.label} precisa ser registrado no platform plane antes de alterar trust.`,
        ['Use a acao install para persistir esse item no lifecycle local primeiro.'],
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
          ? 'O trust local foi persistido sem fingir instalacao binaria no host.'
          : 'O override local foi persistido sem alterar artefatos reais do host.',
      ],
    );
  }

  private executeLocalInstall(
    selected: ZavorthPlatformRegistryEntry,
    snapshot: ZavorthPlatformRegistrySnapshot,
  ): ZavorthPlatformActionExecution {
    if (!this.supportsLocalLifecycle(selected)) {
      return this.finishEntry('install', selected, 'blocked', `${selected.label} nao suporta install neste plane.`, [
        'Somente skills e MCPs usam o lifecycle local do platform plane.',
      ]);
    }

    if (this.isLocallyAdopted(selected)) {
      return this.finishEntry('install', selected, 'noop', `${selected.label} ja esta registrado no platform plane.`, [
        selected.discoveryOnly
          ? 'Esse item ja foi adotado localmente e continua aguardando ativacao externa.'
          : 'Esse item ja esta visivel no host e nao precisa de nova adocao local.',
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
        ? 'O cadastro local foi persistido; o manifesto MCP ainda nao foi alterado automaticamente.'
        : 'O cadastro local foi persistido; a ativacao real da skill ainda depende do host.',
      'Esse passo fecha o lifecycle local sem fingir onboarding remoto completo.',
    ]);
  }

  private executeLocalRemove(selected: ZavorthPlatformRegistryEntry): ZavorthPlatformActionExecution {
    if (!this.supportsLocalLifecycle(selected)) {
      return this.finishEntry('remove', selected, 'blocked', `${selected.label} nao suporta remove neste plane.`, [
        'Somente skills e MCPs usam o lifecycle local do platform plane.',
      ]);
    }

    const cleared = this.platformState.clearState(selected.id);
    if (!cleared) {
      return this.finishEntry('remove', selected, 'noop', `${selected.label} nao tinha override local para remover.`, [
        selected.discoveryOnly
          ? 'O item continua disponivel apenas por discovery no registry local.'
          : 'A observacao nativa do host continua ativa e nao havia cadastro extra persistido.',
      ]);
    }

    return this.finishEntry('remove', selected, 'applied', `${selected.label} removido do lifecycle local.`, [
      selected.discoveryOnly
        ? 'O item continua visivel no catalogo, mas voltou ao estado puro de discovery.'
        : 'O item continua visivel por observacao nativa; apenas o override local foi esquecido.',
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
        `${selectedCollection.label} ainda nao resolveu itens suficientes para adocao.`,
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
        : `${selectedCollection.label} nao conseguiu ser adotada no platform plane.`;

    return this.finishCollection('install', selectedCollection, status, summary, [
      `Itens avaliados: ${entries.length} | aplicados: ${appliedCount} | noop: ${noopCount} | bloqueados: ${blockedCount}.`,
      ...(selectedCollection.missingCount > 0
        ? [`Referencias ausentes no runtime: ${selectedCollection.missingCount}.`]
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
        `${selectedRecipe.label} ainda nao resolveu alvos suficientes para aplicacao.`,
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
        : `${selectedRecipe.label} nao conseguiu ser aplicada no platform plane.`;

    return this.finishRecipe('install', selectedRecipe, status, summary, [
      `Alvos avaliados: ${resolvedTargets.length} | aplicados: ${appliedCount} | noop: ${noopCount} | bloqueados: ${blockedCount}.`,
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
