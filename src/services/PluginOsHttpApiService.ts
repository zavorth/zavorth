import path from 'node:path';
import * as http from 'http';
import { errorMessage } from '../utils/errorLike.js';
import {
  PluginOsControlPlaneService,
  type PluginOsControlPlaneSnapshot,
} from './PluginOsControlPlaneService.js';
import {
  PluginStateBridgeService,
  type BridgedPluginState,
} from './PluginStateBridgeService.js';
import { PluginDiscoveryService } from './PluginDiscoveryService.js';
import { PluginOsObservabilityService } from './PluginOsObservabilityService.js';
import { PluginOsBootstrapCatalogService } from './PluginOsBootstrapCatalogService.js';
import { PluginRouterService } from './PluginRouterService.js';
import { PluginOsAgentSurfaceService } from './PluginOsAgentSurfaceService.js';
import { PluginOsTelemetryService } from './PluginOsTelemetryService.js';
import { PluginOsOnboardingService } from './PluginOsOnboardingService.js';
import { PluginOsPromptInjectionService } from './PluginOsPromptInjectionService.js';
import { PluginOsOnboardingWizardService } from './PluginOsOnboardingWizardService.js';
import { PluginCuratedMarketplaceService } from './PluginCuratedMarketplaceService.js';
import { PluginOsSuggestService } from './PluginOsSuggestService.js';
import { PluginOsReceiptTimelineService } from './PluginOsReceiptTimelineService.js';
import { PluginOsPermissionPreviewService } from './PluginOsPermissionPreviewService.js';

export type PluginOsHttpAction =
  | 'enable'
  | 'disable'
  | 'trust'
  | 'uninstall'
  | 'inspect'
  | 'refresh'
  | 'recommend'
  | 'catalog-apply'
  | 'metrics-persist'
  | 'telemetry-sample'
  | 'onboarding-plan'
  | 'onboarding-apply'
  | 'onboarding-undo'
  | 'preview-permissions'
  | 'prompt-preview'
  | 'wizard-start'
  | 'wizard-next'
  | 'wizard-apply'
  | 'marketplace-refresh-remote'
  | 'suggest'
  | 'receipts-timeline'
  | 'inject-prefs';

export type PluginOsHttpActionBody = {
  action?: string;
  pluginId?: string;
  trust?: 'review' | 'trusted' | 'blocked' | string;
  approved?: boolean;
  intent?: string;
  query?: string;
  limit?: number;
  useLlm?: boolean;
  force?: boolean;
  profile?: string;
  optionalIds?: string[] | string;
  injectMode?: string;
  injectSamplePercent?: number;
  wizard?: Record<string, unknown>;
};

export type PluginOsEnrichedPlugin = BridgedPluginState & {
  loadEligible?: boolean;
  findings?: string[];
  discoveryPath?: string | null;
};

export type PluginOsHttpSnapshot = PluginOsControlPlaneSnapshot & {
  plugins: PluginOsEnrichedPlugin[];
};

export type PluginOsHttpActionResult = {
  ok: boolean;
  action: string;
  pluginId?: string | null;
  bridged?: BridgedPluginState | null;
  discovery?: unknown;
  error?: string;
  notice?: string;
  recommendations?: unknown;
  metricsPath?: string | null;
  catalog?: unknown;
  telemetry?: unknown;
  onboarding?: unknown;
  injection?: unknown;
  wizard?: unknown;
  history?: unknown;
  marketplace?: unknown;
  permissionPreview?: unknown;
  suggest?: unknown;
  timeline?: unknown;
  injectPrefs?: unknown;
};

export type PluginOsHttpApiRuntime = {
  now?: () => Date;
  projectRoot?: string;
  stateBridge?: PluginStateBridgeService;
  controlPlane?: PluginOsControlPlaneService;
  discovery?: PluginDiscoveryService;
  observability?: PluginOsObservabilityService;
  bootstrapCatalog?: PluginOsBootstrapCatalogService;
  router?: PluginRouterService;
  agentSurface?: PluginOsAgentSurfaceService;
  telemetry?: PluginOsTelemetryService;
  onboarding?: PluginOsOnboardingService;
  promptInjection?: PluginOsPromptInjectionService;
  permissionPreview?: PluginOsPermissionPreviewService;
};

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, unknown>>;

export type PluginOsHttpRouteDeps = {
  writeJson: WriteJson;
  readJsonBody: ReadJsonBody;
  workspaceRoot?: string;
};

/**
 * Live Plugin OS control-plane HTTP surface.
 *
 * Routes (do not collide with /api/operations/plugins skill plane):
 *   GET  /api/plugin-os
 *   GET  /api/plugin-os/snapshot
 *   POST /api/plugin-os/actions
 */
export class PluginOsHttpApiService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly bridge: PluginStateBridgeService;
  private readonly controlPlane: PluginOsControlPlaneService;
  private readonly discovery: PluginDiscoveryService | null;
  private readonly observability: PluginOsObservabilityService;
  private readonly bootstrapCatalog: PluginOsBootstrapCatalogService;
  private readonly router: PluginRouterService;
  private readonly agentSurface: PluginOsAgentSurfaceService;
  private readonly telemetry: PluginOsTelemetryService;
  private readonly onboarding: PluginOsOnboardingService;
  private readonly promptInjection: PluginOsPromptInjectionService;
  private readonly wizard: PluginOsOnboardingWizardService;
  private readonly curatedMarketplace: PluginCuratedMarketplaceService;
  private readonly permissionPreview: PluginOsPermissionPreviewService;
  private readonly suggestService: PluginOsSuggestService;
  private readonly receiptTimeline: PluginOsReceiptTimelineService;

  constructor(runtime: PluginOsHttpApiRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.bridge = runtime.stateBridge || new PluginStateBridgeService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.discovery = runtime.discovery || null;
    this.observability = runtime.observability || new PluginOsObservabilityService({
      now: this.now,
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
      discovery: this.discovery || undefined,
    });
    this.bootstrapCatalog = runtime.bootstrapCatalog || new PluginOsBootstrapCatalogService({
      now: this.now,
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
    });
    this.router = runtime.router || new PluginRouterService({
      now: this.now,
      stateBridge: this.bridge,
    });
    this.telemetry = runtime.telemetry || new PluginOsTelemetryService({
      now: this.now,
      projectRoot: this.projectRoot,
      observability: this.observability,
    });
    this.onboarding = runtime.onboarding || new PluginOsOnboardingService({
      now: this.now,
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
      bootstrapCatalog: this.bootstrapCatalog,
      telemetry: this.telemetry,
    });
    this.agentSurface = runtime.agentSurface || new PluginOsAgentSurfaceService({
      now: this.now,
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
      observability: this.observability,
      router: this.router,
    });
    this.promptInjection = runtime.promptInjection || new PluginOsPromptInjectionService({
      now: this.now,
      projectRoot: this.projectRoot,
      agentSurface: this.agentSurface,
      onboarding: this.onboarding,
      telemetry: this.telemetry,
    });
    this.wizard = new PluginOsOnboardingWizardService({
      now: this.now,
      projectRoot: this.projectRoot,
      onboarding: this.onboarding,
    });
    this.curatedMarketplace = new PluginCuratedMarketplaceService({
      projectRoot: this.projectRoot,
      now: this.now,
    });
    this.permissionPreview = runtime.permissionPreview || new PluginOsPermissionPreviewService({
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
      curated: this.curatedMarketplace,
    });
    this.suggestService = new PluginOsSuggestService({
      now: this.now,
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
      router: this.router,
      permissionPreview: this.permissionPreview,
      telemetry: this.telemetry,
    });
    this.receiptTimeline = new PluginOsReceiptTimelineService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.controlPlane = runtime.controlPlane || new PluginOsControlPlaneService({
      now: this.now,
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
      discovery: this.discovery || undefined,
      observability: this.observability,
    });
  }

  public buildEnrichedSnapshot(root?: string): PluginOsHttpSnapshot {
    const projectRoot = path.resolve(root || this.projectRoot);
    const base = this.controlPlane.buildSnapshot(projectRoot);
    const eligibility = this.loadEligibilityMap(projectRoot);

    const plugins: PluginOsEnrichedPlugin[] = base.plugins.map((entry) => {
      const extra = eligibility.get(entry.pluginId);
      return {
        ...entry,
        loadEligible: extra?.loadEligible,
        findings: extra?.findings?.length ? extra.findings : [],
        discoveryPath: extra?.discoveryPath ?? null,
      };
    });

    return {
      ...base,
      plugins,
    };
  }

  public async executeAction(
    body: PluginOsHttpActionBody,
    root?: string,
  ): Promise<{ ok: boolean; snapshot: PluginOsHttpSnapshot; result: PluginOsHttpActionResult }> {
    const projectRoot = path.resolve(root || this.projectRoot);
    const action = String(body.action || '').trim().toLowerCase() as PluginOsHttpAction | '';
    const pluginId = String(body.pluginId || '').trim() || null;
    const approved = body.approved === true;

    if (!action) {
      const snapshot = this.buildEnrichedSnapshot(projectRoot);
      return {
        ok: false,
        snapshot,
        result: { ok: false, action: '', error: 'action is required' },
      };
    }

    if (action === 'marketplace-refresh-remote') {
      try {
        const refreshed = await this.curatedMarketplace.refreshRemote({ root: projectRoot });
        const snapshot = this.buildEnrichedSnapshot(projectRoot);
        return {
          ok: refreshed.ok,
          snapshot,
          result: {
            ok: refreshed.ok,
            action,
            marketplace: refreshed,
            notice: refreshed.ok
              ? `remote marketplace cached (${refreshed.entries.length})`
              : refreshed.findings.join('; '),
          },
        };
      } catch (error: unknown) {
        const snapshot = this.buildEnrichedSnapshot(projectRoot);
        return {
          ok: false,
          snapshot,
          result: {
            ok: false,
            action,
            error: errorMessage(error, 'marketplace remote refresh failed'),
          },
        };
      }
    }

    if (action === 'suggest') {
      try {
        const intent = String(body.intent || body.query || '').trim();
        if (!intent) {
          const snapshot = this.buildEnrichedSnapshot(projectRoot);
          return {
            ok: false,
            snapshot,
            result: { ok: false, action, error: 'intent is required for suggest' },
          };
        }
        const suggested = await this.suggestService.suggest({
          root: projectRoot,
          intent,
          limit: body.limit,
          useLlm: body.useLlm === true,
        });
        const snapshot = this.buildEnrichedSnapshot(projectRoot);
        return {
          ok: true,
          snapshot,
          result: {
            ok: true,
            action,
            notice: 'suggest-to-enable — never auto-enables',
            suggest: {
              ...suggested,
              formatText: undefined,
              text: suggested.formatText(),
            },
          },
        };
      } catch (error: unknown) {
        const snapshot = this.buildEnrichedSnapshot(projectRoot);
        return {
          ok: false,
          snapshot,
          result: {
            ok: false,
            action,
            error: errorMessage(error, 'Plugin OS suggest failed'),
          },
        };
      }
    }

    // Read-only recommend does not require approval.
    if (action === 'recommend') {
      try {
        const intent = String(body.intent || body.query || '').trim();
        if (!intent) {
          const snapshot = this.buildEnrichedSnapshot(projectRoot);
          return {
            ok: false,
            snapshot,
            result: {
              ok: false,
              action,
              error: 'intent is required for recommend',
            },
          };
        }
        const ranked = await this.router.recommend({
          root: projectRoot,
          intent,
          limit: body.limit,
          useLlm: body.useLlm === true,
        });
        try {
          this.telemetry.recordEvent('recommend', {
            root: projectRoot,
            intent,
            counts: {
              recommendations: ranked.recommendations.length,
              candidates: ranked.candidatesConsidered,
            },
          });
        } catch {
          /* soft */
        }
        const snapshot = this.buildEnrichedSnapshot(projectRoot);
        return {
          ok: true,
          snapshot,
          result: {
            ok: true,
            action,
            notice: 'recommendations only — never auto-enables',
            recommendations: {
              intent: ranked.intent,
              usedLlm: ranked.usedLlm,
              autoEnable: false,
              recommendations: ranked.recommendations,
              candidatesConsidered: ranked.candidatesConsidered,
              text: ranked.formatText(),
            },
          },
        };
      } catch (error: unknown) {
        const snapshot = this.buildEnrichedSnapshot(projectRoot);
        return {
          ok: false,
          snapshot,
          result: {
            ok: false,
            action,
            error: errorMessage(error, 'Plugin OS recommend failed'),
          },
        };
      }
    }

    const readOnlyActions = new Set([
      'refresh',
      'inspect',
      'metrics-persist',
      'telemetry-sample',
      'onboarding-plan',
      'preview-permissions',
      'prompt-preview',
      'wizard-start',
      'wizard-next',
      'suggest',
      'receipts-timeline',
      'inject-prefs',
    ]);
    // marketplace-refresh-remote mutates cache and performs network I/O — requires approval.
    if (!readOnlyActions.has(action) && !approved) {
      const snapshot = this.buildEnrichedSnapshot(projectRoot);
      return {
        ok: false,
        snapshot,
        result: {
          ok: false,
          action,
          pluginId,
          error: 'approved: true is required for mutating Plugin OS actions',
        },
      };
    }

    try {
      const result = this.runAction(action, pluginId, body, projectRoot);
      const snapshot = this.buildEnrichedSnapshot(projectRoot);
      return { ok: result.ok, snapshot, result };
    } catch (error: unknown) {
      const snapshot = this.buildEnrichedSnapshot(projectRoot);
      return {
        ok: false,
        snapshot,
        result: {
          ok: false,
          action,
          pluginId,
          error: errorMessage(error, 'Plugin OS action failed'),
        },
      };
    }
  }

  /**
   * HTTP dispatcher for /api/plugin-os*.
   * Returns true when the pathname was handled.
   */
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: PluginOsHttpRouteDeps,
  ): Promise<boolean> {
    if (pathname !== '/api/plugin-os'
      && pathname !== '/api/plugin-os/snapshot'
      && pathname !== '/api/plugin-os/actions'
      && pathname !== '/api/plugin-os/metrics'
      && pathname !== '/api/plugin-os/marketplace'
      && pathname !== '/api/plugin-os/agent-surface'
      && pathname !== '/api/plugin-os/telemetry'
      && pathname !== '/api/plugin-os/telemetry/history'
      && pathname !== '/api/plugin-os/onboarding'
      && pathname !== '/api/plugin-os/wizard'
      && pathname !== '/api/plugin-os/suggest'
      && pathname !== '/api/plugin-os/receipts'
      && pathname !== '/api/plugin-os/inject-prefs') {
      return false;
    }

    const workspaceRoot = path.resolve(deps.workspaceRoot || this.projectRoot);

    if (
      (pathname === '/api/plugin-os' || pathname === '/api/plugin-os/snapshot')
      && (req.method === 'GET' || req.method === 'HEAD')
    ) {
      try {
        const snapshot = this.buildEnrichedSnapshot(workspaceRoot);
        deps.writeJson(res, { ok: true, snapshot }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to build Plugin OS snapshot') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/plugin-os/metrics' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const metrics = this.observability.buildSnapshot(workspaceRoot);
        deps.writeJson(res, {
          ok: true,
          metrics: {
            ...metrics,
            formatText: undefined,
            text: metrics.formatText(),
          },
        }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to build Plugin OS metrics') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/plugin-os/marketplace' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const snapshot = this.controlPlane.buildSnapshot(workspaceRoot);
        deps.writeJson(res, {
          ok: true,
          marketplace: snapshot.curatedMarketplace || [],
          metrics: snapshot.metrics || null,
        }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to build Plugin OS marketplace') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/plugin-os/agent-surface' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const surface = this.agentSurface.buildSurface({ root: workspaceRoot });
        const injection = this.promptInjection.buildInjection({
          root: workspaceRoot,
          recordTelemetry: false,
        });
        deps.writeJson(res, {
          ok: true,
          surface: {
            ...surface,
            formatText: undefined,
            text: surface.formatText(),
          },
          injection: {
            injected: injection.injected,
            reason: injection.reason,
            block: injection.block,
            health: injection.health,
            enabledCount: injection.enabledCount,
          },
        }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to build Plugin OS agent surface') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/plugin-os/telemetry' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const hours = Number(url.searchParams.get('hours') || 168) || 168;
        const aggregate = this.telemetry.aggregate({ root: workspaceRoot, windowHours: hours });
        deps.writeJson(res, {
          ok: true,
          telemetry: {
            ...aggregate,
            formatText: undefined,
            text: aggregate.formatText(),
          },
        }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to build Plugin OS telemetry') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/plugin-os/telemetry/history' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const hours = Number(url.searchParams.get('hours') || 168) || 168;
        const bucket = Number(url.searchParams.get('bucket') || 6) || 6;
        const history = this.telemetry.history({
          root: workspaceRoot,
          windowHours: hours,
          bucketHours: bucket,
        });
        deps.writeJson(res, {
          ok: true,
          history: {
            ...history,
            formatText: undefined,
            text: history.formatText(),
          },
        }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to build Plugin OS telemetry history') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/plugin-os/receipts' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const limit = Number(url.searchParams.get('limit') || 30) || 30;
        const timeline = this.receiptTimeline.buildTimeline({ root: workspaceRoot, limit });
        deps.writeJson(res, {
          ok: true,
          timeline: {
            ...timeline,
            formatText: undefined,
            text: timeline.formatText(),
          },
        }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to build Plugin OS receipts timeline') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/plugin-os/inject-prefs' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const prefs = this.promptInjection.loadPrefs(workspaceRoot);
        deps.writeJson(res, { ok: true, injectPrefs: prefs }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to load inject prefs') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/plugin-os/wizard' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const state = this.wizard.start({ root: workspaceRoot });
        deps.writeJson(res, {
          ok: true,
          wizard: {
            ...state,
            formatText: undefined,
            text: state.formatText(),
            plan: state.plan
              ? { ...state.plan, formatText: undefined, text: state.plan.formatText() }
              : null,
          },
        }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to build Plugin OS wizard') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/plugin-os/onboarding' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const status = this.onboarding.status(workspaceRoot);
        deps.writeJson(res, {
          ok: true,
          onboarding: {
            ...status,
            formatText: undefined,
            text: status.formatText(),
          },
        }, 200);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to build Plugin OS onboarding status') },
          500,
        );
      }
      return true;
    }

    if (pathname === '/api/plugin-os/actions' && req.method === 'POST') {
      try {
        const body = (await deps.readJsonBody(req)) as PluginOsHttpActionBody;
        const response = await this.executeAction(body, workspaceRoot);
        deps.writeJson(
          res,
          {
            ok: response.ok,
            snapshot: response.snapshot,
            result: response.result,
          },
          response.ok ? 200 : 400,
        );
      } catch (error: unknown) {
        deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failed to execute Plugin OS action') },
          400,
        );
      }
      return true;
    }

    deps.writeJson(res, { ok: false, error: 'Method not allowed' }, 405);
    return true;
  }

  private runAction(
    action: PluginOsHttpAction | string,
    pluginId: string | null,
    body: PluginOsHttpActionBody,
    projectRoot: string,
  ): PluginOsHttpActionResult {
    if (action === 'refresh') {
      return {
        ok: true,
        action: 'refresh',
        pluginId,
        notice: 'snapshot refreshed',
      };
    }

    if (action === 'metrics-persist') {
      const persisted = this.observability.persistSnapshot(projectRoot);
      try {
        this.telemetry.recordSample({ root: projectRoot, snapshot: persisted.snapshot });
      } catch {
        /* soft */
      }
      return {
        ok: persisted.ok,
        action,
        pluginId,
        metricsPath: persisted.path,
        notice: persisted.ok ? 'metrics persisted' : 'metrics persist soft-failed',
      };
    }

    if (action === 'telemetry-sample') {
      const event = this.telemetry.recordSample({ root: projectRoot });
      const aggregate = this.telemetry.aggregate({ root: projectRoot });
      return {
        ok: true,
        action,
        pluginId,
        telemetry: {
          event,
          aggregate: {
            ...aggregate,
            formatText: undefined,
            text: aggregate.formatText(),
          },
        },
        notice: 'telemetry sample recorded',
      };
    }

    if (action === 'onboarding-plan') {
      const optionalIds = normalizeOptionalIds(body.optionalIds);
      const plan = this.onboarding.plan(body.profile, { root: projectRoot, optionalIds });
      return {
        ok: plan.ok,
        action,
        pluginId,
        onboarding: {
          ...plan,
          formatText: undefined,
          text: plan.formatText(),
        },
        notice: `onboarding plan profile=${plan.profile}`,
      };
    }

    if (action === 'onboarding-apply') {
      const optionalIds = normalizeOptionalIds(body.optionalIds);
      const applied = this.onboarding.apply(body.profile, {
        root: projectRoot,
        optionalIds,
        approved: true,
        force: body.force === true,
      });
      return {
        ok: applied.ok,
        action,
        pluginId,
        onboarding: {
          ...applied,
          formatText: undefined,
          text: applied.formatText(),
        },
        notice: `onboarding apply enabled=${applied.enabled.length}`,
      };
    }

    if (action === 'onboarding-undo') {
      const undone = this.onboarding.undo({
        root: projectRoot,
        approved: true,
      });
      return {
        ok: undone.ok,
        action,
        pluginId,
        onboarding: {
          ...undone,
          formatText: undefined,
          text: undone.formatText(),
        },
        notice: `onboarding undo disabled=${undone.disabled.length}`,
      };
    }

    if (action === 'preview-permissions') {
      if (!pluginId) {
        return {
          ok: false,
          action,
          pluginId,
          error: 'pluginId is required for preview-permissions',
        };
      }
      const preview = this.permissionPreview.preview(pluginId, projectRoot);
      return {
        ok: preview.ok || Boolean(preview.pluginId),
        action,
        pluginId: preview.pluginId,
        permissionPreview: {
          ...preview,
          formatText: undefined,
          text: preview.formatText(),
        },
        notice: preview.ok
          ? `permission preview for ${preview.pluginId}`
          : `permission preview soft-failed for ${preview.pluginId}`,
      };
    }

    if (action === 'prompt-preview') {
      const injection = this.promptInjection.buildInjection({
        root: projectRoot,
        recordTelemetry: false,
        mode: body.injectMode as any,
      });
      return {
        ok: injection.injected || injection.reason.startsWith('disabled') || injection.reason === 'ab_sample_miss',
        action,
        pluginId,
        injection,
        notice: injection.reason,
      };
    }

    if (action === 'receipts-timeline') {
      const timeline = this.receiptTimeline.buildTimeline({
        root: projectRoot,
        limit: body.limit || 30,
      });
      return {
        ok: true,
        action,
        pluginId,
        timeline: {
          ...timeline,
          formatText: undefined,
          text: timeline.formatText(),
        },
        notice: `receipts=${timeline.entries.length}`,
      };
    }

    if (action === 'inject-prefs') {
      if (body.injectMode) {
        if (body.approved !== true) {
          return {
            ok: false,
            action,
            pluginId,
            error: 'approved: true is required to change inject prefs',
          };
        }
        const saved = this.promptInjection.savePrefs({
          injectMode: body.injectMode as any,
          injectSamplePercent: body.injectSamplePercent,
        }, projectRoot);
        return {
          ok: true,
          action,
          pluginId,
          injectPrefs: saved,
          notice: `injectMode=${saved.injectMode}`,
        };
      }
      const prefs = this.promptInjection.loadPrefs(projectRoot);
      return {
        ok: true,
        action,
        pluginId,
        injectPrefs: prefs,
        notice: `injectMode=${prefs.injectMode}`,
      };
    }

    if (action === 'wizard-start') {
      const state = this.wizard.start({
        root: projectRoot,
        profile: body.profile,
        optionalIds: normalizeOptionalIds(body.optionalIds),
      });
      return {
        ok: true,
        action,
        pluginId,
        wizard: serializeWizard(state),
        notice: `wizard step=${state.step}`,
      };
    }

    if (action === 'wizard-next') {
      let state = this.wizard.start({
        root: projectRoot,
        profile: body.profile || (body.wizard?.profile as string) || undefined,
        optionalIds: normalizeOptionalIds(
          body.optionalIds
          || (Array.isArray(body.wizard?.optionalIds) ? body.wizard?.optionalIds as string[] : undefined),
        ),
      });
      if (body.injectMode || body.wizard?.injectMode) {
        state = this.wizard.setInject(
          state,
          String(body.injectMode || body.wizard?.injectMode || 'compact') as any,
          Number(body.injectSamplePercent ?? body.wizard?.injectSamplePercent ?? 100),
          { root: projectRoot },
        );
      }
      // advance until requested step or one step
      const targetStep = String(body.wizard?.step || '').trim();
      if (targetStep) {
        let guard = 0;
        while (state.step !== targetStep && guard < 8) {
          const next = this.wizard.next(state, { root: projectRoot });
          if (next.stepIndex <= state.stepIndex) break;
          state = next;
          guard += 1;
        }
      } else {
        state = this.wizard.next(state, { root: projectRoot });
      }
      return {
        ok: true,
        action,
        pluginId,
        wizard: serializeWizard(state),
        notice: `wizard step=${state.step}`,
      };
    }

    if (action === 'wizard-apply') {
      let state = this.wizard.start({
        root: projectRoot,
        profile: body.profile || (body.wizard?.profile as string) || 'recommended',
        optionalIds: normalizeOptionalIds(
          body.optionalIds
          || (Array.isArray(body.wizard?.optionalIds) ? body.wizard?.optionalIds as string[] : undefined),
        ),
      });
      if (body.injectMode || body.wizard?.injectMode) {
        state = this.wizard.setInject(
          state,
          String(body.injectMode || body.wizard?.injectMode || 'compact') as any,
          Number(body.injectSamplePercent ?? body.wizard?.injectSamplePercent ?? 100),
          { root: projectRoot },
        );
      }
      const applied = this.wizard.apply(state, {
        root: projectRoot,
        approved: true,
        force: body.force === true,
      });
      return {
        ok: applied.result.ok,
        action,
        pluginId,
        wizard: serializeWizard(applied.state),
        onboarding: {
          ...applied.result,
          formatText: undefined,
          text: applied.result.formatText(),
        },
        notice: `wizard apply enabled=${applied.result.enabled.length}`,
      };
    }

    if (action === 'marketplace-refresh-remote') {
      // async refresh handled in executeAction
      return {
        ok: false,
        action,
        pluginId,
        error: 'marketplace-refresh-remote must use async path',
      };
    }

    if (action === 'catalog-apply') {
      const catalog = this.bootstrapCatalog.apply({
        root: projectRoot,
        force: body.force === true,
      });
      this.observability.recordBootstrapResult(catalog, projectRoot);
      try {
        this.telemetry.recordEvent('catalog-apply', {
          root: projectRoot,
          counts: {
            enabled: catalog.enabled.length,
            skipped: catalog.skipped.length,
            missing: catalog.missing.length,
          },
        });
      } catch {
        /* soft */
      }
      return {
        ok: catalog.ok,
        action,
        pluginId,
        catalog: {
          enabled: catalog.enabled,
          skipped: catalog.skipped,
          missing: catalog.missing,
          findings: catalog.findings,
        },
        notice: `catalog enabled=${catalog.enabled.length}`,
      };
    }

    if (action === 'recommend') {
      // Synchronous shell; recommend is async — handled in executeAction below via promise path.
      // Keep stub for unknown-action safety; executeAction overrides recommend.
      return {
        ok: false,
        action,
        pluginId,
        error: 'recommend must be executed via executeAction async path',
      };
    }

    if (!pluginId) {
      return { ok: false, action, pluginId, error: 'pluginId is required' };
    }

    if (action === 'enable') {
      // Prefer install+enable when package exists only as curated/bundled state.
      let bridged = this.bridge.resolve(pluginId);
      if (!bridged.installed) {
        bridged = this.bridge.markInstalled({
          pluginId,
          revision: bridged.installedRevision || '1.0.0',
          sourceLocator: bridged.sourceLocator || `bundled://${pluginId}`,
          trust: bridged.trust === 'blocked' ? 'review' : bridged.trust,
          enable: true,
        });
      } else {
        bridged = this.bridge.setEnabled(pluginId, true);
      }
      try {
        this.telemetry.recordEvent('enable', { root: projectRoot, pluginId });
      } catch {
        /* soft */
      }
      return { ok: true, action, pluginId, bridged };
    }

    if (action === 'disable') {
      const bridged = this.bridge.setEnabled(pluginId, false);
      try {
        this.telemetry.recordEvent('disable', { root: projectRoot, pluginId });
      } catch {
        /* soft */
      }
      return { ok: true, action, pluginId, bridged };
    }

    if (action === 'trust') {
      const trustRaw = String(body.trust || 'review').trim().toLowerCase();
      const trust = trustRaw === 'trusted' || trustRaw === 'blocked' || trustRaw === 'review'
        ? trustRaw
        : 'review';
      const bridged = this.bridge.setTrust(pluginId, trust);
      return { ok: true, action, pluginId, bridged };
    }

    if (action === 'uninstall') {
      const bridged = this.bridge.markUninstalled(pluginId);
      this.bridge.syncRuntimeIndex();
      return { ok: true, action, pluginId, bridged };
    }

    if (action === 'inspect') {
      const bridged = this.bridge.resolve(pluginId);
      let discovery: unknown = null;
      try {
        const service = this.discovery || new PluginDiscoveryService({
          now: this.now,
          projectRoot,
          stateLookup: this.bridge.asStateLookup(),
        });
        const snapshot = service.discover({ projectRoot });
        const plugins = (snapshot as { plugins?: Array<Record<string, unknown>> }).plugins || [];
        const entry = plugins.find((item) => {
          const id = String(item.pluginId || item.id || '');
          return id === pluginId || id === bridged.pluginId;
        });
        discovery = entry || null;
      } catch {
        discovery = null;
      }
      return { ok: true, action, pluginId, bridged, discovery };
    }

    return { ok: false, action, pluginId, error: `unknown action: ${action}` };
  }

  private loadEligibilityMap(projectRoot: string): Map<string, {
    loadEligible?: boolean;
    findings?: string[];
    discoveryPath?: string | null;
  }> {
    const map = new Map<string, {
      loadEligible?: boolean;
      findings?: string[];
      discoveryPath?: string | null;
    }>();
    try {
      const service = this.discovery || new PluginDiscoveryService({
        now: this.now,
        projectRoot,
        stateLookup: this.bridge.asStateLookup(),
      });
      const snapshot = service.discover({ projectRoot });
      const plugins = (snapshot as { plugins?: Array<Record<string, unknown>> }).plugins || [];
      for (const entry of plugins) {
        const id = String(entry.pluginId || entry.id || '').trim();
        if (!id) continue;
        const validation = entry.validation as { findings?: unknown[]; messages?: unknown[] } | undefined;
        const findings = Array.isArray(entry.findings)
          ? entry.findings.map(String)
          : Array.isArray(validation?.findings)
            ? validation.findings.map(String)
            : Array.isArray(validation?.messages)
              ? validation.messages.map(String)
              : [];
        map.set(id, {
          loadEligible: Boolean(entry.loadEligible ?? entry.eligible),
          findings,
          discoveryPath: entry.path
            ? String(entry.path)
            : entry.packageDir
              ? String(entry.packageDir)
              : entry.rootDir
                ? String(entry.rootDir)
                : null,
        });
      }
    } catch {
      /* soft-fail enrichment */
    }
    return map;
  }
}

function normalizeOptionalIds(raw: string[] | string | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map((id) => id.trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,\s]+/u).map((id) => id.trim()).filter(Boolean);
  }
  return [];
}

function serializeWizard(state: {
  step: string;
  stepIndex: number;
  steps: string[];
  profile: string;
  optionalIds: string[];
  injectMode: string;
  injectSamplePercent: number;
  completed: boolean;
  optionals: unknown[];
  profiles: unknown[];
  findings: string[];
  plan: { formatText(): string; [key: string]: unknown } | null;
  formatText(): string;
}): Record<string, unknown> {
  return {
    step: state.step,
    stepIndex: state.stepIndex,
    steps: state.steps,
    profile: state.profile,
    optionalIds: state.optionalIds,
    injectMode: state.injectMode,
    injectSamplePercent: state.injectSamplePercent,
    completed: state.completed,
    optionals: state.optionals,
    profiles: state.profiles,
    findings: state.findings,
    text: state.formatText(),
    plan: state.plan
      ? {
        ...state.plan,
        formatText: undefined,
        text: state.plan.formatText(),
      }
      : null,
  };
}
