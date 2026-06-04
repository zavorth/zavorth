import { config } from '../../config/index.js';
import type { SidecarStatusCard } from '../../services/SidecarStatusService.js';
import {
  type ProductObservabilitySnapshot,
} from '../../services/ProductObservabilityService.js';
import { SharedSurfaceConsistencyService } from '../../services/SharedSurfaceConsistencyService.js';
import { SkillLibraryPresentationService } from '../../services/SkillLibraryPresentationService.js';
import { getDefaultCapabilityRegistry } from '../../capabilities/CapabilityRegistry.js';
import {
  createSurfaceResponse,
  renderPlainSurfaceResponse,
  type SurfaceResponse,
} from '../../domain/surface/application/surface-response/index.js';
import type {
  CapabilityApprovalRequest,
  CapabilityManifest,
  CapabilityStateSnapshot,
} from '../../services/CapabilityLifecycleService.js';

export type TelegramOpsSystemStatusSnapshot = {
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
        { id: 'dashboard', label: 'Dashboard', kind: 'command', command: '/dashboard', style: 'secondary' },
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
      `Tarefas em andamento: ${activeCount}${activeSummary ? ` (${activeSummary})` : ''}.`,
    ];

    if (staleCount > 0) {
      lines.push(`Backlog antigo ainda visivel: ${staleCount}.`);
    }

    lines.push('Atalhos uteis: /zavorth, /settings, /tasks, /dashboard, /presentation, /demo');

    if (lastFailure) {
      lines.push(
        '',
        `Ultimo alerta: ${lastFailure.executor || lastFailure.commandType || 'executor desconhecido'} | task ${lastFailure.taskId.substring(0, 8)}.`,
        `Motivo: ${String(lastFailure.errorSummary || 'sem resumo').substring(0, 120)}`,
      );
    }

    const productLines = this.formatProductObservabilityLines(productObservability);
    if (productLines.length > 0) {
      lines.push('', 'Produto', ...productLines);
    }

    const surfaceConsistencyLines = this.formatSurfaceConsistencyLines();
    if (surfaceConsistencyLines.length > 0) {
      lines.push('', 'Superficies', ...surfaceConsistencyLines);
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
      title: 'Modelos e providers do Zavorth',
      summary: 'Selecao operacional compartilhada entre Telegram, CLI, Discord e fallback textual.',
      tone: 'neutral',
      blocks: [
        {
          kind: 'table',
          table: {
            title: 'Ativos agora',
            columns: [
              { key: 'item', label: 'Item' },
              { key: 'value', label: 'Valor' },
            ],
            rows: [
              { item: 'Provider principal atual', value: config.llmProvider },
              { item: 'Modelo conversacional atual', value: currentModel },
              { item: 'Modelo preferido do ZavorthBridge', value: preferredZavorthBridgeModel || 'ainda nao definido' },
            ],
          },
        },
        {
          kind: 'list',
          title: 'Providers disponiveis',
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
          title: 'Atalhos uteis',
          items: [
            '/model <nome> para trocar o provider do Zavorth',
            '/model gemma ou /model gemma-4-31b-it para usar Gemma 4 via Gemini API',
            '/agmodel <nome> para trocar o modelo do ZavorthBridge',
            '/agnudge <texto> para continuar a conversa visual atual',
          ],
        },
      ],
      actions: [
        { id: 'model-gemini', label: 'Gemini', kind: 'command', command: '/model gemini', style: 'primary' },
        { id: 'model-gemma', label: 'Gemma', kind: 'command', command: '/model gemma-4-31b-it', style: 'secondary' },
        { id: 'model-openai', label: 'OpenAI', kind: 'command', command: '/model openai', style: 'secondary' },
        { id: 'agmodel-high', label: 'AG Pro High', kind: 'command', command: '/agmodel gemini-3.1-pro-high', style: 'secondary' },
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
      'Capabilities do Zavorth',
      '',
      `Perfil ativo: ${capabilityLifecycle.profile}.`,
      `Lifecycle conhecido: ${capabilityLifecycle.summary.total} capability(s) | ${capabilityLifecycle.summary.active} pronta(s)/ativa(s) | ${capabilityLifecycle.summary.dormant} dormente(s).`,
      `Base declarativa: ${capabilityLifecycle.summary.builtinCapabilities} capacidades de produto | ${capabilityLifecycle.summary.registeredCommands} comando(s) registrados.`,
      '',
      'Comandos:',
      `- ${capabilityLifecycle.commands.profile}`,
      `- ${capabilityLifecycle.commands.capabilities}`,
      `- ${capabilityLifecycle.commands.enable}`,
      `- ${capabilityLifecycle.commands.disable}`,
      '',
      'Capacidades sob demanda:',
    ];

    for (const capability of topCapabilities) {
      const approval = capability.approvalRequired ? ' approval' : '';
      const ttl = capability.idleTtlMs ? ` | ttl ${Math.round(capability.idleTtlMs / 60000)} min` : '';
      const footprint = `${capability.estimatedFootprint.ramIdleMb} MB RAM | ${capability.estimatedFootprint.diskMb} MB disco | ${capability.estimatedFootprint.processCount} proc`;
      lines.push(
        `- ${capability.capabilityId}: ${capability.state} (${capability.activationMode}${approval}) | ${footprint}${ttl}`,
      );
      lines.push(`  fallback: ${capability.fallbackBehavior}`);
      if (capability.notes) {
        lines.push(`  nota: ${capability.notes}`);
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
      'Perfil de runtime',
      '',
      `Perfil atual: ${capabilityLifecycle.profile}.`,
      `Capabilities prontas/ativas: ${capabilityLifecycle.summary.active} | dormentes: ${capabilityLifecycle.summary.dormant}.`,
      `Preaquecidas agora: ${ready.length > 0 ? ready.join(', ') : 'somente core-runtime'}.`,
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
        ? `Capability ${capability.capabilityId} habilitada.`
        : `Capability ${capability.capabilityId} desabilitada.`,
      '',
      `Estado: ${capability.state}.`,
      `Ativacao: ${capability.activationMode}.`,
      `Escopo ativo: ${capability.approvalScope || 'host/default'}.`,
      `Footprint estimado: ${capability.estimatedFootprint.ramIdleMb} MB RAM | ${capability.estimatedFootprint.diskMb} MB disco | ${capability.estimatedFootprint.processCount} proc.`,
      `Fallback: ${capability.fallbackBehavior}`,
    ];

    if (approval) {
      lines.push(
        '',
        `Approval padrao: ${approval.defaultScope}. Escopos: ${approval.availableScopes.join(', ')}.`,
        `Motivo registrado: ${approval.reason}`,
        `Provisionamento opcional: npm run capability:provision -- ${capability.capabilityId}`,
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
    const reason = String(options?.reason || approval?.reason || `Uso solicitado para ${capability.capabilityId}.`).trim();
    const dependencyName = String(options?.dependencyName || '').trim() || null;
    const enableCommands = (approval?.availableScopes || ['once', 'session', 'host'])
      .map((scope) => `/enable ${capability.capabilityId} ${scope}`);
    const lines = [
      `Esta acao precisa da capability ${capability.capabilityId}.`,
      '',
      `Estado atual: ${capability.state}.`,
      `Ativacao: ${capability.activationMode}.`,
      `Motivo: ${reason}`,
      `Footprint estimado: ${capability.estimatedFootprint.ramIdleMb} MB RAM | ${capability.estimatedFootprint.diskMb} MB disco | ${capability.estimatedFootprint.processCount} proc.`,
      `Fallback atual: ${capability.fallbackBehavior}`,
    ];

    if (dependencyName) {
      lines.push(`Dependencia opcional ausente: ${dependencyName}.`);
    }

    if (capability.notes) {
      lines.push(`Ultima nota: ${capability.notes}`);
    }

    lines.push(
      '',
      'Se quiser autorizar agora:',
      ...enableCommands.map((command) => `- ${command}`),
      `- npm run capability:provision -- ${capability.capabilityId}`,
    );

    if (options?.remediation) {
      lines.push('', `Guia rapido: ${options.remediation}`);
    }

    return lines.join('\n');
  }

  public formatCapabilityDetailReply(
    manifest: CapabilityManifest,
    capability: CapabilityStateSnapshot,
  ): string {
    const defaultProfiles = manifest.enabledByDefaultProfiles.join(', ');
    const provisioningDeps = manifest.provisioningRecipe?.dependencies?.join(', ') || 'nenhuma';
    const provisioningCommands = manifest.provisioningRecipe?.commands?.join(' | ') || 'nenhum';
    const cleanupTargets = Array.isArray(manifest.cleanupPaths) && manifest.cleanupPaths.length > 0
      ? manifest.cleanupPaths.map((entry) => entry.replace(/\\/g, '/')).join(' | ')
      : 'nenhum';
    const lines = [
      `Capability ${manifest.id}`,
      '',
      manifest.description,
      '',
      `Estado: ${capability.state}.`,
      `Ativacao: ${capability.activationMode}.`,
      `Approval: ${manifest.approvalRequired ? 'necessario' : 'nao necessario'}${capability.approvalScope ? ` (${capability.approvalScope})` : ''}.`,
      `Perfis default: ${defaultProfiles}.`,
      `Footprint: ${capability.estimatedFootprint.ramIdleMb} MB RAM | ${capability.estimatedFootprint.diskMb} MB disco | ${capability.estimatedFootprint.processCount} proc.`,
      `Fallback: ${manifest.fallbackBehavior}`,
      '',
      `Deps opcionais: ${provisioningDeps}.`,
      `Provisionamento: ${provisioningCommands}.`,
      `Cleanup ao desligar: ${cleanupTargets}.`,
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

    const skillPlaneLines = this.formatSkillPlaneLines();
    if (skillPlaneLines.length > 0) {
      lines.push('', 'Skill plane:', ...skillPlaneLines);
    }

    return lines.join('\n');
  }

  private formatProductObservabilityLines(snapshot: ProductObservabilitySnapshot | null): string[] {
    if (!snapshot) {
      return ['- Observabilidade de produto: indisponivel agora.'];
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
      `- Janela observada: ${snapshot.totals?.tasks || 0} pedido(s) | ${snapshot.totals?.workflowRuns || 0} workflow(s) | ${snapshot.totals?.artifacts || 0} entrega(s).`,
    );

    if (primaryInsight) {
      lines.push(`- Leitura principal: ${primaryInsight}`);
    }

    if (topSurface) {
      lines.push(`- Superficie mais ativa: ${topSurface.label} (${topSurface.count} pedido(s)).`);
    }

    if (topRoute) {
      lines.push(
        `- Melhor rota recente: ${topRoute.executor} em ${topRoute.kind}/${topRoute.subtype} (${topRoute.completed}/${topRoute.total} concluida(s)).`,
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
      lines.push(`- Workflow para retomar: ${workflowLabel}${stageLabel ? ` - ${stageLabel}` : ''}.`);
      if (workflowRunId) {
        lines.push(`- Atalho de retomada: /workflow resume ${workflowRunId}${resumeStageId ? ` ${resumeStageId}` : ''}`);
      }
    }

    if (topExecutor) {
      lines.push(
        `- Executor em destaque: ${topExecutor.executor} (${Math.round(Number(topExecutor.success_rate || 0) * 100)}% de sucesso).`,
      );
    }

    if (highestFriction) {
      lines.push(
        `- Maior atrito recente: ${highestFriction.executor} em ${highestFriction.kind}/${highestFriction.subtype} (${highestFriction.failed} falha(s), ${highestFriction.waitingApproval} aguardando aprovacao).`,
      );
    }

    if (topPolicy) {
      lines.push(
        `- Politica mais reaproveitada: ${topPolicy.executor}/${topPolicy.kind} (${topPolicy.count} liberacao(oes)).`,
      );
    }

    if (lines.length === 0) {
      lines.push('- Observabilidade de produto: aguardando sinais suficientes nesta janela.');
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
    } catch {
      return null;
    }
  }

  private describeRuntimeTaskStatus(status: string): string {
    switch (status) {
      case 'running':
        return 'executando';
      case 'waiting_approval':
        return 'aguardando aprovacao';
      case 'delivery_pending':
        return 'entregando';
      case 'planned':
        return 'planejadas';
      case 'approved':
        return 'aprovadas';
      default:
        return status.replace(/_/g, ' ');
    }
  }

  private formatSidecarStatusLine(sidecar: SidecarStatusCard | undefined, url: string | null | undefined): string {
    if (!sidecar) {
      return 'sem dados ainda.';
    }

    if (!sidecar.enabled) {
      return 'desativado.';
    }

    if (sidecar.ready) {
      return `pronto${url ? ` em ${url}` : ''}.`;
    }

    if (sidecar.running) {
      return `subindo${url ? ` em ${url}` : ''}.`;
    }

    return sidecar.message || 'ainda nao iniciado.';
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
