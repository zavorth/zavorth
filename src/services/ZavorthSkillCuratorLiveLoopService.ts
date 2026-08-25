import fs from 'node:fs';
import path from 'node:path';
import { asErrorLike } from '../utils/errorLike';

import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { SkillSourceRegistryService, type SkillSourceRegistryEntry } from './SkillSourceRegistryService.js';
import { ZavorthPersistentApprovalPolicyService } from './ZavorthPersistentApprovalPolicyService.js';

export const ZAVORTH_SKILL_CURATOR_LIVE_LOOP_CONTRACT_VERSION = 'zavorth-skill-curator-live-loop/1' as const;
const MAX_SKILL_FILE_BYTES = 256 * 1024;
const MAX_USAGE_FILE_BYTES = 256 * 1024;
const MAX_USAGE_FILES = 500;
const USAGE_CONTEXT_RADIUS = 220;
const DESTRUCTIVE_MERGE_MIN_SCORE = 0.65;

export type ZavorthSkillCuratorStatus = 'ready' | 'attention' | 'blocked';
export type ZavorthSkillCuratorActionKind =
  | 'merge-candidates'
  | 'archive-candidate'
  | 'metadata-repair'
  | 'promote-umbrella'
  | 'quality-watch'
  | 'keep';

export type ZavorthSkillCuratorUsageSignal = {
  mentions: number;
  successes: number;
  failures: number;
  approvals: number;
  receipts: number;
  lastSeenAt: string | null;
};

export type ZavorthSkillCuratorQuality = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  usage: number;
  reliability: number;
  metadata: number;
  clarity: number;
  structure: number;
  uniqueness: number;
};

export type ZavorthSkillCuratorSkill = {
  id: string;
  name: string;
  sourceId: string;
  sourceTrust: string;
  relativePath: string;
  absolutePath: string;
  skillFilePath: string;
  title: string;
  description: string;
  wordCount: number;
  referenceCount: number;
  hasNativeManifest: boolean;
  hasOrigin: boolean;
  tags: string[];
  fingerprint: string;
  usage: ZavorthSkillCuratorUsageSignal;
  quality: ZavorthSkillCuratorQuality;
};

export type ZavorthSkillCuratorProposal = {
  id: string;
  kind: ZavorthSkillCuratorActionKind;
  status: 'planned' | 'needs-approval' | 'applied' | 'skipped';
  title: string;
  summary: string;
  risk: 'none' | 'low' | 'medium';
  skillIds: string[];
  confidence: number;
  reasons: string[];
  suggestedCommand: string;
  destructive: boolean;
  patchPreview: {
    files: Array<{
      path: string;
      action: 'create' | 'update' | 'archive' | 'no-op';
      summary: string;
      preview: string;
    }>;
    rollback: string[];
  };
};

export type ZavorthSkillCuratorSnapshot = {
  contractVersion: typeof ZAVORTH_SKILL_CURATOR_LIVE_LOOP_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'skill-curator-live-loop';
  generatedAt: string;
  status: ZavorthSkillCuratorStatus;
  mode: 'preview' | 'applied';
  summary: {
    sources: number;
    skills: number;
    nativeSkills: number;
    importedSkills: number;
    proposals: number;
    needsApproval: number;
    destructiveProposals: number;
    duplicateGroups: number;
    metadataRepairs: number;
    qualityWarnings: number;
    averageQualityScore: number;
  };
  evolution: {
    enabled: true;
    usageSignalsRead: boolean;
    patchPreviewGenerated: boolean;
    rollbackPlanned: boolean;
    liveMutationPerformed: boolean;
    receiptBacked: boolean;
  };
  skills: ZavorthSkillCuratorSkill[];
  proposals: ZavorthSkillCuratorProposal[];
  apply: {
    requested: boolean;
    applied: boolean;
    approvalRequired: boolean;
    approvalSatisfied: boolean;
    approvalId: string | null;
    approvalMode: 'manual' | 'persistent-policy' | null;
    persistentPolicyId: string | null;
    proposalIds: string[];
    proposalSelectionSatisfied: boolean;
    missingProposalIds: string[];
    safeMetadataApplyRequested: boolean;
    safeMetadataApplyEligible: boolean;
    safeMetadataApplied: boolean;
    safeMetadataFiles: string[];
    statePath: string;
    receiptPath: string;
    patchPreviewPath: string;
  };
  commands: {
    preview: 'zavorth skill-curator';
    json: 'zavorth skill-curator --json';
    apply: 'zavorth skill-curator --apply --approval-id <id>';
    check: 'npm run zavorth:skill-curator-live-loop:check --silent';
  };
  safety: {
    noSilentDelete: true;
    noSilentMerge: true;
    noExternalNetworkProbe: true;
    noSkillExecution: true;
    applyRequiresApprovalId: true;
    applyWritesCuratorStateOnly: boolean;
    safeMetadataApplyRequiresExplicitFlag: true;
    safeMetadataApplyLimitedToNativeSkills: true;
    generatedPatchRequiresSeparateApproval: true;
    rollbackPlanRequired: true;
  };
};

export type ZavorthSkillCuratorLiveLoopInput = {
  apply?: boolean;
  approvalId?: string | null;
  usePersistentApproval?: boolean;
  includeImported?: boolean;
  includeWorkspace?: boolean;
  maxSkills?: number;
  proposalIds?: string[];
  applySafeMetadata?: boolean;
};

export type ZavorthSkillCuratorRuntime = {
  now?: () => Date;
  projectRoot?: string;
  stateDir?: string;
  sourceRegistry?: Pick<SkillSourceRegistryService, 'listSearchSources'>;
  usageRoots?: string[];
  persistentApprovals?: Pick<ZavorthPersistentApprovalPolicyService, 'resolve'>;
};

type SkillPair = {
  a: ZavorthSkillCuratorSkill;
  b: ZavorthSkillCuratorSkill;
  score: number;
  overlap: string[];
};

export class ZavorthSkillCuratorLiveLoopService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly stateDir: string;
  private readonly sourceRegistry: Pick<SkillSourceRegistryService, 'listSearchSources'>;
  private readonly usageRoots: string[];
  private readonly persistentApprovals: Pick<ZavorthPersistentApprovalPolicyService, 'resolve'>;

  public constructor(runtime: ZavorthSkillCuratorRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.stateDir = runtime.stateDir || path.join(this.projectRoot, 'data', 'skill-curator');
    this.sourceRegistry = runtime.sourceRegistry || new SkillSourceRegistryService({ projectRoot: this.projectRoot });
    this.persistentApprovals = runtime.persistentApprovals || new ZavorthPersistentApprovalPolicyService({ projectRoot: this.projectRoot });
    this.usageRoots = runtime.usageRoots || [
      path.join(this.projectRoot, 'data'),
      path.join(this.projectRoot, '.zavorth'),
    ];
  }

  public buildSnapshot(input: ZavorthSkillCuratorLiveLoopInput = {}): ZavorthSkillCuratorSnapshot {
    const sources = this.resolveSources(input);
    const rawSkills = this.scanSkills(sources).slice(0, input.maxSkills || 500);
    const usageIndex = this.buildUsageIndex(rawSkills);
    const skills = this.scoreSkills(rawSkills, usageIndex);
    const allProposals = this.buildProposals(skills);
    const requestedProposalIds = uniqueStrings(input.proposalIds || []);
    const proposals = requestedProposalIds.length > 0
      ? allProposals.filter((proposal) => requestedProposalIds.includes(proposal.id))
      : allProposals;
    const missingProposalIds = requestedProposalIds.filter((proposalId) => !allProposals.some((proposal) => proposal.id === proposalId));
    const proposalSelectionSatisfied = missingProposalIds.length === 0;
    const applyRequested = input.apply === true;
    const approvalId = normalizeApprovalId(input.approvalId);
    const approvalSatisfied = Boolean(approvalId);
    const statePath = path.join(this.stateDir, 'skill-curator-state.json');
    const receiptPath = path.join(this.stateDir, 'skill-curator-receipt.json');
    const patchPreviewPath = path.join(this.stateDir, 'skill-curator-patch-preview.json');
    const persistentResolution = applyRequested && !approvalSatisfied && input.usePersistentApproval === true
      ? this.persistentApprovals.resolve({
        surface: 'skill-curator-live-loop',
        actions: uniqueStrings(proposals.map((proposal) => proposal.kind)),
        maxRisk: maxProposalRisk(proposals),
        destructivePreview: proposals.some((proposal) => proposal.destructive),
      })
      : null;
    const effectiveApprovalId = approvalId || persistentResolution?.policy?.id || null;
    const effectiveApprovalMode = approvalId ? 'manual'
      : persistentResolution?.allowed ? 'persistent-policy'
        : null;
    const effectiveApprovalSatisfied = Boolean(effectiveApprovalId);
    const safeMetadataApplyRequested = input.applySafeMetadata === true;
    const safeMetadataApplyEligible = proposalSelectionSatisfied
      && proposals.length > 0
      && proposals.every((proposal) => isSafeNativeMetadataProposal(proposal));
    const applied = applyRequested && effectiveApprovalSatisfied && proposalSelectionSatisfied;
    let safeMetadataFiles: string[] = [];
    let safeMetadataApplied = false;
    if (applied && effectiveApprovalId) {
      if (safeMetadataApplyRequested && safeMetadataApplyEligible) {
        safeMetadataFiles = this.writeSafeMetadataFiles(proposals);
        safeMetadataApplied = safeMetadataFiles.length > 0;
      }
      this.writeCuratorState({
        statePath,
        receiptPath,
        patchPreviewPath,
        approvalId: effectiveApprovalId,
        approvalMode: effectiveApprovalMode || 'manual',
        persistentPolicyId: persistentResolution?.policy?.id || null,
        proposals,
        skills,
        safeMetadataFiles,
      });
    }
    const duplicateGroups = proposals.filter((proposal) => proposal.kind === 'merge-candidates').length;
    const metadataRepairs = proposals.filter((proposal) => proposal.kind === 'metadata-repair').length;
    const qualityWarnings = proposals.filter((proposal) => proposal.kind === 'quality-watch').length;
    const needsApproval = proposals.filter((proposal) => proposal.status === 'needs-approval').length;
    const destructiveProposals = proposals.filter((proposal) => proposal.destructive).length;
    const status: ZavorthSkillCuratorStatus = proposalSelectionSatisfied
      ? destructiveProposals > 0 || needsApproval > 0
        ? 'attention'
        : 'ready'
      : 'blocked';

    return {
      contractVersion: ZAVORTH_SKILL_CURATOR_LIVE_LOOP_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'skill-curator-live-loop',
      generatedAt: this.now().toISOString(),
      status,
      mode: applied ? 'applied' : 'preview',
      summary: {
        sources: sources.length,
        skills: skills.length,
        nativeSkills: skills.filter((skill) => skill.relativePath.includes('skill-library/native')).length,
        importedSkills: skills.filter((skill) => skill.relativePath.includes('skill-library/imported')).length,
        proposals: proposals.length,
        needsApproval,
        destructiveProposals,
        duplicateGroups,
        metadataRepairs,
        qualityWarnings,
        averageQualityScore: average(skills.map((skill) => skill.quality.score)),
      },
      evolution: {
        enabled: true,
        usageSignalsRead: true,
        patchPreviewGenerated: proposals.some((proposal) => proposal.patchPreview.files.length > 0),
        rollbackPlanned: proposals.every((proposal) => proposal.patchPreview.rollback.length > 0),
        liveMutationPerformed: safeMetadataApplied,
        receiptBacked: applied,
      },
      skills,
      proposals: applied
        ? proposals.map((proposal) => ({ ...proposal, status: proposal.destructive ? 'needs-approval' : 'applied' }))
        : proposals,
      apply: {
        requested: applyRequested,
        applied,
        approvalRequired: applyRequested,
        approvalSatisfied: effectiveApprovalSatisfied,
        approvalId: effectiveApprovalId,
        approvalMode: effectiveApprovalMode,
        persistentPolicyId: persistentResolution?.policy?.id || null,
        proposalIds: requestedProposalIds,
        proposalSelectionSatisfied,
        missingProposalIds,
        safeMetadataApplyRequested,
        safeMetadataApplyEligible,
        safeMetadataApplied,
        safeMetadataFiles,
        statePath,
        receiptPath,
        patchPreviewPath,
      },
      commands: {
        preview: 'zavorth skill-curator',
        json: 'zavorth skill-curator --json',
        apply: 'zavorth skill-curator --apply --approval-id <id>',
        check: 'npm run zavorth:skill-curator-live-loop:check --silent',
      },
      safety: {
        noSilentDelete: true,
        noSilentMerge: true,
        noExternalNetworkProbe: true,
        noSkillExecution: true,
        applyRequiresApprovalId: true,
        applyWritesCuratorStateOnly: !safeMetadataApplied,
        safeMetadataApplyRequiresExplicitFlag: true,
        safeMetadataApplyLimitedToNativeSkills: true,
        generatedPatchRequiresSeparateApproval: true,
        rollbackPlanRequired: true,
      },
    };
  }

  public renderText(snapshot: ZavorthSkillCuratorSnapshot): string {
    const proposalLines = snapshot.proposals.slice(0, 12).map((proposal) =>
      `- ${proposal.kind}: ${proposal.title} | ${proposal.risk} | ${proposal.summary}`,
    );
    const skillLines = snapshot.skills.slice(0, 10).map((skill) =>
      `- ${skill.id}: ${skill.wordCount} words | refs=${skill.referenceCount} | ${skill.relativePath}`,
    );
    return [
      'Zavorth Skill Curator Live Loop',
      `status=${snapshot.status} mode=${snapshot.mode}`,
      `skills=${snapshot.summary.skills} sources=${snapshot.summary.sources} proposals=${snapshot.summary.proposals}`,
      `duplicates=${snapshot.summary.duplicateGroups} metadata=${snapshot.summary.metadataRepairs} needsApproval=${snapshot.summary.needsApproval}`,
      `quality=${snapshot.summary.averageQualityScore}/100 warnings=${snapshot.summary.qualityWarnings} patchPreview=${snapshot.evolution.patchPreviewGenerated}`,
      '',
      'Skills',
      ...(skillLines.length > 0 ? skillLines : ['- No skill encontrada.']),
      '',
      'Proposals',
      ...(proposalLines.length > 0 ? proposalLines : ['- No action required now.']),
      '',
      snapshot.apply.requested
        ? snapshot.apply.applied ? `Applied curator state: ${snapshot.apply.statePath}`
          : snapshot.apply.proposalSelectionSatisfied ? 'Apply blocked: informe --approval-id <id> ou use --use-persistent-approval com uma policy compativel.'
            : `Apply blocked: proposal inexistente (${snapshot.apply.missingProposalIds.join(', ')}).`
        : `Apply governado: ${snapshot.commands.apply}`,
      `Patch preview: ${snapshot.apply.patchPreviewPath}`,
      'Safety: does not delete, merge, execute skills, or apply patches silently.',
      '',
    ].join('\n');
  }

  private resolveSources(input: ZavorthSkillCuratorLiveLoopInput): SkillSourceRegistryEntry[] {
    return this.sourceRegistry.listSearchSources()
      .filter((source) => source.enabled)
      .filter((source) => input.includeImported !== false || !source.path.includes('imported'))
      .filter((source) => input.includeWorkspace !== false || source.path.includes('skill-library'))
      .filter((source) => fs.existsSync(source.absolutePath));
  }

  private scanSkills(sources: SkillSourceRegistryEntry[]): ZavorthSkillCuratorSkill[] {
    const byPath = new Map<string, ZavorthSkillCuratorSkill>();
    for (const source of sources) {
      for (const skillFilePath of findSkillFiles(source.absolutePath)) {
        const absolutePath = path.dirname(skillFilePath);
        const text = readText(skillFilePath);
        const relativePath = normalizePath(path.relative(this.projectRoot, absolutePath));
        const name = path.basename(absolutePath);
        const title = extractTitle(text) || name;
        const description = extractDescription(text);
        const tags = extractTags(`${name} ${title} ${description} ${text.slice(0, 2000)}`);
        const skill: ZavorthSkillCuratorSkill = {
          id: normalizeSkillId(relativePath || name),
          name,
          sourceId: source.id,
          sourceTrust: source.trust,
          relativePath,
          absolutePath,
          skillFilePath,
          title,
          description,
          wordCount: tokenize(text).length,
          referenceCount: countReferences(absolutePath),
          hasNativeManifest: fs.existsSync(path.join(absolutePath, 'ZAVORTH_NATIVE_SKILL.json')),
          hasOrigin: fs.existsSync(path.join(absolutePath, 'ORIGIN.json')),
          tags,
          fingerprint: fingerprint(text),
          usage: emptyUsageSignal(),
          quality: emptyQuality(),
        };
        byPath.set(skill.absolutePath, skill);
      }
    }
    return Array.from(byPath.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  private buildUsageIndex(skills: ZavorthSkillCuratorSkill[]): Map<string, ZavorthSkillCuratorUsageSignal> {
    const usage = new Map(skills.map((skill) => [skill.id, emptyUsageSignal()]));
    const aliases = skills.flatMap((skill) => [
      [skill.id, skill.id] as const,
      [skill.name, skill.id] as const,
      [skill.relativePath, skill.id] as const,
    ]);
    for (const filePath of findUsageFiles(this.usageRoots)) {
      const text = readText(filePath, MAX_USAGE_FILE_BYTES);
      if (!text) continue;
      const lower = text.toLowerCase();
      const timestamp = timestampFromPathOrStat(filePath);
      for (const [alias, skillId] of aliases) {
        const normalizedAlias = alias.toLowerCase();
        if (!normalizedAlias || !lower.includes(normalizedAlias)) continue;
        const signal = usage.get(skillId) || emptyUsageSignal();
        const outcomes = countUsageOutcomes(lower, normalizedAlias);
        signal.mentions += outcomes.mentions;
        signal.receipts += outcomes.receipts;
        signal.approvals += outcomes.approvals;
        signal.successes += outcomes.successes;
        signal.failures += outcomes.failures;
        signal.lastSeenAt = latestTimestamp(signal.lastSeenAt, timestamp);
        usage.set(skillId, signal);
      }
    }
    return usage;
  }

  private scoreSkills(
    skills: ZavorthSkillCuratorSkill[],
    usageIndex: Map<string, ZavorthSkillCuratorUsageSignal>,
  ): ZavorthSkillCuratorSkill[] {
    const pairs = findSimilarPairs(skills);
    const duplicatePenalty = new Map<string, number>();
    for (const pair of pairs) {
      duplicatePenalty.set(pair.a.id, Math.max(duplicatePenalty.get(pair.a.id) || 0, pair.score));
      duplicatePenalty.set(pair.b.id, Math.max(duplicatePenalty.get(pair.b.id) || 0, pair.score));
    }
    return skills.map((skill) => {
      const usage = usageIndex.get(skill.id) || emptyUsageSignal();
      const quality = qualityForSkill(skill, usage, duplicatePenalty.get(skill.id) || 0);
      return { ...skill, usage, quality };
    });
  }

  private buildProposals(skills: ZavorthSkillCuratorSkill[]): ZavorthSkillCuratorProposal[] {
    const proposals: ZavorthSkillCuratorProposal[] = [];
    const pairs = findSimilarPairs(skills)
      .filter((pair) => pair.score >= DESTRUCTIVE_MERGE_MIN_SCORE);
    for (const pair of pairs.slice(0, 12)) {
      proposals.push({
        id: `merge:${pair.a.id}:${pair.b.id}`,
        kind: 'merge-candidates',
        status: 'needs-approval',
        title: `${pair.a.name} + ${pair.b.name}`,
        summary: `Possible overlap de ${Math.round(pair.score * 100)}% em ${pair.overlap.slice(0, 6).join(', ')}.`,
        risk: 'medium',
        skillIds: [pair.a.id, pair.b.id],
        confidence: pair.score,
        reasons: [
          `sharedTags=${pair.overlap.join(', ')}`,
          `wordCount=${pair.a.wordCount}/${pair.b.wordCount}`,
        ],
        suggestedCommand: `zavorth skill-curator --apply --approval-id <id> --proposal "${`merge:${pair.a.id}:${pair.b.id}`}"`,
        destructive: true,
        patchPreview: mergePatchPreview(pair.a, pair.b),
      });
    }
    for (const skill of skills.filter((entry) => needsMetadataRepair(entry)).slice(0, 20)) {
      proposals.push({
        id: `metadata:${skill.id}`,
        kind: 'metadata-repair',
        status: 'planned',
        title: skill.name,
        summary: 'Add or complete source and manifest metadata to improve search and governance.',
        risk: 'low',
        skillIds: [skill.id],
        confidence: 0.8,
        reasons: [
          `hasNativeManifest=${String(skill.hasNativeManifest)}`,
          `hasOrigin=${String(skill.hasOrigin)}`,
          `sourceTrust=${skill.sourceTrust}`,
        ],
        suggestedCommand: `zavorth skill-curator --apply --approval-id <id> --proposal "${`metadata:${skill.id}`}"`,
        destructive: false,
        patchPreview: metadataPatchPreview(skill),
      });
    }
    for (const skill of skills.filter((entry) => entry.wordCount > 900 && entry.referenceCount >= 1).slice(0, 8)) {
      proposals.push({
        id: `umbrella:${skill.id}`,
        kind: 'promote-umbrella',
        status: 'planned',
        title: skill.name,
        summary: 'Skill looks broad enough to serve as a primary umbrella capability.',
        risk: 'low',
        skillIds: [skill.id],
        confidence: 0.7,
        reasons: [`wordCount=${skill.wordCount}`, `references=${skill.referenceCount}`],
        suggestedCommand: `zavorth skill-curator --apply --approval-id <id> --proposal "${`umbrella:${skill.id}`}"`,
        destructive: false,
        patchPreview: umbrellaPatchPreview(skill),
      });
    }
    for (const skill of skills.filter((entry) => entry.quality.score < 55).slice(0, 8)) {
      proposals.push({
        id: `quality:${skill.id}`,
        kind: 'quality-watch',
        status: 'planned',
        title: skill.name,
        summary: `Skill score ${skill.quality.score}/100; review clarity, metadata, or real usage.`,
        risk: 'low',
        skillIds: [skill.id],
        confidence: 0.65,
        reasons: [
          `grade=${skill.quality.grade}`,
          `usage=${skill.quality.usage}`,
          `metadata=${skill.quality.metadata}`,
          `uniqueness=${skill.quality.uniqueness}`,
        ],
        suggestedCommand: `zavorth skill-curator --json --proposal "${`quality:${skill.id}`}"`,
        destructive: false,
        patchPreview: qualityPatchPreview(skill),
      });
    }
    if (proposals.length === 0) {
      proposals.push({
        id: 'keep:library',
        kind: 'keep',
        status: 'planned',
        title: 'Skill library',
        summary: 'Biblioteca without duplicatas ou reparos claros no momento.',
        risk: 'none',
        skillIds: skills.map((skill) => skill.id).slice(0, 20),
        confidence: 1,
        reasons: ['no-obvious-duplicates', 'no-metadata-repair-required'],
        suggestedCommand: 'zavorth skill-curator --json',
        destructive: false,
        patchPreview: {
          files: [],
          rollback: ['No-op proposal; no rollback needed beyond keeping current files.'],
        },
      });
    }
    return proposals;
  }

  private writeCuratorState(input: {
    statePath: string;
    receiptPath: string;
    patchPreviewPath: string;
    approvalId: string;
    approvalMode: 'manual' | 'persistent-policy';
    persistentPolicyId: string | null;
    proposals: ZavorthSkillCuratorProposal[];
    skills: ZavorthSkillCuratorSkill[];
    safeMetadataFiles: string[];
  }): void {
    fs.mkdirSync(path.dirname(input.statePath), { recursive: true });
    const payload = {
      contractVersion: ZAVORTH_SKILL_CURATOR_LIVE_LOOP_CONTRACT_VERSION,
      appliedAt: this.now().toISOString(),
      approvalId: input.approvalId,
      approvalMode: input.approvalMode,
      persistentPolicyId: input.persistentPolicyId,
      mode: 'non-destructive-curator-state',
      proposals: input.proposals,
      skillCount: input.skills.length,
      safety: {
        noSkillFileMutation: input.safeMetadataFiles.length === 0,
        safeMetadataFiles: input.safeMetadataFiles,
        noDelete: true,
        noMerge: true,
        noExecution: true,
      },
    };
    fs.writeFileSync(input.statePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(input.patchPreviewPath, `${JSON.stringify({
      generatedAt: payload.appliedAt,
      approvalId: input.approvalId,
      patches: input.proposals.map((proposal) => ({
        proposalId: proposal.id,
        kind: proposal.kind,
        files: proposal.patchPreview.files,
        rollback: proposal.patchPreview.rollback,
      })),
      liveMutationPerformed: false,
      requiresSeparatePatchApproval: true,
      safeMetadataFilesApplied: input.safeMetadataFiles,
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(input.receiptPath, `${JSON.stringify({
      ...payload,
      receiptKind: 'skill-curator-live-loop',
    }, null, 2)}\n`, 'utf8');
  }

  private writeSafeMetadataFiles(proposals: ZavorthSkillCuratorProposal[]): string[] {
    const written: string[] = [];
    const nativeRoot = path.resolve(this.projectRoot, 'skill-library', 'native');
    for (const proposal of proposals) {
      if (!isSafeNativeMetadataProposal(proposal)) {
        throw new Error(`Unsafe metadata proposal cannot be applied: ${proposal.id}`);
      }
      for (const file of proposal.patchPreview.files) {
        const target = path.resolve(this.projectRoot, file.path);
        if (!isPathInside(target, nativeRoot) || path.basename(target) !== 'ZAVORTH_NATIVE_SKILL.json') {
          throw new Error(`Safe metadata apply refused path outside native skill metadata: ${file.path}`);
        }
        const parsed = JSON.parse(file.preview);
        const payload = {
          ...parsed,
          curatedBy: 'zavorth-skill-curator',
          contractVersion: ZAVORTH_SKILL_CURATOR_LIVE_LOOP_CONTRACT_VERSION,
          updatedAt: this.now().toISOString(),
          safeMetadataApply: true,
        };
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        written.push(normalizePath(path.relative(this.projectRoot, target)));
      }
    }
    return written;
  }
}

function findSkillFiles(root: string): string[] {
  const results: string[] = [];
  const visit = (dir: string, depth: number): void => {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[SkillCuratorLiveLoop] findSkillFiles: failure ao ler diretorio', { dir, error: (err as Error).message });
      return;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md')) {
      results.push(path.join(dir, 'SKILL.md'));
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        visit(path.join(dir, entry.name), depth + 1);
      }
    }
  };
  visit(root, 0);
  return results;
}

function readText(filePath: string, maxBytes = MAX_SKILL_FILE_BYTES): string {
  try {
    const stat = fs.statSync(filePath);
    const length = Math.min(Math.max(0, stat.size), maxBytes);
    const fd = fs.openSync(filePath, 'r');
    try {
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, 0);
      return buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[SkillCuratorLiveLoop] readText: failure reading file', { filePath, error: (err as Error).message });
    return '';
  }
}

function extractTitle(text: string): string {
  return String(text.match(/^#\s+(.+)$/m)?.[1] || '').trim();
}

function extractDescription(text: string): string {
  return String(text.split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith('#')) || '').trim();
}

function tokenize(text: string): string[] {
  return String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) || [];
}

function extractTags(text: string): string[] {
  const stop = new Set(['skill', 'zavorth', 'para', 'com', 'the', 'and', 'uma', 'que', 'when', 'use']);
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    if (stop.has(token) || token.length < 4) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([token]) => token);
}

function fingerprint(text: string): string {
  return extractTags(text).join(':');
}

function countReferences(dir: string): number {
  const references = path.join(dir, 'references');
  if (!fs.existsSync(references)) return 0;
  try {
    return fs.readdirSync(references, { withFileTypes: true }).filter((entry) => entry.isFile()).length;
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[SkillCuratorLiveLoop] countReferences: failed to read references directory', { references, error: (err as Error).message });
    return 0;
  }
}

function findSimilarPairs(skills: ZavorthSkillCuratorSkill[]): SkillPair[] {
  const pairs: SkillPair[] = [];
  for (let i = 0; i < skills.length; i += 1) {
    for (let j = i + 1; j < skills.length; j += 1) {
      const a = skills[i];
      const b = skills[j];
      if (a.absolutePath === b.absolutePath) continue;
      const overlap = a.tags.filter((tag) => b.tags.includes(tag));
      const union = new Set([...a.tags, ...b.tags]);
      const score = union.size > 0 ? overlap.length / union.size : 0;
      const slugRelated = shareSlugToken(a.name, b.name);
      if (score >= 0.32 || (slugRelated && score >= 0.18)) {
        pairs.push({ a, b, score, overlap });
      }
    }
  }
  return pairs.sort((a, b) => b.score - a.score);
}

function shareSlugToken(a: string, b: string): boolean {
  const left = new Set(a.split(/[-_\s]+/).filter((entry) => entry.length > 3));
  return b.split(/[-_\s]+/).some((entry) => left.has(entry));
}

function needsMetadataRepair(skill: ZavorthSkillCuratorSkill): boolean {
  if (skill.relativePath.includes('skill-library/native')) {
    return !skill.hasNativeManifest;
  }
  if (skill.relativePath.includes('skill-library/imported')) {
    return !skill.hasOrigin;
  }
  return false;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function normalizeSkillId(value: string): string {
  return normalizePath(value)
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-|-$/g, '');
}

function normalizeApprovalId(value: string | null | undefined): string | null {
  const text = String(value || '').trim();
  return text.length >= 4 ? text : null;
}

function emptyUsageSignal(): ZavorthSkillCuratorUsageSignal {
  return {
    mentions: 0,
    successes: 0,
    failures: 0,
    approvals: 0,
    receipts: 0,
    lastSeenAt: null,
  };
}

function emptyQuality(): ZavorthSkillCuratorQuality {
  return {
    score: 0,
    grade: 'D',
    usage: 0,
    reliability: 0,
    metadata: 0,
    clarity: 0,
    structure: 0,
    uniqueness: 0,
  };
}

function qualityForSkill(
  skill: ZavorthSkillCuratorSkill,
  usage: ZavorthSkillCuratorUsageSignal,
  duplicatePenalty: number,
): ZavorthSkillCuratorQuality {
  const usageScore = clamp(usage.mentions * 8 + usage.receipts * 12 + usage.approvals * 6, 0, 100);
  const totalOutcomes = usage.successes + usage.failures;
  const reliability = totalOutcomes === 0
    ? 70
    : clamp(Math.round((usage.successes / totalOutcomes) * 100), 0, 100);
  const metadata = clamp((skill.hasNativeManifest || skill.hasOrigin ? 60 : 25) + (skill.tags.length >= 6 ? 25 : 10) + (skill.description ? 15 : 0), 0, 100);
  const clarity = clamp(skill.wordCount < 50 ? 35 : skill.wordCount > 1200 ? 70 : 85, 0, 100);
  const structure = clamp(skill.referenceCount > 0 ? 85 : skill.wordCount >= 120 ? 70 : 55, 0, 100);
  const uniqueness = clamp(Math.round(100 - duplicatePenalty * 100), 0, 100);
  const score = Math.round(
    usageScore * 0.16
    + reliability * 0.18
    + metadata * 0.2
    + clarity * 0.16
    + structure * 0.14
    + uniqueness * 0.16,
  );
  return {
    score,
    grade: score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D',
    usage: usageScore,
    reliability,
    metadata,
    clarity,
    structure,
    uniqueness,
  };
}

function mergePatchPreview(
  a: ZavorthSkillCuratorSkill,
  b: ZavorthSkillCuratorSkill,
): ZavorthSkillCuratorProposal['patchPreview'] {
  const umbrellaName = `${a.name}-${b.name}-umbrella`.replace(/-+/g, '-');
  const target = normalizePath(path.join('skill-library', 'curated', umbrellaName, 'SKILL.md'));
  return {
    files: [
      {
        path: target,
        action: 'create',
        summary: 'Criar skill umbrella proposta a partir das duas skills sobrepostas.',
        preview: [
          `# ${titleCase(umbrellaName)}`,
          '',
          `Consolidates the flows from ${a.title} e ${b.title}.`,
          '',
          'Use when a task pedir a area comum dessas skills e preserve referencias especificas nas skills originais.',
          '',
          `Sources: ${a.relativePath}, ${b.relativePath}`,
        ].join('\n'),
      },
      {
        path: a.relativePath,
        action: 'archive',
        summary: 'Proposal only. Real archival requires a separate patch approval.',
        preview: `Would mark ${a.name} as superseded by ${umbrellaName}.`,
      },
      {
        path: b.relativePath,
        action: 'archive',
        summary: 'Proposal only. Real archival requires a separate patch approval.',
        preview: `Would mark ${b.name} as superseded by ${umbrellaName}.`,
      },
    ],
    rollback: [
      `Remove proposed ${target}.`,
      `Restore ${a.relativePath} and ${b.relativePath} as active skills.`,
      'Re-run zavorth skill-curator to verify duplicate score.',
    ],
  };
}

function metadataPatchPreview(skill: ZavorthSkillCuratorSkill): ZavorthSkillCuratorProposal['patchPreview'] {
  const target = normalizePath(path.join(skill.relativePath, skill.relativePath.includes('native') ? 'ZAVORTH_NATIVE_SKILL.json' : 'ORIGIN.json'));
  return {
    files: [
      {
        path: target,
        action: fs.existsSync(path.join(skill.absolutePath, path.basename(target))) ? 'update' : 'create',
        summary: 'Completar metadados auditaveis da skill.',
        preview: JSON.stringify({
          id: skill.name,
          title: skill.title,
          source: skill.sourceId,
          trust: skill.sourceTrust,
          tags: skill.tags.slice(0, 8),
          curatedBy: 'zavorth-skill-curator',
        }, null, 2),
      },
    ],
    rollback: [
      `Restore previous metadata file at ${target}, or remove it if it did not exist.`,
      'Re-run skill import/readiness checks.',
    ],
  };
}

function umbrellaPatchPreview(skill: ZavorthSkillCuratorSkill): ZavorthSkillCuratorProposal['patchPreview'] {
  return {
    files: [
      {
        path: normalizePath(path.join(skill.relativePath, 'ZAVORTH_CURATOR_NOTES.md')),
        action: 'create',
        summary: 'Record that the skill can serve as a primary umbrella capability.',
        preview: [
          `# Curator Notes: ${skill.title}`,
          '',
          `Quality score: ${skill.quality.score}/100 (${skill.quality.grade})`,
          `References: ${skill.referenceCount}`,
          `Tags: ${skill.tags.slice(0, 8).join(', ')}`,
        ].join('\n'),
      },
    ],
    rollback: [
      `Remove ${normalizePath(path.join(skill.relativePath, 'ZAVORTH_CURATOR_NOTES.md'))}.`,
    ],
  };
}

function qualityPatchPreview(skill: ZavorthSkillCuratorSkill): ZavorthSkillCuratorProposal['patchPreview'] {
  return {
    files: [
      {
        path: normalizePath(path.join(skill.relativePath, 'ZAVORTH_QUALITY_REVIEW.md')),
        action: 'create',
        summary: 'Create a quality review for manual or governed improvement.',
        preview: [
          `# Quality Review: ${skill.title}`,
          '',
          `Score: ${skill.quality.score}/100 (${skill.quality.grade})`,
          `Usage: ${skill.quality.usage}`,
          `Reliability: ${skill.quality.reliability}`,
          `Metadata: ${skill.quality.metadata}`,
          `Uniqueness: ${skill.quality.uniqueness}`,
          '',
          'Recommended: improve trigger clarity, metadata and examples before promotion.',
        ].join('\n'),
      },
    ],
    rollback: [
      `Remove ${normalizePath(path.join(skill.relativePath, 'ZAVORTH_QUALITY_REVIEW.md'))}.`,
    ],
  };
}

function findUsageFiles(roots: string[]): string[] {
  const results: string[] = [];
  for (const root of roots) {
    visitUsageRoot(root, results, 0);
  }
  return results.slice(0, MAX_USAGE_FILES);
}

function visitUsageRoot(dir: string, results: string[], depth: number): void {
  if (depth > 4 || results.length >= MAX_USAGE_FILES || !fs.existsSync(dir)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[SkillCuratorLiveLoop] visitUsageRoot: failed to read usage directory', { dir, error: (err as Error).message });
    return;
  }
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isSkippedUsageDirectory(entry.name, next)) {
        visitUsageRoot(next, results, depth + 1);
      }
    } else if (isUsageEvidenceFile(next, entry.name)) {
      results.push(next);
    }
  }
}

function countUsageOutcomes(text: string, needle: string): Omit<ZavorthSkillCuratorUsageSignal, 'lastSeenAt'> {
  const outcome = {
    mentions: 0,
    successes: 0,
    failures: 0,
    approvals: 0,
    receipts: 0,
  };
  if (!needle) return outcome;
  let index = text.indexOf(needle);
  while (index >= 0) {
    outcome.mentions += 1;
    const context = text.slice(
      Math.max(0, index - USAGE_CONTEXT_RADIUS),
      Math.min(text.length, index + needle.length + USAGE_CONTEXT_RADIUS),
    );
    outcome.receipts += /\breceipt\b/.test(context) ? 1 : 0;
    outcome.approvals += /\bapproval\b|\bapproved\b/.test(context) ? 1 : 0;
    outcome.successes += /\bsuccess\b|\bpassed\b|\bapplied\b|\bok\b|\bsucceeded\b/.test(context) ? 1 : 0;
    outcome.failures += /\bfailed\b|\bblocked\b|\berror\b/.test(context) ? 1 : 0;
    index = text.indexOf(needle, index + needle.length);
  }
  return outcome;
}

function isSkippedUsageDirectory(name: string, fullPath: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerPath = normalizePath(fullPath).toLowerCase();
  return [
    'node_modules',
    'mnemos_db',
    'mnemos_vault',
    'temp',
    'tmp',
    'skill-curator',
  ].includes(lowerName)
    || /(^|\/)(secret|secrets|credentials.*|tokens?|private|keys?)(\/|$)/i.test(lowerPath);
}

function isUsageEvidenceFile(filePath: string, name: string): boolean {
  if (!/\.(json|jsonl|md|txt|log)$/i.test(name)) return false;
  const lower = normalizePath(filePath).toLowerCase();
  if (/(^|[._-])(secret|credential|token|key|private|pem|cert)([._-]|$)/i.test(name)) return false;
  if (lower.includes('/skill-curator/')) return false;
  return /(receipt|ledger|event|runtime|run|history|usage|proof|approval|audit|log)/i.test(lower);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function maxProposalRisk(proposals: ZavorthSkillCuratorProposal[]): 'none' | 'low' | 'medium' {
  if (proposals.some((proposal) => proposal.risk === 'medium')) return 'medium';
  if (proposals.some((proposal) => proposal.risk === 'low')) return 'low';
  return 'none';
}

function isSafeNativeMetadataProposal(proposal: ZavorthSkillCuratorProposal): boolean {
  return proposal.kind === 'metadata-repair'
    && proposal.risk === 'low'
    && proposal.destructive === false
    && proposal.skillIds.length === 1
    && proposal.skillIds[0].startsWith('skill-library/native/')
    && proposal.patchPreview.files.length > 0
    && proposal.patchPreview.files.every((file) =>
      file.action !== 'archive'
      && normalizePath(file.path).startsWith('skill-library/native/')
      && normalizePath(file.path).endsWith('/ZAVORTH_NATIVE_SKILL.json'));
}

function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function timestampFromPathOrStat(filePath: string): string | null {
  const fromName = filePath.match(/\d{4}-\d{2}-\d{2}T\d{2}[-:]\d{2}[-:]\d{2}/)?.[0]?.replace(/-/g, ':').replace(/^(\d{4}):(\d{2}):(\d{2})T/, '$1-$2-$3T');
  if (fromName) return fromName;
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[SkillCuratorLiveLoop] timestampFromPathOrStat: failure getting file stat', { filePath, error: (err as Error).message });
    return null;
  }
}

function latestTimestamp(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
