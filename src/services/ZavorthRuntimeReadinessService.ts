import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/index.js';
import type { ZavorthProviderReadinessMatrixSnapshot } from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import type { ZavorthDashboardExperienceHomeSnapshot } from '../contracts/ZavorthDashboardExperienceHomeContract.js';
import type { ZavorthApprovalActionCardsUxSnapshot } from '../contracts/ZavorthApprovalActionCardsUxContract.js';
import type { ZavorthTransactionLiveExecutorGateContractSnapshot } from '../contracts/ZavorthTransactionLiveExecutorGateContract.js';
import type { ZavorthMemoryPlaneSnapshot } from './ZavorthMemoryPlaneService.js';
import { NaturalFirstRunClassifier } from '../runtime/agent/NaturalFirstRunClassifier.js';
import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';
import { ZavorthDashboardExperienceHomeService } from './ZavorthDashboardExperienceHomeService.js';
import { ZavorthApprovalActionCardsUxService } from './ZavorthApprovalActionCardsUxService.js';
import { ZavorthTransactionLiveExecutorGateService } from './ZavorthTransactionLiveExecutorGateService.js';
import { ZavorthMemoryPlaneService } from './ZavorthMemoryPlaneService.js';
import { SkillSourceRegistryService, type SkillSourceRegistryDocument } from './SkillSourceRegistryService.js';

export const ZAVORTH_RUNTIME_READINESS_CONTRACT_VERSION = 'zavorth-runtime-readiness/1' as const;

export type ZavorthRuntimeReadinessStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthRuntimeReadinessCheckId =
  | 'natural-first-runtime'
  | 'provider-mesh'
  | 'dashboard'
  | 'telegram'
  | 'approvals'
  | 'transaction-plane'
  | 'skill-imports'
  | 'memory-continuity';

export type ZavorthRuntimeReadinessCheck = {
  id: ZavorthRuntimeReadinessCheckId;
  label: string;
  status: ZavorthRuntimeReadinessStatus;
  required: boolean;
  summary: string;
  evidence: string[];
  command: string;
  nextAction: string;
};

export type ZavorthRuntimeReadinessSnapshot = {
  contractVersion: typeof ZAVORTH_RUNTIME_READINESS_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'runtime-readiness';
  generatedAt: string;
  status: ZavorthRuntimeReadinessStatus;
  dailyUseReady: boolean;
  summary: {
    ready: number;
    attention: number;
    blocked: number;
    requiredBlocked: number;
    providerOk: boolean;
    dashboardOk: boolean;
    telegramOk: boolean;
    approvalsOk: boolean;
    transactionPlaneSafe: boolean;
    skillsBlockedByDefault: boolean;
    memoryReady: boolean;
    naturalFirstReady: boolean;
  };
  checks: ZavorthRuntimeReadinessCheck[];
  operator: {
    primaryCommand: 'zavorth readiness';
    jsonCommand: 'zavorth readiness --json';
    dailyCommand: 'zavorth daily';
    dashboardRoute: '/dashboard';
    safeStartupCommand: 'zavorth go';
  };
  safety: {
    noLiveTransactionExecution: true;
    noHiddenProviderProbe: true;
    noRawSecretsSerialized: true;
    importedSkillsDoNotBypassReview: true;
    dashboardHasNoTargetExecutionAuthority: true;
    approvalsRemainGatewayMediated: true;
  };
  nextAction: string;
};

type ProviderReadinessLike = Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;
type DashboardHomeLike = Pick<ZavorthDashboardExperienceHomeService, 'buildSnapshot'>;
type ApprovalCardsLike = Pick<ZavorthApprovalActionCardsUxService, 'buildSnapshot'>;
type TransactionGateLike = Pick<ZavorthTransactionLiveExecutorGateService, 'buildSnapshot'>;
type SkillSourcesLike = Pick<SkillSourceRegistryService, 'readConfig'>;
type NaturalClassifierLike = Pick<NaturalFirstRunClassifier, 'classify'>;
type MemoryPlaneLike = Partial<Pick<ZavorthMemoryPlaneService, 'buildSnapshot' | 'buildSnapshotFast'>>;

export type ZavorthRuntimeReadinessInput = {
  pendingApprovals?: Array<Record<string, unknown>> | null;
  userId?: string | null;
  sessionId?: string | null;
  workspaceHint?: string | null;
};

export type ZavorthRuntimeReadinessRuntime = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  naturalClassifier?: NaturalClassifierLike;
  providerReadiness?: ProviderReadinessLike;
  dashboardHome?: DashboardHomeLike;
  approvalCards?: ApprovalCardsLike;
  transactionLiveExecutorGate?: TransactionGateLike;
  skillSources?: SkillSourcesLike;
  memoryPlane?: MemoryPlaneLike;
};

export class ZavorthRuntimeReadinessService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly projectRoot: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly naturalClassifier: NaturalClassifierLike;
  private readonly providerReadiness: ProviderReadinessLike;
  private readonly dashboardHome: DashboardHomeLike;
  private readonly approvalCards: ApprovalCardsLike;
  private readonly transactionLiveExecutorGate: TransactionGateLike;
  private readonly skillSources: SkillSourcesLike;
  private readonly memoryPlane: MemoryPlaneLike;

  public constructor(runtime: ZavorthRuntimeReadinessRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.naturalClassifier = runtime.naturalClassifier || new NaturalFirstRunClassifier();
    this.providerReadiness = runtime.providerReadiness || new ZavorthProviderReadinessMatrixService({ now: this.now });
    this.dashboardHome = runtime.dashboardHome || new ZavorthDashboardExperienceHomeService({ now: this.now });
    this.approvalCards = runtime.approvalCards || new ZavorthApprovalActionCardsUxService({ now: this.now });
    this.transactionLiveExecutorGate = runtime.transactionLiveExecutorGate || new ZavorthTransactionLiveExecutorGateService({ now: this.now });
    this.skillSources = runtime.skillSources || new SkillSourceRegistryService({ projectRoot: this.projectRoot });
    this.memoryPlane = runtime.memoryPlane || new ZavorthMemoryPlaneService({ now: this.now });
  }

  public async buildSnapshot(input: ZavorthRuntimeReadinessInput = {}): Promise<ZavorthRuntimeReadinessSnapshot> {
    const checks = [
      this.buildNaturalFirstCheck(input),
      this.buildProviderCheck(),
      this.buildDashboardCheck(),
      this.buildTelegramCheck(),
      this.buildApprovalsCheck(input),
      this.buildTransactionPlaneCheck(),
      this.buildSkillImportsCheck(),
      await this.buildMemoryContinuityCheck(input),
    ];
    const summary = summarizeChecks(checks);
    const status = resolveStatus(checks);
    const dailyUseReady = summary.requiredBlocked === 0
      && summary.naturalFirstReady
      && summary.dashboardOk
      && summary.approvalsOk
      && summary.transactionPlaneSafe
      && summary.skillsBlockedByDefault
      && summary.memoryReady;

    return {
      contractVersion: ZAVORTH_RUNTIME_READINESS_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'runtime-readiness',
      generatedAt: this.now().toISOString(),
      status,
      dailyUseReady,
      summary,
      checks,
      operator: {
        primaryCommand: 'zavorth readiness',
        jsonCommand: 'zavorth readiness --json',
        dailyCommand: 'zavorth daily',
        dashboardRoute: '/dashboard',
        safeStartupCommand: 'zavorth go',
      },
      safety: {
        noLiveTransactionExecution: true,
        noHiddenProviderProbe: true,
        noRawSecretsSerialized: true,
        importedSkillsDoNotBypassReview: true,
        dashboardHasNoTargetExecutionAuthority: true,
        approvalsRemainGatewayMediated: true,
      },
      nextAction: buildNextAction(status, dailyUseReady, checks),
    };
  }

  public renderText(snapshot: ZavorthRuntimeReadinessSnapshot): string {
    return [
      '[zavorth-runtime-readiness]',
      `status=${snapshot.status}`,
      `daily_use_ready=${snapshot.dailyUseReady}`,
      `generated_at=${snapshot.generatedAt}`,
      '',
      '[summary]',
      `ready=${snapshot.summary.ready} attention=${snapshot.summary.attention} blocked=${snapshot.summary.blocked} required_blocked=${snapshot.summary.requiredBlocked}`,
      `provider_ok=${snapshot.summary.providerOk} dashboard_ok=${snapshot.summary.dashboardOk} telegram_ok=${snapshot.summary.telegramOk}`,
      `approvals_ok=${snapshot.summary.approvalsOk} transaction_plane_safe=${snapshot.summary.transactionPlaneSafe}`,
      `skills_blocked_by_default=${snapshot.summary.skillsBlockedByDefault} memory_ready=${snapshot.summary.memoryReady} natural_first_ready=${snapshot.summary.naturalFirstReady}`,
      '',
      '[checks]',
      ...snapshot.checks.map((check) => [
        `- ${check.id}: ${check.status}${check.required ? ' required' : ' optional'}`,
        `  ${check.summary}`,
        `  command: ${check.command}`,
        `  next: ${check.nextAction}`,
      ].join('\n')),
      '',
      '[operator]',
      `primary=${snapshot.operator.primaryCommand}`,
      `json=${snapshot.operator.jsonCommand}`,
      `daily=${snapshot.operator.dailyCommand}`,
      `dashboard=${snapshot.operator.dashboardRoute}`,
      `startup=${snapshot.operator.safeStartupCommand}`,
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }

  private buildNaturalFirstCheck(input: ZavorthRuntimeReadinessInput): ZavorthRuntimeReadinessCheck {
    return this.safeCheck('natural-first-runtime', 'Natural First Runtime', true, 'zavorth ask-runtime "oi"', () => {
      const light = this.naturalClassifier.classify({
        text: 'oi',
        channel: 'cli',
        userId: input.userId || 'operator',
        sessionId: input.sessionId || 'readiness',
        workspace: input.workspaceHint || this.projectRoot,
      });
      const risky = this.naturalClassifier.classify({
        text: 'apague dist e faca push',
        channel: 'cli',
        userId: input.userId || 'operator',
        sessionId: input.sessionId || 'readiness',
        workspace: input.workspaceHint || this.projectRoot,
        requestedTools: ['shell.exec', 'git.push'],
        metadata: {
          requireApprovalFor: ['shell.exec', 'git.push'],
        },
      });
      const ok = light.shouldEnterGateway === true
        && light.route === 'light-chat'
        && risky.shouldEnterGateway === true
        && risky.requiresApproval === true
        && risky.risk.previewRequired === true;
      return {
        status: ok ? 'ready' : 'blocked',
        summary: ok
          ? 'Free text enters the gateway; risky work becomes preview/approval.'
          : 'Natural-first classification is not preserving the gateway/approval contract.',
        evidence: [
          `light.route=${light.route}`,
          `light.gateway=${String(light.shouldEnterGateway)}`,
          `risky.route=${risky.route}`,
          `risky.approval=${String(risky.requiresApproval)}`,
          `risky.preview=${String(risky.risk.previewRequired)}`,
        ],
        nextAction: ok ? 'Use natural text normally.' : 'Run natural-first tests before daily use.',
      };
    });
  }

  private buildProviderCheck(): ZavorthRuntimeReadinessCheck {
    return this.safeCheck('provider-mesh', 'Provider Mesh', false, 'zavorth providers', () => {
      const snapshot = this.providerReadiness.buildSnapshot({ includeAdvanced: false, probe: false }) as ZavorthProviderReadinessMatrixSnapshot;
      const providerOk = snapshot.summary.defaultRouteAllowed > 0;
      const status = snapshot.status === 'blocked'
        ? 'blocked'
        : providerOk
          ? 'ready'
          : 'attention';
      return {
        status,
        summary: providerOk
          ? `Provider mesh has ${snapshot.summary.defaultRouteAllowed} default route(s) allowed; live probes are explicit.`
          : `Provider catalog has ${snapshot.summary.ready} ready route(s), but no default route is allowed yet.`,
        evidence: [
          `active=${snapshot.activeProvider}/${snapshot.activeModel}`,
          `ready=${snapshot.summary.ready}`,
          `defaultRouteAllowed=${snapshot.summary.defaultRouteAllowed}`,
          `liveReady=${snapshot.summary.liveReady}`,
          `missingAuth=${snapshot.summary.missingAuth}`,
        ],
        nextAction: providerOk ? 'Run live provider probe only when needed.' : snapshot.nextAction,
      };
    });
  }

  private buildDashboardCheck(): ZavorthRuntimeReadinessCheck {
    return this.safeCheck('dashboard', 'Dashboard', true, 'zavorth go', () => {
      const snapshot = this.dashboardHome.buildSnapshot() as ZavorthDashboardExperienceHomeSnapshot;
      const pageExists = this.existsSyncImpl(path.join(this.projectRoot, 'src', 'ai-gateway', 'app', '(dashboard)', 'dashboard', 'page.tsx'));
      const ok = snapshot.route === '/dashboard'
        && snapshot.safety.projectionOnly === true
        && snapshot.safety.dashboardCanExecuteTargetAction === false
        && pageExists;
      return {
        status: ok ? 'ready' : 'blocked',
        summary: ok
          ? 'Dashboard daily-use route is present and projection-only.'
          : 'Dashboard route or projection-only safety contract is missing.',
        evidence: [
          `route=${snapshot.route}`,
          `projectionOnly=${String(snapshot.safety.projectionOnly)}`,
          `dashboardCanExecute=${String(snapshot.safety.dashboardCanExecuteTargetAction)}`,
          `pageExists=${String(pageExists)}`,
        ],
        nextAction: ok ? 'Open /dashboard or run zavorth go.' : 'Restore the /dashboard daily-use surface.',
      };
    });
  }

  private buildTelegramCheck(): ZavorthRuntimeReadinessCheck {
    return this.safeCheck('telegram', 'Telegram', false, 'zavorth connectors doctor telegram', () => {
      const configured = hasUsableSecret(
        this.env.ZAVORTH_TELEGRAM_BOT_TOKEN
        || this.env.TELEGRAM_BOT_TOKEN
        || this.env.BOT_TOKEN,
      );
      return {
        status: configured ? 'ready' : 'attention',
        summary: configured
          ? 'Telegram token is configured; remote approval can be wired by the channel doctor.'
          : 'Telegram is not configured in this environment; dashboard/CLI remain usable.',
        evidence: [
          `tokenPresent=${String(configured)}`,
          'approvalButtons=inline-callbacks',
          'approvalResolution=gateway-mediated',
        ],
        nextAction: configured ? 'Run connector doctor if approvals are not arriving.' : 'Configure Telegram when remote college use is required.',
      };
    });
  }

  private buildApprovalsCheck(input: ZavorthRuntimeReadinessInput): ZavorthRuntimeReadinessCheck {
    return this.safeCheck('approvals', 'Approvals', true, 'zavorth gateway approvals', () => {
      const snapshot = this.approvalCards.buildSnapshot({
        approvals: input.pendingApprovals || [],
      }) as ZavorthApprovalActionCardsUxSnapshot;
      const projection = snapshot.dashboardProjection;
      const ok = snapshot.summary.rawSecretsSerialized === false
        && projection.executionAuthority === false
        && projection.approvalResolutionAuthority === 'gateway-mediated';
      const pending = snapshot.summary.pending;
      return {
        status: ok ? (pending > 0 ? 'attention' : 'ready') : 'blocked',
        summary: ok
          ? pending > 0
            ? `${pending} approval(s) pending; resolution remains gateway-mediated.`
            : 'Approval cards are ready and do not execute target actions.'
          : 'Approval UX is not proving gateway mediation and no-execution authority.',
        evidence: [
          `pending=${pending}`,
          `executionAuthority=${String(projection.executionAuthority)}`,
          `resolutionAuthority=${projection.approvalResolutionAuthority}`,
          `rawSecretsSerialized=${String(snapshot.summary.rawSecretsSerialized)}`,
        ],
        nextAction: pending > 0 ? 'Review pending approvals before continuing.' : 'No approval is waiting.',
      };
    });
  }

  private buildTransactionPlaneCheck(): ZavorthRuntimeReadinessCheck {
    return this.safeCheck('transaction-plane', 'Transaction Plane', true, 'zavorth transaction-live-executor-gate', () => {
      const snapshot = this.transactionLiveExecutorGate.buildSnapshot() as ZavorthTransactionLiveExecutorGateContractSnapshot;
      const hasHoldStatus = snapshot.statuses.includes('live-ready-held');
      const blocksExecuteLive = snapshot.invariants.some((item) => item.includes('executeLive=true'));
      const noLiveByDefault = snapshot.invariants.some((item) => item.includes('performs no live execution by default'));
      const ok = hasHoldStatus && blocksExecuteLive && noLiveByDefault;
      return {
        status: ok ? 'ready' : 'blocked',
        summary: ok
          ? 'Transaction plane is prepared for readiness packets while live execution stays held.'
          : 'Transaction live gate is missing an execution-hold invariant.',
        evidence: [
          `version=${snapshot.version}`,
          `liveReadyHeld=${String(hasHoldStatus)}`,
          `executeLiveBlocked=${String(blocksExecuteLive)}`,
          `noLiveByDefault=${String(noLiveByDefault)}`,
        ],
        nextAction: ok ? 'Use simulation/preview unless a future live activation is explicit.' : 'Run transaction live executor gate checks.',
      };
    });
  }

  private buildSkillImportsCheck(): ZavorthRuntimeReadinessCheck {
    return this.safeCheck('skill-imports', 'Skill Imports', true, 'npx tsx scripts/skills-security-scan.ts', () => {
      const registry = this.skillSources.readConfig() as SkillSourceRegistryDocument;
      const enabledExternal = registry.sources.filter((source) =>
        source.enabled
        && (source.kind !== 'workspace' || Boolean(source.upstream)),
      );
      const enabledExternalWithoutPin = enabledExternal.filter((source) =>
        source.kind !== 'workspace' && !source.pinnedRevision,
      );
      const ok = enabledExternalWithoutPin.length === 0;
      return {
        status: ok ? 'ready' : 'blocked',
        summary: ok
          ? 'External skill imports remain explicit and pinned; no enabled unpinned external source is trusted.'
          : `${enabledExternalWithoutPin.length} enabled external source(s) are missing pinnedRevision.`,
        evidence: [
          `sources=${registry.sources.length}`,
          `enabledExternal=${enabledExternal.length}`,
          `enabledExternalWithoutPin=${enabledExternalWithoutPin.length}`,
          `reviewSources=${registry.sources.filter((source) => source.trust === 'review').length}`,
        ],
        nextAction: ok ? 'Keep importing only by explicit source id and review.' : 'Disable or pin every enabled external source.',
      };
    });
  }

  private async buildMemoryContinuityCheck(input: ZavorthRuntimeReadinessInput): Promise<ZavorthRuntimeReadinessCheck> {
    return this.safeCheckAsync('memory-continuity', 'Memory Continuity', true, 'zavorth memory review --json', async () => {
      const snapshot = await this.buildMemorySnapshot(input);
      const ok = Boolean(snapshot.generatedAt && snapshot.narrative?.operatorSummary);
      return {
        status: ok ? 'ready' : 'blocked',
        summary: ok
          ? 'Memory plane can produce a continuity snapshot without writing hidden memory.'
          : 'Memory continuity snapshot is not available.',
        evidence: [
          `persisted=${snapshot.summary.persistedMemories}`,
          `relevant=${snapshot.summary.relevantMemories}`,
          `timeline=${snapshot.summary.timelineEvents}`,
          `vectorRecall=${String(snapshot.memory.vectorRecall)}`,
        ],
        nextAction: ok ? 'Use memory recall naturally when continuing work.' : 'Repair memory plane before relying on continuity.',
      };
    });
  }

  private async buildMemorySnapshot(input: ZavorthRuntimeReadinessInput): Promise<ZavorthMemoryPlaneSnapshot> {
    const request = {
      userId: input.userId || 'operator',
      sessionId: input.sessionId || 'readiness',
      workspaceHint: input.workspaceHint || this.projectRoot,
      platform: 'cli',
    };
    if (this.memoryPlane.buildSnapshotFast) {
      return this.memoryPlane.buildSnapshotFast(request);
    }
    if (this.memoryPlane.buildSnapshot) {
      return this.memoryPlane.buildSnapshot(request);
    }
    return new ZavorthMemoryPlaneService({ now: this.now }).buildSnapshotFast(request);
  }

  private safeCheck(
    id: ZavorthRuntimeReadinessCheckId,
    label: string,
    required: boolean,
    command: string,
    factory: () => Omit<ZavorthRuntimeReadinessCheck, 'id' | 'label' | 'required' | 'command'>,
  ): ZavorthRuntimeReadinessCheck {
    try {
      return {
        id,
        label,
        required,
        command,
        ...factory(),
      };
    } catch (error) {
      return failedCheck(id, label, required, command, error);
    }
  }

  private async safeCheckAsync(
    id: ZavorthRuntimeReadinessCheckId,
    label: string,
    required: boolean,
    command: string,
    factory: () => Promise<Omit<ZavorthRuntimeReadinessCheck, 'id' | 'label' | 'required' | 'command'>>,
  ): Promise<ZavorthRuntimeReadinessCheck> {
    try {
      return {
        id,
        label,
        required,
        command,
        ...(await factory()),
      };
    } catch (error) {
      return failedCheck(id, label, required, command, error);
    }
  }
}

function failedCheck(
  id: ZavorthRuntimeReadinessCheckId,
  label: string,
  required: boolean,
  command: string,
  error: unknown,
): ZavorthRuntimeReadinessCheck {
  return {
    id,
    label,
    required,
    command,
    status: 'blocked',
    summary: `Readiness check failed: ${error instanceof Error ? error.message : String(error)}`,
    evidence: ['check-exception'],
    nextAction: `Run ${command} and inspect the failure.`,
  };
}

function summarizeChecks(checks: ZavorthRuntimeReadinessCheck[]): ZavorthRuntimeReadinessSnapshot['summary'] {
  const byId = new Map(checks.map((check) => [check.id, check]));
  return {
    ready: checks.filter((check) => check.status === 'ready').length,
    attention: checks.filter((check) => check.status === 'attention').length,
    blocked: checks.filter((check) => check.status === 'blocked').length,
    requiredBlocked: checks.filter((check) => check.required && check.status === 'blocked').length,
    providerOk: byId.get('provider-mesh')?.status === 'ready',
    dashboardOk: byId.get('dashboard')?.status === 'ready',
    telegramOk: byId.get('telegram')?.status === 'ready',
    approvalsOk: byId.get('approvals')?.status !== 'blocked',
    transactionPlaneSafe: byId.get('transaction-plane')?.status === 'ready',
    skillsBlockedByDefault: byId.get('skill-imports')?.status === 'ready',
    memoryReady: byId.get('memory-continuity')?.status === 'ready',
    naturalFirstReady: byId.get('natural-first-runtime')?.status === 'ready',
  };
}

function resolveStatus(checks: ZavorthRuntimeReadinessCheck[]): ZavorthRuntimeReadinessStatus {
  if (checks.some((check) => check.required && check.status === 'blocked')) {
    return 'blocked';
  }
  if (checks.some((check) => check.status !== 'ready')) {
    return 'attention';
  }
  return 'ready';
}

function buildNextAction(
  status: ZavorthRuntimeReadinessStatus,
  dailyUseReady: boolean,
  checks: ZavorthRuntimeReadinessCheck[],
): string {
  const firstBlocked = checks.find((check) => check.required && check.status === 'blocked');
  if (firstBlocked) {
    return `${firstBlocked.label}: ${firstBlocked.nextAction}`;
  }
  if (status === 'attention') {
    const firstAttention = checks.find((check) => check.status === 'attention');
    return dailyUseReady
      ? `Zavorth is usable; optional attention: ${firstAttention?.label || 'configuration'}.`
      : `Resolve attention item before unattended use: ${firstAttention?.label || 'configuration'}.`;
  }
  return 'Zavorth is ready for daily use. Start with zavorth go, zavorth daily or /dashboard.';
}

function hasUsableSecret(value: unknown): boolean {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  if (/^(changeme|change-me|example|placeholder|test|dummy|null|undefined)$/i.test(text)) {
    return false;
  }
  return text.length >= 8;
}
