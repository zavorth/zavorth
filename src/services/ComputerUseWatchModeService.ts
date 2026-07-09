import type { ComputerUseAgent } from '../agents/ComputerUseAgent.js';
import { ComputerUseWatchModePolicyFileService } from './ComputerUseWatchModePolicyFileService.js';
import { ComputerUseWatchModeStateFileService } from './ComputerUseWatchModeStateFileService.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import { CapabilityLifecycleService, type CapabilityApprovalScope } from './CapabilityLifecycleService.js';
import { ZavorthRuntimeStabilityControlPlaneService } from './ZavorthRuntimeStabilityControlPlaneService.js';
import { TrustDecisionService } from './TrustDecisionService.js';
import { PermissionService } from './PermissionService.js';
import type { ZavorthMutationPlan } from '../contracts/ZavorthMutationPlaneContract.js';
import { ComputerUseWatchModeLifecycleSupport } from './computer-use-watch-mode/ComputerUseWatchModeLifecycleSupport.js';
import { ComputerUseWatchModeMutationSupport } from './computer-use-watch-mode/ComputerUseWatchModeMutationSupport.js';
import { ComputerUseWatchModePolicySupport } from './computer-use-watch-mode/ComputerUseWatchModePolicySupport.js';
import { logger } from '../logger.js';
import type {
ComputerUseWatchModeState,
  StartWatchModeRunInput,
  WatchModeApprovalDecision,
  WatchModeMutationPreview,
  WatchModeRunBudget,
  WatchModeRunSnapshot,
  WatchModeSnapshot,
} from './computer-use-watch-mode/ComputerUseWatchModeSharedTypes.js';

export type {
  ComputerUseWatchModeState,
  StartWatchModeRunInput,
  WatchModeApproval,
  WatchModeApprovalDecision,
  WatchModeMutationPreview,
  WatchModeRunBudget,
  WatchModeRunSnapshot,
  WatchModeSnapshot,
  WatchModeTimelineEntry,
} from './computer-use-watch-mode/ComputerUseWatchModeSharedTypes.js';

export type ComputerUseWatchModeServiceDeps = {
  createAgent: () => ComputerUseAgent;
  maxRuns?: number;
  timelineLimit?: number;
  artifactLimit?: number;
  screenshotThrottleMs?: number;
  maxIterations?: number;
  maxDurationMs?: number;
  maxScreenshots?: number;
  maxMemoryMb?: number;
  idleTtlMs?: number;
  screenshotTtlMs?: number;
  maxScreenshotBytes?: number;
  screenshotRedactionMode?: string;
  sensitiveScreenPolicy?: string;
  strictApprovalDefault?: boolean;
  allowedApps?: string[];
  allowedSites?: string[];
  isExecutionAllowed?: () => boolean;
  mutationGuardEnabled?: boolean;
  policyFileService?: Pick<
    ComputerUseWatchModePolicyFileService,
    'readPolicy' | 'savePolicy' | 'setStrictApprovalDefault' | 'allowApp' | 'allowSite'
  >;
  stateFileService?: Pick<
    ComputerUseWatchModeStateFileService,
    'readSnapshot' | 'saveSnapshot'
  >;
  mutationPlaneService?: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'>;
  trustDecisionService?: Pick<TrustDecisionService, 'evaluate'>;
  permissionService?: Pick<PermissionService, 'getRequest'>;
  capabilityLifecycleService?: Pick<CapabilityLifecycleService, 'shouldBootCapability' | 'registerCapabilityDemand' | 'enableCapability' | 'registerCapabilityUsage'>;
  runtimeStabilityControlPlaneService?: Pick<ZavorthRuntimeStabilityControlPlaneService, 'buildSnapshot'>;
};

export class ComputerUseWatchModeService {
  private readonly state: ComputerUseWatchModeState;
  private readonly policyFileService: Pick<
    ComputerUseWatchModePolicyFileService,
    'readPolicy' | 'savePolicy' | 'setStrictApprovalDefault' | 'allowApp' | 'allowSite'
  >;
  private readonly stateFileService: Pick<
    ComputerUseWatchModeStateFileService,
    'readSnapshot' | 'saveSnapshot'
  >;
  private readonly mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'>;
  private readonly trustDecision: Pick<TrustDecisionService, 'evaluate'>;
  private readonly permissionService: Pick<PermissionService, 'getRequest'>;
  private readonly capabilityLifecycle: Pick<CapabilityLifecycleService, 'shouldBootCapability' | 'registerCapabilityDemand' | 'enableCapability' | 'registerCapabilityUsage'>;
  private readonly runtimeStability: Pick<ZavorthRuntimeStabilityControlPlaneService, 'buildSnapshot'>;
  private readonly policySupport: ComputerUseWatchModePolicySupport;
  private readonly lifecycleSupport: ComputerUseWatchModeLifecycleSupport;
  private readonly mutationSupport: ComputerUseWatchModeMutationSupport;

  constructor(private readonly deps: ComputerUseWatchModeServiceDeps) {
    this.state = {
      maxRuns: Math.max(5, deps.maxRuns || 12),
      timelineLimit: Math.max(10, deps.timelineLimit || 40),
      artifactLimit: Math.max(1, deps.artifactLimit || 8),
      screenshotThrottleMs: Math.max(250, deps.screenshotThrottleMs || 1200),
      runs: new Map(),
      runOrder: [],
      strictApprovalDefault: true,
      allowedApps: [],
      allowedSites: [],
      defaultBudget: this.normalizeBudget({
        maxIterations: deps.maxIterations,
        maxDurationMs: deps.maxDurationMs,
        maxScreenshots: deps.maxScreenshots,
        maxMemoryMb: deps.maxMemoryMb,
        idleTtlMs: deps.idleTtlMs,
        delayBetweenActionsMs: deps.screenshotThrottleMs,
        screenshotTtlMs: deps.screenshotTtlMs,
        maxScreenshotBytes: deps.maxScreenshotBytes,
        screenshotRedactionMode: deps.screenshotRedactionMode,
        sensitiveScreenPolicy: deps.sensitiveScreenPolicy,
      }),
    };
    this.policyFileService = deps.policyFileService || new ComputerUseWatchModePolicyFileService();
    this.stateFileService = deps.stateFileService || new ComputerUseWatchModeStateFileService();
    this.mutationPlane = deps.mutationPlaneService || new ZavorthMutationPlaneService();
    this.trustDecision = deps.trustDecisionService || new TrustDecisionService();
    this.permissionService = deps.permissionService || new PermissionService();
    this.capabilityLifecycle = deps.capabilityLifecycleService || new CapabilityLifecycleService();
    this.runtimeStability = deps.runtimeStabilityControlPlaneService || new ZavorthRuntimeStabilityControlPlaneService();

    this.policySupport = new ComputerUseWatchModePolicySupport({
      state: this.state,
      policyFileService: this.policyFileService,
      persistSnapshot: () => this.persistSnapshot(),
      strictApprovalDefault: deps.strictApprovalDefault,
      allowedApps: deps.allowedApps,
      allowedSites: deps.allowedSites,
      readListEnv: this.readListEnv.bind(this),
      readStrictApprovalDefault: this.readStrictApprovalDefault.bind(this),
      mergeLists: this.mergeLists.bind(this),
      normalizeAppList: this.normalizeAppList.bind(this),
      normalizeSiteList: this.normalizeSiteList.bind(this),
      normalizeApp: this.normalizeApp.bind(this),
      normalizeSite: this.normalizeSite.bind(this),
    });

    this.lifecycleSupport = new ComputerUseWatchModeLifecycleSupport({
      state: this.state,
      createAgent: deps.createAgent,
      isExecutionAllowed: deps.isExecutionAllowed,
      mutationGuardEnabled: deps.mutationGuardEnabled !== false,
      persistSnapshot: () => this.persistSnapshot(),
      previewMutation: (input) => this.previewMutation(input),
      trustDecisionService: this.trustDecision,
      capabilityLifecycleService: this.capabilityLifecycle,
      runtimeStabilityControlPlaneService: this.runtimeStability,
    });

    this.mutationSupport = new ComputerUseWatchModeMutationSupport({
      mutationPlane: this.mutationPlane,
      trustDecisionService: this.trustDecision,
      permissionService: this.permissionService,
      capabilityLifecycleService: this.capabilityLifecycle,
      previewSnapshot: (limit) => this.buildSnapshot(limit),
      startRun: (input) => this.startRun(input),
      setStrictApprovalDefault: (value) => this.setStrictApprovalDefault(value),
      allowApp: (app) => this.allowApp(app),
      allowSite: (site) => this.allowSite(site),
      resolveCapabilityScope: (plan) => this.resolveCapabilityScope(plan),
    });
  }

  public buildSnapshot(limit: number = 6): WatchModeSnapshot {
    return this.lifecycleSupport.buildSnapshot(limit);
  }

  public listRuns(limit: number = 10): WatchModeRunSnapshot[] {
    return this.lifecycleSupport.listRuns(limit);
  }

  public getRun(runId: string): WatchModeRunSnapshot | null {
    return this.lifecycleSupport.getRun(runId);
  }

  public getActiveRun(): WatchModeRunSnapshot | null {
    return this.lifecycleSupport.getActiveRun();
  }

  public setStrictApprovalDefault(value: boolean): WatchModeSnapshot {
    return this.policySupport.setStrictApprovalDefault(value);
  }

  public allowApp(app: string): WatchModeSnapshot {
    return this.policySupport.allowApp(app);
  }

  public allowSite(site: string): WatchModeSnapshot {
    return this.policySupport.allowSite(site);
  }

  public async previewMutation(input: {
    actionId: 'start' | 'set-strict-default' | 'allow-app' | 'allow-site';
    targetWindow?: string | null;
    objective?: string | null;
    siteUrl?: string | null;
    strictApproval?: boolean | null;
    maxIterations?: number | null;
    maxDurationMs?: number | null;
    maxScreenshots?: number | null;
    maxMemoryMb?: number | null;
    idleTtlMs?: number | null;
    screenshotTtlMs?: number | null;
    maxScreenshotBytes?: number | null;
    screenshotRedactionMode?: string | null;
    sensitiveScreenPolicy?: string | null;
    app?: string | null;
    site?: string | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }): Promise<WatchModeMutationPreview> {
    return this.mutationSupport.previewMutation(input);
  }

  public async applyMutationPlan(input: {
    planId: string;
    requestedBy?: string | null;
  }): Promise<{ ok: true; status: 'applied'; mutationPlan: ZavorthMutationPlan; snapshot: WatchModeSnapshot; run: WatchModeRunSnapshot | null }> {
    return this.mutationSupport.applyMutationPlan(input);
  }

  public async startRun(input: StartWatchModeRunInput): Promise<WatchModeRunSnapshot> {
    return this.lifecycleSupport.startRun(input);
  }

  public pauseRun(runId: string, requestedBy: string | null = null): WatchModeRunSnapshot {
    return this.lifecycleSupport.pauseRun(runId, requestedBy);
  }

  public resumeRun(runId: string, requestedBy: string | null = null): WatchModeRunSnapshot {
    return this.lifecycleSupport.resumeRun(runId, requestedBy);
  }

  public stopRun(runId: string, requestedBy: string | null = null): WatchModeRunSnapshot {
    return this.lifecycleSupport.stopRun(runId, requestedBy);
  }

  public decideApproval(input: {
    runId: string;
    approvalId: string;
    decision: WatchModeApprovalDecision;
    requestedBy?: string | null;
    note?: string | null;
  }): WatchModeRunSnapshot {
    return this.lifecycleSupport.decideApproval(input);
  }

  public resolveScreenshotPath(runId: string, entryId?: string | null): string | null {
    return this.lifecycleSupport.resolveScreenshotPath(runId, entryId);
  }

  private persistSnapshot(): WatchModeSnapshot {
    const snapshot = this.lifecycleSupport.buildSnapshot(this.state.maxRuns);
    this.stateFileService.saveSnapshot(snapshot);
    return snapshot;
  }

  private resolveCapabilityScope(plan: ZavorthMutationPlan): CapabilityApprovalScope {
    const scope = plan.approval.defaultScope;
    if (scope === 'host' || scope === 'session') {
      return scope;
    }
    return 'once';
  }

  private mergeLists(primary: string[], secondary: string[]): string[] {
    return [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])];
  }

  private normalizeAppList(values: string[]): string[] {
    return values
      .map((value) => this.normalizeApp(value))
      .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);
  }

  private normalizeSiteList(values: string[]): string[] {
    return values
      .map((value) => this.normalizeSite(value))
      .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);
  }

  private readListEnv(...keys: string[]): string[] {
    for (const key of keys) {
      const raw = String(process.env[key] || '').trim();
      if (!raw) {
        continue;
      }
      return raw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
    return [];
  }

  private readStrictApprovalDefault(): boolean {
    const raw = String(process.env.ZAVORTH_WATCH_STRICT_APPROVAL || '').trim().toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'off') {
      return false;
    }
    return true;
  }

  private normalizeApp(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeSite(value: unknown): string {
    const raw = String(value || '').trim();
    return this.extractSiteHost(raw) || raw.trim().toLowerCase();
  }

  private extractSiteHost(siteUrl: string | null): string | null {
    const normalized = this.normalizeOptional(siteUrl);
    if (!normalized) {
      return null;
    }
    try {
      const target = normalized.match(/^https?:\/\//i) ? normalized : `https://${normalized}`;
      return new URL(target).hostname.trim().toLowerCase();
    } catch (error: unknown) {logger.warn('[Computer Use Watch Mode] network request failed', error); return null; }
  }

  private normalizeOptional(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private normalizeBudget(input: {
    maxIterations?: unknown;
    maxDurationMs?: unknown;
    maxScreenshots?: unknown;
    maxMemoryMb?: unknown;
    idleTtlMs?: unknown;
    delayBetweenActionsMs?: unknown;
    screenshotTtlMs?: unknown;
    maxScreenshotBytes?: unknown;
    screenshotRedactionMode?: unknown;
    sensitiveScreenPolicy?: unknown;
  }): WatchModeRunBudget {
    return {
      maxIterations: this.positiveNumber(input.maxIterations, 8),
      maxDurationMs: this.positiveNumber(input.maxDurationMs, 10 * 60 * 1000),
      maxScreenshots: this.positiveNumber(input.maxScreenshots, 24),
      maxMemoryMb: this.positiveNumber(input.maxMemoryMb, 512),
      idleTtlMs: this.positiveNumber(input.idleTtlMs, 2 * 60 * 1000),
      delayBetweenActionsMs: this.positiveNumber(input.delayBetweenActionsMs, 1200),
      screenshotTtlMs: this.positiveNumber(input.screenshotTtlMs, 24 * 60 * 60 * 1000),
      maxScreenshotBytes: this.positiveNumber(input.maxScreenshotBytes, 250 * 1024 * 1024),
      screenshotRedactionMode: this.normalizeRedactionMode(input.screenshotRedactionMode),
      sensitiveScreenPolicy: this.normalizeSensitiveScreenPolicy(input.sensitiveScreenPolicy),
    };
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : fallback;
  }

  private normalizeRedactionMode(value: unknown): WatchModeRunBudget['screenshotRedactionMode'] {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'metadata-only' || normalized === 'raw') {
      return normalized;
    }
    return 'redacted';
  }

  private normalizeSensitiveScreenPolicy(value: unknown): WatchModeRunBudget['sensitiveScreenPolicy'] {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'redact' || normalized === 'allow') {
      return normalized;
    }
    return 'pause';
  }
}
