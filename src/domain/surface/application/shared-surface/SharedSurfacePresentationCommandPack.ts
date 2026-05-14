import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { RuntimeDiagnosticsSnapshot } from '../../../../services/RuntimeDiagnosticsService.js';
import type { ZavorthSecurityMeshService } from '../../../../services/ZavorthSecurityMeshService.js';
import type { ZavorthTrustPlaneService } from '../../../../services/ZavorthTrustPlaneService.js';
import type { DiscordSurfacePolicyService } from '../../../../services/DiscordSurfacePolicyService.js';
import { getSharedSurfaceCommandContract } from '../../../../services/SharedSurfaceCommandContract.js';
import type { RuntimeMaintenanceIntent } from './SharedSurfaceRuntimeMaintenanceCommandPack.js';
import { createSurfaceResponse } from '../surface-response/index.js';
import { replyWithSharedSurfaceResponse } from './SharedSurfaceResponseSender.js';

export type SharedSurfacePresentationCommandPackDeps = {
  securityMeshService: Pick<ZavorthSecurityMeshService, 'buildSnapshot'>;
  trustPlaneService: Pick<ZavorthTrustPlaneService, 'buildSnapshot'>;
  discordSurfacePolicyService: Pick<
    DiscordSurfacePolicyService,
    'canUseOperationalCommand' | 'getCommandExposure'
  >;
};

export class SharedSurfacePresentationCommandPack {
  public constructor(private readonly deps: SharedSurfacePresentationCommandPackDeps) {}

  public async handleCommandCatalog(ctx: IMessageContext, args: string = ''): Promise<void> {
    await replyWithSharedSurfaceResponse(ctx, this.buildCommandCatalogSurfaceResponse(args));
  }

  public async handleStatus(ctx: IMessageContext, snapshot: RuntimeDiagnosticsSnapshot): Promise<void> {
    const text = this.formatSystemStatusReply(snapshot, ctx);
    const recentFailures = Array.isArray(snapshot.tasks?.recentFailures) ? snapshot.tasks.recentFailures.length : 0;
    await replyWithSharedSurfaceResponse(ctx, createSurfaceResponse({
      id: 'shared-status',
      intent: 'status',
      title: 'Status do Zavorth',
      summary: 'Saude operacional, atalhos e proximos comandos na mesma resposta compartilhada.',
      tone: recentFailures > 0 ? 'warning' : 'success',
      blocks: [
        {
          kind: 'text',
          title: 'Leitura operacional',
          text,
        },
      ],
      actions: [
        { id: 'status-gateway', label: 'Gateway', kind: 'command', command: '/gateway', callbackData: '/gateway', style: 'primary' },
        { id: 'status-models', label: 'Modelos', kind: 'command', command: '/models', callbackData: '/models', style: 'secondary' },
        { id: 'status-runtime', label: 'Runtime', kind: 'command', command: '/runtime', callbackData: '/runtime', style: 'secondary' },
        { id: 'status-doctor', label: 'Doctor', kind: 'command', command: '/doctor', callbackData: '/doctor', style: 'success' },
      ],
      metadata: {
        uptimeSeconds: snapshot.process?.uptimeSeconds || 0,
        recentFailures,
      },
    }));
  }

  private buildCommandCatalogSurfaceResponse(args: string = '') {
    const normalizedArgs = String(args || '').trim().toLowerCase();
    const pageMatch = normalizedArgs.match(/\bpage\s+(\d+)\b/) || normalizedArgs.match(/^(\d+)$/);
    const page = Math.max(1, Number(pageMatch?.[1] || 1));
    const query = normalizedArgs
      .replace(/\bpage\s+\d+\b/g, '')
      .replace(/^\d+$/g, '')
      .trim();
    const pageSize = 12;
    const allEntries = getSharedSurfaceCommandContract()
      .filter((entry) => entry.handler === 'dispatcher' || entry.fallbackVisible || entry.description)
      .map((entry) => ({
        command: entry.surfaceCommand,
        handler: entry.handler,
        scopeRaw: entry.discordSlashVisibility,
        scope: this.formatCommandScope(entry.discordSlashVisibility),
        description: entry.description || 'Comando compartilhado do Zavorth.',
        discord: entry.discordSlashName || 'n/d',
      }));
    const filtered = query
      ? allEntries.filter((entry) => [
        entry.command,
        entry.handler,
        entry.scopeRaw,
        entry.scope,
        entry.description,
        entry.discord,
      ].some((value) => String(value || '').toLowerCase().includes(query)))
      : allEntries;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const actions = [
      { id: 'commands-status', label: 'Status', kind: 'command' as const, command: '/status', callbackData: '/status', style: 'primary' as const },
      { id: 'commands-models', label: 'Modelos', kind: 'command' as const, command: '/models', callbackData: '/models', style: 'secondary' as const },
      { id: 'commands-channels', label: 'Canais', kind: 'command' as const, command: '/channels', callbackData: '/channels', style: 'secondary' as const },
      { id: 'commands-gateway', label: 'Gateway', kind: 'command' as const, command: '/gateway', callbackData: '/gateway', style: 'success' as const },
      ...(safePage > 1
        ? [{
            id: 'commands-prev',
            label: 'Pagina anterior',
            kind: 'command' as const,
            command: `/commands${query ? ` ${query}` : ''} page ${safePage - 1}`,
            callbackData: `/commands${query ? ` ${query}` : ''} page ${safePage - 1}`,
            style: 'secondary' as const,
          }]
        : []),
      ...(safePage < totalPages
        ? [{
            id: 'commands-next',
            label: 'Proxima pagina',
            kind: 'command' as const,
            command: `/commands${query ? ` ${query}` : ''} page ${safePage + 1}`,
            callbackData: `/commands${query ? ` ${query}` : ''} page ${safePage + 1}`,
            style: 'secondary' as const,
          }]
        : []),
    ];

    return createSurfaceResponse({
      id: `shared-command-catalog-${query || 'all'}-${safePage}`,
      intent: 'help',
      title: 'Catalogo de comandos do Zavorth',
      summary: `Pagina ${safePage}/${totalPages}${query ? ` filtrada por "${query}"` : ''}.`,
      tone: 'info',
      blocks: [
        {
          kind: 'table',
          table: {
            title: 'Comandos compartilhados',
            columns: [
              { key: 'command', label: 'Comando', width: 18 },
              { key: 'scope', label: 'Escopo', width: 10 },
              { key: 'discord', label: 'Discord', width: 12 },
              { key: 'description', label: 'Uso', width: 36 },
            ],
            rows: visible.map(({ command, scope, discord, description }) => ({
              command,
              scope,
              discord,
              description,
            })),
            emptyText: 'Nenhum comando bateu com esse filtro.',
          },
        },
        {
          kind: 'list',
          title: 'Como usar',
          items: [
            'Use texto livre para pedidos normais; comandos servem para controle explicito.',
            'Use /commands page 2 para paginar.',
            'Use /commands channel, /commands model ou /commands operator para filtrar.',
          ],
        },
      ],
      actions,
      metadata: {
        query: query || null,
        page: safePage,
        totalPages,
        totalCommands: filtered.length,
      },
    });
  }

  private formatCommandScope(scope: string): string {
    switch (scope) {
      case 'public':
        return 'publico';
      case 'operator':
        return 'operador';
      default:
        return 'local';
    }
  }

  public renderHelp(ctx: Pick<IMessageContext, 'platform' | 'userId' | 'isGroup'>): string {
    const isDiscordOperationalOwner =
      ctx.platform === 'discord' &&
      this.deps.discordSurfacePolicyService.canUseOperationalCommand(String(ctx.userId || '').trim(), {
        isDirectMessage: !ctx.isGroup,
      });
    const discordExposure = this.deps.discordSurfacePolicyService.getCommandExposure();
    const lines = [
      'Comandos compartilhados do Zavorth',
      '',
      '/task <pedido> para abrir uma tarefa comum.',
      '/plan <pedido> para planejar antes de agir.',
      '/auto <pedido> para automacao guiada.',
      '/gateway para ver o snapshot canonico do Gateway.',
      '/tools para ver a surface oficial de tools, skills e plugins.',
      '/runtime para ver o Runtime & Security Mesh oficial.',
      '/trust [status|mcp safe|mcp trusted|skills deny] para operar o Trust Plane oficial.',
      '/access [local|remote] para ver o manifesto oficial de acesso e entrada por superficie.',
      '/bootstrap para revisar o checklist oficial de instalacao e bootstrap.',
      '/transports [id] para ver bridges, sidecars e node hosts do plano remoto.',
      '/transports <inspect|prepare|smoke|repair> <id> para agir num transporte remoto first-class.',
      '/channels [id] para ver o Channel Mesh oficial.',
      '/channels parity [id] para auditar paridade de experiencia por canal: status card, resposta rica, botoes, QR/login e callbacks seguros.',
      '/channels <inspect|status|policy|prepare|doctor|repair|send-test|broadcast-test|login-qr|relink|logout> <id> para agir num canal first-class.',
      'Pedidos naturais como "quero colocar voce no discord" ou "me conecta ao slack" agora abrem o fluxo guiado do canal.',
      'Pedidos como "me mostre as opcoes de canal antes de conectar", "qual canal fica melhor para trabalho", "vai com o recomendado" e "na verdade o Slack" agora tambem entram na conversa guiada do Channel Mesh.',
      'Pedidos naturais como "instale o plugin openrouter", "repare o transporte do discord" e "quero parear um node desktop" agora tambem abrem os fluxos oficiais.',
      'Pedidos como "me mostre as opcoes de transporte antes de subir", "qual transporte fica melhor para remoto", "vai com o recomendado" e "na verdade o node host" agora tambem entram na conversa guiada do remote transport plane.',
      'Pedidos como "me mostre as opcoes de node antes de parear", "qual node fica melhor para desktop visual", "vai com o recomendado" e "na verdade o mobile" agora tambem entram na conversa guiada do Node Mesh.',
      'Pedidos naturais como "mostre minhas sessoes", "quero ver o replay da sessao web:demo" e "procure na memoria por gateway release" agora tambem caem na surface operacional.',
      'Pedidos naturais como "mostre as permissoes pendentes" e "aprove a permissao perm-123" agora tambem abrem o permission plane.',
      'Pedidos naturais de engenharia como "crie um servidor Express", "veja por que esse build quebrou", "instale o que falta e teste de novo" e "o que falta para continuar?" agora entram no Engineering Core oficial.',
      'Quando faltar Docker, toolchain, dependencia ou secret, o Zavorth tenta negociar isso com linguagem natural antes de cair em detalhe tecnico.',
      'Pedidos naturais como "aprove a tarefa task-123", "aprove a ultima tarefa pendente" e "rejeite a tarefa de onboarding do discord" agora usam o fluxo canonico de task approval.',
      'Pedidos naturais como "continue a ultima tarefa", "retome o trabalho anterior" e "desfaca a ultima tarefa" agora resolvem a tarefa recente com guardrails.',
      'Pedidos naturais como "tente de novo a tarefa de onboarding do discord" e "reabra isso" agora reabrem um pedido recente como nova task canonica quando fizer sentido.',
      'Pedidos naturais como "repita isso com mais foco no discord" e "faca igual de novo com um resumo mais curto" agora abrem uma nova task canonica com o ajuste anexado ao pedido base.',
      'Follow-ups curtos como "deixa mais curto", "faz mais tecnico", "menos marketing" e "mais detalhado" agora refinam a tarefa recente como uma nova variacao canonica.',
      'Pedidos compostos como "faz uma versao mais curta e mais tecnica", "faz isso para slack e telegram" e "me mostre as opcoes antes de abrir a nova task" agora tambem entram no fluxo de variacao canonica.',
      'Follow-ups como "abre a segunda opcao", "faz a versao mais tecnica, nao a mais curta" e "qual dessas variacoes fica melhor para Telegram" agora tambem funcionam na shared surface.',
      'Follow-ups como "e a ultima tarefa?", "deu certo a ultima tarefa?" e "o que falta nela?" agora consultam a tarefa recente e sugerem o proximo passo.',
      'Pedidos explicitos como "selfmod src/arquivo.ts -- ajuste" e "selfmod goal -- melhorar o gateway" agora usam o fluxo guardado de auto-modificacao sem depender do slash command.',
      'Pedidos naturais como "promova o candidate:wf-1 no learning", "workflow research sobre channel mesh" e "retome o ultimo workflow" agora tambem entram no plano oficial.',
      '/plugins [id|filtro] para ver o plugin plane oficial.',
      '/plugins <trust|review|install|update|remove> <id> para agir no plugin plane.',
      'Pedidos como "me mostre as opcoes de plugin antes de instalar", "qual plugin fica melhor para llm", "vai com o recomendado" e "na verdade o OpenRouter" agora tambem entram na conversa guiada do plugin plane.',
      '/skills [library|bridge|run <skill>|live <skill> --approval-id <id>|origin <skill>|plan <id>|plan recipe <id>|id|filtro|recipe <id>|recommend <objetivo>|mcp] para ver e ativar skills pelo bridge governado.',
      '/platform [id|filtro|collection:id|recipe:id] para ver plugins, skills, MCPs, colecoes e recipes num unico plano.',
      '/hub [id|filtro] para ver o Hub + MCP product plane consolidado.',
      '/hub sync, /hub doctor e /hub run <actionId> para usar a action plane canonica do Hub.',
      '/evals [workspace X|surface Y|executor Z|workflow W] para ver a Wave D com scorecards, traces e historico.',
      '/qa [alpha|beta] para ver budgets, regressions, smokes e release gates da Wave 6.',
      '/governance [limit N] para ver tenants, trust decisions, allowlists e policy da Wave 7.',
      '/replayloop [limit N] para ver replay, artifacts reutilizaveis e learning loop da Wave 8.',
      '/ecosystem [id|filtro] para ver SDKs, guides, publish e receitas publicas da Wave 9.',
      '/automations [status|maintenance on|maintenance off|maintenance run|pause <id>|resume <id>|remove <id>|<pedido natural>] para operar a Wave F.',
      '/platform sync para sincronizar o catalogo remoto do platform plane.',
      '/platform publish <pasta> para gerar bundle e proveniencia de uma extensao do ecossistema.',
      '/platform <inspect|open|install|trust|review|remove> <id> para agir no platform plane.',
      '/learning [status|candidates|approve <id>|reject <id>|promote <id>] para revisar o learning plane.',
      '/perm [pending|approved|rejected|all|show <id>|approve <id>|reject <id>] para operar o permission plane.',
      '/approve <task_id> e /reject <task_id> para decidir tarefas pendentes no fluxo canonico.',
      '/undo [task_id] para tentar rollback de uma tarefa recente.',
      '/selfmod [preview <arquivo> -- <instrucao>|goal -- <objetivo>|apply <preview_id>|rollback <change_id>] para usar o selfmod guardado.',
      '/codexremote para ver perfis, sessoes e handoffs do Codex Remote.',
      '/codexremote start [titulo] -- <prompt> para abrir uma sessao rastreavel do Codex CLI.',
      'No Codex Remote, pedidos sensiveis e estados relevantes devem aparecer ao operador na mesma surface.',
      '/AIGateway [status|route|start|doctor|sync|promote|rollback] para operar a rota propria do AIGateway.',
      '/workflow <review|ship|research|sdd|resume|restart-stage|close> ... para acionar workflows compostos.',
      '/teams [id] para ver os workflows compostos e onde cada um pode rodar.',
      '/tenants [tenant|surface] para ver governanca, onboarding e allowlists por tenant.',
      '/tenants run <tenantId> <actionId> para executar uma acao guiada de governanca por tenant.',
      '/memory [status|search <consulta>|procedures] para consultar a layered memory em camadas.',
      '/memoryplane para ver retomada, entregas e memorias em um unico plano.',
      '/sessions para ver o plano oficial de sessao.',
      '/sessionhistory [sessionId|chatId] para abrir replay e handoff consolidados.',
      '/sessionsend <sessionId|chatId> -- <mensagem> para despachar a outra sessao.',
      '/sessionspawn [web] para abrir uma sessao derivada rastreavel.',
      '/agmobile [start|status|guide|stop] para preparar o ZavorthBridge para uso pelo celular.',
      '/nodepair [headless|desktop|mobile|browser] [label] para criar um pairing draft de node.',
    ];

    if (ctx.platform === 'discord') {
      if (discordExposure === 'minimal' || discordExposure === 'operator') {
        lines.push('', 'No Discord, os comandos publicos aparecem como slash commands nativos.');
      } else {
        lines.push('', 'No Discord publico, slash commands estao desabilitados por policy neste runtime.');
      }

      if (isDiscordOperationalOwner) {
        lines.push(
          '',
          'Comandos operacionais liberados para owner neste contexto:',
          '/status para ver a saude do runtime.',
          '/models para ver providers e modelos ativos.',
          '/codexremote para ver perfis e sessoes remotas do Codex CLI.',
          '/teams [id] para ver os workflows compostos e as superficies permitidas.',
          '/tenants [tenant|surface] para ver tenants observados, onboarding e allowlists.',
          '/tenants run <tenantId> <actionId> para executar uma acao guiada de tenant.',
          '/capabilities para resumir o que o Zavorth sabe fazer.',
          '/runtime para ver a postura oficial de runtime e seguranca.',
          '/trust [status|mcp safe|mcp trusted|skills deny] para operar o Trust Plane oficial.',
          '/access [local|remote] para ver o manifesto oficial de acesso.',
          '/bootstrap para revisar o checklist oficial de bootstrap.',
          '/transports [id] para ver o plano oficial de transportes remotos.',
          '/transports <inspect|prepare|smoke|repair> <id> para agir num transporte remoto.',
          '/agmobile [start|status|guide|stop] para liberar o ZavorthBridge no celular sob demanda.',
          '/AIGateway [status|route|start|doctor|sync|promote|rollback] para operar a rota propria do AIGateway.',
          '/integrations [id] para ver o catalogo de integracoes.',
          '/connect <integracao> [modo] para iniciar onboarding de uma integracao.',
          '/changes para resumir mudancas locais e estado do runtime.',
          '/workflow <review|ship|research> <objetivo> para acionar times compostos.',
          '/workflow sdd <feature-id> para avancar uma feature no loop spec/plan/tasks.',
          '/reload para pedir um recycle supervisionado.',
          '/reload force para reciclar mesmo sem pendencia detectada.',
          '/autorepair para diagnosticar, corrigir, validar e religar.',
          '/autorepair status para consultar o ultimo relatorio.',
        );
      } else {
        lines.push('', 'Comandos operacionais ficam restritos ao owner e, no Discord publico, devem rodar em DM.');
      }
      return lines.join('\n');
    }

    lines.push(
      '/capabilities para resumir o que o Zavorth sabe fazer.',
      '/runtime para ver a postura oficial de runtime e seguranca.',
      '/trust [status|mcp safe|mcp trusted|skills deny] para operar o Trust Plane oficial.',
      '/access [local|remote] para ver o manifesto oficial de acesso.',
      '/bootstrap para revisar o checklist oficial de bootstrap.',
      '/transports [id] para ver bridges, node hosts e sidecars do plano remoto.',
      '/transports <inspect|prepare|smoke|repair> <id> para agir no Remote Transport Plane.',
      '/channels [id] para ver canais, readiness e proximo passo do mesh.',
      '/channels parity [id] para auditar paridade de experiencia por canal sem envio real.',
      '/channels <inspect|status|policy|prepare|broadcast-test|login-qr|relink|logout> <id> para agir no Channel Mesh oficial.',
      '/plugins [id|filtro] para ver plugins, skills e extensoes visiveis.',
      '/plugins <trust|review|install|update|remove> <id> para agir no plugin plane.',
      '/skills [library|bridge|run <skill>|live <skill> --approval-id <id>|origin <skill>|plan <id>|plan recipe <id>|id|filtro|recipe <id>|recommend <objetivo>|mcp] para ver e ativar skills pelo bridge governado.',
      '/platform [id|filtro|collection:id|recipe:id] para ver plugins, skills, MCPs, colecoes e recipes num unico plano.',
      '/hub [id|filtro] para ver o Hub + MCP product plane consolidado.',
      '/hub sync, /hub doctor e /hub run <actionId> para usar a action plane canonica do Hub.',
      '/evals [workspace X|surface Y|executor Z|workflow W] para ver a Wave D com scorecards, traces e historico.',
      '/qa [alpha|beta] para ver budgets, regressions, smokes e release gates da Wave 6.',
      '/governance [limit N] para ver tenants, trust decisions, allowlists e policy da Wave 7.',
      '/replayloop [limit N] para ver replay, artifacts reutilizaveis e learning loop da Wave 8.',
      '/ecosystem [id|filtro] para ver SDKs, guides, publish e receitas publicas da Wave 9.',
      '/automations [status|maintenance on|maintenance off|maintenance run|pause <id>|resume <id>|remove <id>|<pedido natural>] para operar a Wave F.',
      '/platform sync para sincronizar o catalogo remoto do platform plane.',
      '/platform publish <pasta> para gerar bundle e proveniencia de uma extensao do ecossistema.',
      '/platform <inspect|open|install|trust|review|remove> <id> para agir no platform plane.',
      '/learning [status|candidates|approve <id>|reject <id>|promote <id>] para revisar o learning plane.',
      '/AIGateway [status|route|start|doctor|sync|promote|rollback] para operar a rota propria do AIGateway.',
      '/teams [id] para ver os workflows compostos e as superficies permitidas.',
      '/tenants [tenant|surface] para ver tenants observados, onboarding e allowlists.',
      '/tenants run <tenantId> <actionId> para executar uma acao guiada de tenant.',
      '/memory [status|search <consulta>|procedures] para consultar a layered memory em camadas.',
      '/memoryplane para ver retomada, entregas e memorias num unico plano.',
      '/agmobile [start|status|guide|stop] para liberar o ZavorthBridge no celular sob demanda.',
      '/integrations [id] para ver o catalogo de integracoes.',
      '/connect <integracao> [modo] para iniciar onboarding de uma integracao.',
      '/status para ver a saude do runtime.',
      '/models para ver providers e modelos ativos.',
      '/codexremote para ver perfis e sessoes remotas do Codex CLI.',
      'No Codex Remote, pedidos sensiveis e estados relevantes devem aparecer ao operador na mesma surface.',
      '/workflow <review|ship|research> <objetivo> para acionar times compostos.',
      '/workflow sdd <feature-id> para avancar uma feature no loop spec/plan/tasks.',
      '/changes para resumir mudancas locais e estado do runtime.',
      '/reload para pedir um recycle supervisionado.',
      '/reload force para reciclar mesmo sem pendencia detectada.',
      '/autorepair para diagnosticar, corrigir, validar e religar.',
      '/autorepair status para consultar o ultimo relatorio.',
    );

    return lines.join('\n');
  }

  public formatSecurityMeshReply(): string {
    const snapshot = this.deps.securityMeshService.buildSnapshot();
    const trustPlane = this.deps.trustPlaneService.buildSnapshot();
    const posture = snapshot.posture || { label: 'n/d', summary: 'Sem postura disponivel.' };
    const summary = snapshot.summary || {
      coreReady: 0,
      extensionsReady: 0,
      gvisorActive: false,
      firecrackerReady: false,
      neverDowngrade: false,
    };
    const actions = Array.isArray(snapshot.suggestedActions) ? snapshot.suggestedActions.slice(0, 3) : [];

    const lines = [
      'Runtime & Security Mesh',
      '',
      `Postura: ${posture.label}.`,
      snapshot.narrative?.operatorSummary || posture.summary,
      '',
      `Core pronto: ${summary.coreReady} | Extensoes prontas: ${summary.extensionsReady}.`,
      `gVisor: ${summary.gvisorActive ? 'ativo' : 'inativo'} | MicroVM: ${summary.firecrackerReady ? 'pronta' : 'em preparo'}.`,
      `Never-downgrade: ${summary.neverDowngrade ? 'ativo' : 'inativo'}.`,
      '',
      snapshot.narrative?.trustBoundary || 'Sem trust boundary detalhado agora.',
      '',
      'Trust Plane',
      '',
      trustPlane.narrative?.operatorSummary || 'Sem resumo de trust plane disponivel.',
      `MCP: ${trustPlane.surfaces.mcp.profile} | Skills: ${trustPlane.surfaces.skills.defaultPolicy} | Approvals: ${trustPlane.surfaces.systemOverlord.pendingApprovals}.`,
    ];

    if (actions.length > 0) {
      lines.push('', 'Proximos passos:');
      for (const action of actions) {
        lines.push(`- ${action.label}: ${action.command}`);
      }
    }

    const trustActions = Array.isArray(trustPlane.suggestedActions)
      ? trustPlane.suggestedActions.slice(0, 3)
      : [];
    if (trustActions.length > 0) {
      lines.push('', 'Acoes de trust sugeridas:');
      for (const action of trustActions) {
        lines.push(`- ${action.label}: ${action.command || action.reason}`);
      }
    }

    return lines.join('\n');
  }

  public formatSystemStatusReply(
    snapshot: RuntimeDiagnosticsSnapshot,
    ctx: Pick<IMessageContext, 'platform' | 'userId' | 'isGroup'>,
  ): string {
    const uptimeMinutes = Math.floor(snapshot.process.uptimeSeconds / 60);
    const uptimeText =
      uptimeMinutes >= 60
        ? `${Math.floor(uptimeMinutes / 60)}h ${uptimeMinutes % 60}min`
        : `${uptimeMinutes}min`;
    const hostPid = snapshot.runtime.hostSupervisor.alive ? snapshot.runtime.hostSupervisor.pid : null;
    const workerPid = snapshot.runtime.telegramWorker.alive ? snapshot.runtime.telegramWorker.pid : null;
    const discordLabel = snapshot.runtime.discordBridge.mode === 'native' ? 'Discord nativo' : 'Discord bridge';
    const lastFailure = snapshot.tasks.recentFailures[0] || null;
    const isDiscordOperationalOwner =
      ctx.platform === 'discord' &&
      this.deps.discordSurfacePolicyService.canUseOperationalCommand(String(ctx.userId || '').trim(), {
        isDirectMessage: !ctx.isGroup,
      });
    const shortcuts =
      ctx.platform === 'discord' && !isDiscordOperationalOwner
        ? 'Atalhos uteis: /help e /task.'
        : 'Atalhos uteis: /help, /changes, /reload, /autorepair.';

    const lines = [
      'Panorama do Zavorth',
      '',
      `Agora: online ha ${uptimeText}.`,
      `Uso atual: RSS ${snapshot.process.rssMb} MB | heap ${snapshot.process.heapMb} MB.`,
      `Processos ativos: host ${hostPid || 'indisponivel'} | worker ${workerPid || 'indisponivel'}.`,
      `${discordLabel}: ${snapshot.runtime.discordBridge.started ? 'ativo' : 'pendente'}${
        snapshot.runtime.discordBridge.lastError ? ` | ultimo erro: ${snapshot.runtime.discordBridge.lastError}` : ''
      }.`,
      `Tarefas em andamento: ${snapshot.tasks.activeCount} | backlog antigo: ${snapshot.tasks.staleCount}.`,
      `Ambiente: ${snapshot.process.platform} / ${snapshot.process.cpuArch}.`,
      '',
      shortcuts,
    ];

    if (lastFailure) {
      lines.push(
        '',
        `Ultimo alerta: ${lastFailure.executor || lastFailure.commandType || 'executor desconhecido'} | task ${lastFailure.taskId.substring(0, 8)}.`,
        `Motivo: ${String(lastFailure.errorSummary || 'sem resumo').substring(0, 120)}`,
      );
    }

    return lines.join('\n');
  }

  public parseRuntimeMaintenanceIntent(rawText: string): RuntimeMaintenanceIntent | null {
    const normalized = String(rawText || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    if (
      /^(resuma|mostre|me diga|quais sao)( as)? (ultimas|ultimas) (alteracoes|mudancas)/i.test(normalized) ||
      normalized.includes('resumo das ultimas alteracoes') ||
      normalized.includes('resumo das ultimas mudancas')
    ) {
      return { action: 'changes', force: false, dryRun: false, improve: false };
    }

    if (
      normalized.includes('se autoatualize') ||
      normalized.includes('se atualize') ||
      normalized.includes('atualize o zavorth') ||
      normalized.includes('recarregue o zavorth') ||
      normalized.includes('reinicie o zavorth') ||
      normalized.includes('suba o zavorth com as mudancas') ||
      normalized.includes('religue o zavorth')
    ) {
      return {
        action: 'reload',
        force: /(force|forcar|forcado|mesmo que ja esteja rodando)/i.test(normalized),
        dryRun: false,
        improve: false,
      };
    }

    if (
      normalized.includes('se autorepare') ||
      normalized.includes('se conserte') ||
      normalized.includes('tente se corrigir') ||
      normalized.includes('corrija o zavorth') ||
      normalized.includes('faca autoreparo') ||
      normalized.includes('se melhore') ||
      normalized.includes('melhore o zavorth') ||
      normalized.includes('se otimize') ||
      normalized.includes('otimize o zavorth')
    ) {
      return {
        action: 'autorepair',
        force: /(force|forcar|forcado|mesmo sem erro)/i.test(normalized),
        dryRun: /(simule|dry run|dryrun|planeje|mostre o plano)/i.test(normalized),
        improve: /(melhore|otimize)/i.test(normalized),
      };
    }

    return null;
  }
}
