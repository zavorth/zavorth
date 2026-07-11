import { DiscordGatewayRepairFlowService } from '../../../../services/DiscordGatewayRepairFlowService.js';
import { GatewayHealthRenewalService } from '../../../../services/GatewayHealthRenewalService.js';
import type {
  RuntimeAccessChannelProviderDoctorSnapshot,
  RuntimeAccessZavorthControlSnapshot,
  RuntimeAccessReadinessReport,
  RuntimeAccessReadinessStep,
  RuntimeAccessResolvedInput,
} from './RuntimeAccessReadinessTypes.js';

type RuntimeAccessSurfaceProbe = {
  ok: boolean;
  targetUrl: string;
  statusCode: number | null;
  error: string | null;
};

type RuntimeAccessReportBuilderOptions = {
  now: () => Date;
  publicBaseUrl: string;
  highRiskApprovalPin: string;
  buildLocalBaseUrl: (zavorthControl: RuntimeAccessZavorthControlSnapshot | null) => string;
  discordGatewayRepairFlowService: Pick<DiscordGatewayRepairFlowService, 'inspect'>;
  gatewayHealthRenewalService: Pick<GatewayHealthRenewalService, 'inspect'>;
};

export class RuntimeAccessReadinessReportService {
  constructor(private readonly options: RuntimeAccessReportBuilderOptions) {}

  public buildReport(input: RuntimeAccessResolvedInput, localProbe: RuntimeAccessSurfaceProbe | null = null): RuntimeAccessReadinessReport {
    const localBaseUrl = this.options.buildLocalBaseUrl(input.zavorthControl);
    const localIssues = this.buildLocalIssues(input, localProbe);
    const remoteIssues = this.buildRemoteIssues(input);
    const localReady = this.buildLocalBlockingIssues(input, localProbe).length === 0;
    const remoteReady = localReady && remoteIssues.length === 0;
    const recommendations = this.buildRecommendations(input, localReady, remoteReady);
    const nextSteps = this.buildNextSteps(input, remoteReady, localProbe);

    return {
      checkedAt: this.options.now().toISOString(),
      runtime: {
        ...input,
        hostAuthorized: input.hostIdentity?.authorized ?? null,
        firstRun: input.hostIdentity?.firstRun ?? null,
      },
      auth: input.auth,
      local: {
        baseUrl: localBaseUrl,
        zavorthControlUrl: `${localBaseUrl}/zavorthControl`,
        appUrl: `${localBaseUrl}/zavorthControl`,
        ready: localReady,
        issues: localIssues,
      },
      remote: {
        baseUrl: this.options.publicBaseUrl || null,
        appUrl: this.options.publicBaseUrl ? `${this.options.publicBaseUrl}/zavorthControl` : null,
        ready: remoteReady,
        issues: remoteIssues,
      },
      recommendations,
      nextSteps,
      summary: this.buildSummary(localReady, remoteReady, localIssues, remoteIssues),
    };
  }

  public buildLocalBlockingIssues(input: RuntimeAccessResolvedInput, localProbe: RuntimeAccessSurfaceProbe | null): string[] {
    const issues: string[] = [];
    const surfaceHealthy = localProbe?.ok === true;
    if (!input.hostSupervisor.alive && !surfaceHealthy) issues.push('O host supervisor nao esta ativo.');
    if (!input.telegramWorker.alive && !surfaceHealthy) issues.push('O worker principal do Zavorth nao esta ativo.');
    if (input.providers.readyCount === 0) issues.push('Nenhum provider conversacional esta pronto no runtime atual.');
    if (input.nodeMeshSmoke.status === 'failed') issues.push('O ultimo smoke real do Node Mesh falhou; o runtime local ainda nao deve ser tratado como pronto.');
    if (input.systemOverlordSmoke.status === 'failed') issues.push('O ultimo smoke do System Overlord falhou; revise browser/tunnel/WSL/Docker supervisionados antes de confiar nessas superficies.');
    if (input.hostIdentity && input.hostIdentity.authorized === false) issues.push('O host atual ainda nao foi autorizado para execucoes mutaveis.');
    if (localProbe && !localProbe.ok) issues.push(this.describeLocalProbeFailure(localProbe));
    return issues;
  }

  public buildLocalIssues(input: RuntimeAccessResolvedInput, localProbe: RuntimeAccessSurfaceProbe | null): string[] {
    const issues: string[] = [];
    const surfaceHealthy = localProbe?.ok === true;
    if (!input.hostSupervisor.alive && !surfaceHealthy) issues.push('O host supervisor nao esta ativo.');
    if (!input.telegramWorker.alive && !surfaceHealthy) issues.push('O worker principal do Zavorth nao esta ativo.');
    if (input.providers.readyCount === 0) issues.push('Nenhum provider conversacional esta pronto no runtime atual.');
    if (input.nodeMeshSmoke.status === 'failed') {
      issues.push(input.nodeMeshSmoke.error ? `O smoke real do Node Mesh falhou na ultima execucao: ${input.nodeMeshSmoke.error}` : 'O smoke real do Node Mesh falhou na ultima execucao.');
    }
    if (input.systemOverlordSmoke.status === 'failed') {
      issues.push(input.systemOverlordSmoke.summary ? `O smoke do System Overlord falhou na ultima execucao: ${input.systemOverlordSmoke.summary}` : 'O smoke do System Overlord falhou na ultima execucao.');
    }
    if (input.hostIdentity && input.hostIdentity.authorized === false) issues.push('O host atual ainda nao foi autorizado para execucoes mutaveis.');
    if (localProbe && !localProbe.ok) issues.push(this.describeLocalProbeFailure(localProbe));
    return issues;
  }

  public buildRemoteIssues(input: RuntimeAccessResolvedInput): string[] {
    const issues: string[] = [];
    if (!this.options.publicBaseUrl) {
      issues.push('ZAVORTH_PUBLIC_BASE_URL ainda nao foi configurada.');
    } else if (!this.options.publicBaseUrl.toLowerCase().startsWith('https://')) {
      issues.push('A URL publica do Zavorth precisa usar HTTPS para o shell web remoto.');
    }
    if (!input.auth.enabled) issues.push('O token web ainda nao esta pronto.');
    if (input.hostIdentity && input.hostIdentity.authorized === false) issues.push('O host atual ainda nao foi autorizado para execucoes mutaveis.');
    if (input.tenants.pendingOnboardingCount > 0) issues.push('Ainda existem tenants compartilhados sem onboarding/policy completos.');
    if (input.nodeMeshSmoke.status === 'failed') issues.push('O ultimo smoke real do Node Mesh falhou; revise o plano remoto antes de confiar em invokes pareados.');
    if (input.systemOverlordSmoke.status === 'failed') issues.push('O smoke do System Overlord falhou; revalide browser/tunnel/WSL/Docker supervisionados antes de prometer operacao ampliada no host remoto.');
    if (input.channelProviderDoctor.status === 'failed') issues.push('O doctor dos canais nativos falhou; revalide Slack native / WhatsApp Cloud API antes de ampliar o rollout remoto.');
    if (input.remoteTransportDoctor.status === 'failed') issues.push('O doctor dos transportes remotos falhou; revalide o plano remoto antes de confiar em sidecars, gateways e nodes pareados.');
    return issues;
  }

  public buildRecommendations(input: RuntimeAccessResolvedInput, localReady: boolean, remoteReady: boolean): string[] {
    const lines: string[] = [];
    const mcpSummary = this.normalizeMcpSummary(input.mcp);
    const discordRepair = this.options.discordGatewayRepairFlowService.inspect(input.discordBridge);
    const healthRenewal = this.options.gatewayHealthRenewalService.inspect({
      checkedAt: this.options.now().toISOString(),
      runtime: {
        hostSupervisor: input.hostSupervisor,
        telegramWorker: input.telegramWorker,
        discordBridge: input.discordBridge,
        providers: input.providers,
        mcp: input.mcp,
        tenants: input.tenants,
        zavorthControl: null,
        nodeMeshSmoke: input.nodeMeshSmoke,
        systemOverlordSmoke: input.systemOverlordSmoke,
        channelProviderDoctor: input.channelProviderDoctor,
        remoteTransportDoctor: input.remoteTransportDoctor,
        learning: input.learning,
        layeredMemory: input.layeredMemory,
        platform: input.platform,
        hostAuthorized: input.hostIdentity?.authorized ?? null,
        firstRun: input.hostIdentity?.firstRun ?? null,
      },
      auth: input.auth,
      local: { baseUrl: this.options.buildLocalBaseUrl(null), zavorthControlUrl: `${this.options.buildLocalBaseUrl(null)}/zavorthControl`, appUrl: `${this.options.buildLocalBaseUrl(null)}/zavorthControl`, ready: localReady, issues: [] },
      remote: { baseUrl: this.options.publicBaseUrl || null, appUrl: this.options.publicBaseUrl ? `${this.options.publicBaseUrl.replace(/\/+$/u, '')}/zavorthControl` : null, ready: remoteReady, issues: [] },
      recommendations: [],
      nextSteps: [],
      summary: '',
    });

    if (localReady) lines.push('Use o /zavorthControl local como superficie principal para operar e aprovar o Zavorth.');
    if (input.learning.available) {
      if (input.learning.summary.pending > 0) lines.push(`O learning plane tem ${input.learning.summary.pending} candidato(s) pendente(s); use /learning candidates para revisar e promover so o que passou pelo gate.`);
      else if (input.learning.summary.total > 0) lines.push(`O learning plane ja consolidou ${input.learning.summary.total} candidato(s), com ${input.learning.summary.promoted} trusted local e ${input.learning.summary.quarantined} em quarentena.`);
      else lines.push('O learning plane ainda nao encontrou runs de alta confianca suficientes para gerar candidatos novos.');
    }
    if (input.layeredMemory.available) {
      if (input.layeredMemory.summary.procedural > 0) lines.push(`A layered memory tem ${input.layeredMemory.summary.procedural} procedimento(s) validado(s); use /memory procedures para reaproveitar passos confiaveis.`);
      else lines.push('A layered memory ja esta ligada, mas ainda sem procedimentos suficientes para procedural recall forte.');
    }
    if (input.platform.available) {
      if (input.platform.summary.reviewPending > 0 || input.platform.summary.quarantined > 0) lines.push(`O platform plane tem ${input.platform.summary.reviewPending} item(ns) em review e ${input.platform.summary.quarantined} em quarentena; feche esse gate antes de ampliar o rollout.`);
      else if (input.platform.summary.learnedLocal > 0) lines.push(`O platform plane ja reconhece ${input.platform.summary.learnedLocal} item(ns) learned-local com governanca explicita.`);
    }
    if (discordRepair.status === 'healthy') lines.push(input.discordBridge.mode === 'native' ? 'O gateway nativo do Discord esta pronto para receber mensagens diretamente.' : 'O Discord bridge local esta pronto para receber envelopes assinados do relay.');
    else if (discordRepair.status === 'attention') { lines.push(discordRepair.summary); if (discordRepair.nextStep) lines.push(discordRepair.nextStep); }
    const selectedModel = input.providers.modelPicker?.selected || null;
    if (selectedModel) {
      lines.push(`O Model Picker compartilhado selecionou ${selectedModel.providerLabel}/${selectedModel.modelLabel} (${selectedModel.readiness}).`);
    }
    if (input.providers.readyCount > 0) lines.push(`O provider plane tem ${input.providers.readyCount} rota(s) pronta(s); atual ${input.providers.activeProviderName}/${input.providers.activeModelName} com perfil ${input.providers.recommendedProfile}.`);
    else lines.push('Nenhum provider pronto foi encontrado; configure ao menos uma rota cloud antes de tratar o runtime como operacional.');
    for (const recommendation of input.providers.recommendations.slice(0, 2)) lines.push(recommendation);
    if (mcpSummary.enabled > 0) lines.push(mcpSummary.connected > 0 ? `O MCP control plane tem ${mcpSummary.connected}/${mcpSummary.enabled} servidor(es) conectado(s) com ${mcpSummary.toolCount} tool(s) prontas.` : 'Existem servidores MCP habilitados, mas nenhum entrou em estado conectado no runtime atual.');
    for (const recommendation of input.mcp.recommendations.slice(0, 1)) lines.push(recommendation);
    if (input.tenants.pendingOnboardingCount > 0) {
      const firstPending = input.tenants.pendingOnboarding[0];
      lines.push(`Feche o onboarding/policy de ${firstPending?.tenantId || 'o tenant compartilhado'} antes de tratar esse runtime como multitenant pronto para producao.`);
    }
    if (input.nodeMeshSmoke.status === 'passed' && !input.nodeMeshSmoke.stale) lines.push(input.nodeMeshSmoke.checkedAt ? `O Node Mesh passou no smoke real em ${input.nodeMeshSmoke.checkedAt}; pairing, heartbeat e invoke end-to-end estao validados.` : 'O Node Mesh passou no smoke real; pairing, heartbeat e invoke end-to-end estao validados.');
    else if (input.nodeMeshSmoke.status === 'passed' && input.nodeMeshSmoke.stale) lines.push(input.nodeMeshSmoke.checkedAt ? `O ultimo smoke real do Node Mesh passou em ${input.nodeMeshSmoke.checkedAt}, mas o relatorio ficou velho; rode npm run test:nodes:smoke para renovar a validacao da malha.` : 'O ultimo smoke real do Node Mesh passou, mas o relatorio ficou velho; rode npm run test:nodes:smoke para renovar a validacao da malha.');
    else if (input.nodeMeshSmoke.status === 'failed') lines.push('O ultimo smoke real do Node Mesh falhou; rode npm run test:nodes:smoke antes de confiar em invokes remotos.');
    else if (input.nodeMeshSmoke.status === 'running') lines.push('Existe um smoke real do Node Mesh em andamento; aguarde o resultado antes de tratar a malha como validada.');
    else lines.push('Ainda nao existe um smoke real recente do Node Mesh; rode npm run test:nodes:smoke para validar pairing, heartbeat e invoke end-to-end.');
    if (input.systemOverlordSmoke.status === 'passed' && !input.systemOverlordSmoke.stale) lines.push(input.systemOverlordSmoke.checkedAt ? `O System Overlord passou no smoke em ${input.systemOverlordSmoke.checkedAt}; browser, tunnel, WSL e Docker supervisionados foram avaliados de forma honesta.` : 'O System Overlord passou no smoke; browser, tunnel, WSL e Docker supervisionados foram avaliados de forma honesta.');
    else if (input.systemOverlordSmoke.status === 'passed' && input.systemOverlordSmoke.stale) lines.push(input.systemOverlordSmoke.checkedAt ? `O ultimo smoke do System Overlord passou em ${input.systemOverlordSmoke.checkedAt}, mas o relatorio ficou velho; rode npm run test:overlord:smoke para renovar browser, tunnel, WSL e Docker supervisionados.` : 'O ultimo smoke do System Overlord passou, mas o relatorio ficou velho; rode npm run test:overlord:smoke para renovar browser, tunnel, WSL e Docker supervisionados.');
    else if (input.systemOverlordSmoke.status === 'failed') lines.push(input.systemOverlordSmoke.summary ? `O smoke do System Overlord falhou: ${input.systemOverlordSmoke.summary}` : 'O smoke do System Overlord falhou; rode npm run test:overlord:smoke antes de confiar nas superficies supervisionadas do host.');
    else if (input.systemOverlordSmoke.status === 'running') lines.push('Existe um smoke do System Overlord em andamento; aguarde o resultado antes de tratar browser/tunnel/WSL/Docker como validados.');
    else if (input.systemOverlordSmoke.status === 'skipped') lines.push('O smoke do System Overlord terminou so com skips honestos; faltam dependencias opcionais para validar browser/tunnel/WSL/Docker supervisionados.');
    else lines.push('Ainda nao existe um smoke recente do System Overlord; rode npm run test:overlord:smoke para validar browser, tunnel, WSL e Docker supervisionados.');
    if (input.channelProviderDoctor.status === 'passed' && !input.channelProviderDoctor.stale) lines.push(input.channelProviderDoctor.checkedAt ? `O doctor dos canais nativos validou ${this.describeChannelProviderDoctorTargets(input.channelProviderDoctor)} em ${input.channelProviderDoctor.checkedAt}.` : `O doctor dos canais nativos validou ${this.describeChannelProviderDoctorTargets(input.channelProviderDoctor)}.`);
    else if (input.channelProviderDoctor.status === 'passed' && input.channelProviderDoctor.stale) lines.push(input.channelProviderDoctor.checkedAt ? `O ultimo doctor dos canais nativos passou em ${input.channelProviderDoctor.checkedAt}, mas o relatorio ficou velho; rode npm run test:channels:smoke antes de ampliar o rollout de Slack native / WhatsApp Cloud API.` : 'O ultimo doctor dos canais nativos passou, mas o relatorio ficou velho; rode npm run test:channels:smoke antes de ampliar o rollout de Slack native / WhatsApp Cloud API.');
    else if (input.channelProviderDoctor.status === 'failed') lines.push(input.channelProviderDoctor.summary ? `O doctor dos canais nativos falhou: ${input.channelProviderDoctor.summary}` : 'O doctor dos canais nativos falhou; rode npm run test:channels:smoke antes de ampliar o rollout de Slack native / WhatsApp Cloud API.');
    if (input.remoteTransportDoctor.status === 'passed' && !input.remoteTransportDoctor.stale) lines.push(input.remoteTransportDoctor.checkedAt ? `Os transportes remotos passaram no doctor em ${input.remoteTransportDoctor.checkedAt}; o plano remoto esta validado.` : 'Os transportes remotos passaram no doctor; o plano remoto esta validado.');
    else if (input.remoteTransportDoctor.status === 'passed' && input.remoteTransportDoctor.stale) lines.push(input.remoteTransportDoctor.checkedAt ? `O ultimo doctor dos transportes remotos passou em ${input.remoteTransportDoctor.checkedAt}, mas o relatorio ficou velho; rode npm run test:transports:smoke antes de confiar em sidecars, gateways e nodes pareados.` : 'O ultimo doctor dos transportes remotos passou, mas o relatorio ficou velho; rode npm run test:transports:smoke antes de confiar em sidecars, gateways e nodes pareados.');
    else if (input.remoteTransportDoctor.status === 'failed') lines.push(input.remoteTransportDoctor.summary ? `O doctor dos transportes remotos falhou: ${input.remoteTransportDoctor.summary}` : 'O doctor dos transportes remotos falhou; rode npm run test:transports:smoke antes de confiar no plano remoto.');
    else if (input.remoteTransportDoctor.status === 'running') lines.push('Existe um doctor dos transportes remotos em andamento; aguarde o resultado antes de tratar o plano remoto como validado.');
    if (healthRenewal.status === 'renewal_recommended') lines.push(`${healthRenewal.summary} Comandos uteis: ${healthRenewal.commands.slice(0, 3).join(' | ')}.`);
    if (!this.options.publicBaseUrl) lines.push('Para acesso remoto simples, suba um tunnel rapido com npm run ops:public:tunnel ou defina ZAVORTH_PUBLIC_BASE_URL com uma URL HTTPS confiavel.');
    if (this.options.publicBaseUrl && !remoteReady) lines.push('A URL publica ja existe, mas ainda falta fechar os itens de seguranca e disponibilidade para uso remoto.');
    if (remoteReady) lines.push('O shell web remoto ja pode apontar para a URL publica do Zavorth com token web dedicado.');
    if (!input.auth.enabled && this.options.highRiskApprovalPin) lines.push('O PIN de alto risco continua reservado para confirmacoes criticas; defina ZAVORTH_WEB_AUTH_TOKEN dedicado para liberar o acesso web.');
    if (input.hostIdentity?.firstRun) lines.push('O host esta em primeira execucao; confirme /hostauth status antes de liberar operacao mutavel em outras maquinas.');
    if (localReady && (!input.hostSupervisor.alive || !input.telegramWorker.alive)) lines.push('A superficie web respondeu, mas o lock do supervisor ou do worker parece desatualizado; confirme o runtime antes de usar este host como referencia operacional.');
    return Array.from(new Set(lines));
  }

  public buildNextSteps(input: RuntimeAccessResolvedInput, remoteReady: boolean, localProbe: RuntimeAccessSurfaceProbe | null = null): RuntimeAccessReadinessStep[] {
    const steps: RuntimeAccessReadinessStep[] = [];
    const surfaceHealthy = localProbe?.ok === true;
    const discordRepair = this.options.discordGatewayRepairFlowService.inspect(input.discordBridge);
    const healthRenewal = this.options.gatewayHealthRenewalService.inspect({
      checkedAt: this.options.now().toISOString(),
      runtime: {
        ...input,
        zavorthControl: null,
        hostAuthorized: input.hostIdentity?.authorized ?? null,
        firstRun: null,
      },
      auth: input.auth,
      local: { baseUrl: this.options.buildLocalBaseUrl(null), zavorthControlUrl: `${this.options.buildLocalBaseUrl(null)}/zavorthControl`, appUrl: `${this.options.buildLocalBaseUrl(null)}/zavorthControl`, ready: surfaceHealthy, issues: [] },
      remote: { baseUrl: this.options.publicBaseUrl, appUrl: this.options.publicBaseUrl ? `${this.options.publicBaseUrl}/zavorthControl` : null, ready: remoteReady, issues: [] },
      recommendations: [],
      nextSteps: [],
      summary: surfaceHealthy ? 'Runtime local com superficie pronta.' : 'Runtime local ainda pede reconciliacao de superficie.',
    });

    if (!input.hostSupervisor.alive && !surfaceHealthy) steps.push({ id: 'start-supervised-host', title: 'Subir o host supervisionado', description: 'Rode npm run dev:supervised ou npm run start:supervised antes de abrir o /zavorthControl.', blocking: true });
    else if (localProbe && !localProbe.ok) steps.push({ id: 'recover-web-surface', title: 'Recuperar a superficie web', description: 'O host supervisor esta ativo, mas o endpoint de prontidao web nao respondeu. Reinicie o runtime supervisionado ou confira a porta anunciada antes de operar.', blocking: true });
    else if (!input.telegramWorker.alive && !surfaceHealthy) steps.push({ id: 'recover-worker', title: 'Recuperar o worker principal', description: 'Use /selfupdate ou reinicie o Zavorth supervisionado para recolocar o worker em linha.', blocking: true });
    if (input.hostIdentity && input.hostIdentity.authorized === false) steps.push({ id: 'trust-host', title: 'Autorizar este host', description: 'Valide /hostauth status e rode /hostauth trust se este host for confiavel para execucao mutavel.', blocking: true });
    if (input.providers.readyCount === 0) steps.push({ id: 'configure-primary-provider', title: 'Configurar um provider principal', description: 'Defina GEMINI_API_KEY, OPENAI_API_KEY ou outra rota valida antes de operar o Zavorth em producao.', blocking: true });
    else if (input.providers.modelPicker?.selected && !input.providers.modelPicker.selected.ready) steps.push({ id: 'align-model-picker-selection', title: 'Alinhar a selecao do Model Picker', description: `A selecao compartilhada aponta para ${input.providers.modelPicker.selected.providerLabel}/${input.providers.modelPicker.selected.modelLabel}, mas essa rota esta em ${input.providers.modelPicker.selected.readiness}. Configure a rota ou escolha um provider pronto.`, blocking: false });
    else if (!input.providers.readyProviders.includes(input.providers.activeProviderName)) steps.push({ id: 'align-provider-default', title: 'Alinhar o provider default', description: `O provider ativo ainda nao aparece como pronto. Considere trocar o default para ${input.providers.(readyProviders[0] || '')}.`, blocking: false });
    if (discordRepair.status === 'attention') steps.push({ id: 'recover-discord-bridge', title: input.discordBridge.mode === 'native' ? 'Recuperar o gateway do Discord' : 'Recuperar o Discord bridge', description: discordRepair.nextStep || (input.discordBridge.mode === 'native' ? 'Use /autorepair ou /reload para reconciliar o gateway nativo do Discord antes de abrir o canal remoto.' : 'Use /autorepair ou /reload para reconciliar o relay local do Discord antes de abrir o canal remoto.'), blocking: false });
    if (healthRenewal.status === 'renewal_recommended') steps.push({ id: 'renew-gateway-health', title: 'Renovar checks leves de health', description: `${healthRenewal.summary} Comandos uteis: ${healthRenewal.commands.slice(0, 3).join(' | ')}.`.trim(), blocking: false });
    if (this.normalizeMcpSummary(input.mcp).enabled > 0 && this.normalizeMcpSummary(input.mcp).connected === 0) steps.push({ id: 'recover-mcp-runtime', title: 'Reconectar o runtime MCP', description: 'O manifesto MCP esta presente, mas nenhuma capability habilitada ficou conectada. Revise manifesto, binarios e bootstrap do runtime MCP.', blocking: false });
    if (input.tenants.pendingOnboardingCount > 0) steps.push({ id: 'finish-tenant-onboarding', title: 'Fechar onboarding dos tenants compartilhados', description: 'Configure owner IDs, canais allowlisted e policy dos tenants pendentes antes de abrir o runtime para multiplos servidores.', blocking: false });
    if (input.learning.available && input.learning.summary.pending > 0) steps.push({ id: 'review-learning-candidates', title: 'Revisar candidatos aprendidos', description: 'Use /learning candidates para aprovar, promover ou colocar em quarentena os drafts aprendidos antes de expor novas automacoes no runtime trusted.', blocking: false });
    if (input.layeredMemory.available && input.layeredMemory.summary.procedural > 0) steps.push({ id: 'consult-procedural-memory', title: 'Consultar a memoria procedural', description: 'Use /memory procedures ou o card de memoria no /zavorthControl para reaproveitar procedimentos validados antes de repetir uma rotina manualmente.', blocking: false });
    if (input.platform.available && (input.platform.summary.reviewPending > 0 || input.platform.summary.quarantined > 0)) steps.push({ id: 'review-platform-governance', title: 'Fechar review e quarentena do platform plane', description: 'Revise os itens learned-local, os candidatos em review e qualquer quarentena antes de promover novos plugins, skills ou MCPs.', blocking: false });
    if (input.nodeMeshSmoke.status !== 'passed' || input.nodeMeshSmoke.stale) steps.push({ id: 'validate-node-mesh-smoke', title: 'Validar o Node Mesh com smoke real', description: input.nodeMeshSmoke.status === 'failed' ? 'O ultimo smoke real do Node Mesh falhou. Rode npm run test:nodes:smoke e revise o relatorio persistido antes de confiar em invokes pareados.' : input.nodeMeshSmoke.status === 'running' ? 'Existe um smoke real do Node Mesh em andamento. Aguarde o resultado persistido antes de liberar a malha como valida.' : input.nodeMeshSmoke.stale ? 'O ultimo smoke real do Node Mesh ficou velho. Rode npm run test:nodes:smoke para renovar a validacao de pairing, heartbeat e invoke end-to-end.' : 'Ainda nao existe um smoke real recente do Node Mesh. Rode npm run test:nodes:smoke para validar pairing, heartbeat e invoke end-to-end.', blocking: false });
    if (input.systemOverlordSmoke.status === 'failed' || input.systemOverlordSmoke.status === 'running' || input.systemOverlordSmoke.status === 'missing' || input.systemOverlordSmoke.status === 'skipped' || (input.systemOverlordSmoke.status === 'passed' && input.systemOverlordSmoke.stale)) {
      const description = input.systemOverlordSmoke.status === 'failed' ? (input.systemOverlordSmoke.summary ? `O ultimo smoke do System Overlord falhou (${input.systemOverlordSmoke.summary}). Rode npm run test:overlord:smoke antes de confiar em browser, tunnel, WSL e Docker supervisionados.` : 'O ultimo smoke do System Overlord falhou. Rode npm run test:overlord:smoke antes de confiar em browser, tunnel, WSL e Docker supervisionados.') : input.systemOverlordSmoke.status === 'running' ? 'Existe um smoke do System Overlord em andamento. Aguarde o relatorio persistido antes de liberar browser, tunnel, WSL e Docker supervisionados.' : input.systemOverlordSmoke.status === 'passed' ? (input.systemOverlordSmoke.checkedAt ? `O smoke do System Overlord ficou velho (ultimo relatorio em ${input.systemOverlordSmoke.checkedAt}). Rode npm run test:overlord:smoke para renovar a validacao das superficies supervisionadas.` : 'O smoke do System Overlord ficou velho. Rode npm run test:overlord:smoke para renovar a validacao das superficies supervisionadas.') : input.systemOverlordSmoke.status === 'skipped' ? 'O smoke do System Overlord terminou apenas com skips honestos. Provisione as dependencias opcionais e rode npm run test:overlord:smoke para validar browser, tunnel, WSL e Docker supervisionados.' : 'Ainda nao existe um smoke recente do System Overlord. Rode npm run test:overlord:smoke para validar browser, tunnel, WSL e Docker supervisionados.';
      steps.push({ id: 'validate-system-overlord-smoke', title: 'Validar o System Overlord supervisionado', description, blocking: false });
    }
    if (input.channelProviderDoctor.status === 'failed' || (input.channelProviderDoctor.status === 'passed' && input.channelProviderDoctor.stale)) {
      const description = input.channelProviderDoctor.status === 'failed' ? (input.channelProviderDoctor.summary ? `O doctor dos canais nativos falhou (${input.channelProviderDoctor.summary}). Rode npm run test:channels:smoke antes de ampliar o rollout de Slack native / WhatsApp Cloud API.` : 'O doctor dos canais nativos falhou. Rode npm run test:channels:smoke antes de ampliar o rollout de Slack native / WhatsApp Cloud API.') : input.channelProviderDoctor.checkedAt ? `O doctor dos canais nativos ficou velho (ultimo relatorio em ${input.channelProviderDoctor.checkedAt}). Rode npm run test:channels:smoke para renovar a validacao de Slack native / WhatsApp Cloud API.` : 'O doctor dos canais nativos ficou velho. Rode npm run test:channels:smoke para renovar a validacao de Slack native / WhatsApp Cloud API.';
      steps.push({ id: 'validate-channel-providers', title: 'Validar canais nativos', description, blocking: false });
    }
    if (input.remoteTransportDoctor.status === 'failed' || input.remoteTransportDoctor.status === 'running' || (input.remoteTransportDoctor.status === 'passed' && input.remoteTransportDoctor.stale) || input.remoteTransportDoctor.status === 'missing') {
      const description = input.remoteTransportDoctor.status === 'failed' ? (input.remoteTransportDoctor.summary ? `O doctor dos transportes remotos falhou (${input.remoteTransportDoctor.summary}). Rode npm run test:transports:smoke antes de confiar em sidecars, gateways e nodes pareados.` : 'O doctor dos transportes remotos falhou. Rode npm run test:transports:smoke antes de confiar em sidecars, gateways e nodes pareados.') : input.remoteTransportDoctor.status === 'running' ? 'Existe um doctor dos transportes remotos em andamento. Aguarde o resultado persistido antes de tratar o plano remoto como validado.' : input.remoteTransportDoctor.status === 'passed' ? (input.remoteTransportDoctor.checkedAt ? `O doctor dos transportes remotos ficou velho (ultimo relatorio em ${input.remoteTransportDoctor.checkedAt}). Rode npm run test:transports:smoke para renovar a validacao do plano remoto.` : 'O doctor dos transportes remotos ficou velho. Rode npm run test:transports:smoke para renovar a validacao do plano remoto.') : 'Ainda nao existe um doctor recente dos transportes remotos. Rode npm run test:transports:smoke para validar sidecars, gateways e nodes pareados.';
      steps.push({ id: 'validate-remote-transports', title: 'Validar transportes remotos', description, blocking: false });
    }
    if (!this.options.publicBaseUrl) steps.push({ id: 'configure-public-base-url', title: 'Definir URL publica', description: 'Suba um tunnel rapido com npm run ops:public:tunnel ou configure ZAVORTH_PUBLIC_BASE_URL com a URL HTTPS do runtime para liberar o shell web remoto.', blocking: false });
    else if (!this.options.publicBaseUrl.toLowerCase().startsWith('https://')) steps.push({ id: 'secure-public-url', title: 'Trocar para HTTPS', description: 'A URL publica do Zavorth precisa usar HTTPS para o shell web remoto funcionar com seguranca.', blocking: true });
    if (!input.auth.enabled) steps.push({ id: 'configure-web-token', title: 'Configurar token web', description: 'Defina ZAVORTH_WEB_AUTH_TOKEN ou gere um token em arquivo antes de expor o runtime.', blocking: true });
    if (remoteReady) steps.push({ id: 'connect-remote-frontend', title: 'Conectar o shell web remoto', description: 'Abra o shell remoto publicado, informe a URL publica do Zavorth e valide a conexao com o token web.', blocking: false });
    return steps;
  }

  public buildSummary(localReady: boolean, remoteReady: boolean, localIssues: string[], remoteIssues: string[]): string {
    if (localReady && remoteReady) return 'Zavorth pronto para uso local e remoto.';
    if (localReady) return `Zavorth pronto para uso local. Remoto pendente: ${remoteIssues[0] || 'Ainda faltam ajustes para o acesso remoto.'}`;
    return `Zavorth ainda nao esta pronto para uso consistente: ${localIssues[0] || 'Ainda existem pendencias locais.'}`;
  }

  public describeLocalProbeFailure(localProbe: RuntimeAccessSurfaceProbe): string {
    const targetUrl = localProbe.targetUrl || 'o /zavorthControl local';
    if (localProbe.statusCode) return `A superficie web do Zavorth nao respondeu de forma saudavel em ${targetUrl} (status ${localProbe.statusCode}).`;
    if (localProbe.error) return `A superficie web do Zavorth nao respondeu em ${targetUrl}: ${localProbe.error}`;
    return `A superficie web do Zavorth nao respondeu em ${targetUrl}.`;
  }

  public describeChannelProviderDoctorTargets(snapshot: RuntimeAccessChannelProviderDoctorSnapshot): string {
    const targets = (snapshot.items || []).filter((item) => item.status === 'passed').map((item) => {
      if (item.channelId === 'telegram') return item.mode === 'native' ? 'Telegram native' : 'Telegram';
      if (item.channelId === 'discord') return item.mode === 'native' ? 'Discord native' : 'Discord';
      if (item.channelId === 'whatsapp') return item.mode === 'cloud-api' ? 'WhatsApp Cloud API' : item.mode === 'baileys' ? 'WhatsApp Baileys' : 'WhatsApp';
      if (item.channelId === 'signal') return item.mode === 'signal-cli' ? 'Signal bridge' : 'Signal';
      if (item.channelId === 'imessage') return item.mode === 'mac-bridge' ? 'iMessage bridge' : 'iMessage';
      if (item.channelId === 'teams') return item.mode === 'graph-bot' ? 'Teams Graph/Bot' : 'Teams';
      if (item.channelId === 'email') return item.mode === 'local-outbox' ? 'Email local-outbox' : 'Email';
      return item.mode === 'native' ? 'Slack native' : 'Slack';
    });
    if (targets.length === 0) return 'os providers nativos configurados';
    if (targets.length === 1) return targets[0];
    if (targets.length === 2) return `${targets[0]} e ${targets[1]}`;
    return `${targets.slice(0, -1).join(', ')} e ${targets[targets.length - 1]}`;
  }

  private normalizeMcpSummary(snapshot: Pick<{ summary: any }, 'summary'> | null | undefined): any {
    const summary = snapshot?.summary;
    return {
      total: Number(summary?.total || 0),
      enabled: Number(summary?.enabled || 0),
      connected: Number(summary?.connected || 0),
      failed: Number(summary?.failed || 0),
      disabled: Number(summary?.disabled || 0),
      stopped: Number(summary?.stopped || 0),
      toolCount: Number(summary?.toolCount || 0),
      capabilityCount: Number(summary?.capabilityCount || 0),
    };
  }
}
