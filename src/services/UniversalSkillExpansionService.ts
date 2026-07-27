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
    description: 'local skill folder already placed in the workspace by the user.',
    defaultSourceKind: 'directory',
    defaultTrust: 'trusted-local',
    recommendedUse: 'Use for small or medium local libraries you control.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
  {
    id: 'downloaded-skill-archive',
    label: 'Downloaded skill archive',
    description: 'Downloaded .zip file with many skills or skill packages.',
    defaultSourceKind: 'zip',
    defaultTrust: 'review',
    recommendedUse: 'Use for external bundles; always start in preview.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
  {
    id: 'codex-skill-root',
    label: 'Codex-compatible skill root',
    description: 'Skill root using the SKILL.md-compatible format.',
    defaultSourceKind: 'directory',
    defaultTrust: 'review',
    recommendedUse: 'Use to reuse general skills without coupling to the source brand.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
  {
    id: 'agent-skill-root',
    label: 'Agent skill root',
    description: 'Agent skill library with instructions, playbooks, and support files.',
    defaultSourceKind: 'directory',
    defaultTrust: 'review',
    recommendedUse: 'Use when the origin has many automation or orchestration skills.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
  {
    id: 'generic-skill-folder',
    label: 'Generic skill folder',
    description: 'Generic folder that may contain SKILL.md, catalogs, markdown, and manifests.',
    defaultSourceKind: 'auto',
    defaultTrust: 'review',
    recommendedUse: 'Use as a neutral preset for unknown sources.',
    allowAllCandidatesByDefault: false,
    requiresExplicitApply: true,
    noExecutionPerformed: true,
  },
  {
    id: 'custom',
    label: 'Custom source',
    description: 'Custom source declared by the operator.',
    defaultSourceKind: 'auto',
    defaultTrust: 'review',
    recommendedUse: 'Use when no preset describes the source well.',
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
      limitReasons.push(`Sources above limit: ${sources.length}/${maxSources}.`);
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
      limitReasons.push(`Candidates above limit: ${previewCandidateCount}/${maxCandidates}.`);
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
        nextAction: 'Surface controls - Expansion QA, Telemetry and Operator Rollout',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthUniversalSkillExpansionSnapshot): string {
    const lines = [
      'Universal Skill Expansion - Runtime gateway',
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
    lines.push('', `Next: ${snapshot.commands.nextAction}`);
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
      'Required preview executed for every source before any materialization.',
      'Deny-by-default preserved: apply requires allow-source and a skill allowlist or explicit allow-all.',
      'No upstream code was executed during intake, import, registry, or activation.',
    ];
    if (input.limitReasons.length > 0) {
      reasons.push(...input.limitReasons);
    }
    if (input.summary.blockedCandidates > 0) {
      reasons.push(`${input.summary.blockedCandidates} hostile candidate(s) remained blocked.`);
    }
    if (input.summary.materialized > 0) {
      reasons.push(`${input.summary.materialized} skill(s) materialized with provenance, attribution, and receipts.`);
    }
    if (input.summary.bridgeReady > 0) {
      reasons.push(`${input.summary.bridgeReady} skill(s) ready for dry-run through the governed bridge.`);
    }
    if (!input.apply) {
      reasons.push('Preview-only mode: no import was performed.');
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
