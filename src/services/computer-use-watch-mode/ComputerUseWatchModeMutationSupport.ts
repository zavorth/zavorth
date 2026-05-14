import type { CapabilityApprovalScope, CapabilityLifecycleService } from '../CapabilityLifecycleService.js';
import type { ZavorthMutationPlaneService } from '../ZavorthMutationPlaneService.js';
import type { ZavorthMutationPlan } from '../../contracts/ZavorthMutationPlaneContract.js';
import type { PermissionService } from '../PermissionService.js';
import type { TrustDecisionService } from '../TrustDecisionService.js';
import type { StartWatchModeRunInput, WatchModeMutationPreview, WatchModeRunSnapshot, WatchModeSnapshot } from './ComputerUseWatchModeSharedTypes.js';

type ComputerUseWatchModeMutationSupportDeps = {
  mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'>;
  trustDecisionService: Pick<TrustDecisionService, 'evaluate'>;
  permissionService: Pick<PermissionService, 'getRequest'>;
  capabilityLifecycleService: Pick<CapabilityLifecycleService, 'shouldBootCapability' | 'registerCapabilityDemand' | 'enableCapability' | 'registerCapabilityUsage'>;
  previewSnapshot: (limit?: number) => WatchModeSnapshot;
  startRun: (input: StartWatchModeRunInput) => Promise<WatchModeRunSnapshot>;
  setStrictApprovalDefault: (value: boolean) => WatchModeSnapshot;
  allowApp: (app: string) => WatchModeSnapshot;
  allowSite: (site: string) => WatchModeSnapshot;
  resolveCapabilityScope: (plan: ZavorthMutationPlan) => CapabilityApprovalScope;
};

export class ComputerUseWatchModeMutationSupport {
  constructor(private readonly deps: ComputerUseWatchModeMutationSupportDeps) {}

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
    const actionId = input.actionId;
    const payload = this.buildMutationPayload(input);
    const plan = this.deps.mutationPlane.createPlan({
      domain: 'watch',
      actionId,
      title: this.buildMutationTitle(actionId, payload),
      summary: this.buildMutationSummary(actionId, payload),
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'watch-mode',
      riskLevel: actionId === 'start' ? 'high' : 'medium',
      approvalRequired: true,
      approvalReason: 'Watch Mode aumenta poder visual/mutavel e exige approval antes de executar.',
      resourceImpact: {
        ramMb: actionId === 'start' ? 180 : 0,
        diskMb: actionId === 'start' ? Math.ceil(Number(payload.maxScreenshotBytes || 0) / (1024 * 1024)) : 1,
        processCount: actionId === 'start' ? 1 : 0,
        externalExposure: actionId === 'allow-site' || payload.siteUrl ? 'network' : 'local',
        recurring: false,
        notes: [
          `maxIterations ${Number(payload.maxIterations || 8)}`,
          `maxRuntime ${Number(payload.maxDurationMs || 600000)}ms`,
          `screenshots TTL ${Number(payload.screenshotTtlMs || 86400000)}ms`,
          `redaction ${String(payload.screenshotRedactionMode || 'redacted')}`,
        ],
      },
      retentionPolicy: {
        ttlMs: Number(payload.screenshotTtlMs || 24 * 60 * 60 * 1000),
        maxBytes: Number(payload.maxScreenshotBytes || 250 * 1024 * 1024),
        cleanupOnSuccess: false,
        cleanupOnBoot: true,
        notes: ['Screenshots e timeline sao efemeros e seguem policy de redaction/sensitive-screen.'],
      },
      validationPlan: [
        'Confirmar capability watch-mode ativa ou aprovada sob demanda.',
        'Checar TrustDecisionService antes de aplicar.',
        'Bloquear start se Runtime Stability Gate estiver failed.',
      ],
      rollbackPlan: [
        actionId === 'start' ? 'Stop/pause continuam diretos como acoes de seguranca.' : 'Reaplicar policy anterior do Watch Mode.',
      ],
      payload,
    });
    const decision = await this.deps.trustDecisionService.evaluate({
      domain: 'watch',
      actionId,
      planId: plan.id,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'watch-mode',
      riskLevel: actionId === 'start' ? 'high' : 'medium',
      approvalRequired: true,
      capabilityId: actionId === 'start' ? 'watch-mode' : null,
      reason: 'Watch Mode mutavel exige approval.',
      payload,
      resourceImpact: plan.resourceImpact,
    });
    const mutationPlan = decision.permission
      ? this.deps.mutationPlane.attachApproval(plan.id, {
        permissionId: decision.permission.permission_id,
        status: decision.permission.status === 'approved' ? 'approved' : 'pending',
        reason: decision.reason,
      })
      : plan;
    return {
      generatedAt: new Date().toISOString(),
      status: decision.decision === 'blocked' ? 'blocked' : 'waiting_approval',
      ok: false,
      summary: decision.decision === 'blocked'
        ? decision.reason
        : `Preview criado para Watch Mode ${actionId}; aplique somente apos approval.`,
      mutationPlan,
      trustDecision: decision,
      snapshot: this.deps.previewSnapshot(8),
    };
  }

  public async applyMutationPlan(input: {
    planId: string;
    requestedBy?: string | null;
  }): Promise<{ ok: true; status: 'applied'; mutationPlan: ZavorthMutationPlan; snapshot: WatchModeSnapshot; run: WatchModeRunSnapshot | null }> {
    let plan = this.deps.mutationPlane.readPlan(input.planId);
    if (!plan || plan.domain !== 'watch') {
      throw new Error(`Plano de Watch Mode nao encontrado: ${input.planId || 'n/d'}.`);
    }
    if (plan.status === 'expired' || plan.status === 'blocked') {
      throw new Error(`Plano ${plan.id} nao pode ser aplicado porque esta ${plan.status}.`);
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      const permission = plan.approval.permissionId
        ? await this.deps.permissionService.getRequest(plan.approval.permissionId)
        : null;
      if (permission?.status === 'approved') {
        plan = this.deps.mutationPlane.approvePlan(plan.id, {
          permissionId: permission.permission_id,
          approvedBy: permission.decided_by || input.requestedBy || null,
          scope: permission.scope === 'persistent' ? 'host' : permission.scope === 'session' ? 'session' : 'once',
        });
      }
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      throw new Error(`Plano ${plan.id} ainda aguarda approval.`);
    }

    const payload = plan.payload || {};
    let run: WatchModeRunSnapshot | null = null;
    if (plan.actionId === 'start') {
      this.deps.capabilityLifecycleService.enableCapability('watch-mode', input.requestedBy || 'watch-mode', this.deps.resolveCapabilityScope(plan));
      run = await this.deps.startRun({
        targetWindow: String(payload.targetWindow || ''),
        objective: String(payload.objective || ''),
        siteUrl: this.normalizeOptional(payload.siteUrl),
        requestedBy: input.requestedBy || null,
        strictApproval: typeof payload.strictApproval === 'boolean' ? payload.strictApproval : null,
        maxIterations: Number(payload.maxIterations || 8),
        maxDurationMs: Number(payload.maxDurationMs || 10 * 60 * 1000),
        maxScreenshots: Number(payload.maxScreenshots || 24),
        maxMemoryMb: Number(payload.maxMemoryMb || 512),
        idleTtlMs: Number(payload.idleTtlMs || 2 * 60 * 1000),
        screenshotTtlMs: Number(payload.screenshotTtlMs || 24 * 60 * 60 * 1000),
        maxScreenshotBytes: Number(payload.maxScreenshotBytes || 250 * 1024 * 1024),
        screenshotRedactionMode: String(payload.screenshotRedactionMode || 'redacted'),
        sensitiveScreenPolicy: String(payload.sensitiveScreenPolicy || 'pause'),
        delayBetweenActionsMs: Number(payload.delayBetweenActionsMs || 1200),
        approvedPlanId: plan.id,
      });
      this.deps.capabilityLifecycleService.registerCapabilityUsage('watch-mode', `started from approved plan ${plan.id}`);
    } else if (plan.actionId === 'set-strict-default') {
      this.deps.setStrictApprovalDefault(payload.strictApproval !== false);
    } else if (plan.actionId === 'allow-app') {
      this.deps.allowApp(String(payload.app || ''));
    } else if (plan.actionId === 'allow-site') {
      this.deps.allowSite(String(payload.site || ''));
    } else {
      throw new Error(`Acao de Watch Mode desconhecida no plano: ${plan.actionId}.`);
    }

    const appliedPlan = this.deps.mutationPlane.markApplied(plan.id, `Watch Mode ${plan.actionId} aplicado.`, [plan.actionId]);
    return {
      ok: true,
      status: 'applied',
      mutationPlan: appliedPlan,
      snapshot: this.deps.previewSnapshot(8),
      run,
    };
  }

  private buildMutationPayload(input: {
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
  }): Record<string, unknown> {
    if (input.actionId === 'start') {
      return {
        targetWindow: this.normalizeOptional(input.targetWindow),
        objective: this.normalizeOptional(input.objective),
        siteUrl: this.normalizeOptional(input.siteUrl),
        strictApproval: typeof input.strictApproval === 'boolean' ? input.strictApproval : null,
        maxIterations: this.positiveNumber(input.maxIterations, 8),
        maxDurationMs: this.positiveNumber(input.maxDurationMs, 10 * 60 * 1000),
        maxScreenshots: this.positiveNumber(input.maxScreenshots, 24),
        maxMemoryMb: this.positiveNumber(input.maxMemoryMb, 512),
        idleTtlMs: this.positiveNumber(input.idleTtlMs, 2 * 60 * 1000),
        screenshotTtlMs: this.positiveNumber(input.screenshotTtlMs, 24 * 60 * 60 * 1000),
        maxScreenshotBytes: this.positiveNumber(input.maxScreenshotBytes, 250 * 1024 * 1024),
        screenshotRedactionMode: this.normalizeRedactionMode(input.screenshotRedactionMode),
        sensitiveScreenPolicy: this.normalizeSensitiveScreenPolicy(input.sensitiveScreenPolicy),
        delayBetweenActionsMs: 1200,
      };
    }
    if (input.actionId === 'set-strict-default') {
      return { strictApproval: input.strictApproval !== false };
    }
    if (input.actionId === 'allow-app') {
      return { app: this.normalizeApp(input.app) };
    }
    return { site: this.normalizeSite(input.site) };
  }

  private buildMutationTitle(actionId: string, payload: Record<string, unknown>): string {
    if (actionId === 'start') {
      return `Iniciar Watch Mode em ${String(payload.targetWindow || 'janela')}`;
    }
    if (actionId === 'set-strict-default') {
      return `Alterar strict approval para ${payload.strictApproval === false ? 'off' : 'on'}`;
    }
    if (actionId === 'allow-app') {
      return `Liberar app ${String(payload.app || 'n/d')}`;
    }
    return `Liberar site ${String(payload.site || 'n/d')}`;
  }

  private buildMutationSummary(actionId: string, payload: Record<string, unknown>): string {
    if (actionId === 'start') {
      return `Start visual para ${String(payload.objective || 'objetivo')} com approval e TTL de screenshots.`;
    }
    if (actionId === 'set-strict-default') {
      return payload.strictApproval === false
        ? 'Desligar strict approval reduz friccao e aumenta poder automatico.'
        : 'Ligar strict approval reduz risco e pode ser aplicado como hardening.';
    }
    if (actionId === 'allow-app') {
      return `Adicionar ${String(payload.app || 'app')} a allowlist do Watch Mode.`;
    }
    return `Adicionar ${String(payload.site || 'site')} a allowlist do Watch Mode.`;
  }

  private normalizeOptional(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
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
    } catch {
      return null;
    }
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : fallback;
  }

  private normalizeRedactionMode(value: unknown): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'metadata-only' || normalized === 'raw') {
      return normalized;
    }
    return 'redacted';
  }

  private normalizeSensitiveScreenPolicy(value: unknown): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'redact' || normalized === 'allow') {
      return normalized;
    }
    return 'pause';
  }
}
