import fs from 'fs/promises';
import path from 'path';

import { config } from '../config/index.js';
import {
  ZavorthSkillCuratorLiveLoopService,
  type ZavorthSkillCuratorSnapshot,
} from '../services/ZavorthSkillCuratorLiveLoopService.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { redactSensitiveText } from '../security/SensitiveDataGuard.js';
import { Database } from '../storage/Database.js';
import type {
  ProfileImprovementLane,
  ProfileImprovementPolicy,
  ProfileRuntimeBundle,
} from '../contracts/ProfileManifestContract.js';
import type { SkillCatalogEntry } from './SkillCatalogContract.js';
import { SkillCatalogService } from './SkillCatalogService.js';
import { SkillCurationService } from './SkillCurationService.js';

export type SkillCuratorLifecycleState = 'active' | 'stale' | 'archived';

export type SkillCuratorState = {
  contractVersion: '2026-05-31.zavorth.skill-curator-plane.v1';
  enabled: boolean;
  paused: boolean;
  lastRunAt: string | null;
  lastRunDurationSeconds: number | null;
  lastRunSummary: string | null;
  lastRunSummaryShownAt: string | null;
  lastReportPath: string | null;
  runCount: number;
  seededAt: string | null;
  skillStates: Record<string, {
    state: SkillCuratorLifecycleState;
    markedAt: string;
    reason: string;
  }>;
};

export type SkillCuratorTransition = {
  skillId: string;
  from: SkillCuratorLifecycleState;
  to: SkillCuratorLifecycleState;
  reason: string;
  dryRun: boolean;
};

export type SkillCuratorConsolidationCandidate = {
  topic: string;
  skillIds: string[];
  recommendation: string;
};

export type SkillCuratorAutonomyReport = {
  profileId: string | null;
  mode: ProfileImprovementPolicy['mode'];
  silent: ProfileImprovementLane[];
  notify: ProfileImprovementLane[];
  requireApproval: ProfileImprovementLane[];
  maxSilentRisk: ProfileImprovementPolicy['maxSilentRisk'];
  interruptMode: ProfileImprovementPolicy['interruptMode'];
  scheduledRunMode: 'manual-dry-run' | 'silent-dry-run' | 'silent-apply-reversible';
  backgroundOnly: boolean;
  lowRiskArchiveAllowed: boolean;
  approvalInterruptsCreated: number;
  transitionLanes: ProfileImprovementLane[];
  notes: string[];
};

export type SkillCuratorRunReport = {
  contractVersion: SkillCuratorState['contractVersion'];
  id: string;
  dryRun: boolean;
  reason: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  config: {
    intervalHours: number;
    minIdleHours: number;
    staleAfterDays: number;
    archiveAfterDays: number;
  };
  transitions: SkillCuratorTransition[];
  autonomy: SkillCuratorAutonomyReport;
  auxiliaryReview: {
    mode: 'local-heuristic' | 'zavorth-live-loop';
    consolidationCandidates: SkillCuratorConsolidationCandidate[];
    proposals: Array<{
      id: string;
      kind: string;
      title: string;
      skillIds: string[];
      risk: string;
      confidence: number;
    }>;
    notes: string[];
  };
  llmReview: SkillCuratorLlmReview;
  summary: string;
};

export type SkillCuratorLlmReview = {
  enabled: boolean;
  status: 'disabled' | 'skipped' | 'completed' | 'failed';
  providerName: string | null;
  modelName: string | null;
  summary: string | null;
  recommendations: Array<{
    title: string;
    rationale: string;
    affectedSkillIds: string[];
    priority: 'low' | 'medium' | 'high';
  }>;
  risks: string[];
  notes: string[];
  error: string | null;
};

export type SkillCuratorStatus = {
  contractVersion: SkillCuratorState['contractVersion'];
  enabled: boolean;
  paused: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunDurationSeconds: number | null;
  lastRunSummary: string | null;
  lastReportPath: string | null;
  runCount: number;
  config: SkillCuratorRunReport['config'];
  autonomy: SkillCuratorAutonomyReport;
  stats: {
    total: number;
    managed: number;
    active: number;
    stale: number;
    archived: number;
    pinned: number;
  };
  pinned: string[];
  leastActive: Array<{ skillId: string; useCount: number; lastExecutedAt: string | null }>;
  mostActive: Array<{ skillId: string; useCount: number; lastExecutedAt: string | null }>;
  skills: Array<{
    id: string;
    description: string | null;
    sourceId: string | null;
    imported: boolean;
    managed: boolean;
    state: SkillCuratorLifecycleState;
    pinned: boolean;
    useCount: number;
    lastExecutedAt: string | null;
    reason: string | null;
  }>;
};

type TelemetryRow = {
  skill_id: string;
  use_count: number | null;
  last_executed_at: string | null;
  status: 'active' | 'archived';
  pinned: number | null;
};

type CuratorDatabase = Pick<Database, 'all' | 'run'>;

type SkillCuratorPlaneRuntime = {
  catalogService?: Pick<SkillCatalogService, 'listEntries'>;
  curationService?: Pick<
    SkillCurationService,
    'archiveSkill' | 'restoreSkill' | 'togglePin' | 'listArchivedSkills'
  >;
  proposalReviewer?: Pick<ZavorthSkillCuratorLiveLoopService, 'buildSnapshot'> | null;
  llmRuntime?: Pick<LlmRuntimeService, 'chatDetailed' | 'isProviderAvailable'> | null;
  database?: CuratorDatabase;
  databaseProvider?: () => Promise<CuratorDatabase>;
  stateFilePath?: string;
  reportsDir?: string;
  now?: () => Date;
  enabled?: boolean;
  intervalHours?: number;
  minIdleHours?: number;
  staleAfterDays?: number;
  archiveAfterDays?: number;
  llmReviewEnabled?: boolean;
  llmProviderName?: string;
  llmModelName?: string;
  llmMaxProposals?: number;
  profileBundle?: Pick<ProfileRuntimeBundle, 'id' | 'improvementPolicy'> | null;
  profileId?: string | null;
  improvementPolicy?: ProfileImprovementPolicy | null;
};

type SkillCuratorRunOptions = {
  dryRun?: boolean;
  reason?: string;
  triggeredBy?: string;
  idleForSeconds?: number;
  llmReview?: boolean;
};

const CONTRACT_VERSION = '2026-05-31.zavorth.skill-curator-plane.v1' as const;

const DEFAULT_IMPROVEMENT_POLICY: ProfileImprovementPolicy = {
  mode: 'quiet-staging',
  silent: ['telemetry', 'ranking', 'metadata', 'candidate', 'staging_diff', 'sandbox_validation'],
  notify: ['draft_skill', 'low_risk_archive'],
  requireApproval: ['apply', 'policy', 'provider', 'channel', 'secret', 'external_send', 'host_mutation'],
  maxSilentRisk: 'low',
  interruptMode: 'daily-digest',
};

export class SkillCuratorPlaneService {
  private readonly catalogService: Pick<SkillCatalogService, 'listEntries'>;
  private readonly curationService: Pick<
    SkillCurationService,
    'archiveSkill' | 'restoreSkill' | 'togglePin' | 'listArchivedSkills'
  >;
  private readonly proposalReviewer: Pick<ZavorthSkillCuratorLiveLoopService, 'buildSnapshot'> | null;
  private readonly llmRuntime: Pick<LlmRuntimeService, 'chatDetailed' | 'isProviderAvailable'> | null;
  private readonly database?: CuratorDatabase;
  private readonly databaseProvider?: () => Promise<CuratorDatabase>;
  private readonly stateFilePath: string;
  private readonly reportsDir: string;
  private readonly now: () => Date;
  private readonly enabled: boolean;
  private readonly intervalHours: number;
  private readonly minIdleHours: number;
  private readonly staleAfterDays: number;
  private readonly archiveAfterDays: number;
  private readonly llmReviewEnabled: boolean;
  private readonly llmProviderName: string;
  private readonly llmModelName: string;
  private readonly llmMaxProposals: number;
  private readonly profileId: string | null;
  private readonly improvementPolicy: ProfileImprovementPolicy;

  constructor(runtime: SkillCuratorPlaneRuntime = {}) {
    const catalogService = runtime.catalogService || new SkillCatalogService();
    this.catalogService = catalogService;
    this.curationService = runtime.curationService || new SkillCurationService(catalogService as SkillCatalogService);
    this.proposalReviewer = runtime.proposalReviewer === undefined
      ? (process.env.NODE_ENV === 'test' ? null : new ZavorthSkillCuratorLiveLoopService())
      : runtime.proposalReviewer;
    this.llmReviewEnabled = runtime.llmReviewEnabled ?? config.skillsCuratorLlmReviewEnabled;
    this.llmProviderName = runtime.llmProviderName || config.skillsCuratorLlmProvider || '';
    this.llmModelName = runtime.llmModelName || config.skillsCuratorLlmModel || '';
    this.llmMaxProposals = Math.max(1, runtime.llmMaxProposals || config.skillsCuratorLlmMaxProposals || 12);
    this.llmRuntime = runtime.llmRuntime === undefined
      ? (this.llmReviewEnabled ? new LlmRuntimeService(this.llmProviderName || undefined) : null)
      : runtime.llmRuntime;
    this.database = runtime.database;
    this.databaseProvider = runtime.databaseProvider;
    this.stateFilePath = runtime.stateFilePath || config.skillsCuratorStateFile;
    this.reportsDir = runtime.reportsDir || config.skillsCuratorReportsDir;
    this.now = runtime.now || (() => new Date());
    this.enabled = runtime.enabled ?? config.skillsCurationEnabled;
    this.intervalHours = runtime.intervalHours ?? config.skillsCuratorIntervalHours;
    this.minIdleHours = runtime.minIdleHours ?? config.skillsCuratorMinIdleHours;
    this.staleAfterDays = runtime.staleAfterDays ?? config.skillsCuratorStaleAfterDays;
    this.archiveAfterDays = runtime.archiveAfterDays ?? config.skillsCuratorArchiveAfterDays;
    this.profileId = runtime.profileBundle?.id || runtime.profileId || null;
    this.improvementPolicy = normalizeImprovementPolicy(
      runtime.improvementPolicy || runtime.profileBundle?.improvementPolicy || DEFAULT_IMPROVEMENT_POLICY,
    );
  }

  public async status(): Promise<SkillCuratorStatus> {
    const [state, telemetryRows, archivedSkills] = await Promise.all([
      this.loadState(),
      this.listTelemetry(),
      this.curationService.listArchivedSkills(),
    ]);
    const entries = this.catalogService.listEntries();
    const telemetry = new Map(telemetryRows.map((row) => [row.skill_id, row]));
    const archivedIds = new Set(archivedSkills.map((entry) => entry.skillId));
    const archivedOnly = archivedSkills
      .filter((entry) => !entries.some((skill) => skill.name === entry.skillId))
      .map((entry) => ({
        name: entry.skillId,
        description: 'Archived skill.',
        sourceId: null,
        imported: true,
      }));

    const skillRows = [...entries, ...archivedOnly].map((entry) => {
      const row = telemetry.get(entry.name);
      const lifecycle = this.resolveLifecycleState(entry.name, row, state, archivedIds);
      return {
        id: entry.name,
        description: entry.description || null,
        sourceId: entry.sourceId || null,
        imported: entry.imported === true,
        managed: this.isManagedSkill(entry),
        state: lifecycle,
        pinned: row?.pinned === 1,
        useCount: row?.use_count || 0,
        lastExecutedAt: row?.last_executed_at || null,
        reason: state.skillStates[entry.name]?.reason || null,
      };
    });

    const usageRows = skillRows.map((entry) => ({
      skillId: entry.id,
      useCount: entry.useCount,
      lastExecutedAt: entry.lastExecutedAt,
    }));

    return {
      contractVersion: CONTRACT_VERSION,
      enabled: state.enabled,
      paused: state.paused,
      nextRunAt: this.nextRunAt(state),
      lastRunAt: state.lastRunAt,
      lastRunDurationSeconds: state.lastRunDurationSeconds,
      lastRunSummary: state.lastRunSummary,
      lastReportPath: state.lastReportPath,
      runCount: state.runCount,
      config: this.curatorConfig(),
      autonomy: this.buildAutonomyReport({
        dryRun: this.shouldDryRunForScheduledRun(),
        triggeredBy: 'status',
        transitions: [],
      }),
      stats: {
        total: skillRows.length,
        managed: skillRows.filter((entry) => entry.managed).length,
        active: skillRows.filter((entry) => entry.state === 'active').length,
        stale: skillRows.filter((entry) => entry.state === 'stale').length,
        archived: skillRows.filter((entry) => entry.state === 'archived').length,
        pinned: skillRows.filter((entry) => entry.pinned).length,
      },
      pinned: skillRows.filter((entry) => entry.pinned).map((entry) => entry.id).sort(),
      leastActive: usageRows
        .slice()
        .sort((left, right) => this.compareActivity(left, right))
        .slice(0, 5),
      mostActive: usageRows
        .slice()
        .sort((left, right) => this.compareActivity(right, left))
        .slice(0, 5),
      skills: skillRows.sort((left, right) => left.id.localeCompare(right.id, 'en-US')),
    };
  }

  public async runCuratorReview(options: SkillCuratorRunOptions = {}): Promise<SkillCuratorRunReport> {
    const startedAt = this.now();
    const startedMs = startedAt.getTime();
    const state = await this.loadState();
    const dryRun = options.dryRun === true;
    const transitions = await this.applyAutomaticTransitions(state, dryRun);
    const autonomy = this.buildAutonomyReport({
      dryRun,
      triggeredBy: options.triggeredBy || 'operator',
      transitions,
    });
    const activeManagedSkills = this.catalogService.listEntries().filter((entry) => this.isManagedSkill(entry));
    const auxiliaryReview = this.buildAuxiliaryReview(activeManagedSkills);
    const llmReview = await this.buildLlmReview({
      enabled: options.llmReview ?? this.llmReviewEnabled,
      dryRun,
      transitions,
      activeManagedSkills,
      auxiliaryReview,
    });
    const finishedAt = this.now();
    const durationSeconds = Math.max(0, (finishedAt.getTime() - startedMs) / 1000);
    const summary = this.summarizeRun(
      dryRun,
      transitions,
      auxiliaryReview.consolidationCandidates.length,
      llmReview.status,
    );
    const id = this.reportId(startedAt);
    const report: SkillCuratorRunReport = {
      contractVersion: CONTRACT_VERSION,
      id,
      dryRun,
      reason: options.reason || 'manual',
      triggeredBy: options.triggeredBy || 'operator',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationSeconds,
      config: this.curatorConfig(),
      transitions,
      autonomy,
      auxiliaryReview,
      llmReview,
      summary,
    };

    const reportPath = await this.writeReport(report);
    state.enabled = this.enabled;
    state.lastRunAt = finishedAt.toISOString();
    state.lastRunDurationSeconds = durationSeconds;
    state.lastRunSummary = summary;
    state.lastReportPath = reportPath;
    state.runCount += 1;
    if (!state.seededAt) state.seededAt = startedAt.toISOString();
    await this.saveState(state);
    return { ...report, summary: `${summary} Report: ${reportPath}` };
  }

  public async maybeRunCurator(options: SkillCuratorRunOptions = {}): Promise<{
    ran: boolean;
    reason: string;
    report?: SkillCuratorRunReport;
  }> {
    const state = await this.loadState();
    if (!state.enabled) return { ran: false, reason: 'disabled' };
    if (state.paused) return { ran: false, reason: 'paused' };
    if ((options.idleForSeconds ?? Number.POSITIVE_INFINITY) < this.minIdleHours * 3600) {
      return { ran: false, reason: 'not-idle-enough' };
    }
    if (!state.lastRunAt) {
      state.seededAt = this.now().toISOString();
      state.lastRunAt = state.seededAt;
      state.lastRunSummary = 'Curator seeded; first automatic run waits one full interval.';
      await this.saveState(state);
      return { ran: false, reason: 'seeded' };
    }
    const nextRunAt = this.nextRunAt(state);
    if (nextRunAt && this.now().getTime() < new Date(nextRunAt).getTime()) {
      return { ran: false, reason: 'interval-not-reached' };
    }
    const report = await this.runCuratorReview({
      ...options,
      dryRun: options.dryRun ?? this.shouldDryRunForScheduledRun(),
      reason: options.reason || 'scheduled',
      triggeredBy: options.triggeredBy || 'runtime-maintenance',
    });
    return { ran: true, reason: 'ran', report };
  }

  public async pause(): Promise<SkillCuratorState> {
    const state = await this.loadState();
    state.paused = true;
    await this.saveState(state);
    return state;
  }

  public async resume(): Promise<SkillCuratorState> {
    const state = await this.loadState();
    state.paused = false;
    await this.saveState(state);
    return state;
  }

  public async togglePin(skillId: string, pinned: boolean): Promise<void> {
    await this.curationService.togglePin(skillId, pinned);
  }

  public async archiveSkill(skillId: string): Promise<void> {
    await this.curationService.archiveSkill(skillId);
    const state = await this.loadState();
    state.skillStates[skillId] = {
      state: 'archived',
      markedAt: this.now().toISOString(),
      reason: 'archived-by-operator',
    };
    await this.saveState(state);
  }

  public async restoreSkill(skillId: string): Promise<void> {
    await this.curationService.restoreSkill(skillId);
    const state = await this.loadState();
    state.skillStates[skillId] = {
      state: 'active',
      markedAt: this.now().toISOString(),
      reason: 'restored-by-operator',
    };
    await this.saveState(state);
  }

  private async applyAutomaticTransitions(
    state: SkillCuratorState,
    dryRun: boolean,
  ): Promise<SkillCuratorTransition[]> {
    const db = await this.getDatabase();
    const now = this.now();
    const transitions: SkillCuratorTransition[] = [];
    const telemetryRows = await this.listTelemetry();
    const telemetry = new Map(telemetryRows.map((row) => [row.skill_id, row]));
    const managedEntries = this.catalogService.listEntries().filter((entry) => this.isManagedSkill(entry));

    for (const entry of managedEntries) {
      const existing = telemetry.get(entry.name);
      if (!existing && !dryRun) {
        db.run(
          `INSERT OR IGNORE INTO zavorth_skills_telemetry (skill_id, use_count, last_executed_at, status, pinned)
           VALUES (?, 0, ?, 'active', 0)`,
          [entry.name, now.toISOString()],
        );
      }
      const row = existing || {
        skill_id: entry.name,
        use_count: 0,
        last_executed_at: now.toISOString(),
        status: 'active' as const,
        pinned: 0,
      };
      if (row.pinned === 1 || row.status === 'archived') continue;

      const lastActivity = row.last_executed_at ? new Date(row.last_executed_at) : now;
      const ageDays = (now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
      const currentState = state.skillStates[entry.name]?.state || 'active';

      if (ageDays >= this.archiveAfterDays) {
        transitions.push({
          skillId: entry.name,
          from: currentState,
          to: 'archived',
          reason: `inactive-for-${Math.floor(ageDays)}-days`,
          dryRun,
        });
        if (!dryRun) {
          await this.curationService.archiveSkill(entry.name);
          state.skillStates[entry.name] = {
            state: 'archived',
            markedAt: now.toISOString(),
            reason: 'automatic-archive',
          };
        }
        continue;
      }

      if (ageDays >= this.staleAfterDays && currentState !== 'stale') {
        transitions.push({
          skillId: entry.name,
          from: currentState,
          to: 'stale',
          reason: `inactive-for-${Math.floor(ageDays)}-days`,
          dryRun,
        });
        if (!dryRun) {
          state.skillStates[entry.name] = {
            state: 'stale',
            markedAt: now.toISOString(),
            reason: 'automatic-stale',
          };
        }
        continue;
      }

      if (ageDays < this.staleAfterDays && currentState === 'stale') {
        transitions.push({
          skillId: entry.name,
          from: 'stale',
          to: 'active',
          reason: 'recent-activity',
          dryRun,
        });
        if (!dryRun) {
          state.skillStates[entry.name] = {
            state: 'active',
            markedAt: now.toISOString(),
            reason: 'automatic-reactivation',
          };
        }
      }
    }

    if (!dryRun) {
      await this.saveState(state);
    }
    return transitions;
  }

  private buildAuxiliaryReview(entries: SkillCatalogEntry[]): SkillCuratorRunReport['auxiliaryReview'] {
    if (this.proposalReviewer) {
      const snapshot = this.proposalReviewer.buildSnapshot({
        includeImported: true,
        includeWorkspace: true,
        maxSkills: 500,
      });
      return this.buildAuxiliaryReviewFromLiveLoop(snapshot);
    }

    const buckets = new Map<string, string[]>();
    for (const entry of entries) {
      const topic = this.skillTopic(entry.name);
      const list = buckets.get(topic) || [];
      list.push(entry.name);
      buckets.set(topic, list);
    }
    const consolidationCandidates = Array.from(buckets.entries())
      .filter(([, skillIds]) => skillIds.length >= 3)
      .map(([topic, skillIds]) => ({
        topic,
        skillIds: skillIds.slice().sort((left, right) => left.localeCompare(right, 'en-US')),
        recommendation: `Review ${skillIds.length} related skills for an umbrella skill or shared reference docs.`,
      }))
      .sort((left, right) => right.skillIds.length - left.skillIds.length)
      .slice(0, 8);

    return {
      mode: 'local-heuristic',
      consolidationCandidates,
      proposals: [],
      notes: [
        'Only curator-managed, non-native skills are reviewed.',
        'Automatic cleanup archives or marks stale; consolidation recommendations remain preview-only.',
      ],
    };
  }

  private buildAuxiliaryReviewFromLiveLoop(snapshot: ZavorthSkillCuratorSnapshot): SkillCuratorRunReport['auxiliaryReview'] {
    const proposals = snapshot.proposals.map((proposal) => ({
      id: proposal.id,
      kind: proposal.kind,
      title: proposal.title,
      skillIds: proposal.skillIds,
      risk: proposal.risk,
      confidence: proposal.confidence,
    }));
    const consolidationCandidates = proposals
      .filter((proposal) => proposal.kind === 'merge-candidates' || proposal.kind === 'promote-umbrella')
      .map((proposal) => ({
        topic: proposal.id,
        skillIds: proposal.skillIds,
        recommendation: proposal.title,
      }));

    return {
      mode: 'zavorth-live-loop',
      consolidationCandidates,
      proposals,
      notes: [
        `Live-loop curator status: ${snapshot.status}.`,
        'Patch previews, rollback plans and approval ids stay owned by zavorth skill-curator.',
        'Lifecycle cleanup remains limited to non-native curator-managed skills.',
      ],
    };
  }

  private async buildLlmReview(input: {
    enabled: boolean;
    dryRun: boolean;
    transitions: SkillCuratorTransition[];
    activeManagedSkills: SkillCatalogEntry[];
    auxiliaryReview: SkillCuratorRunReport['auxiliaryReview'];
  }): Promise<SkillCuratorLlmReview> {
    if (!input.enabled) {
      return this.emptyLlmReview('disabled');
    }
    if (!this.llmRuntime) {
      return {
        ...this.emptyLlmReview('skipped'),
        notes: ['LLM review requested, but no LLM runtime is configured for the curator plane.'],
      };
    }
    if (this.llmProviderName && !this.llmRuntime.isProviderAvailable(this.llmProviderName)) {
      return {
        ...this.emptyLlmReview('skipped'),
        providerName: this.llmProviderName,
        modelName: this.llmModelName || null,
        notes: [`Provider ${this.llmProviderName} is not available for curator LLM review.`],
      };
    }

    try {
      const payload = this.buildLlmReviewPayload(input);
      const result = await this.llmRuntime.chatDetailed([
        {
          role: 'system',
          content: [
            'You are Zavorth Skill Curator Reviewer.',
            'Analyze skill lifecycle proposals only. Do not request file writes, shell commands, network calls, or direct mutation.',
            'Return compact JSON with keys: summary, recommendations, risks, notes.',
            'Each recommendation must include title, rationale, affectedSkillIds, priority.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify(payload, null, 2),
        },
      ], undefined, {
        providerName: this.llmProviderName || undefined,
        modelName: this.llmModelName || undefined,
        allowFallback: true,
        telemetry: {
          surface: 'skill-curator-llm-review',
        },
      });
      const parsed = this.parseLlmReviewContent(result.response.content || '');
      return {
        enabled: true,
        status: 'completed',
        providerName: result.providerName,
        modelName: result.modelName,
        summary: parsed.summary,
        recommendations: parsed.recommendations,
        risks: parsed.risks,
        notes: [
          ...parsed.notes,
          'LLM review is advisory only; live-loop proposals and mutation gates remain authoritative.',
        ],
        error: null,
      };
    } catch (error) {
      return {
        ...this.emptyLlmReview('failed'),
        providerName: this.llmProviderName || null,
        modelName: this.llmModelName || null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildLlmReviewPayload(input: {
    dryRun: boolean;
    transitions: SkillCuratorTransition[];
    activeManagedSkills: SkillCatalogEntry[];
    auxiliaryReview: SkillCuratorRunReport['auxiliaryReview'];
  }): Record<string, unknown> {
    return {
      contract: 'zavorth-skill-curator-llm-review-input/1',
      dryRun: input.dryRun,
      safetyRules: [
        'advisory-only',
        'no direct mutation',
        'no shell commands',
        'no secrets',
        'human or policy approval required for changes',
      ],
      lifecycleTransitions: input.transitions.slice(0, this.llmMaxProposals).map((entry) => ({
        skillId: this.safeForLlm(entry.skillId),
        from: entry.from,
        to: entry.to,
        reason: this.safeForLlm(entry.reason),
        dryRun: entry.dryRun,
      })),
      liveLoop: {
        mode: input.auxiliaryReview.mode,
        proposals: input.auxiliaryReview.proposals.slice(0, this.llmMaxProposals).map((proposal) => ({
          id: this.safeForLlm(proposal.id),
          kind: proposal.kind,
          title: this.safeForLlm(proposal.title),
          skillIds: proposal.skillIds.map((skillId) => this.safeForLlm(skillId)),
          risk: proposal.risk,
          confidence: proposal.confidence,
        })),
        consolidationCandidates: input.auxiliaryReview.consolidationCandidates.slice(0, this.llmMaxProposals).map((candidate) => ({
          topic: this.safeForLlm(candidate.topic),
          skillIds: candidate.skillIds.map((skillId) => this.safeForLlm(skillId)),
          recommendation: this.safeForLlm(candidate.recommendation),
        })),
      },
      managedSkills: input.activeManagedSkills.slice(0, 60).map((entry) => ({
        name: this.safeForLlm(entry.name),
        description: this.safeForLlm(entry.description).slice(0, 300),
        sourceId: this.safeForLlm(entry.sourceId || ''),
        imported: entry.imported === true,
        bundleTags: (Array.isArray(entry.bundleTags) ? entry.bundleTags : []).slice(0, 8).map((tag) => this.safeForLlm(tag)),
        riskLevel: entry.risk?.level || null,
        licensePolicy: entry.licensePolicy?.label || null,
      })),
    };
  }

  private parseLlmReviewContent(content: string): Pick<
    SkillCuratorLlmReview,
    'summary' | 'recommendations' | 'risks' | 'notes'
  > {
    const jsonText = extractJsonObject(content);
    const parsed = jsonText ? JSON.parse(jsonText) as Record<string, unknown> : {};
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, this.llmMaxProposals).map((entry) => {
        const item = entry as Record<string, unknown>;
        return {
          title: this.safeForLlm(String(item.title || 'Review curator proposal')),
          rationale: this.safeForLlm(String(item.rationale || item.reason || 'No rationale provided.')),
          affectedSkillIds: Array.isArray(item.affectedSkillIds)
            ? item.affectedSkillIds.slice(0, 12).map((skillId) => this.safeForLlm(String(skillId)))
            : [],
          priority: normalizePriority(String(item.priority || 'medium')),
        };
      })
      : [];
    return {
      summary: this.safeForLlm(String(parsed.summary || content || 'LLM review completed.')).slice(0, 1000),
      recommendations,
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.slice(0, 12).map((risk) => this.safeForLlm(String(risk)))
        : [],
      notes: Array.isArray(parsed.notes)
        ? parsed.notes.slice(0, 12).map((note) => this.safeForLlm(String(note)))
        : [],
    };
  }

  private emptyLlmReview(status: SkillCuratorLlmReview['status']): SkillCuratorLlmReview {
    return {
      enabled: status !== 'disabled',
      status,
      providerName: null,
      modelName: null,
      summary: null,
      recommendations: [],
      risks: [],
      notes: [],
      error: null,
    };
  }

  private async loadState(): Promise<SkillCuratorState> {
    try {
      const raw = await fs.readFile(this.stateFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SkillCuratorState>;
      return {
        ...this.defaultState(),
        ...parsed,
        enabled: this.enabled,
        skillStates: parsed.skillStates && typeof parsed.skillStates === 'object' ? parsed.skillStates : {},
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      return this.defaultState();
    }
  }

  private async saveState(state: SkillCuratorState): Promise<void> {
    await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true });
    const tmpFile = `${this.stateFilePath}.${process.pid}.tmp`;
    await fs.writeFile(tmpFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await fs.rename(tmpFile, this.stateFilePath);
  }

  private defaultState(): SkillCuratorState {
    return {
      contractVersion: CONTRACT_VERSION,
      enabled: this.enabled,
      paused: false,
      lastRunAt: null,
      lastRunDurationSeconds: null,
      lastRunSummary: null,
      lastRunSummaryShownAt: null,
      lastReportPath: null,
      runCount: 0,
      seededAt: null,
      skillStates: {},
    };
  }

  private async writeReport(report: SkillCuratorRunReport): Promise<string> {
    const reportDir = path.join(this.reportsDir, report.id);
    await fs.mkdir(reportDir, { recursive: true });
    const jsonFile = path.join(reportDir, 'run.json');
    const markdownFile = path.join(reportDir, 'REPORT.md');
    await fs.writeFile(jsonFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await fs.writeFile(markdownFile, this.renderMarkdownReport(report), 'utf8');
    return markdownFile;
  }

  private renderMarkdownReport(report: SkillCuratorRunReport): string {
    const transitionLines = report.transitions.length
      ? report.transitions.map((entry) => `- ${entry.skillId}: ${entry.from} -> ${entry.to} (${entry.reason})`)
      : ['- No lifecycle transitions.'];
    const consolidationLines = report.auxiliaryReview.consolidationCandidates.length
      ? report.auxiliaryReview.consolidationCandidates.map((entry) => `- ${entry.topic}: ${entry.skillIds.join(', ')}`)
      : ['- No consolidation candidates.'];
    const llmLines = report.llmReview.status === 'completed'
      ? [
        `- summary: ${report.llmReview.summary || 'completed'}`,
        `- provider: ${report.llmReview.providerName || 'unknown'}${report.llmReview.modelName ? `/${report.llmReview.modelName}` : ''}`,
        ...(
          report.llmReview.recommendations.length
            ? report.llmReview.recommendations.map((entry) => `- ${entry.priority}: ${entry.title} (${entry.affectedSkillIds.join(', ') || 'no explicit skill'})`)
            : ['- No LLM recommendations.']
        ),
      ]
      : [`- ${report.llmReview.status}${report.llmReview.error ? `: ${report.llmReview.error}` : ''}`];
    const autonomyLines = [
      `- profile: ${report.autonomy.profileId || 'default'}`,
      `- mode: ${report.autonomy.mode}`,
      `- scheduledRunMode: ${report.autonomy.scheduledRunMode}`,
      `- interruptMode: ${report.autonomy.interruptMode}`,
      `- lowRiskArchiveAllowed: ${String(report.autonomy.lowRiskArchiveAllowed)}`,
      `- approvalInterruptsCreated: ${String(report.autonomy.approvalInterruptsCreated)}`,
      ...report.autonomy.notes.map((note) => `- ${note}`),
    ];
    return [
      `# Zavorth Skill Curator Report`,
      '',
      `- id: ${report.id}`,
      `- dryRun: ${String(report.dryRun)}`,
      `- triggeredBy: ${report.triggeredBy}`,
      `- summary: ${report.summary}`,
      '',
      '## Autonomy policy',
      ...autonomyLines,
      '',
      '## Lifecycle transitions',
      ...transitionLines,
      '',
      '## Auxiliary consolidation review',
      ...consolidationLines,
      '',
      '## LLM advisory review',
      ...llmLines,
      '',
    ].join('\n');
  }

  private async listTelemetry(): Promise<TelemetryRow[]> {
    const db = await this.getDatabase();
    return db.all<TelemetryRow>(`SELECT * FROM zavorth_skills_telemetry`);
  }

  private async getDatabase(): Promise<CuratorDatabase> {
    if (this.database) return this.database;
    if (this.databaseProvider) return this.databaseProvider();
    return Database.getInstance();
  }

  private isManagedSkill(entry: Pick<SkillCatalogEntry, 'sourceId' | 'imported'> | { sourceId: string | null; imported: boolean }): boolean {
    if (entry.sourceId === 'zavorth-native') return false;
    return entry.imported === true || Boolean(entry.sourceId && entry.sourceId !== 'zavorth-native');
  }

  private resolveLifecycleState(
    skillId: string,
    row: TelemetryRow | undefined,
    state: SkillCuratorState,
    archivedIds: Set<string>,
  ): SkillCuratorLifecycleState {
    if (row?.status === 'archived' || archivedIds.has(skillId)) return 'archived';
    return state.skillStates[skillId]?.state === 'stale' ? 'stale' : 'active';
  }

  private nextRunAt(state: SkillCuratorState): string | null {
    if (!state.lastRunAt) return null;
    return new Date(new Date(state.lastRunAt).getTime() + this.intervalHours * 60 * 60 * 1000).toISOString();
  }

  private curatorConfig(): SkillCuratorRunReport['config'] {
    return {
      intervalHours: this.intervalHours,
      minIdleHours: this.minIdleHours,
      staleAfterDays: this.staleAfterDays,
      archiveAfterDays: this.archiveAfterDays,
    };
  }

  private shouldDryRunForScheduledRun(): boolean {
    if (this.improvementPolicy.mode === 'manual') return true;
    return !this.lowRiskArchiveAllowed();
  }

  private lowRiskArchiveAllowed(): boolean {
    return this.improvementPolicy.silent.includes('low_risk_archive')
      && !this.improvementPolicy.requireApproval.includes('low_risk_archive')
      && this.improvementPolicy.mode !== 'manual';
  }

  private buildAutonomyReport(input: {
    dryRun: boolean;
    triggeredBy: string;
    transitions: SkillCuratorTransition[];
  }): SkillCuratorAutonomyReport {
    const transitionLanes = unique(
      input.transitions.map((entry) => this.transitionLane(entry)),
    ) as ProfileImprovementLane[];
    const lowRiskArchiveAllowed = this.lowRiskArchiveAllowed();
    const scheduledRunMode = this.improvementPolicy.mode === 'manual'
      ? 'manual-dry-run'
      : input.dryRun
        ? 'silent-dry-run'
        : 'silent-apply-reversible';
    const backgroundOnly = !['operator', 'manual', 'test'].includes(input.triggeredBy);
    const actor = backgroundOnly ? 'Background curator' : 'Curator review';
    const approvalLanes = transitionLanes.filter((lane) => this.improvementPolicy.requireApproval.includes(lane));
    const notes = [
      input.dryRun
        ? `${actor} prepared a reversible report without mutating skills.`
        : `${actor} applied only reversible low-risk lifecycle transitions.`,
      'No approval dialog is created from background curation; risky work is held for operator review or digest.',
    ];
    if (approvalLanes.length > 0) {
      notes.push(`Transitions requiring approval were left as report-only lanes: ${approvalLanes.join(', ')}.`);
    }
    if (this.improvementPolicy.interruptMode === 'never-for-low-risk') {
      notes.push('Low-risk improvement notifications are suppressed for this profile.');
    } else if (this.improvementPolicy.interruptMode === 'daily-digest') {
      notes.push('Non-urgent improvement notifications are folded into the daily/status digest.');
    } else {
      notes.push('This profile allows immediate operator interruption for approval-gated improvement work.');
    }

    return {
      profileId: this.profileId,
      mode: this.improvementPolicy.mode,
      silent: this.improvementPolicy.silent,
      notify: this.improvementPolicy.notify,
      requireApproval: this.improvementPolicy.requireApproval,
      maxSilentRisk: this.improvementPolicy.maxSilentRisk,
      interruptMode: this.improvementPolicy.interruptMode,
      scheduledRunMode,
      backgroundOnly,
      lowRiskArchiveAllowed,
      approvalInterruptsCreated: 0,
      transitionLanes,
      notes,
    };
  }

  private transitionLane(transition: SkillCuratorTransition): ProfileImprovementLane {
    if (transition.to === 'archived') return 'low_risk_archive';
    return 'metadata';
  }

  private reportId(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-');
  }

  private summarizeRun(
    dryRun: boolean,
    transitions: SkillCuratorTransition[],
    consolidationCandidateCount: number,
    llmReviewStatus: SkillCuratorLlmReview['status'],
  ): string {
    const prefix = dryRun ? 'Dry-run prepared' : 'Curator completed';
    return `${prefix}: ${transitions.length} lifecycle transition(s), ${consolidationCandidateCount} consolidation candidate(s), LLM review ${llmReviewStatus}.`;
  }

  private compareActivity(
    left: { useCount: number; lastExecutedAt: string | null },
    right: { useCount: number; lastExecutedAt: string | null },
  ): number {
    if (left.useCount !== right.useCount) return left.useCount - right.useCount;
    return this.activityTime(left.lastExecutedAt) - this.activityTime(right.lastExecutedAt);
  }

  private activityTime(value: string | null): number {
    return value ? new Date(value).getTime() : 0;
  }

  private skillTopic(skillId: string): string {
    const normalized = skillId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return normalized.split('-').filter(Boolean)[0] || 'misc';
  }

  private safeForLlm(value: string): string {
    return redactSensitiveText(String(value || '')).replace(/\s+/g, ' ').trim();
  }
}

function extractJsonObject(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate;
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : null;
}

function normalizePriority(value: string): 'low' | 'medium' | 'high' {
  const normalized = value.toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'low') return 'low';
  return 'medium';
}

function normalizeImprovementPolicy(policy: ProfileImprovementPolicy): ProfileImprovementPolicy {
  return {
    mode: policy.mode || DEFAULT_IMPROVEMENT_POLICY.mode,
    silent: unique(policy.silent || DEFAULT_IMPROVEMENT_POLICY.silent) as ProfileImprovementLane[],
    notify: unique(policy.notify || DEFAULT_IMPROVEMENT_POLICY.notify) as ProfileImprovementLane[],
    requireApproval: unique(policy.requireApproval || DEFAULT_IMPROVEMENT_POLICY.requireApproval) as ProfileImprovementLane[],
    maxSilentRisk: policy.maxSilentRisk || DEFAULT_IMPROVEMENT_POLICY.maxSilentRisk,
    interruptMode: policy.interruptMode || DEFAULT_IMPROVEMENT_POLICY.interruptMode,
  };
}

function unique<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values.map((entry) => String(entry || '').trim()).filter(Boolean) as T[]));
}
