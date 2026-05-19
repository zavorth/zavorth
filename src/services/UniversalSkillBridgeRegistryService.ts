import {
  ZAVORTH_UNIVERSAL_SKILL_BRIDGE_REGISTRY_CONTRACT_VERSION,
  type ZavorthUniversalSkillBridgeRegistryAction,
  type ZavorthUniversalSkillBridgeRegistryEntry,
  type ZavorthUniversalSkillBridgeRegistryEntryStatus,
  type ZavorthUniversalSkillBridgeRegistrySnapshot,
} from '../contracts/ZavorthUniversalSkillBridgeRegistryContract.js';
import type { ZavorthUniversalSkillBridgeMode } from '../contracts/ZavorthUniversalSkillBridgeRuntimeContract.js';
import { SkillCatalogService } from '../skills/SkillCatalogService.js';
import type { SkillCatalogEntry } from '../skills/SkillCatalogContract.js';
import {
  UniversalSkillBridgeRuntimeService,
  type UniversalSkillBridgeRuntimeInput,
} from '../skills/UniversalSkillBridgeRuntimeService.js';

type Runtime = {
  now?: () => Date;
  skillCatalogService?: Pick<SkillCatalogService, 'listEntries'>;
  bridgeRuntimeService?: Pick<UniversalSkillBridgeRuntimeService, 'invoke'>;
};

export type UniversalSkillBridgeRegistryInput = {
  selectedId?: string | null;
  query?: string | null;
  invoke?: boolean;
  mode?: ZavorthUniversalSkillBridgeMode;
  live?: boolean;
  channel?: string | null;
  ownerApprovalId?: string | null;
  intent?: string | null;
  persistReceipt?: boolean;
};

export class UniversalSkillBridgeRegistryService {
  private readonly now: () => Date;
  private readonly skillCatalog: Pick<SkillCatalogService, 'listEntries'>;
  private readonly bridgeRuntime: Pick<UniversalSkillBridgeRuntimeService, 'invoke'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillCatalog = runtime.skillCatalogService || new SkillCatalogService();
    this.bridgeRuntime = runtime.bridgeRuntimeService || new UniversalSkillBridgeRuntimeService();
  }

  public buildProjection(input: UniversalSkillBridgeRegistryInput = {}): ZavorthUniversalSkillBridgeRegistrySnapshot {
    const mode = input.live === true ? 'live' : input.mode === 'live' ? 'live' : 'dry-run';
    const channel = normalizeChannel(input.channel);
    const query = normalizeQuery(input.query);
    const allEntries = this.skillCatalog.listEntries().map((entry) => this.buildEntry(entry));
    const selected = this.resolveSelected(allEntries, input.selectedId || input.query || null);
    const visibleEntries = this.filterEntries(allEntries, query, selected);
    const actions = this.buildTopActions(selected, visibleEntries);
    const ready = allEntries.filter((entry) => entry.status === 'ready').length;
    const approvalRequired = allEntries.filter((entry) => entry.status === 'approval-required').length;
    const blocked = allEntries.filter((entry) => entry.status === 'blocked').length;
    const localOnly = allEntries.filter((entry) => entry.status === 'local-only').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_UNIVERSAL_SKILL_BRIDGE_REGISTRY_CONTRACT_VERSION,
      query: query || null,
      selectedId: selected?.id || normalizeQuery(input.selectedId) || null,
      mode,
      channel,
      summary: {
        total: allEntries.length,
        imported: allEntries.filter((entry) => entry.imported).length,
        localOnly,
        ready,
        approvalRequired,
        blocked,
        visible: visibleEntries.length,
        actions: actions.length,
        invocationPrepared: false,
      },
      entries: visibleEntries,
      selected,
      invocation: null,
      actions,
      narrative: {
        headline: 'Universal Skill Bridge Registry',
        operatorSummary: `${visibleEntries.length}/${allEntries.length} skill(s) visiveis, `
          + `${ready} pronta(s), ${approvalRequired} exigem approval live e ${blocked} bloqueada(s).`,
        nextAction: this.resolveNextAction(selected, visibleEntries),
      },
      policy: {
        registryDoesNotExecuteSkills: true,
        bridgeRuntimeIsAuthority: true,
        importedSkillsOnlyByDefault: true,
        dryRunSafeDefault: true,
        liveRequiresOwnerApproval: true,
        catalogActionsUseBridgeOnly: true,
      },
      commands: {
        inspect: 'npm run zavorth:universal-skill-bridge-registry -- --skill <name>',
        invokeDryRun: 'npm run zavorth:universal-skill-bridge-registry -- --skill <name> --invoke',
        invokeLive: 'npm run zavorth:universal-skill-bridge-registry -- --skill <name> --invoke --live --approval-id <approval-id>',
        check: 'npm run zavorth:universal-skill-bridge-registry:check --silent',
        nextStage: 'Credential vault - Activation UX and Channel Command Packs',
      },
    };
  }

  public async buildSnapshot(input: UniversalSkillBridgeRegistryInput = {}): Promise<ZavorthUniversalSkillBridgeRegistrySnapshot> {
    const mode = input.live === true ? 'live' : input.mode === 'live' ? 'live' : 'dry-run';
    const channel = normalizeChannel(input.channel);
    const base = this.buildProjection(input);
    const selected = base.selected;
    const invocation = input.invoke && selected
      ? await this.bridgeRuntime.invoke(this.buildInvokeInput({
        input,
        selected,
        mode,
        channel,
      }))
      : null;
    return {
      ...base,
      summary: {
        ...base.summary,
        invocationPrepared: Boolean(invocation?.promptEnvelope),
      },
      invocation,
    };
  }

  public renderReport(snapshot: ZavorthUniversalSkillBridgeRegistrySnapshot): string {
    const lines = [
      'Universal Skill Bridge Registry',
      '',
      snapshot.narrative.operatorSummary,
      `Modo: ${snapshot.mode} | Canal: ${snapshot.channel}.`,
      `Imports: ${snapshot.summary.imported} | locais fora do bridge: ${snapshot.summary.localOnly} | bloqueadas: ${snapshot.summary.blocked}.`,
      '',
    ];

    if (snapshot.selected) {
      const selected = snapshot.selected;
      lines.push(
        `Skill em foco: ${selected.skillName}`,
        selected.description,
        `Status: ${selected.status} | dry-run: ${selected.dryRunReady ? 'ready' : 'blocked'} | live: ${selected.liveRequiresApproval ? 'approval required' : 'ready'}.`,
        `Fonte: ${selected.sourceLabel || selected.sourceId || 'n/d'} | trust: ${selected.sourceTrust || 'n/d'} | licenca: ${selected.license || 'n/d'}.`,
      );
      if (selected.blockers.length > 0) {
        lines.push(`Bloqueios: ${selected.blockers.join(' ')}`);
      }
    }

    if (snapshot.invocation) {
      lines.push(
        '',
        `Invocacao bridge: ${snapshot.invocation.status}`,
        `Receipt: ${snapshot.invocation.receipts[0]?.id || 'n/d'}`,
        `Envelope preparado: ${snapshot.invocation.promptEnvelope ? 'sim' : 'nao'}.`,
      );
    }

    if (!snapshot.selected && snapshot.entries.length > 0) {
      lines.push('Skills visiveis:');
      for (const entry of snapshot.entries.slice(0, 8)) {
        lines.push(`- ${entry.skillName}: ${entry.status} (${entry.actions[0]?.command || 'sem acao'})`);
      }
    }

    if (snapshot.actions.length > 0) {
      lines.push('', 'Acoes:');
      for (const action of snapshot.actions.slice(0, 8)) {
        lines.push(`- ${action.label}: ${action.command}`);
      }
    }

    lines.push('', `Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private buildEntry(entry: SkillCatalogEntry): ZavorthUniversalSkillBridgeRegistryEntry {
    const blockers = this.resolveBlockers(entry);
    const imported = entry.imported === true;
    const runtimeEligible = imported && blockers.length === 0;
    const reviewRequired = entry.risk?.reviewRequired === true || entry.sourceTrust === 'review';
    const status = this.resolveStatus({
      imported,
      runtimeEligible,
      reviewRequired,
      blockers,
    });

    return {
      id: entry.id,
      skillName: entry.name,
      description: entry.description,
      status,
      imported,
      runtimeEligible,
      dryRunReady: runtimeEligible,
      liveRequiresApproval: runtimeEligible,
      sourceId: entry.sourceId,
      sourceLabel: entry.sourceLabel,
      sourceTrust: entry.sourceTrust,
      license: entry.license,
      riskLevel: entry.risk?.level || null,
      reviewRequired,
      blockers,
      actions: this.buildEntryActions(entry, status, runtimeEligible),
      catalogEntry: entry,
    };
  }

  private resolveBlockers(entry: SkillCatalogEntry): string[] {
    const blockers: string[] = [];
    if (!entry.imported) {
      blockers.push('Skill local nao entra no universal bridge por padrao.');
    }
    if (entry.sourceTrust === 'blocked') {
      blockers.push('Fonte marcada como blocked.');
    }
    if (entry.risk?.level === 'blocked') {
      blockers.push('Risk assessment bloqueado.');
    }
    if (entry.licensePolicy?.allowRuntimeUse === false) {
      blockers.push(`Licenca bloqueia runtime: ${entry.licensePolicy.summary}`);
    }
    return uniqueStrings(blockers);
  }

  private resolveStatus(input: {
    imported: boolean;
    runtimeEligible: boolean;
    reviewRequired: boolean;
    blockers: string[];
  }): ZavorthUniversalSkillBridgeRegistryEntryStatus {
    if (!input.imported) {
      return 'local-only';
    }
    if (!input.runtimeEligible || input.blockers.length > 0) {
      return 'blocked';
    }
    return input.reviewRequired ? 'approval-required' : 'ready';
  }

  private buildEntryActions(
    entry: SkillCatalogEntry,
    status: ZavorthUniversalSkillBridgeRegistryEntryStatus,
    runtimeEligible: boolean,
  ): ZavorthUniversalSkillBridgeRegistryAction[] {
    const encoded = encodeURIComponent(entry.name);
    const actions: ZavorthUniversalSkillBridgeRegistryAction[] = [
      {
        id: `catalog:${entry.name}`,
        kind: 'catalog',
        label: 'Abrir no catalogo',
        command: `/skills ${entry.name}`,
        apiPath: `/api/skills/${encoded}`,
        requiresApproval: false,
        safeDefault: true,
        reason: 'Inspecao de catalogo nao executa a skill.',
      },
    ];

    if (entry.provenance?.originDocumentPath) {
      actions.push({
        id: `origin:${entry.name}`,
        kind: 'origin',
        label: 'Ver provenance',
        command: `/skills origin ${entry.name}`,
        apiPath: `/api/skills/bridge?id=${encoded}`,
        requiresApproval: false,
        safeDefault: true,
        reason: 'Provenance ajuda a revisar fonte, licenca e auditoria antes de usar.',
      });
    }

    if (runtimeEligible) {
      actions.push({
        id: `bridge-dry-run:${entry.name}`,
        kind: 'dry-run',
        label: 'Dry-run pelo bridge',
        command: `npm run zavorth:universal-skill-bridge -- --skill ${shellQuote(entry.name)}`,
        apiPath: `/api/skills/bridge?id=${encoded}&invoke=1`,
        requiresApproval: false,
        safeDefault: true,
        reason: 'Prepara envelope governado com conteudo marcado como nao confiavel.',
      });
      actions.push({
        id: `bridge-live:${entry.name}`,
        kind: 'live-prepare',
        label: 'Preparar live com approval',
        command: `npm run zavorth:universal-skill-bridge -- --skill ${shellQuote(entry.name)} --live --approval-id <approval-id>`,
        apiPath: `/api/skills/bridge?id=${encoded}&invoke=1&mode=live&approvalId=<approval-id>`,
        requiresApproval: true,
        safeDefault: false,
        reason: 'Live bridge exige owner approval antes de preparar contexto operacional.',
      });
    } else if (status === 'blocked' || status === 'local-only') {
      actions.push({
        id: `policy:${entry.name}`,
        kind: 'policy',
        label: 'Revisar policy',
        command: `/trust skills review ${entry.name}`,
        apiPath: `/api/skills/bridge?id=${encoded}`,
        requiresApproval: true,
        safeDefault: false,
        reason: 'A skill precisa passar pela importacao governada ou policy antes do bridge.',
      });
    }

    return actions;
  }

  private resolveSelected(
    entries: ZavorthUniversalSkillBridgeRegistryEntry[],
    selectedId: string | null | undefined,
  ): ZavorthUniversalSkillBridgeRegistryEntry | null {
    const normalized = normalizeQuery(selectedId);
    if (!normalized) {
      return null;
    }
    return entries.find((entry) => [
      entry.id,
      entry.skillName,
      entry.sourceId ? `${entry.sourceId}/${entry.skillName}` : '',
    ].some((value) => normalizeQuery(value) === normalized)) || null;
  }

  private filterEntries(
    entries: ZavorthUniversalSkillBridgeRegistryEntry[],
    query: string,
    selected: ZavorthUniversalSkillBridgeRegistryEntry | null,
  ): ZavorthUniversalSkillBridgeRegistryEntry[] {
    if (!query) {
      return entries;
    }
    return entries.filter((entry) =>
      entry.id === selected?.id
      || normalizeQuery([
        entry.skillName,
        entry.description,
        entry.status,
        entry.sourceId || '',
        entry.sourceLabel || '',
        entry.license || '',
        entry.riskLevel || '',
      ].join(' ')).includes(query));
  }

  private buildTopActions(
    selected: ZavorthUniversalSkillBridgeRegistryEntry | null,
    visibleEntries: ZavorthUniversalSkillBridgeRegistryEntry[],
  ): ZavorthUniversalSkillBridgeRegistryAction[] {
    if (selected) {
      return selected.actions;
    }
    return visibleEntries
      .flatMap((entry) => entry.actions.filter((action) => action.kind === 'dry-run' || action.kind === 'catalog'))
      .slice(0, 10);
  }

  private buildInvokeInput(input: {
    input: UniversalSkillBridgeRegistryInput;
    selected: ZavorthUniversalSkillBridgeRegistryEntry;
    mode: ZavorthUniversalSkillBridgeMode;
    channel: string;
  }): UniversalSkillBridgeRuntimeInput {
    return {
      skillName: input.selected.skillName,
      intent: input.input.intent || `Use ${input.selected.skillName} via Universal Skill Bridge.`,
      mode: input.mode,
      channel: input.channel,
      ownerApprovalId: input.input.ownerApprovalId || null,
      persistReceipt: input.input.persistReceipt === true,
    };
  }

  private resolveNextAction(
    selected: ZavorthUniversalSkillBridgeRegistryEntry | null,
    visibleEntries: ZavorthUniversalSkillBridgeRegistryEntry[],
  ): string {
    if (selected) {
      return selected.actions.find((action) => action.kind === 'dry-run')?.command
        || selected.actions[0]?.command
        || 'npm run zavorth:universal-skill-bridge-registry -- --skill <name>';
    }
    const ready = visibleEntries.find((entry) => entry.runtimeEligible);
    if (ready) {
      return ready.actions.find((action) => action.kind === 'dry-run')?.command
        || `/skills ${ready.skillName}`;
    }
    return 'npm run zavorth:universal-skill-bridge-registry -- --skill <name>';
  }
}

function normalizeChannel(value: string | null | undefined): string {
  return String(value || 'cli').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'cli';
}

function normalizeQuery(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function shellQuote(value: string): string {
  return JSON.stringify(String(value || ''));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}
