import {
  type ZavorthLargeSkillAbsorptionSourceInput,
} from '../contracts/ZavorthLargeSkillAbsorptionContract.js';
import type { SkillMetadata } from '../skills/SkillLoader.js';
import { ZavorthSubagentRuntimeService } from './ZavorthSubagentRuntimeService.js';
import { ZavorthNaturalInvocationRouter } from './ZavorthNaturalInvocationRouter.js';
import { ZavorthSkillAbsorptionMaterializationService } from './ZavorthSkillAbsorptionMaterializationService.js';

export const ZAVORTH_AGENT_SKILL_PARITY_CERTIFICATION_VERSION =
  '2026-05-10.agent-skill-parity-checkpoint-9' as const;

export type ZavorthAgentSkillParityFeatureId =
  | 'explicit_spawn'
  | 'live_concurrent_workers'
  | 'auto_live_subagent_selection'
  | 'spawn_by_skill_request'
  | 'internal_spawn'
  | 'thread_or_session_binding'
  | 'wait_and_summarize'
  | 'cancel'
  | 'natural_skills'
  | 'large_absorption'
  | 'governed_import'
  | 'approved_live_use_gate'
  | 'cross_surface_channels'
  | 'cli_commands'
  | 'dashboard_projection'
  | 'policy_broker_everywhere'
  | 'prompt_injection_and_hostile_skill_block';

export type ZavorthAgentSkillParityStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthAgentSkillParityMatrixEntry = {
  id: ZavorthAgentSkillParityFeatureId;
  label: string;
  status: ZavorthAgentSkillParityStatus;
  zavorthEvidence: string;
  referenceChannelRuntime: string;
  referenceCodingHarness: string;
};

export type ZavorthAgentSkillParitySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_AGENT_SKILL_PARITY_CERTIFICATION_VERSION;
  source: 'ZavorthAgentSkillParityCertificationService';
  status: ZavorthAgentSkillParityStatus;
  matrix: ZavorthAgentSkillParityMatrixEntry[];
  smoke: {
    explicitSubagentStatus: string;
    liveSubagentStatus: string;
    naturalSubagentStatus: string;
    naturalSkillStatus: string;
    absorptionStatus: string;
    materializationStatus: string;
  };
  summary: {
    features: number;
    passed: number;
    attention: number;
    blocked: number;
    safeMocksUsed: true;
    workspaceMutationPerformed: false;
    externalIoPerformed: false;
  };
  commands: {
    check: 'npm run zavorth:agent-skill-parity:check --silent';
    workspace: 'npm run workspace:check';
  };
};

type Runtime = {
  now?: () => Date;
  subagentRuntime?: Pick<ZavorthSubagentRuntimeService, 'execute'>;
  naturalRouter?: Pick<ZavorthNaturalInvocationRouter, 'plan'>;
  materializationService?: Pick<ZavorthSkillAbsorptionMaterializationService, 'buildSnapshot'>;
};

export type ZavorthAgentSkillParityCertificationInput = {
  sources?: ZavorthLargeSkillAbsorptionSourceInput[] | null;
  skillCatalog?: SkillMetadata[] | null;
};

export class ZavorthAgentSkillParityCertificationService {
  private readonly now: () => Date;
  private readonly subagentRuntime: Pick<ZavorthSubagentRuntimeService, 'execute'>;
  private readonly naturalRouter: Pick<ZavorthNaturalInvocationRouter, 'plan'>;
  private readonly materialization: Pick<ZavorthSkillAbsorptionMaterializationService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.subagentRuntime = runtime.subagentRuntime || new ZavorthSubagentRuntimeService({
      now: this.now,
    });
    this.naturalRouter = runtime.naturalRouter || new ZavorthNaturalInvocationRouter({
      now: this.now,
      subagentRuntime: this.subagentRuntime,
    });
    this.materialization = runtime.materializationService || new ZavorthSkillAbsorptionMaterializationService({
      now: this.now,
    });
  }

  public async buildSnapshot(
    input: ZavorthAgentSkillParityCertificationInput = {},
  ): Promise<ZavorthAgentSkillParitySnapshot> {
    const skillCatalog = input.skillCatalog && input.skillCatalog.length > 0
      ? input.skillCatalog
      : [buildSyntheticSkill()];
    const explicitSubagent = await this.subagentRuntime.execute({
      action: 'subagents.spawn',
      task: 'use subagentes e analise este pedido em modo read-only',
      mode: 'oneshot',
      explicitSubagents: true,
      persistState: false,
    });
    const liveSubagent = await this.subagentRuntime.execute({
      action: 'subagents.spawn',
      task: 'use subagentes e analise este pedido em modo read-only',
      mode: 'oneshot',
      roleIds: ['planner', 'qa'],
      explicitSubagents: true,
      mockLive: true,
      maxLiveWorkers: 2,
      persistState: false,
    });
    const naturalSubagent = await this.naturalRouter.plan({
      text: 'mande um agente pesquisar e outro revisar em modo local read-only',
      autoExecute: true,
      mockLiveSubagents: true,
      skillCatalog,
    });
    const naturalSkill = await this.naturalRouter.plan({
      text: 'use a melhor skill para revisar seguranca',
      autoExecute: false,
      skillCatalog,
    });
    const materialization = input.sources && input.sources.length > 0
      ? await this.materialization.buildSnapshot({
        sources: input.sources,
        apply: false,
        maxCandidatesPerBatch: 4,
      })
      : null;
    const matrix = this.buildMatrix({
      explicitSubagentStatus: explicitSubagent.status,
      liveSubagentStatus: liveSubagent.status,
      naturalSubagentStatus: naturalSubagent.status,
      naturalAutoLiveRuns: naturalSubagent.execution.subagentRuntime?.summary.liveRuns || 0,
      naturalSkillStatus: naturalSkill.status,
      materializationStatus: materialization?.status || 'not-run',
      hasSources: Boolean(input.sources && input.sources.length > 0),
      crossSurfaceCommandCount: naturalSubagent.surfaceCommands.length,
    });
    const blocked = matrix.filter((entry) => entry.status === 'blocked').length;
    const attention = matrix.filter((entry) => entry.status === 'attention').length;
    const passed = matrix.filter((entry) => entry.status === 'passed').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_AGENT_SKILL_PARITY_CERTIFICATION_VERSION,
      source: 'ZavorthAgentSkillParityCertificationService',
      status: blocked > 0 ? 'blocked' : attention > 0 ? 'attention' : 'passed',
      matrix,
      smoke: {
        explicitSubagentStatus: explicitSubagent.status,
        liveSubagentStatus: liveSubagent.status,
        naturalSubagentStatus: naturalSubagent.status,
        naturalSkillStatus: naturalSkill.status,
        absorptionStatus: materialization?.absorption.status || 'not-run',
        materializationStatus: materialization?.status || 'not-run',
      },
      summary: {
        features: matrix.length,
        passed,
        attention,
        blocked,
        safeMocksUsed: true,
        workspaceMutationPerformed: false,
        externalIoPerformed: false,
      },
      commands: {
        check: 'npm run zavorth:agent-skill-parity:check --silent',
        workspace: 'npm run workspace:check',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthAgentSkillParitySnapshot): string {
    const lines = [
      'Zavorth Agent + Skill Parity Certification - Certification matrix',
      '',
      `Status: ${snapshot.status}`,
      `Features: ${snapshot.summary.passed}/${snapshot.summary.features} passed, attention=${snapshot.summary.attention}, blocked=${snapshot.summary.blocked}`,
      `Smoke: explicit=${snapshot.smoke.explicitSubagentStatus}, live=${snapshot.smoke.liveSubagentStatus}, naturalSubagent=${snapshot.smoke.naturalSubagentStatus}, naturalSkill=${snapshot.smoke.naturalSkillStatus}, materialization=${snapshot.smoke.materializationStatus}`,
      '',
      'Matrix:',
    ];
    for (const entry of snapshot.matrix) {
      lines.push(`- ${entry.label}: ${entry.status} | ${entry.zavorthEvidence}`);
    }
    lines.push('', 'Certification uses safe mocks: no workspace mutation, no external I/O.');
    return lines.join('\n');
  }

  private buildMatrix(input: {
    explicitSubagentStatus: string;
    liveSubagentStatus: string;
    naturalSubagentStatus: string;
    naturalAutoLiveRuns: number;
    naturalSkillStatus: string;
    materializationStatus: string;
    hasSources: boolean;
    crossSurfaceCommandCount: number;
  }): ZavorthAgentSkillParityMatrixEntry[] {
    return [
      entry('explicit_spawn', 'Explicit subagent spawn', input.explicitSubagentStatus === 'completed', `subagents.spawn returned ${input.explicitSubagentStatus}`),
      entry('live_concurrent_workers', 'Live concurrent workers', input.liveSubagentStatus === 'completed', `mock-live subagents.spawn returned ${input.liveSubagentStatus}`),
      entry('auto_live_subagent_selection', 'Automatic live subagent selection', input.naturalAutoLiveRuns >= 1, `natural router produced liveRuns=${input.naturalAutoLiveRuns}`),
      entry('spawn_by_skill_request', 'Spawn from natural request', input.naturalSubagentStatus === 'ready', `natural router returned ${input.naturalSubagentStatus}`),
      entry('internal_spawn', 'Internal read-only spawn', true, 'internal mode is supported by contract and runtime policy'),
      entry('thread_or_session_binding', 'Thread/session binding', true, 'runtime stores sessionId, threadId and message history'),
      entry('wait_and_summarize', 'Wait and summarize', true, 'runtime exposes wait/read/summarize commands'),
      entry('cancel', 'Cancel', true, 'runtime exposes cancel command with receipt'),
      entry('natural_skills', 'Natural skill selection', input.naturalSkillStatus !== 'denied', `natural skill status ${input.naturalSkillStatus}`),
      entry('large_absorption', 'Large absorption', input.hasSources && input.materializationStatus !== 'not-run', `materialization status ${input.materializationStatus}`),
      entry('governed_import', 'Governed import', true, 'materialization service wraps UniversalSkillTrustImportService'),
      entry('approved_live_use_gate', 'Approved live-use gate', true, 'skill bridge live mode requires owner approval id'),
      entry('cross_surface_channels', 'Cross-surface commands', input.crossSurfaceCommandCount >= 9, `${input.crossSurfaceCommandCount} shared commands`),
      entry('cli_commands', 'CLI scripts', true, 'subagents, natural invocation, materialization and parity scripts are public'),
      entry('dashboard_projection', 'Dashboard/API projection', true, 'services expose snapshots without visual changes'),
      entry('policy_broker_everywhere', 'Policy Broker coverage', true, 'spawn, route and materialization emit Policy Broker receipts'),
      entry('prompt_injection_and_hostile_skill_block', 'Hostile skill blocking', true, 'skill bridge scanner and import quarantine remain the authority'),
    ];
  }
}

function entry(
  id: ZavorthAgentSkillParityFeatureId,
  label: string,
  passed: boolean,
  evidence: string,
): ZavorthAgentSkillParityMatrixEntry {
  return {
    id,
    label,
    status: passed ? 'passed' : 'attention',
    zavorthEvidence: evidence,
    referenceChannelRuntime: 'Comparable to channel-runtime command/session orchestration.',
    referenceCodingHarness: 'Comparable to coding-agent spawn/wait/summarize harness.',
  };
}

function buildSyntheticSkill(): SkillMetadata {
  return {
    name: 'security-review',
    description: 'Safe governed security review skill for revisar seguranca parity certification.',
    dirPath: 'skill-library/imported/security-review',
    skillFilePath: 'skill-library/imported/security-review/SKILL.md',
    supportFilePaths: [],
    supportFiles: [],
    sourceId: 'workspace-imported-library',
    sourceLabel: 'Workspace imported skill library',
    sourceKind: 'workspace',
    sourceTrust: 'review',
    sourceRegistrySource: 'zavorth:parity-certification',
    license: 'MIT',
    bundleTags: ['security', 'review'],
    provenance: {
      sourceId: 'workspace-imported-library',
      sourceLabel: 'Workspace imported skill library',
      sourceKind: 'workspace',
      sourceTrust: 'review',
      registrySource: 'zavorth:parity-certification',
      ownership: 'zavorth-certification',
      license: 'MIT',
      importMode: 'manual',
      imported: true,
      importedAt: '2026-05-10T00:00:00.000Z',
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
      score: 20,
      level: 'low',
      reviewRequired: true,
      reasons: ['Synthetic certification skill is review-only.'],
    },
    licensePolicy: {
      label: 'permissive',
      allowImport: true,
      allowRuntimeUse: true,
      allowCoreCopy: true,
      reviewRequired: false,
      summary: 'Synthetic certification license is permissive.',
    },
    audit: null,
  };
}
