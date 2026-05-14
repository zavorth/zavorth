import { getDefaultCapabilityRegistry, type CapabilityRegistry } from '../../../../capabilities/CapabilityRegistry.js';
import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { TaskResourceImpact } from '../../../../contracts/TaskResourcePlannerContract.js';
import { ZavorthMutationPlaneService } from '../../../../services/ZavorthMutationPlaneService.js';
import type { CapabilityLifecycleService } from '../../../../services/CapabilityLifecycleService.js';
import type { PermissionService } from '../../../../services/PermissionService.js';
import { TaskResourcePlannerService } from '../../../../services/TaskResourcePlannerService.js';
import { TrustDecisionService } from '../../../../services/TrustDecisionService.js';
import {
  buildReportSurfaceResponse,
  buildRuntimeSurfaceResponse,
  renderPlainSurfaceResponse,
  type SurfaceReceiptStatus,
} from '../surface-response/index.js';

type CapabilityLifecycleLike = Pick<
  CapabilityLifecycleService,
  'getManifest'
  | 'registerCapabilityDemand'
  | 'enableCapability'
  | 'disableCapability'
  | 'markCapabilityState'
  | 'registerCapabilityUsage'
>;

type TaskResourcePlannerLike = Pick<
  TaskResourcePlannerService,
  'planCapabilityEnable' | 'renderImpactSummary' | 'toMutationResourceImpact'
>;

type CapabilityRegistryLike = Pick<CapabilityRegistry, 'getSummary' | 'getAll'>;

type SharedSurfaceCapabilityCommandPackDeps = {
  capabilityLifecycleService: CapabilityLifecycleLike | null;
  taskResourcePlannerService: TaskResourcePlannerLike | null;
  permissionService?: PermissionService | null;
  capabilityRegistry?: CapabilityRegistryLike;
};

export class SharedSurfaceCapabilityCommandPack {
  private readonly deps: Required<Pick<SharedSurfaceCapabilityCommandPackDeps, 'capabilityRegistry'>>
    & Omit<SharedSurfaceCapabilityCommandPackDeps, 'capabilityRegistry'>;

  public constructor(deps: SharedSurfaceCapabilityCommandPackDeps) {
    this.deps = {
      ...deps,
      capabilityRegistry: deps.capabilityRegistry || getDefaultCapabilityRegistry(),
    };
  }

  public async handleEnable(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.capabilityLifecycleService) {
      await ctx.reply('Capability Lifecycle indisponivel neste runtime.');
      return;
    }

    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const capabilityId = String(tokens[0] || '').trim();
    const scopeCandidate = String(tokens[1] || '').trim().toLowerCase();
    const scope = scopeCandidate === 'once' || scopeCandidate === 'session' || scopeCandidate === 'host'
      ? scopeCandidate
      : 'host';
    if (!capabilityId) {
      await ctx.reply('Uso: /enable <capability> [once|session|host]');
      return;
    }

    const manifest = this.deps.capabilityLifecycleService.getManifest(capabilityId);
    if (!manifest) {
      await ctx.reply(`Capability desconhecida: ${capabilityId}. Use /capabilities para listar as disponiveis.`);
      return;
    }

    const requestedBy = String(ctx.userId || '').trim() || 'operator';
    const reason = `Habilitar ${manifest.label} via ${ctx.platform}.`;
    const impact = await this.deps.taskResourcePlannerService?.planCapabilityEnable(capabilityId, {
      requestedBy,
      intent: reason,
    }) || null;
    const mutationPlane = new ZavorthMutationPlaneService();
    const mutationPlan = mutationPlane.createPlan({
      domain: 'capability',
      actionId: 'enable',
      title: `Enable capability ${manifest.label}`,
      summary: reason,
      requestedBy,
      sourceSurface: ctx.platform,
      riskLevel: manifest.approvalRequired ? 'high' : 'low',
      approvalRequired: manifest.approvalRequired,
      approvalReason: reason,
      resourceImpact: this.deps.taskResourcePlannerService?.toMutationResourceImpact(impact) || {
        ramMb: Number(manifest.estimatedFootprint.ramIdleMb || 0),
        diskMb: Number(manifest.estimatedFootprint.diskMb || 0),
        processCount: Number(manifest.estimatedFootprint.processCount || 0),
        externalExposure: manifest.activationMode === 'sidecar' ? 'local' : 'none',
        recurring: false,
        notes: manifest.estimatedFootprint.notes ? [manifest.estimatedFootprint.notes] : [],
      },
      validationPlan: ['manifest', 'approval', 'runtime readiness'],
      rollbackPlan: [`/disable ${capabilityId}`],
      payload: {
        capabilityId,
        scope,
      },
    });

    const demand = this.deps.capabilityLifecycleService.registerCapabilityDemand(capabilityId, requestedBy, reason);
    if (manifest.approvalRequired) {
      const decision = await new TrustDecisionService({
        capabilityLifecycleService: this.deps.capabilityLifecycleService as any,
        permissionService: this.deps.permissionService || undefined,
      }).evaluate({
        domain: 'capability',
        actionId: 'enable',
        planId: mutationPlan.id,
        requestedBy,
        sourceSurface: ctx.platform,
        riskLevel: manifest.activationMode === 'sidecar' ? 'high' : 'medium',
        approvalRequired: true,
        capabilityId,
        reason,
        approvalScope: scope as any,
        resourceImpact: this.deps.taskResourcePlannerService?.toMutationResourceImpact(impact) || mutationPlan.resourceImpact,
        payload: {
          capabilityId,
          scope,
        },
      });
      let plan = mutationPlan;
      if (decision.permission) {
        plan = mutationPlane.attachApproval(plan.id, {
          permissionId: decision.permission.permission_id,
          status: decision.decision === 'allowed' ? 'approved' : 'pending',
          reason: decision.reason,
        });
      }
      if (decision.decision === 'blocked') {
        plan = mutationPlane.markBlocked(plan.id, decision.reason);
        await ctx.reply(this.formatCapabilityEnableReply({
          applied: false,
          waitingApproval: false,
          capabilityId,
          label: manifest.label,
          scope,
          impact,
          mutationPlanId: plan.id,
          summary: decision.reason,
        }));
        return;
      }
      if (decision.decision === 'requires_approval') {
        await ctx.reply(this.formatCapabilityEnableReply({
          applied: false,
          waitingApproval: true,
          capabilityId,
          label: manifest.label,
          scope,
          impact,
          mutationPlanId: plan.id,
          summary: decision.reason,
        }));
        return;
      }
    }

    const enabled = this.deps.capabilityLifecycleService.enableCapability(capabilityId, requestedBy, scope as any);
    this.deps.capabilityLifecycleService.markCapabilityState(capabilityId, 'active', `activated via shared surface by ${requestedBy}`);
    this.deps.capabilityLifecycleService.registerCapabilityUsage(capabilityId, `capability activated in ${ctx.platform}`);
    const appliedPlan = mutationPlane.markApplied(
      mutationPlan.id,
      `Capability ${manifest.label} habilitada via shared surface.`,
      [`capability.enable:${capabilityId}`],
    );
    await ctx.reply(this.formatCapabilityEnableReply({
      applied: true,
      waitingApproval: false,
      capabilityId,
      label: manifest.label,
      scope,
      impact,
      mutationPlanId: appliedPlan.id,
      summary: enabled?.fallbackBehavior
        ? `${manifest.label} habilitada.`
        : `Capability ${manifest.label} habilitada.`,
    }));
  }

  public async handleDisable(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.capabilityLifecycleService) {
      await ctx.reply('Capability Lifecycle indisponivel neste runtime.');
      return;
    }

    const capabilityId = String(args || '').trim().split(/\s+/).filter(Boolean)[0] || '';
    if (!capabilityId) {
      await ctx.reply('Uso: /disable <capability>');
      return;
    }
    if (capabilityId === 'core-runtime') {
      await ctx.reply('core-runtime nao pode ser desabilitada.');
      return;
    }

    const manifest = this.deps.capabilityLifecycleService.getManifest(capabilityId);
    if (!manifest) {
      await ctx.reply(`Capability desconhecida: ${capabilityId}.`);
      return;
    }

    const requestedBy = String(ctx.userId || '').trim() || 'operator';
    const disabled = this.deps.capabilityLifecycleService.disableCapability(capabilityId, requestedBy);
    const mutationPlane = new ZavorthMutationPlaneService();
    const plan = mutationPlane.createPlan({
      domain: 'capability',
      actionId: 'disable',
      title: `Disable capability ${manifest.label}`,
      summary: `Desabilitar ${manifest.label} via ${ctx.platform}.`,
      requestedBy,
      sourceSurface: ctx.platform,
      riskLevel: 'low',
      approvalRequired: false,
      validationPlan: ['cleanup', 'state snapshot'],
      rollbackPlan: [`/enable ${capabilityId}`],
      payload: {
        capabilityId,
      },
    });
    mutationPlane.markApplied(plan.id, `Capability ${manifest.label} desabilitada via shared surface.`, [`capability.disable:${capabilityId}`]);
    await ctx.reply(this.renderCapabilityAction(
      'capability-disable',
      `Capability ${manifest.label} desabilitada.`,
      [
      `Capability ${manifest.label} desabilitada.`,
      '',
      disabled?.notes ? `Estado: ${disabled.notes}` : 'A capability voltou para o modo leve/dormente.',
      `Rollback: /enable ${capabilityId}.`,
      ].filter(Boolean).join('\n'),
      {
        capabilityId,
        mutationPlanId: plan.id,
      },
    ));
  }

  private formatCapabilityEnableReply(input: {
    applied: boolean;
    waitingApproval: boolean;
    capabilityId: string;
    label: string;
    scope: string;
    impact: TaskResourceImpact | null;
    mutationPlanId: string | null;
    summary: string;
  }): string {
    const text = [
      input.applied
        ? `Capability ${input.label} habilitada.`
        : input.waitingApproval
          ? `Capability ${input.label} aguardando approval.`
          : `Capability ${input.label} nao foi habilitada.`,
      '',
      input.summary,
      this.deps.taskResourcePlannerService?.renderImpactSummary(input.impact) || null,
      `Escopo: ${input.scope}.`,
      input.mutationPlanId ? `Plano: ${input.mutationPlanId}.` : null,
      input.waitingApproval ? `Proximo passo: aprovar a mutacao e repetir /enable ${input.capabilityId} ${input.scope}.` : null,
    ].filter(Boolean).join('\n');
    return this.renderCapabilityAction(
      'capability-enable',
      input.summary,
      text,
      {
        capabilityId: input.capabilityId,
        scope: input.scope,
        mutationPlanId: input.mutationPlanId,
        status: input.applied ? 'done' : input.waitingApproval ? 'require_user_confirmation' : 'blocked',
      },
    );
  }


  public buildCapabilitiesReply(): string {
    const summary = this.deps.capabilityRegistry.getSummary();
    const capabilities = this.deps.capabilityRegistry.getAll();
    const commandCapabilities = capabilities.filter((capability) => capability.command);
    const implicitCapabilities = capabilities.filter((capability) => capability.matchers?.length);
    const pluginCapabilities = capabilities.filter((capability) => capability.source === 'plugin');

    const lines = [
      'O que o Zavorth consegue fazer',
      '',
      `Base carregada: ${summary.total} capacidades (${summary.builtin} nativas e ${summary.plugin} plugins).`,
      `Comandos diretos: ${summary.commands} | rotas automaticas: ${summary.implicitRoutes}.`,
      '',
      'Frentes principais hoje:',
      '- Pesquisa e sintese de informacao',
      '- Leitura, comparacao e envio de arquivos',
      '- Execucao e revisao com agentes especializados',
      '- Workflows compostos e tarefas encadeadas',
      '- Operacao, diagnostico e acompanhamento do runtime',
    ];

    if (commandCapabilities.length > 0) {
      lines.push('', 'Atalhos mais visiveis:');
      for (const capability of commandCapabilities.slice(0, 8)) {
        lines.push(`- ${capability.label}: ${capability.command?.command}`);
      }
    }

    if (implicitCapabilities.length > 0) {
      lines.push('', 'Rotas automaticas em destaque:');
      for (const capability of implicitCapabilities.slice(0, 6)) {
        lines.push(`- ${capability.label}: ${capability.routing_reason || capability.description}`);
      }
    }

    if (pluginCapabilities.length > 0) {
      lines.push('', 'Plugins declarativos ativos:');
      for (const capability of pluginCapabilities.slice(0, 8)) {
        const command = capability.command?.command ? ` (${capability.command.command})` : '';
        lines.push(`- ${capability.plugin_name || capability.id}: ${capability.label}${command}`);
      }
    } else {
      lines.push('', 'Plugins declarativos ativos: nenhum alem da base nativa.');
    }

    return this.renderCapabilityReport('capability-registry', 'O que o Zavorth consegue fazer', lines.join('\n'), {
      total: summary.total,
      builtin: summary.builtin,
      plugin: summary.plugin,
    });
  }

  private renderCapabilityReport(
    id: string,
    title: string,
    text: string,
    metadata: Record<string, unknown> = {},
  ): string {
    return renderPlainSurfaceResponse(buildReportSurfaceResponse({
      id: `shared-capability-${id}`,
      title,
      text,
      policyProfile: 'shared-capability',
      metadata,
    })).text;
  }

  private renderCapabilityAction(
    id: string,
    summary: string,
    text: string,
    metadata: Record<string, unknown> & { status?: SurfaceReceiptStatus } = {},
  ): string {
    const { status, ...rest } = metadata;
    return renderPlainSurfaceResponse(buildRuntimeSurfaceResponse({
      id: `shared-capability-${id}`,
      title: 'Capability lifecycle',
      summary,
      text,
      status: status || 'done',
      policyProfile: 'shared-capability',
      metadata: rest,
    })).text;
  }


}
