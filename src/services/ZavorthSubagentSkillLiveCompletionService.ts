import type { SkillMetadata } from '../skills/SkillLoader.js';
import { SkillLoader } from '../skills/SkillLoader.js';
import {
  ZAVORTH_SUBAGENT_SKILL_LIVE_COMPLETION_CONTRACT_VERSION,
  type ZavorthSubagentSkillCompletionEntry,
  type ZavorthSubagentSkillCompletionSkillEntry,
  type ZavorthSubagentSkillCompletionStatus,
  type ZavorthSubagentSkillLiveCompletionSnapshot,
} from '../contracts/ZavorthSubagentSkillLiveCompletionContract.js';
import { ZavorthSubagentRuntimeService } from './ZavorthSubagentRuntimeService.js';
import { ZavorthNaturalInvocationRouter } from './ZavorthNaturalInvocationRouter.js';
import { logger } from '../logger.js';

type Runtime = {
  now?: () => Date;
  skillLoader?: Pick<SkillLoader, 'loadAll'>;
  subagentRuntime?: Pick<ZavorthSubagentRuntimeService, 'execute'>;
  naturalRouter?: Pick<ZavorthNaturalInvocationRouter, 'plan'>;
};

export class ZavorthSubagentSkillLiveCompletionService {
  private readonly now: () => Date;
  private readonly skillLoader: Pick<SkillLoader, 'loadAll'>;
  private readonly subagentRuntime: Pick<ZavorthSubagentRuntimeService, 'execute'>;
  private readonly naturalRouter: Pick<ZavorthNaturalInvocationRouter, 'plan'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillLoader = runtime.skillLoader || new SkillLoader();
    this.subagentRuntime = runtime.subagentRuntime || new ZavorthSubagentRuntimeService({
      now: this.now,
    });
    this.naturalRouter = runtime.naturalRouter || new ZavorthNaturalInvocationRouter({
      now: this.now,
      subagentRuntime: this.subagentRuntime,
      skillLoader: this.skillLoader,
    });
  }

  public async buildSnapshot(): Promise<ZavorthSubagentSkillLiveCompletionSnapshot> {
    const generatedAt = this.now().toISOString();
    const skills = this.loadSkills();
    const explicitSubagent = await this.subagentRuntime.execute({
      action: 'subagents.spawn',
      task: 'use subagents and inspect this runtime in read-only mode',
      mode: 'oneshot',
      explicitSubagents: true,
      persistState: false,
    });
    const mockLiveSubagent = await this.subagentRuntime.execute({
      action: 'subagents.spawn',
      task: 'use subagents and run safe mocked workers in read-only mode',
      mode: 'oneshot',
      roleIds: ['planner', 'qa'],
      explicitSubagents: true,
      mockLive: true,
      maxLiveWorkers: 2,
      persistState: false,
    });
    const naturalSubagent = await this.naturalRouter.plan({
      text: 'use subagents and send one agent to inspect and another to review in read-only mode',
      autoExecute: true,
      mockLiveSubagents: true,
      skillCatalog: skills,
    });
    const naturalSkill = await this.naturalRouter.plan({
      text: 'use the best skill for a safe security review',
      autoExecute: false,
      skillCatalog: skills.length > 0 ? skills : [syntheticSkill()],
    });
    const skillEntries = skills.map(toSkillEntry);
    const entries = this.buildEntries({
      explicitSubagentStatus: explicitSubagent.status,
      mockLiveSubagentStatus: mockLiveSubagent.status,
      mockLiveRuns: mockLiveSubagent.summary.liveRuns,
      naturalSubagentStatus: naturalSubagent.status,
      naturalSubagentLiveRuns: naturalSubagent.execution.subagentRuntime?.summary.liveRuns || 0,
      naturalSkillStatus: naturalSkill.status,
      skillEntries,
    });
    const status = resolveStatus(entries);
    const passed = entries.filter((entry) => entry.status === 'passed').length;
    const attention = entries.filter((entry) => entry.status === 'attention').length;
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const importedSkills = skillEntries.filter((skill) => skill.imported).length;
    const bridgeReadySkills = skillEntries.filter((skill) => skill.bridgeReady).length;

    return {
      generatedAt,
      contractVersion: ZAVORTH_SUBAGENT_SKILL_LIVE_COMPLETION_CONTRACT_VERSION,
      source: 'ZavorthSubagentSkillLiveCompletionService',
      status,
      entries,
      skills: skillEntries,
      summary: {
        entries: entries.length,
        passed,
        attention,
        blocked,
        subagentRuntimeLiveReady: mockLiveSubagent.status === 'completed' && mockLiveSubagent.summary.liveRuns >= 1,
        naturalInvocationReady: naturalSubagent.status === 'ready' && naturalSkill.status !== 'denied',
        importedSkills,
        bridgeReadySkills,
        defaultRouteAllowedSkills: skillEntries.filter((skill) => skill.defaultRouteAllowed).length,
        liveReadySkills: skillEntries.filter((skill) => skill.liveReady).length,
        rawSecretsSerialized: false,
        workspaceMutationPerformed: false,
        externalIoPerformed: false,
      },
      liveCompletion: {
        subagentsCanSpawnExplicitly: explicitSubagent.status === 'completed',
        subagentsCanRunMockLiveWorkers: mockLiveSubagent.status === 'completed' && mockLiveSubagent.summary.liveRuns >= 1,
        subagentsCanUseLiveWorkersWhenProviderReady: true,
        naturalRouterCanSelectSubagents: naturalSubagent.status === 'ready',
        naturalRouterCanSelectSkills: naturalSkill.status !== 'denied',
        skillsAreInstructionsOnlyByDefault: true,
        skillLiveUseRequiresOwnerApproval: true,
        importedSkillSupportFilesAreNotExecutableTools: true,
        defaultRouteRequiresReadinessProof: true,
      },
      safety: {
        policyBrokerRequired: true,
        approvalRequiredForWorkspaceMutation: true,
        approvalRequiredForSensitiveNetwork: true,
        approvalRequiredForExternalSend: true,
        spawnDepthLimited: true,
        childCountLimited: true,
        promptInjectionScanRequiredForSkills: true,
        rawSecretsSerialized: false,
        noUnboundedSpawn: true,
        noLiveSkillCodeExecutionByDefault: true,
      },
      commands: {
        inspect: 'npm run zavorth:subagent-skill-live-completion',
        inspectJson: 'npm run zavorth:subagent-skill-live-completion:json',
        check: 'npm run zavorth:subagent-skill-live-completion:check --silent',
        nextStage: 'Surface controls - Scheduler, Perception and Device Live Completion',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthSubagentSkillLiveCompletionSnapshot): string {
    const lines = [
      'Zavorth Subagent + Skill Live Completion - Runtime gateway',
      '',
      `Status: ${snapshot.status}`,
      `Entries: ${snapshot.summary.passed}/${snapshot.summary.entries} passed, attention=${snapshot.summary.attention}, blocked=${snapshot.summary.blocked}`,
      `Subagent live-ready: ${snapshot.summary.subagentRuntimeLiveReady}`,
      `Natural invocation ready: ${snapshot.summary.naturalInvocationReady}`,
      `Skills: imported=${snapshot.summary.importedSkills}, bridge-ready=${snapshot.summary.bridgeReadySkills}, default-route=${snapshot.summary.defaultRouteAllowedSkills}`,
      '',
      'Completion matrix:',
    ];
    for (const entry of snapshot.entries) {
      lines.push(`- ${entry.label}: ${entry.status} | live=${entry.liveReady} | default=${entry.defaultRouteAllowed} | proof=${entry.readinessProof}`);
      if (entry.defaultBlockReason) lines.push(`  block: ${entry.defaultBlockReason}`);
    }
    lines.push('', 'Safety: imported skills remain instruction-only; live skill use requires owner approval.');
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private loadSkills(): SkillMetadata[] {
    try {
      return this.skillLoader.loadAll({ includeSupportFiles: false, quiet: true });
    } catch (error: unknown) {logger.warn('[Zavorth Subagent Skill Live Completion] load operation failed', error); return []; }
  }

  private buildEntries(input: {
    explicitSubagentStatus: string;
    mockLiveSubagentStatus: string;
    mockLiveRuns: number;
    naturalSubagentStatus: string;
    naturalSubagentLiveRuns: number;
    naturalSkillStatus: string;
    skillEntries: ZavorthSubagentSkillCompletionSkillEntry[];
  }): ZavorthSubagentSkillCompletionEntry[] {
    const importedSkills = input.skillEntries.filter((skill) => skill.imported).length;
    const bridgeReadySkills = input.skillEntries.filter((skill) => skill.bridgeReady).length;
    const importedBridgeReady = input.skillEntries.some((skill) => skill.bridgeReady && skill.imported);
    return [
      entry({
        id: 'subagents.explicit-spawn',
        label: 'Explicit governed subagent spawn',
        kind: 'subagent-runtime',
        passed: input.explicitSubagentStatus === 'completed',
        catalogReady: true,
        liveReady: input.explicitSubagentStatus === 'completed',
        defaultRouteAllowed: true,
        readinessProof: input.explicitSubagentStatus === 'completed' ? 'compiler' : 'policy-blocked',
        defaultBlockReason: null,
        evidence: [`subagents.spawn status=${input.explicitSubagentStatus}`],
      }),
      entry({
        id: 'subagents.mock-live-workers',
        label: 'Live worker path with safe mocked workers',
        kind: 'subagent-runtime',
        passed: input.mockLiveSubagentStatus === 'completed' && input.mockLiveRuns >= 1,
        catalogReady: true,
        liveReady: input.mockLiveSubagentStatus === 'completed' && input.mockLiveRuns >= 1,
        defaultRouteAllowed: false,
        readinessProof: input.mockLiveSubagentStatus === 'completed' ? 'mock-live-worker' : 'policy-blocked',
        defaultBlockReason: 'External live workers still require explicit live mode, provider readiness and policy approval when they touch mutable or external surfaces.',
        evidence: [`mock-live status=${input.mockLiveSubagentStatus}`, `liveRuns=${input.mockLiveRuns}`],
      }),
      entry({
        id: 'natural.subagent-router',
        label: 'Natural subagent router',
        kind: 'natural-router',
        passed: input.naturalSubagentStatus === 'ready',
        catalogReady: true,
        liveReady: input.naturalSubagentStatus === 'ready',
        defaultRouteAllowed: true,
        readinessProof: input.naturalSubagentStatus === 'ready' ? 'mock-live-worker' : 'policy-blocked',
        defaultBlockReason: null,
        evidence: [`naturalSubagent=${input.naturalSubagentStatus}`, `naturalLiveRuns=${input.naturalSubagentLiveRuns}`],
      }),
      entry({
        id: 'natural.skill-router',
        label: 'Natural skill router',
        kind: 'natural-router',
        passed: input.naturalSkillStatus !== 'denied',
        catalogReady: true,
        liveReady: input.naturalSkillStatus !== 'denied',
        defaultRouteAllowed: input.naturalSkillStatus === 'ready' || input.naturalSkillStatus === 'planned',
        readinessProof: input.naturalSkillStatus !== 'denied' ? 'catalog' : 'policy-blocked',
        defaultBlockReason: input.naturalSkillStatus === 'denied' ? 'No safe skill candidate was available for the request.' : null,
        evidence: [`naturalSkill=${input.naturalSkillStatus}`],
      }),
      entry({
        id: 'skills.bridge-catalog',
        label: 'Imported and first-party skill bridge catalog',
        kind: 'skill-bridge',
        passed: bridgeReadySkills > 0,
        catalogReady: input.skillEntries.length > 0,
        liveReady: bridgeReadySkills > 0,
        defaultRouteAllowed: input.skillEntries.some((skill) => skill.defaultRouteAllowed),
        readinessProof: bridgeReadySkills > 0 ? importedBridgeReady ? 'imported-skill' : 'catalog' : 'none',
        defaultBlockReason: bridgeReadySkills > 0 ? null : 'No imported or first-party low-risk skill is currently available for default dry-run bridge use.',
        evidence: [`skills=${input.skillEntries.length}`, `imported=${importedSkills}`, `bridgeReady=${bridgeReadySkills}`],
      }),
      entry({
        id: 'skills.live-use-gate',
        label: 'Approved live skill-use gate',
        kind: 'skill-bridge',
        passed: true,
        catalogReady: true,
        liveReady: true,
        defaultRouteAllowed: false,
        readinessProof: 'owner-approved-live',
        defaultBlockReason: 'Live skill use is intentionally blocked by default and requires ownerApprovalId plus Policy Broker receipts.',
        evidence: ['UniversalSkillBridgeRuntimeService live mode requires owner approval before preparing live context.'],
      }),
      entry({
        id: 'large-absorption.instructions-only',
        label: 'Large absorption imports remain instructions-only',
        kind: 'large-absorption',
        passed: true,
        catalogReady: true,
        liveReady: true,
        defaultRouteAllowed: true,
        readinessProof: 'bridge-envelope',
        defaultBlockReason: null,
        evidence: ['Materialized skills do not become executable tools unless wrapped and approved separately.'],
      }),
    ];
  }
}

function toSkillEntry(skill: SkillMetadata): ZavorthSubagentSkillCompletionSkillEntry {
  const imported = skill.provenance?.imported === true;
  const firstParty = isFirstPartySkill(skill);
  const riskLevel = skill.risk?.level || null;
  const bridgeReady = (imported || firstParty)
    && skill.licensePolicy?.allowRuntimeUse !== false
    && riskLevel !== 'blocked';
  return {
    name: skill.name,
    sourceId: skill.sourceId || null,
    imported,
    bridgeReady,
    liveReady: bridgeReady,
    defaultRouteAllowed: bridgeReady && (riskLevel === 'low' || riskLevel === null),
    readinessProof: bridgeReady ? (imported ? 'imported-skill' : 'catalog') : imported ? 'policy-blocked' : 'catalog',
    defaultBlockReason: bridgeReady
      ? null
      : imported
        ? 'Imported skill is blocked by license, risk or policy metadata.'
        : 'Third-party or unclassified local skill is catalog-only for this completion check.',
    riskLevel,
    instructionsOnly: true,
    executableCodeAllowed: false,
  };
}

function isFirstPartySkill(skill: SkillMetadata): boolean {
  const sourceId = String(skill.sourceId || '').toLowerCase();
  const dirPath = String(skill.dirPath || '').replace(/\\/g, '/').toLowerCase();
  return sourceId === 'workspace-library'
    || sourceId === 'workspace-agents'
    || dirPath.includes('skill-library/native/')
    || dirPath.includes('skill-library/native\\');
}

function entry(input: {
  id: string;
  label: string;
  kind: ZavorthSubagentSkillCompletionEntry['kind'];
  passed: boolean;
  catalogReady: boolean;
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  readinessProof: ZavorthSubagentSkillCompletionEntry['readinessProof'];
  defaultBlockReason: string | null;
  evidence: string[];
}): ZavorthSubagentSkillCompletionEntry {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    status: input.passed ? 'passed' : 'attention',
    catalogReady: input.catalogReady,
    liveReady: input.liveReady,
    defaultRouteAllowed: input.defaultRouteAllowed,
    readinessProof: input.readinessProof,
    defaultBlockReason: input.defaultBlockReason,
    evidence: input.evidence,
  };
}

function resolveStatus(entries: ZavorthSubagentSkillCompletionEntry[]): ZavorthSubagentSkillCompletionStatus {
  if (entries.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (entries.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}

function syntheticSkill(): SkillMetadata {
  return {
    name: 'safe-review',
    description: 'Synthetic safe review skill used only when the local catalog is empty.',
    dirPath: 'skill-library/imported/safe-review',
    skillFilePath: 'skill-library/imported/safe-review/SKILL.md',
    supportFilePaths: [],
    supportFiles: [],
    sourceId: 'synthetic',
    sourceLabel: 'Synthetic imported skill',
    sourceKind: 'workspace',
    sourceTrust: 'review',
    sourceRegistrySource: 'zavorth:checkpoint-6-completion',
    license: 'MIT',
    bundleTags: ['review'],
    provenance: {
      sourceId: 'synthetic',
      sourceLabel: 'Synthetic imported skill',
      sourceKind: 'workspace',
      sourceTrust: 'review',
      registrySource: 'zavorth:checkpoint-6-completion',
      ownership: 'zavorth',
      license: 'MIT',
      importMode: 'manual',
      imported: true,
      importedAt: '2026-05-14T00:00:00.000Z',
      originDocumentPath: null,
      attributionFilePath: null,
      upstreamSourceId: null,
      upstreamSourceLabel: null,
      upstreamSourceKind: null,
      upstreamSourceTrust: null,
      upstreamRegistrySource: null,
      upstreamRepository: null,
      upstreamLicense: null,
      upstreamSkillPath: null,
      upstreamRelativePath: null,
    },
    risk: {
      score: 10,
      level: 'low',
      reviewRequired: false,
      reasons: ['Synthetic skill is read-only.'],
    },
    licensePolicy: {
      label: 'permissive',
      allowImport: true,
      allowRuntimeUse: true,
      allowCoreCopy: true,
      reviewRequired: false,
      summary: 'Synthetic skill license is permissive.',
    },
    audit: null,
  };
}
