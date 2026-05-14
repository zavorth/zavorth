import path from 'path';
import { config } from '../config/index.js';
import {
  ZAVORTH_UNIVERSAL_SKILL_EXPANSION_CONTRACT_VERSION,
  type ZavorthUniversalSkillExpansionPreset,
  type ZavorthUniversalSkillExpansionPresetId,
  type ZavorthUniversalSkillExpansionSnapshot,
  type ZavorthUniversalSkillExpansionSourceInput,
  type ZavorthUniversalSkillExpansionSourceResult,
  type ZavorthUniversalSkillExpansionStatus,
} from '../contracts/ZavorthUniversalSkillExpansionContract.js';
import { UniversalSkillTrustImportService } from '../skills/UniversalSkillTrustImportService.js';
import type { ZavorthUniversalSkillImportSnapshot } from '../contracts/ZavorthUniversalSkillImportContract.js';
import { UniversalSkillBridgeRegistryService } from './UniversalSkillBridgeRegistryService.js';
import { SkillCatalogService } from '../skills/SkillCatalogService.js';
import { SkillLoader } from '../skills/SkillLoader.js';
import { SkillSourceRegistryService } from './SkillSourceRegistryService.js';
import { SkillTrustPolicyService } from './SkillTrustPolicyService.js';
import { UniversalSkillBridgeRuntimeService } from '../skills/UniversalSkillBridgeRuntimeService.js';

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  importService?: Pick<UniversalSkillTrustImportService, 'buildSnapshot'>;
  bridgeRegistryService?: Pick<UniversalSkillBridgeRegistryService, 'buildSnapshot'>;
};

export type UniversalSkillExpansionInput = {
  sources: ZavorthUniversalSkillExpansionSourceInput[];
  projectRoot?: string | null;
  targetRootPath?: string | null;
  apply?: boolean;
  overwrite?: boolean;
  allowSource?: boolean;
  allowAllCandidates?: boolean;
  allowedSkillNames?: string[];
  allowedSkillIds?: string[];
  channel?: string | null;
  maxSources?: number;
  maxCandidates?: number;
};

type NormalizedSource = Required<Omit<ZavorthUniversalSkillExpansionSourceInput, 'sourceId'>> & {
  sourceId: string | null;
  preset: ZavorthUniversalSkillExpansionPreset;
};

const DEFAULT_MAX_SOURCES = 20;
const DEFAULT_MAX_CANDIDATES = 500;

const PRESETS: ZavorthUniversalSkillExpansionPreset[] = [
  {
    id: 'workspace-skill-library',
    label: 'Workspace skill library',
    description: 'Pasta local de skills que o usuario ja colocou no workspace.',
    defaultSourceKind: 'directory',
    defaultTrust: 'trusted-local',
    recommendedUse: 'Use para bibliotecas locais pequenas ou medias que voce controla.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
  {
    id: 'downloaded-skill-archive',
    label: 'Downloaded skill archive',
    description: 'Arquivo .zip baixado com muitas skills ou pacotes de skills.',
    defaultSourceKind: 'zip',
    defaultTrust: 'review',
    recommendedUse: 'Use para bundles externos; sempre comece em preview.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
  {
    id: 'codex-skill-root',
    label: 'Codex-compatible skill root',
    description: 'Raiz de skills no formato SKILL.md compativel com Codex.',
    defaultSourceKind: 'directory',
    defaultTrust: 'review',
    recommendedUse: 'Use para reaproveitar skills gerais sem acoplar a marca da fonte.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
  {
    id: 'agent-skill-root',
    label: 'Agent skill root',
    description: 'Biblioteca de skills de agentes com instrucoes, playbooks e arquivos auxiliares.',
    defaultSourceKind: 'directory',
    defaultTrust: 'review',
    recommendedUse: 'Use quando a origem tiver muitas skills de automacao ou orquestracao.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
  {
    id: 'generic-skill-folder',
    label: 'Generic skill folder',
    description: 'Pasta generica que pode conter SKILL.md, catalogos, markdown e manifests.',
    defaultSourceKind: 'auto',
    defaultTrust: 'review',
    recommendedUse: 'Use como preset neutro para fontes desconhecidas.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
  {
    id: 'custom',
    label: 'Custom source',
    description: 'Fonte personalizada declarada pelo operador.',
    defaultSourceKind: 'auto',
    defaultTrust: 'review',
    recommendedUse: 'Use quando nenhum preset descreve bem a fonte.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
];

export class UniversalSkillExpansionService {
  private readonly now: () => Date;
  private readonly defaultProjectRoot: string;
  private readonly importService: Pick<UniversalSkillTrustImportService, 'buildSnapshot'> | null;
  private readonly bridgeRegistryService: Pick<UniversalSkillBridgeRegistryService, 'buildSnapshot'> | null;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultProjectRoot = runtime.projectRoot || config.projectRoot;
    this.importService = runtime.importService || null;
    this.bridgeRegistryService = runtime.bridgeRegistryService || null;
  }

  public listPresets(): ZavorthUniversalSkillExpansionPreset[] {
    return PRESETS.map((preset) => ({ ...preset }));
  }

  public async buildSnapshot(input: UniversalSkillExpansionInput): Promise<ZavorthUniversalSkillExpansionSnapshot> {
    const projectRoot = path.resolve(input.projectRoot || this.defaultProjectRoot);
    const targetRootPath = path.resolve(input.targetRootPath || path.join(projectRoot, 'skill-library', 'imported'));
    const apply = input.apply === true;
    const overwrite = input.overwrite === true;
    const channel = normalizeChannel(input.channel);
    const maxSources = normalizePositiveInteger(input.maxSources, DEFAULT_MAX_SOURCES);
    const maxCandidates = normalizePositiveInteger(input.maxCandidates, DEFAULT_MAX_CANDIDATES);
    const sources = this.normalizeSources(input.sources || []);
    const limitReasons: string[] = [];

    if (sources.length > maxSources) {
      limitReasons.push(`Fontes acima do limite: ${sources.length}/${maxSources}.`);
    }

    const previewResults = await this.buildSourceResults({
      sources,
      projectRoot,
      targetRootPath,
      apply: false,
      overwrite,
      globalAllowSource: input.allowSource === true,
      globalAllowAllCandidates: input.allowAllCandidates === true,
      globalAllowedSkillNames: input.allowedSkillNames || [],
      globalAllowedSkillIds: input.allowedSkillIds || [],
    });
    const previewCandidateCount = previewResults.reduce(
      (total, result) => total + result.importSnapshot.summary.candidates,
      0,
    );

    if (previewCandidateCount > maxCandidates) {
      limitReasons.push(`Candidatos acima do limite: ${previewCandidateCount}/${maxCandidates}.`);
    }

    const sourceResults = apply && limitReasons.length === 0
      ? await this.buildSourceResults({
          sources,
          projectRoot,
          targetRootPath,
          apply: true,
          overwrite,
          globalAllowSource: input.allowSource === true,
          globalAllowAllCandidates: input.allowAllCandidates === true,
          globalAllowedSkillNames: input.allowedSkillNames || [],
          globalAllowedSkillIds: input.allowedSkillIds || [],
        })
      : previewResults;

    const bridgeRegistry = await this.resolveBridgeRegistry(projectRoot).buildSnapshot({
      channel,
      mode: 'dry-run',
    });
    const enrichedSourceResults = this.attachBridgeReadiness(sourceResults, bridgeRegistry);
    const summary = this.buildSummary({
      sourceResults: enrichedSourceResults,
      bridgeRegistry,
      apply,
    });
    const status = this.resolveStatus({
      apply,
      summary,
      limitReasons,
      sourceResults: enrichedSourceResults,
    });
    const certificationReasons = this.buildCertificationReasons({
      sourceResults: enrichedSourceResults,
      summary,
      limitReasons,
      apply,
    });

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_UNIVERSAL_SKILL_EXPANSION_CONTRACT_VERSION,
      status,
      apply,
      overwrite,
      projectRoot,
      targetRootPath,
      channel,
      presets: this.listPresets(),
      summary,
      sourceResults: enrichedSourceResults,
      bridgeRegistry,
      certification: {
        passed: status !== 'blocked',
        label: status,
        reasons: certificationReasons,
        scaleLimits: {
          maxSources,
          maxCandidates,
        },
      },
      policy: {
        previewFirstForEverySource: true,
        denyByDefault: true,
        explicitSourceAllowlistRequiredForApply: true,
        explicitSkillAllowlistOrAllowAllRequiredForApply: true,
        hostileCandidatesStayBlocked: true,
        provenanceRequiredForMaterializedSkills: true,
        bridgeCertificationUsesRegistryOnly: true,
        activationDoesNotExecuteUpstreamCode: true,
        noExecutionPerformed: true,
        noDirectUpstreamRuntimeUse: true,
      },
      commands: {
        preview: 'npm run zavorth:universal-skill-expansion -- --source <path>',
        apply: 'npm run zavorth:universal-skill-expansion -- --source <path> --apply --allow-source --skills <name>',
        check: 'npm run zavorth:universal-skill-expansion:check --silent',
        nextPhase: 'Phase 7 - Expansion QA, Telemetry and Operator Rollout',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthUniversalSkillExpansionSnapshot): string {
    const lines = [
      'Universal Skill Expansion - Phase 6',
      '',
      `Status: ${snapshot.status}`,
      `Apply: ${snapshot.apply} | Sources: ${snapshot.summary.sources} | Candidates: ${snapshot.summary.candidates}`,
      `Imported: ${snapshot.summary.materialized} | Denied: ${snapshot.summary.denied} | Blocked candidates: ${snapshot.summary.blockedCandidates}`,
      `Bridge dry-run ready: ${snapshot.summary.bridgeReady} | live approval required: ${snapshot.summary.bridgeApprovalRequired} | blocked: ${snapshot.summary.bridgeBlocked}`,
      '',
      'Sources:',
    ];

    for (const result of snapshot.sourceResults) {
      lines.push(
        `- ${result.sourceLabel}: ${result.status}`,
        `  preset=${result.preset.id} candidates=${result.importSnapshot.summary.candidates} materialized=${result.importSnapshot.summary.materialized} denied=${result.importSnapshot.summary.denied}`,
        `  imported=${result.importedSkillNames.join(', ') || 'none'}`,
        `  bridgeReady=${result.readyForBridgeNames.join(', ') || 'none'}`,
      );
    }

    lines.push('', 'Certification:');
    for (const reason of snapshot.certification.reasons) {
      lines.push(`- ${reason}`);
    }
    lines.push('', `Next: ${snapshot.commands.nextPhase}`);
    return lines.join('\n');
  }

  private async buildSourceResults(input: {
    sources: NormalizedSource[];
    projectRoot: string;
    targetRootPath: string;
    apply: boolean;
    overwrite: boolean;
    globalAllowSource: boolean;
    globalAllowAllCandidates: boolean;
    globalAllowedSkillNames: string[];
    globalAllowedSkillIds: string[];
  }): Promise<ZavorthUniversalSkillExpansionSourceResult[]> {
    const importService = this.resolveImportService(input.projectRoot);
    const results: ZavorthUniversalSkillExpansionSourceResult[] = [];

    for (const source of input.sources) {
      const snapshot = await importService.buildSnapshot({
        sourcePath: source.sourcePath,
        sourceKind: source.sourceKind || source.preset.defaultSourceKind,
        sourceId: source.sourceId || undefined,
        sourceLabel: source.sourceLabel || source.preset.label,
        targetRootPath: input.targetRootPath,
        apply: input.apply,
        overwrite: input.overwrite,
        allowSource: source.allowSource || input.globalAllowSource,
        allowAllCandidates: source.allowAllCandidates || input.globalAllowAllCandidates,
        allowedSkillNames: uniqueStrings([
          ...source.allowedSkillNames,
          ...input.globalAllowedSkillNames,
        ]),
        allowedSkillIds: uniqueStrings([
          ...source.allowedSkillIds,
          ...input.globalAllowedSkillIds,
        ]),
      });
      results.push(this.buildSourceResult(source, snapshot));
    }

    return results;
  }

  private buildSourceResult(
    source: NormalizedSource,
    snapshot: ZavorthUniversalSkillImportSnapshot,
  ): ZavorthUniversalSkillExpansionSourceResult {
    return {
      sourcePath: source.sourcePath,
      sourceLabel: snapshot.trustPolicy.sourceLabel || source.sourceLabel || source.preset.label,
      sourceId: snapshot.trustPolicy.sourceId || source.sourceId,
      preset: source.preset,
      status: this.mapImportStatus(snapshot.status),
      importSnapshot: snapshot,
      importedSkillNames: snapshot.decisions
        .filter((decision) => decision.materialized)
        .map((decision) => decision.skillName),
      deniedSkillNames: snapshot.decisions
        .filter((decision) => decision.mode === 'deny')
        .map((decision) => decision.skillName),
      blockedCandidateNames: snapshot.preview.candidates
        .filter((candidate) => candidate.status === 'blocked')
        .map((candidate) => candidate.manifest.name),
      readyForBridgeNames: [],
    };
  }

  private attachBridgeReadiness(
    results: ZavorthUniversalSkillExpansionSourceResult[],
    bridgeRegistry: Awaited<ReturnType<UniversalSkillBridgeRegistryService['buildSnapshot']>>,
  ): ZavorthUniversalSkillExpansionSourceResult[] {
    const bridgeEntries = new Map(
      bridgeRegistry.entries.map((entry) => [normalizeName(entry.skillName), entry]),
    );
    return results.map((result) => ({
      ...result,
      readyForBridgeNames: result.importedSkillNames.filter((skillName) => {
        const entry = bridgeEntries.get(normalizeName(skillName));
        return entry?.dryRunReady === true;
      }),
    }));
  }

  private buildSummary(input: {
    sourceResults: ZavorthUniversalSkillExpansionSourceResult[];
    bridgeRegistry: Awaited<ReturnType<UniversalSkillBridgeRegistryService['buildSnapshot']>>;
    apply: boolean;
  }): ZavorthUniversalSkillExpansionSnapshot['summary'] {
    const sourceResults = input.sourceResults;
    return {
      sources: sourceResults.length,
      candidates: sum(sourceResults, (result) => result.importSnapshot.summary.candidates),
      allowed: sum(sourceResults, (result) => result.importSnapshot.summary.allowed),
      denied: sum(sourceResults, (result) => result.importSnapshot.summary.denied),
      blockedCandidates: sum(sourceResults, (result) => result.blockedCandidateNames.length),
      materialized: sum(sourceResults, (result) => result.importSnapshot.summary.materialized),
      filesWritten: sum(sourceResults, (result) => result.importSnapshot.summary.filesWritten),
      receipts: sum(sourceResults, (result) => result.importSnapshot.summary.receipts),
      bridgeReady: input.bridgeRegistry.entries.filter((entry) => entry.dryRunReady).length,
      bridgeApprovalRequired: input.bridgeRegistry.entries.filter((entry) => entry.liveRequiresApproval).length,
      bridgeBlocked: input.bridgeRegistry.entries.filter((entry) => entry.status === 'blocked').length,
      activationActions: input.bridgeRegistry.actions.length,
      previewRequired: true,
      importPerformed: input.apply && sourceResults.some((result) => result.importSnapshot.summary.importPerformed),
      executionPerformed: false,
      directUpstreamRuntimeUse: false,
    };
  }

  private resolveStatus(input: {
    apply: boolean;
    summary: ZavorthUniversalSkillExpansionSnapshot['summary'];
    limitReasons: string[];
    sourceResults: ZavorthUniversalSkillExpansionSourceResult[];
  }): ZavorthUniversalSkillExpansionStatus {
    if (input.limitReasons.length > 0) {
      return 'blocked';
    }
    if (!input.apply) {
      return 'preview-only';
    }
    if (input.summary.materialized > 0 && input.summary.denied === 0) {
      return 'passed';
    }
    if (input.summary.materialized > 0) {
      return 'partial';
    }
    return 'blocked';
  }

  private buildCertificationReasons(input: {
    sourceResults: ZavorthUniversalSkillExpansionSourceResult[];
    summary: ZavorthUniversalSkillExpansionSnapshot['summary'];
    limitReasons: string[];
    apply: boolean;
  }): string[] {
    const reasons = [
      'Preview obrigatorio executado para cada fonte antes de qualquer materializacao.',
      'Deny-by-default preservado: apply exige allow-source e allowlist de skill ou allow-all explicito.',
      'Nenhum codigo upstream foi executado durante intake, import, registry ou activation.',
    ];
    if (input.limitReasons.length > 0) {
      reasons.push(...input.limitReasons);
    }
    if (input.summary.blockedCandidates > 0) {
      reasons.push(`${input.summary.blockedCandidates} candidato(s) hostil(is) permaneceram bloqueados.`);
    }
    if (input.summary.materialized > 0) {
      reasons.push(`${input.summary.materialized} skill(s) materializada(s) com provenance, attribution e receipts.`);
    }
    if (input.summary.bridgeReady > 0) {
      reasons.push(`${input.summary.bridgeReady} skill(s) prontas para dry-run pelo bridge governado.`);
    }
    if (!input.apply) {
      reasons.push('Modo preview-only: nenhuma importacao foi realizada.');
    }
    return reasons;
  }

  private normalizeSources(sources: ZavorthUniversalSkillExpansionSourceInput[]): NormalizedSource[] {
    return sources
      .map((source) => {
        const preset = this.resolvePreset(source.presetId);
        return {
          sourcePath: path.resolve(source.sourcePath || '.'),
          sourceKind: source.sourceKind || preset.defaultSourceKind,
          sourceLabel: source.sourceLabel || preset.label,
          sourceId: normalizeNullable(source.sourceId),
          presetId: preset.id,
          preset,
          allowSource: source.allowSource === true,
          allowAllCandidates: source.allowAllCandidates === true,
          allowedSkillNames: uniqueStrings(source.allowedSkillNames || []),
          allowedSkillIds: uniqueStrings(source.allowedSkillIds || []),
        };
      })
      .filter((source) => Boolean(source.sourcePath));
  }

  private resolvePreset(id: ZavorthUniversalSkillExpansionPresetId | null | undefined): ZavorthUniversalSkillExpansionPreset {
    const preset = PRESETS.find((entry) => entry.id === (id || 'custom'));
    return { ...(preset || PRESETS[PRESETS.length - 1]) };
  }

  private resolveImportService(projectRoot: string): Pick<UniversalSkillTrustImportService, 'buildSnapshot'> {
    return this.importService || new UniversalSkillTrustImportService({ projectRoot });
  }

  private resolveBridgeRegistry(projectRoot: string): Pick<UniversalSkillBridgeRegistryService, 'buildSnapshot'> {
    if (this.bridgeRegistryService) {
      return this.bridgeRegistryService;
    }
    return new UniversalSkillBridgeRegistryService({
      skillCatalogService: new SkillCatalogService({
        skillLoader: new SkillLoader({
          sourceRegistryService: new SkillSourceRegistryService({ projectRoot }),
          skillTrustPolicyService: new SkillTrustPolicyService({ projectRoot }),
        }),
      }),
      bridgeRuntimeService: new UniversalSkillBridgeRuntimeService({ projectRoot }),
    });
  }

  private mapImportStatus(status: ZavorthUniversalSkillImportSnapshot['status']): ZavorthUniversalSkillExpansionStatus {
    if (status === 'passed' || status === 'partial' || status === 'blocked') {
      return status;
    }
    return 'preview-only';
  }
}

function normalizeChannel(value: string | null | undefined): string {
  return String(value || 'cli').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'cli';
}

function normalizeNullable(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeName(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizePositiveInteger(value: number | null | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sum<T>(values: T[], selector: (value: T) => number): number {
  return values.reduce((total, value) => total + selector(value), 0);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}
