import { config } from '../../../../config/index.js';
import type { SidecarStatusCard } from '../../../../services/SidecarStatusService.js';
import {
  type ProductObservabilitySnapshot,
} from '../../../../services/ProductObservabilityService.js';
import { SharedSurfaceConsistencyService } from '../../../../services/SharedSurfaceConsistencyService.js';
import { logger } from '../../../../logger';

import { SkillLibraryPresentationService } from '../../../../services/SkillLibraryPresentationService.js';
import { getDefaultCapabilityRegistry } from '../../../../capabilities/CapabilityRegistry.js';
import {
  createSurfaceResponse,
  renderPlainSurfaceResponse,
  type SurfaceResponse,
} from '../../../../domain/surface/application/surface-response/index.js';

import type {
CapabilityApprovalRequest,
  CapabilityManifest,
  CapabilityStateSnapshot,
} from '../../../../services/CapabilityLifecycleService.js';export type TelegramOpsSystemStatusSnapshot = {
  process: {
    uptimeSeconds: number;
    rssMb: number;
    heapMb: number;
    platform: string;
    cpuArch: string;
  };
  runtime?: {
    hostSupervisor?: { pid: number | null; alive: boolean };
    telegramWorker?: { pid: number | null; alive: boolean };
  };
  sidecars?: {
    AIGateway?: SidecarStatusCard;
    ZavorthTerminal?: SidecarStatusCard;
  };
  tasks?: {
    activeCount: number;
    staleCount?: number;
    byStatus: Record<string, number>;
    recentFailures: Array<{
      taskId: string;
      executor: string | null;
      commandType: string;
      errorSummary: string | null;
    }>;
  };
};

type TelegramOpsModeFlags = {
  demoEnabled: boolean;
  operatorEnabled: boolean;
  presentationEnabled: boolean;
};

export class TelegramOpsInsightPresentationService {
  private static cachedSkillPlaneSnapshot:
    ReturnType<SkillLibraryPresentationService['buildSnapshot']> | null = null;
  private readonly capabilityRegistry = getDefaultCapabilityRegistry();
  private readonly surfaceConsistencyService = new SharedSurfaceConsistencyService();
  private readonly skillLibraryPresentationService = new SkillLibraryPresentationService();

  public buildSystemStatusSurfaceResponse(
    snapshot: TelegramOpsSystemStatusSnapshot,
    modes: TelegramOpsModeFlags,
    productObservability: ProductObservabilitySnapshot | null = null,
  ): SurfaceResponse {
    const legacyText = this.formatSystemStatusReply(snapshot, modes, productObservability);
    const detailText = stripLeadingSurfaceTitle(legacyText, 'Panorama do Zavorth');

    return createSurfaceResponse({
      id: 'telegram-status-surface',
      intent: 'status',
      title: 'Panorama do Zavorth',
      summary: 'Runtime, sidecars, tarefas e superficies em uma resposta compartilhada.',
      tone: 'info',
      blocks: [
        {
          kind: 'text',
          text: detailText,
        },
      ],
      actions: [
        { id: 'hub', label: 'Hub', kind: 'callback', callbackData: 'hub:page:overview', style: 'primary' },
        { id: 'zavorthControl', label: 'ZavorthControl', kind: 'command', command: '/zavorthControl', style: 'secondary' },
        { id: 'tasks', label: 'Tasks', kind: 'command', command: '/tasks', style: 'secondary' },
        { id: 'permissions', label: 'Permissoes', kind: 'command', command: '/perm list', style: 'secondary' },
      ],
    });
  }

  public formatSystemStatusReply(
    snapshot: TelegramOpsSystemStatusSnapshot,
    modes: TelegramOpsModeFlags,
    productObservability: ProductObservabilitySnapshot | null = null,
  ): string {
    const uptimeMinutes = Math.floor(snapshot.process.uptimeSeconds / 60);
    const uptimeText =
      uptimeMinutes >= 60
        ? `${Math.floor(uptimeMinutes / 60)}h ${uptimeMinutes % 60}min`
        : `${uptimeMinutes}min`;
    const activeCount = snapshot.tasks?.activeCount || 0;
    const staleCount = snapshot.tasks?.staleCount || 0;
    const byStatus = snapshot.tasks?.byStatus || {};
    const activeSummary = Object.entries(byStatus)
      .map(([status, count]) => `${this.describeRuntimeTaskStatus(status)} ${count}`)
      .join(' | ');
    const lastFailure = snapshot.tasks?.recentFailures?.[0] || null;
    const hostPid = snapshot.runtime?.hostSupervisor?.alive ? snapshot.runtime.hostSupervisor.pid : null;
    const workerPid = snapshot.runtime?.telegramWorker?.alive ? snapshot.runtime.telegramWorker.pid : null;
    const AIGateway = snapshot.sidecars?.AIGateway;
    const ZavorthTerminal = snapshot.sidecars?.ZavorthTerminal;

    const lines = [
      'Panorama do Zavorth',
      '',
      `Agora: online ha ${uptimeText}.`,
      `Uso atual: RSS ${snapshot.process.rssMb} MB | heap ${snapshot.process.heapMb} MB.`,
      `Processos ativos: host ${hostPid || 'indisponivel'} | worker ${workerPid || 'indisponivel'}.`,
      `Ambiente: ${snapshot.process.platform} / ${snapshot.process.cpuArch}.`,
      '',
      'Modos',
      `- Apresentacao: ${modes.presentationEnabled ? 'ativo' : 'inativo'}`,
      `- Demo: ${modes.demoEnabled ? 'ativo' : 'inativo'}`,
      `- Operador: ${modes.operatorEnabled ? 'ativo' : 'inativo'}`,
      '',
      'Sidecars',
      `- AIGateway: ${this.formatSidecarStatusLine(AIGateway, AIGateway?.baseUrl)}`,
      `- ZavorthBridge remoto: ${this.formatSidecarStatusLine(
        ZavorthTerminal,
        ZavorthTerminal?.localUrl || ZavorthTerminal?.baseUrl,
      )}`,
      '',
      `Tasks in progress: ${activeCount}${activeSummary ? ` (${activeSummary})` : ''}.`,
    ];

    if (staleCount > 0) {
      lines.push(`Old backlog still visible: ${staleCount}.`);
    }

    lines.push('Useful shortcuts: /zavorth, /settings, /tasks, /zavorthControl, /presentation, /demo');

    if (lastFailure) {
      lines.push(
        '',
        `Last alert: ${lastFailure.executor || lastFailure.commandType || 'unknown executor'} | task ${lastFailure.taskId.substring(0, 8)}.`,
        `Reason: ${String(lastFailure.errorSummary || 'no summary').substring(0, 120)}`,
      );
    }

    const productLines = this.formatProductObservabilityLines(productObservability);
    if (productLines.length > 0) {
      lines.push('', 'Product', ...productLines);
    }

    const surfaceConsistencyLines = this.formatSurfaceConsistencyLines();
    if (surfaceConsistencyLines.length > 0) {
      lines.push('', 'Surfaces', ...surfaceConsistencyLines);
    }

    const skillPlaneLines = this.formatSkillPlaneLines();
    if (skillPlaneLines.length > 0) {
      lines.push('', 'Skill plane', ...skillPlaneLines);
    }

    return lines.join('\n');
  }

  public formatModelsReply(currentModel: string, preferredZavorthBridgeModel: string | null): string {
    return renderPlainSurfaceResponse(
      this.buildModelsSurfaceResponse(currentModel, preferredZavorthBridgeModel),
    ).text;
  }

  public buildModelsSurfaceResponse(
    currentModel: string,
    preferredZavorthBridgeModel: string | null,
  ): SurfaceResponse {
    return createSurfaceResponse({
      id: 'telegram-models-surface',
      intent: 'models',
      title: 'Zavorth Models And Providers',
      summary: 'Operational selection shared across Telegram, CLI, Discord, and text fallback.',
      tone: 'neutral',
      blocks: [
        {
          kind: 'table',
          table: {
            title: 'Active Now',
            columns: [
              { key: 'item', label: 'Item' },
              { key: 'value', label: 'Value' },
            ],
            rows: [
              { item: 'Current primary provider', value: config.llmProvider },
              { item: 'Current conversational model', value: currentModel },
              { item: 'Preferred ZavorthBridge model', value: preferredZavorthBridgeModel || 'not set yet' },
            ],
          },
        },
        {
          kind: 'list',
          title: 'Available Providers',
          items: [
            'gemini',
            'gemma via Gemini API',
            'deepseek',
            'openai',
            'AIGateway',
            'qwen',
            'puter',
            'openrouter',
          ],
        },
        {
          kind: 'list',
          title: 'Useful Shortcuts',
          items: [
            '/model <name> to change the Zavorth provider',
            '/model gemma or /model gemma-2-27b-it to use Gemma 2 through the Gemini API',
            '/agmodel <name> to change the ZavorthBridge model',
            '/agnudge <text> to continue the current visual conversation',
          ],
        },
      ],
      actions: [
        { id: 'model-gemini', label: 'Gemini', kind: 'command', command: '/model gemini', style: 'primary' },
        { id: 'model-gemma', label: 'Gemma', kind: 'command', command: '/model gemma-2-27b-it', style: 'secondary' },
        { id: 'model-openai', label: 'OpenAI', kind: 'command', command: '/model openai', style: 'secondary' },
        { id: 'agmodel-high', label: 'AG Pro High', kind: 'command', command: '/agmodel gemini-2.5-pro', style: 'secondary' },
      ],
    });
  }

  public formatCapabilitiesReply(capabilityLifecycle?: {
    profile: string;
    commands: { profile: string; capabilities: string; enable: string; disable: string };
    summary: {
      total: number;
      builtinCapabilities: number;
      registeredCommands: number;
      active: number;
      dormant: number;
      requiringApproval: number;
    };
    capabilities: CapabilityStateSnapshot[];
  }): string {
    if (!capabilityLifecycle) {
      return this.formatCapabilitiesReplyFromLegacy();
    }

    const topCapabilities = capabilityLifecycle.capabilities
      .slice()
      .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
    const lines = [
      'Zavorth Capabilities',
      '',
      `Active profile: ${capabilityLifecycle.profile}.`,
      `Known lifecycle: ${capabilityLifecycle.summary.total} capability(s) | ${capabilityLifecycle.summary.active} ready/active | ${capabilityLifecycle.summary.dormant} dormant.`,
      `Declarative base: ${capabilityLifecycle.summary.builtinCapabilities} product capabilities | ${capabilityLifecycle.summary.registeredCommands} registered command(s).`,
      '',
      'Commands:',
      `- ${capabilityLifecycle.commands.profile}`,
      `- ${capabilityLifecycle.commands.capabilities}`,
      `- ${capabilityLifecycle.commands.enable}`,
      `- ${capabilityLifecycle.commands.disable}`,
      '',
      'On-demand capabilities:',
    ];

    for (const capability of topCapabilities) {
      const approval = capability.approvalRequired ? ' approval' : '';
      const ttl = capability.idleTtlMs ? ` | ttl ${Math.round(capability.idleTtlMs / 60000)} min` : '';
      const footprint = `${capability.estimatedFootprint.ramIdleMb} MB RAM | ${capability.estimatedFootprint.diskMb} MB disk | ${capability.estimatedFootprint.processCount} proc`;
      lines.push(
        `- ${capability.capabilityId}: ${capability.state} (${capability.activationMode}${approval}) | ${footprint}${ttl}`,
      );
      lines.push(`  fallback: ${capability.fallbackBehavior}`);
      if (capability.notes) {
        lines.push(`  note: ${capability.notes}`);
      }
    }

    return lines.join('\n');
  }

  public formatProfileReply(
    capabilityLifecycle: {
      profile: string;
      summary: { total: number; active: number; dormant: number };
      capabilities: CapabilityStateSnapshot[];
    },
    note?: string,
  ): string {
    const ready = capabilityLifecycle.capabilities
      .filter((entry) => entry.enabledByProfile || entry.enabledByUser)
      .map((entry) => entry.capabilityId)
      .slice(0, 8);
    const lines = [
      'Runtime Profile',
      '',
      `Current profile: ${capabilityLifecycle.profile}.`,
      `Ready/active capabilities: ${capabilityLifecycle.summary.active} | dormant: ${capabilityLifecycle.summary.dormant}.`,
      `Warmed now: ${ready.length > 0 ? ready.join(', ') : 'core-runtime only'}.`,
    ];

    if (note) {
      lines.push('', note);
    }

    return lines.join('\n');
  }

  public formatCapabilityToggleReply(
    mode: 'enable' | 'disable',
    capability: CapabilityStateSnapshot,
    approval: CapabilityApprovalRequest | null,
  ): string {
    const lines = [
      mode === 'enable'
        ? `Capability ${capability.capabilityId} enabled.`
        : `Capability ${capability.capabilityId} disabled.`,
      '',
      `State: ${capability.state}.`,
      `Activation: ${capability.activationMode}.`,
      `Active scope: ${capability.approvalScope || 'host/default'}.`,
      `Estimated footprint: ${capability.estimatedFootprint.ramIdleMb} MB RAM | ${capability.estimatedFootprint.diskMb} MB disk | ${capability.estimatedFootprint.processCount} proc.`,
      `Fallback: ${capability.fallbackBehavior}`,
    ];

    if (approval) {
      lines.push(
        '',
        `Default approval: ${approval.defaultScope}. Scopes: ${approval.availableScopes.join(', ')}.`,
        `Recorded reason: ${approval.reason}`,
        `Optional provisioning: npm run capability:provision -- ${capability.capabilityId}`,
      );
    }

    return lines.join('\n');
  }

  public formatCapabilityApprovalReply(
    capability: CapabilityStateSnapshot,
    approval: CapabilityApprovalRequest | null,
    options?: {
      reason?: string;
      remediation?: string;
      dependencyName?: string | null;
    },
  ): string {
    const reason = String(options?.reason || approval?.reason || `Requested use for ${capability.capabilityId}.`).trim();
    const dependencyName = String(options?.dependencyName || '').trim() || null;
    const enableCommands = (approval?.availableScopes || ['once', 'session', 'host'])
      .map((scope) => `/enable ${capability.capabilityId} ${scope}`);
    const lines = [
      `This action needs capability ${capability.capabilityId}.`,
      '',
      `Current state: ${capability.state}.`,
      `Activation: ${capability.activationMode}.`,
      `Reason: ${reason}`,
      `Estimated footprint: ${capability.estimatedFootprint.ramIdleMb} MB RAM | ${capability.estimatedFootprint.diskMb} MB disk | ${capability.estimatedFootprint.processCount} proc.`,
      `Current fallback: ${capability.fallbackBehavior}`,
    ];

    if (dependencyName) {
      lines.push(`Missing optional dependency: ${dependencyName}.`);
    }

    if (capability.notes) {
      lines.push(`Last note: ${capability.notes}`);
    }

    lines.push(
      '',
      'To authorize now:',
      ...enableCommands.map((command) => `- ${command}`),
      `- npm run capability:provision -- ${capability.capabilityId}`,
    );

    if (options?.remediation) {
      lines.push('', `Quick guide: ${options.remediation}`);
    }

    return lines.join('\n');
  }

  public formatCapabilityDetailReply(
    manifest: CapabilityManifest,
    capability: CapabilityStateSnapshot,
  ): string {
    const defaultProfiles = manifest.enabledByDefaultProfiles.join(', ');
    const provisioningDeps = manifest.provisioningRecipe?.dependencies?.join(', ') || 'none';
    const provisioningCommands = manifest.provisioningRecipe?.commands?.join(' | ') || 'none';
    const cleanupTargets = Array.isArray(manifest.cleanupPaths) && manifest.cleanupPaths.length > 0
      ? manifest.cleanupPaths.map((entry) => entry.replace(/\\/g, '/')).join(' | ')
      : 'none';
    const lines = [
      `Capability ${manifest.id}`,
      '',
      manifest.description,
      '',
      `State: ${capability.state}.`,
      `Activation: ${capability.activationMode}.`,
      `Approval: ${manifest.approvalRequired ? 'required' : 'not required'}${capability.approvalScope ? ` (${capability.approvalScope})` : ''}.`,
      `Default profiles: ${defaultProfiles}.`,
      `Footprint: ${capability.estimatedFootprint.ramIdleMb} MB RAM | ${capability.estimatedFootprint.diskMb} MB disk | ${capability.estimatedFootprint.processCount} proc.`,
      `Fallback: ${manifest.fallbackBehavior}`,
      '',
      `Optional deps: ${provisioningDeps}.`,
      `Provisioning: ${provisioningCommands}.`,
      `Cleanup on shutdown: ${cleanupTargets}.`,
      '',
      `Atalhos: /enable ${manifest.id} [once|session|host] | /disable ${manifest.id}`,
      `Provisionar agora: npm run capability:provision -- ${manifest.id}`,
      `Limpar agora: npm run capability:clean -- ${manifest.id}`,
    ];

    if (manifest.provisioningRecipe?.notes) {
      lines.push(`Nota: ${manifest.provisioningRecipe.notes}`);
    }
    if (capability.notes) {
      lines.push(`Ultima nota: ${capability.notes}`);
    }

    return lines.join('\n');
  }

  private formatCapabilitiesReplyFromLegacy(): string {
    const summary = this.capabilityRegistry.getSummary();
    const capabilities = this.capabilityRegistry.getAll();
    const commandCapabilities = capabilities.filter((capability) => capability.command);
    const implicitCapabilities = capabilities.filter((capability) => capability.matchers?.length);
    const pluginCapabilities = capabilities.filter((capability) => capability.source === 'plugin');

    const lines = [
      'What Zavorth Can Do',
      '',
      `Loaded base: ${summary.total} capabilities (${summary.builtin} native and ${summary.plugin} plugins).`,
      `Direct commands: ${summary.commands} | automatic routes: ${summary.implicitRoutes}.`,
      '',
      'Main fronts today:',
      '- Research and information synthesis',
      '- File reading, comparison, and delivery',
      '- Execution and review with specialized agents',
      '- Composed workflows and chained tasks',
      '- Runtime operation, diagnostics, and monitoring',
    ];

    if (commandCapabilities.length > 0) {
      lines.push('', 'Most visible shortcuts:');
      for (const capability of commandCapabilities.slice(0, 8)) {
        lines.push(`- ${capability.label}: ${capability.command?.command}`);
      }
    }

    if (implicitCapabilities.length > 0) {
      lines.push('', 'Featured automatic routes:');
      for (const capability of implicitCapabilities.slice(0, 6)) {
        lines.push(`- ${capability.label}: ${capability.routing_reason || capability.description}`);
      }
    }

    if (pluginCapabilities.length > 0) {
      lines.push('', 'Active declarative plugins:');
      for (const capability of pluginCapabilities.slice(0, 8)) {
        const command = capability.command?.command ? ` (${capability.command.command})` : '';
        lines.push(`- ${capability.plugin_name || capability.id}: ${capability.label}${command}`);
      }
    } else {
      lines.push('', 'Active declarative plugins: none beyond the native base.');
    }

    const skillPlaneLines = this.formatSkillPlaneLines();
    if (skillPlaneLines.length > 0) {
      lines.push('', 'Skill plane:', ...skillPlaneLines);
    }

    return lines.join('\n');
  }

  private formatProductObservabilityLines(snapshot: ProductObservabilitySnapshot | null): string[] {
    if (!snapshot) {
      return ['- Product observability: unavailable right now.'];
    }

    const lines: string[] = [];
    const primaryInsight = String(snapshot.insights?.[0] || '').trim();
    const topSurface = snapshot.surfaces?.sources?.[0] || null;
    const topRoute = snapshot.learning?.routes?.topSuccessful?.[0] || null;
    const highestFriction = snapshot.learning?.routes?.highestFriction?.[0] || null;
    const recentResumableWorkflow =
      snapshot.workflows?.recent?.find((entry) => Boolean(entry.resume_stage_label)) ||
      null;
    const resumableWorkflow =
      snapshot.learning?.workflowResumeStages?.[0] ||
      recentResumableWorkflow ||
      null;
    const topExecutor = snapshot.executors?.top?.[0] || null;
    const topPolicy = snapshot.learning?.approvedPolicies?.[0] || null;

    lines.push(
      `- Observed window: ${snapshot.totals?.tasks || 0} request(s) | ${snapshot.totals?.workflowRuns || 0} workflow(s) | ${snapshot.totals?.artifacts || 0} delivery item(s).`,
    );

    if (primaryInsight) {
      lines.push(`- Primary insight: ${primaryInsight}`);
    }

    if (topSurface) {
      lines.push(`- Most active surface: ${topSurface.label} (${topSurface.count} request(s)).`);
    }

    if (topRoute) {
      lines.push(
        `- Best recent route: ${topRoute.executor} in ${topRoute.kind}/${topRoute.subtype} (${topRoute.completed}/${topRoute.total} completed).`,
      );
    }

    if (resumableWorkflow) {
      const workflowLabel = String((resumableWorkflow as any).workflow || '').trim() || 'workflow';
      const stageLabel = String(
        (resumableWorkflow as any).stage_label || (resumableWorkflow as any).resume_stage_label || '',
      ).trim();
      const workflowRunId = String(
        (resumableWorkflow as any).workflow_run_id || (recentResumableWorkflow as any)?.workflow_run_id || '',
      ).trim();
      const resumeStageId = String(
        (resumableWorkflow as any).resume_stage_id || (recentResumableWorkflow as any)?.resume_stage_id || '',
      ).trim();
      lines.push(`- Workflow to resume: ${workflowLabel}${stageLabel ? ` - ${stageLabel}` : ''}.`);
      if (workflowRunId) {
        lines.push(`- Resume shortcut: /workflow resume ${workflowRunId}${resumeStageId ? ` ${resumeStageId}` : ''}`);
      }
    }

    if (topExecutor) {
      lines.push(
        `- Featured executor: ${topExecutor.executor} (${Math.round(Number(topExecutor.success_rate || 0) * 100)}% success).`,
      );
    }

    if (highestFriction) {
      lines.push(
        `- Highest recent friction: ${highestFriction.executor} in ${highestFriction.kind}/${highestFriction.subtype} (${highestFriction.failed} failure(s), ${highestFriction.waitingApproval} awaiting approval).`,
      );
    }

    if (topPolicy) {
      lines.push(
        `- Most reused policy: ${topPolicy.executor}/${topPolicy.kind} (${topPolicy.count} authorization(s)).`,
      );
    }

    if (lines.length === 0) {
      lines.push('- Product observability: waiting for sufficient signals in this window.');
    }

    return lines;
  }

  private formatSurfaceConsistencyLines(): string[] {
    const consistency = this.surfaceConsistencyService.buildManifest();
    if (!consistency) {
      return [];
    }

    const lines = [
      `- Web: ${consistency.surfaces?.web?.ready ? 'pronto' : 'pendente'} - ${consistency.surfaces?.web?.summary || 'Sem resumo adicional.'}`,
      `- Telegram: ${consistency.surfaces?.telegram?.ready ? 'pronto' : 'pendente'} - ${consistency.surfaces?.telegram?.summary || 'Sem resumo adicional.'}`,
    ];

    if (consistency.surfaces?.discord) {
      lines.push(
        `- Discord: ${Number(consistency.surfaces.discord.slashReadyCount || 0)} slash ativo(s) - ${consistency.surfaces.discord.summary || 'Sem resumo adicional.'}`,
      );
    }

    const recommended = consistency.recommended
      .map((entry) => String(entry.surfaceCommand || entry.commandType || '').trim())
      .filter(Boolean)
      .slice(0, 4);
    if (recommended.length > 0) {
      lines.push(`- Acoes alinhadas agora: ${recommended.join(', ')}.`);
    }

    return lines;
  }

  private formatSkillPlaneLines(): string[] {
    const snapshot = this.readSkillPlaneSnapshot();
    if (!snapshot) {
      return ['- Biblioteca: indisponivel agora.'];
    }
    const lines = [
      `- Biblioteca: ${snapshot.catalog.summary.total} skill(s) | ${snapshot.catalog.summary.readyRecipes}/${snapshot.catalog.summary.recipes} recipe(s) pronta(s).`,
      `- MCP: ${snapshot.mcp.summary.tools} tool(s) | ${snapshot.mcp.summary.resources} resource(s).`,
    ];
    const trustSummary = snapshot.trust
      .map((entry) => `${entry.trust} ${entry.count}`)
      .join(' | ');
    if (trustSummary) {
      lines.push(`- Trust: ${trustSummary}.`);
    }
    const vendorSummary = snapshot.vendors
      .slice(0, 2)
      .map((vendor) => `${vendor.displayName}=${vendor.ready ? 'ready' : vendor.status}`)
      .join(' | ');
    if (vendorSummary) {
      lines.push(`- Vendors: ${vendorSummary}.`);
    }
    if (snapshot.actions[0]) {
      lines.push(`- Atalho sugerido: ${snapshot.actions[0].command}.`);
    }
    return lines;
  }

  private readSkillPlaneSnapshot(): ReturnType<SkillLibraryPresentationService['buildSnapshot']> | null {
    if (TelegramOpsInsightPresentationService.cachedSkillPlaneSnapshot) {
      return TelegramOpsInsightPresentationService.cachedSkillPlaneSnapshot;
    }

    try {
      TelegramOpsInsightPresentationService.cachedSkillPlaneSnapshot =
        this.skillLibraryPresentationService.buildSnapshot();
      return TelegramOpsInsightPresentationService.cachedSkillPlaneSnapshot;
    } catch (error: unknown) {logger.warn('[Telegram Ops Insight Presentation] cache operation failed', error); return null; }
  }

  private describeRuntimeTaskStatus(status: string): string {
    switch (status) {
      case 'running':
        return 'running';
      case 'waiting_approval':
        return 'awaiting approval';
      case 'delivery_pending':
        return 'delivering';
      case 'planned':
        return 'planned';
      case 'approved':
        return 'approved';
      default:
        return status.replace(/_/g, ' ');
    }
  }

  private formatSidecarStatusLine(sidecar: SidecarStatusCard | undefined, url: string | null | undefined): string {
    if (!sidecar) {
      return 'no data yet.';
    }

    if (!sidecar.enabled) {
      return 'disabled.';
    }

    if (sidecar.ready) {
      return `ready${url ? ` at ${url}` : ''}.`;
    }

    if (sidecar.running) {
      return `starting${url ? ` at ${url}` : ''}.`;
    }

    return sidecar.message || 'not started yet.';
  }
}

function stripLeadingSurfaceTitle(text: string, title: string): string {
  const normalized = String(text || '').trim();
  if (!normalized.startsWith(title)) {
    return normalized;
  }

  return normalized
    .slice(title.length)
    .replace(/^\s+/, '')
    .trim();
}
