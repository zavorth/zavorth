import path from 'node:path';

import type { UniversalAgentModelProfile } from '../runtime/agent/UniversalAgentRuntimeTypes.js';
import {
  ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION,
  type ZavorthAgentKernelSnapshot,
  type ZavorthAgentKernelStatus,
  type ZavorthCapabilityPassport,
  type ZavorthIntentDecision,
} from '../contracts/ZavorthAgentKernelSnapshotContract.js';
import type { ProfileRuntimeBundle } from '../contracts/ProfileManifestContract.js';
import type { ZavorthProviderActivationSnapshot } from './ZavorthProviderActivationService.js';
import { ProfileManifestService } from './ProfileManifestService.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';
import { ZavorthCapabilityAtlasService } from './ZavorthCapabilityAtlasService.js';
import { ZavorthDailyProductQuietAutonomyService } from './ZavorthDailyProductQuietAutonomyService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';
import { ZavorthIntentDecisionService } from './ZavorthIntentDecisionService.js';
import {
  ZavorthPerformanceMemoryService,
  type ZavorthPerformanceMemoryRuntime,
} from './ZavorthPerformanceMemoryService.js';
import { ZavorthProviderActivationService } from './ZavorthProviderActivationService.js';

type StateDbLike = ZavorthPerformanceMemoryRuntime['stateDb'];

export type ZavorthAgentKernelSnapshotInput = {
  projectRoot?: string | null;
  text?: string | null;
  channel?: string | null;
  profileId?: string | null;
  profileSource?: string | null;
  profileBundle?: ProfileRuntimeBundle | null;
  modelProfile?: Partial<UniversalAgentModelProfile> | null;
  providerActivation?: ZavorthProviderActivationSnapshot | null;
  includeProviderActivation?: boolean;
  stateDb?: StateDbLike;
};

export type ZavorthAgentKernelSnapshotRuntime = {
  now?: () => Date;
  profileManifestService?: Pick<ProfileManifestService, 'compileProfileById'>;
  channelMeshService?: Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
  providerActivationService?: Pick<ZavorthProviderActivationService, 'buildSnapshot'>;
  intentDecisionService?: Pick<ZavorthIntentDecisionService, 'decide'>;
  performanceMemoryService?: ZavorthPerformanceMemoryService;
  env?: Record<string, string | undefined>;
};

export class ZavorthAgentKernelSnapshotService {
  private readonly now: () => Date;
  private readonly profiles: Pick<ProfileManifestService, 'compileProfileById'>;
  private readonly channels: Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
  private readonly providerActivation: Pick<ZavorthProviderActivationService, 'buildSnapshot'>;
  private readonly intent: Pick<ZavorthIntentDecisionService, 'decide'>;
  private readonly performanceMemory: ZavorthPerformanceMemoryService | null;
  private readonly env: Record<string, string | undefined>;

  constructor(runtime: ZavorthAgentKernelSnapshotRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.profiles = runtime.profileManifestService || new ProfileManifestService();
    this.channels = runtime.channelMeshService || new ZavorthChannelMeshService({ now: this.now });
    this.providerActivation = runtime.providerActivationService || new ZavorthProviderActivationService({ now: this.now });
    this.intent = runtime.intentDecisionService || new ZavorthIntentDecisionService({ now: this.now });
    this.performanceMemory = runtime.performanceMemoryService || null;
    this.env = runtime.env || process.env;
  }

  public async buildSnapshot(
    input: ZavorthAgentKernelSnapshotInput = {},
  ): Promise<ZavorthAgentKernelSnapshot> {
    const providerActivation = input.providerActivation
      || (input.includeProviderActivation === false
        ? null
        : await this.providerActivation.buildSnapshot({ includeAdvanced: true }));
    return this.buildSnapshotSync({
      ...input,
      providerActivation,
    });
  }

  public buildSnapshotSync(input: ZavorthAgentKernelSnapshotInput = {}): ZavorthAgentKernelSnapshot {
    const generatedAt = this.now().toISOString();
    const projectRoot = path.resolve(input.projectRoot || process.cwd());
    const home = new ZavorthHomePathService({
      projectRoot,
      explicitHome: this.env.ZAVORTH_HOME || null,
      env: this.env,
      now: this.now,
    }).resolveSnapshot();
    const profile = input.profileBundle || this.resolveProfile(input.profileId);
    const profileId = profile?.id || normalize(input.profileId, 'personal');
    const channels = safe(() => this.channels.buildSnapshot(), null);
    const performance = (this.performanceMemory || new ZavorthPerformanceMemoryService({
      now: this.now,
      stateDb: input.stateDb || null,
      storePath: path.join(home.resolvedPaths.dataDir, 'performance-memory.json'),
    })).buildSnapshot();
    const intentDecision = normalize(input.text)
      ? this.intent.decide({
        text: normalize(input.text),
        channel: input.channel,
        profileId,
      })
      : null;
    const providerSummary = this.buildProviderSummary(input.providerActivation || null, input.modelProfile || null);
    const capabilityAtlas = new ZavorthCapabilityAtlasService({
      projectRoot,
      now: this.now,
    }).buildSnapshot({ limit: 18 });
    const passport = this.buildPassport({
      generatedAt,
      projectRoot,
      home,
      profile,
      profileId,
      profileSource: normalize(input.profileSource, 'default'),
      channels,
      providerSummary,
    });
    const quietAutonomy = this.buildQuietAutonomy(profile);
    const cleanInstallCertification = this.buildCleanInstallCertification(passport);
    const status = mergeStatus([
      passport.status,
      cleanInstallCertification.status,
      intentDecision?.risk === 'danger' ? 'attention' : 'ready',
    ]);
    const snapshotWithoutPrompt = {
      contractVersion: ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION,
      schemaVersion: 1 as const,
      surface: 'agent-kernel-snapshot' as const,
      generatedAt,
      status,
      projectRoot,
      activeProfile: profile,
      capabilityPassport: passport,
      capabilityAtlas: {
        status: capabilityAtlas.status,
        summary: capabilityAtlas.summary,
        entries: capabilityAtlas.entries,
        llmContextBlock: capabilityAtlas.llmContextBlock,
      },
      intentDecision,
      performanceMemory: performance,
      quietAutonomy,
      cleanInstallCertification,
    };
    return {
      ...snapshotWithoutPrompt,
      llmContextBlock: this.buildLlmContextBlock(snapshotWithoutPrompt),
    };
  }

  public buildLlmContextBlock(input: Omit<ZavorthAgentKernelSnapshot, 'llmContextBlock'>): string {
    const passport = input.capabilityPassport;
    const intent = input.intentDecision;
    const performanceRecommendation = input.performanceMemory.recommendations[0];
    return [
      'Agent Kernel Snapshot (canonical install/runtime context; context only, not proof of execution):',
      `- status: ${passport.status}; home: ${passport.install.isolated ? 'isolated' : 'compat'} (${safeText(passport.install.homeSource)}).`,
      `- profile: ${safeText(passport.activeProfile.id)} / ${safeText(passport.activeProfile.label)}; autonomy=${safeText(passport.activeProfile.autonomy)}; trust=${safeText(passport.activeProfile.trustMode)}; approvals=${safeText(passport.activeProfile.approvalMode)}; sandbox=${safeText(passport.activeProfile.sandboxMode)}.`,
      `- provider: ${safeText(passport.providers.activeProvider)} / ${safeText(passport.providers.activeModel)}; routes=${passport.providers.routes}; executionReady=${passport.providers.executionReady}; liveReady=${passport.providers.liveReady}; needsCredentials=${passport.providers.needsCredentials}.`,
      `- channels: total=${passport.channels.total}; ready=${passport.channels.ready}; configured=${passport.channels.configured}; liveReady=${passport.channels.liveReady}.`,
      `- can do now: ${passport.canDo.slice(0, 8).map(safeText).join('; ') || 'direct answer'}.`,
      `- capability atlas: ${input.capabilityAtlas.summary.total} mapped; ${input.capabilityAtlas.summary.actionHarnessBacked} action-backed; ${input.capabilityAtlas.summary.llmVisible} visible to LLM context.`,
      input.capabilityAtlas.llmContextBlock,
      `- missing/setup: ${passport.missing.slice(0, 6).map(safeText).join('; ') || 'none critical'}.`,
      intent
        ? `- intent route: ${intent.kind}; next=${safeText(intent.nextSurface)}; preview=${intent.requiresPreview}; approval=${intent.requiresApproval}; reason=${safeText(intent.reason)}.`
        : '',
      performanceRecommendation
        ? `- performance memory: prefer ${safeText(performanceRecommendation.providerId)}/${safeText(performanceRecommendation.routeId)} for ${safeText(performanceRecommendation.taskKind)} when compatible.`
        : '- performance memory: no route history yet; choose by current provider capability and policy.',
      `- quiet autonomy: ${input.quietAutonomy.mode}; interrupt=${input.quietAutonomy.interruptMode}; summary=${safeText(input.quietAutonomy.operatorSummary)}.`,
      `- daily product: ${safeText(input.quietAutonomy.dailyProductRule)}.`,
      input.quietAutonomy.llmGuidance,
      '- routing rule: choose direct response, zavorth_action, memory, background task, swarm, sandbox, channel or approval by task nature; do not depend on magic words.',
      '- safety rule: risky mutation, outbound send, secrets, provider default changes and host execution need preview/approval/receipt unless profile policy explicitly allows a reversible low-risk background action.',
    ].filter(Boolean).join('\n');
  }

  public renderText(snapshot: ZavorthAgentKernelSnapshot): string {
    const passport = snapshot.capabilityPassport;
    return [
      '[agent-kernel]',
      `status=${snapshot.status}`,
      `profile=${passport.activeProfile.id} approvals=${passport.activeProfile.approvalMode} trust=${passport.activeProfile.trustMode}`,
      `home=${passport.install.homeRoot} isolated=${passport.install.isolated ? 'yes' : 'no'}`,
      `providers routes=${passport.providers.routes} execution_ready=${passport.providers.executionReady} live_ready=${passport.providers.liveReady} needs_credentials=${passport.providers.needsCredentials}`,
      `channels total=${passport.channels.total} ready=${passport.channels.ready} live_ready=${passport.channels.liveReady}`,
      snapshot.intentDecision ? `intent=${snapshot.intentDecision.kind} approval=${snapshot.intentDecision.requiresApproval ? 'yes' : 'no'}` : 'intent=none',
      `performance_samples=${snapshot.performanceMemory.sampleCount}`,
      `quiet_autonomy=${snapshot.quietAutonomy.mode} interrupt=${snapshot.quietAutonomy.interruptMode}`,
      '',
      snapshot.llmContextBlock,
      '',
    ].join('\n');
  }

  private resolveProfile(profileId: string | null | undefined): ProfileRuntimeBundle | null {
    return safe(() =>
      this.profiles.compileProfileById(profileId || 'personal')
      || this.profiles.compileProfileById('developer')
      || null,
    null);
  }

  private buildProviderSummary(
    activation: ZavorthProviderActivationSnapshot | null,
    modelProfile: Partial<UniversalAgentModelProfile> | null,
  ): ZavorthCapabilityPassport['providers'] {
    if (!activation) {
      return {
        status: 'unknown',
        activeProvider: normalize(modelProfile?.providerLabel, 'not selected'),
        activeModel: normalize(modelProfile?.modelLabel, 'not selected'),
        routes: 0,
        executionReady: 0,
        liveReady: 0,
        needsCredentials: 0,
        needsBaseUrl: 0,
        needsConnector: 0,
      };
    }
    return {
      status: activation.status,
      activeProvider: normalize(modelProfile?.providerLabel, 'selected by provider mesh'),
      activeModel: normalize(modelProfile?.modelLabel, 'selected by provider mesh'),
      routes: activation.summary.routes,
      executionReady: activation.summary.executionReady,
      liveReady: activation.summary.liveReady,
      needsCredentials: activation.summary.needsCredentials,
      needsBaseUrl: activation.summary.needsBaseUrl,
      needsConnector: activation.summary.needsConnector,
    };
  }

  private buildPassport(input: {
    generatedAt: string;
    projectRoot: string;
    home: ReturnType<ZavorthHomePathService['resolveSnapshot']>;
    profile: ProfileRuntimeBundle | null;
    profileId: string;
    profileSource: string;
    channels: ReturnType<ZavorthChannelMeshService['buildSnapshot']> | null;
    providerSummary: ZavorthCapabilityPassport['providers'];
  }): ZavorthCapabilityPassport {
    const profile = input.profile;
    const providerMissing = input.providerSummary.needsCredentials + input.providerSummary.needsBaseUrl;
    const canDo = [
      'answer natural questions',
      'route Zavorth operations through Action Harness',
      'use memory recall/forget/correct/promote contracts',
      'stage low-risk learning and curation in background',
      'run governed tasks and goal continuations',
      'plan large work through Swarm Scale Plane',
      'preview risky execution through Sandbox Control Plane',
      input.channels && input.channels.summary.total > 0 ? 'normalize channel inbound and govern outbound' : '',
      input.providerSummary.executionReady > 0 ? 'select configured provider routes when credentials are present' : '',
    ].filter(Boolean);
    const missing = [
      ...input.home.warnings,
      providerMissing > 0 ? `${providerMissing} provider route(s) still need credentials or base URL before live proof.` : '',
      input.providerSummary.needsConnector > 0 ? `${input.providerSummary.needsConnector} provider route(s) need an execution connector.` : '',
      input.channels && input.channels.summary.liveReady === 0 ? 'No channel has live proof yet; use channel doctor/canary after configuring credentials.' : '',
      !input.home.isolated ? 'ZAVORTH_HOME is in compatibility mode; choose an isolated home for clean installs.' : '',
    ].filter(Boolean);
    const status = mergeStatus([
      input.providerSummary.needsConnector > 0 ? 'blocked' : 'ready',
      missing.length > 0 ? 'attention' : 'ready',
    ]);
    return {
      status,
      generatedAt: input.generatedAt,
      install: {
        projectRoot: input.projectRoot,
        homeRoot: input.home.root,
        homeSource: input.home.source,
        isolated: input.home.isolated,
        cleanInstallReady: input.home.safety.preventsPathTraversal && input.home.safety.noAutomaticMigration,
        warnings: [...input.home.warnings],
      },
      activeProfile: {
        id: profile?.id || input.profileId,
        label: profile?.label || input.profileId,
        source: input.profileSource,
        autonomy: profile?.cognitivePolicy.autonomy || 'governed',
        trustMode: profile?.runtimePolicy.trustMode || 'balanced',
        approvalMode: profile?.runtimePolicy.approvalMode || 'risk-based',
        sandboxMode: profile?.runtimePolicy.sandboxMode || 'preferred',
        memoryMode: profile?.memoryPolicy.mode || 'working',
        learning: profile?.memoryPolicy.learning || 'approved-only',
        maxToolRounds: profile?.runtimePolicy.maxToolRounds || 8,
        allowedTools: profile?.capabilityPolicy.allow || [],
        requireApprovalFor: profile?.capabilityPolicy.requireApproval || [],
      },
      providers: input.providerSummary,
      channels: {
        status: input.channels
          ? input.channels.summary.ready > 0 ? 'ready' : 'attention'
          : 'attention',
        total: input.channels?.summary.total || 0,
        ready: input.channels?.summary.ready || 0,
        configured: input.channels?.summary.configured || 0,
        liveReady: input.channels?.summary.liveReady || 0,
        defaultRouteAllowed: input.channels?.summary.defaultRouteAllowed || 0,
      },
      runtime: {
        actionHarness: 'ready',
        memory: 'ready',
        taskPlane: 'ready',
        goalLoop: 'ready',
        swarmScalePlane: 'ready',
        sandbox: 'ready',
        voiceWake: 'ready',
      },
      canDo,
      missing,
      safety: {
        noRawSecrets: true,
        noHiddenLiveNetworkByDefault: true,
        riskyMutationUsesPreviewApprovalReceipt: true,
        channelsCannotBypassActionHarness: true,
        quietAutonomyIsReversible: true,
      },
    };
  }

  private buildQuietAutonomy(profile: ProfileRuntimeBundle | null): ZavorthAgentKernelSnapshot['quietAutonomy'] {
    const policy = profile?.improvementPolicy;
    const daily = new ZavorthDailyProductQuietAutonomyService({
      now: this.now,
      profileManifestService: this.profiles,
    }).buildSnapshot({ profileId: profile?.id || null });
    const mode = policy?.mode || 'quiet-staging';
    const active = daily.quietAutonomy.activePolicy;
    const summary = mode === 'manual'
      ? 'Background learning is visible and waits for the operator.'
      : active.dailySummary;
    return {
      mode,
      silent: active.silentLanes.map((lane) => lane.lane),
      notify: active.digestLanes.map((lane) => lane.lane),
      requireApproval: active.approvalLanes.map((lane) => lane.lane),
      silentReceipts: daily.quietAutonomy.backgroundReceipts.enabled,
      rollbackRequired: daily.quietAutonomy.backgroundReceipts.rollbackRequired,
      maxSilentRisk: policy?.maxSilentRisk || 'low',
      interruptMode: policy?.interruptMode || 'daily-digest',
      operatorSummary: summary,
      dailyProductRule: daily.dailyProduct.zavorthControlRule,
      llmGuidance: daily.quietAutonomy.llmGuidance,
    };
  }

  private buildCleanInstallCertification(
    passport: ZavorthCapabilityPassport,
  ): ZavorthAgentKernelSnapshot['cleanInstallCertification'] {
    const checks = [
      {
        id: 'home-resolves',
        status: passport.install.homeRoot ? 'ready' as const : 'blocked' as const,
        summary: 'Zavorth Home resolves through the central path service.',
      },
      {
        id: 'home-safe',
        status: passport.install.cleanInstallReady ? 'ready' as const : 'attention' as const,
        summary: 'Home path safety supports explicit migration and no automatic writes.',
      },
      {
        id: 'provider-routes',
        status: passport.providers.status === 'unknown'
          ? 'attention' as const
          : passport.providers.needsConnector > 0 ? 'blocked' as const : 'ready' as const,
        summary: 'Provider routes have executable adapters; live proof still depends on user credentials.',
      },
      {
        id: 'channel-governance',
        status: passport.channels.total > 0 ? 'ready' as const : 'attention' as const,
        summary: 'Channel Mesh is present and outbound is governed.',
      },
      {
        id: 'quiet-autonomy',
        status: 'ready' as const,
        summary: 'Low-risk maintenance can stay quiet while risky boundaries keep approvals.',
      },
    ];
    return {
      status: mergeStatus(checks.map((check) => check.status)),
      checks,
      command: 'npm run qa:zavorth-agent-kernel --silent',
    };
  }
}

function mergeStatus(statuses: Array<ZavorthAgentKernelStatus | null | undefined>): ZavorthAgentKernelStatus {
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('attention')) return 'attention';
  return 'ready';
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function normalize(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function safeText(value: unknown): string {
  return normalize(value, 'unknown')
    .replace(/sk-[A-Za-z0-9_-]{8,}/gu, '[redacted]')
    .replace(/[A-Za-z0-9_\-.]{20,}\.[A-Za-z0-9_\-.]{20,}\.[A-Za-z0-9_\-.]{20,}/gu, '[redacted-token]')
    .slice(0, 500);
}
