import {
  DASHBOARD_SETUP_CHECKLIST_VERSION,
  type DashboardSetupChecklistItem,
  type DashboardSetupChecklistItemStatus,
  type DashboardSetupChecklistSnapshot,
} from '../contracts/DashboardSetupChecklistContract.js';
import { ChannelConnectionPlaybookService } from './ChannelConnectionPlaybookService.js';
import { ExecutionBackendPlaybookService } from './ExecutionBackendPlaybookService.js';
import { ProviderConnectionPlaybookService } from './ProviderConnectionPlaybookService.js';

type DashboardSetupChecklistDeps = {
  now?: () => Date;
  channelPlaybook?: Pick<ChannelConnectionPlaybookService, 'buildSnapshot'>;
  providerPlaybook?: Pick<ProviderConnectionPlaybookService, 'buildSnapshot'>;
  backendPlaybook?: Pick<ExecutionBackendPlaybookService, 'buildSnapshot'>;
};

export class DashboardSetupChecklistService {
  private readonly now: () => Date;
  private readonly channelPlaybook: Pick<ChannelConnectionPlaybookService, 'buildSnapshot'>;
  private readonly providerPlaybook: Pick<ProviderConnectionPlaybookService, 'buildSnapshot'>;
  private readonly backendPlaybook: Pick<ExecutionBackendPlaybookService, 'buildSnapshot'>;

  constructor(deps: DashboardSetupChecklistDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.channelPlaybook = deps.channelPlaybook || new ChannelConnectionPlaybookService();
    this.providerPlaybook = deps.providerPlaybook || new ProviderConnectionPlaybookService();
    this.backendPlaybook = deps.backendPlaybook || new ExecutionBackendPlaybookService();
  }

  public buildSnapshot(): DashboardSetupChecklistSnapshot {
    const channels = this.channelPlaybook.buildSnapshot();
    const providers = this.providerPlaybook.buildSnapshot();
    const backends = this.backendPlaybook.buildSnapshot();
    const items: DashboardSetupChecklistItem[] = [
      {
        id: 'connect-telegram',
        label: 'Conectar Telegram',
        area: 'channel',
        status: statusFromReady(channels.summary.defaultRouteAllowed > 0, channels.summary.readyToValidate > 0),
        summary: channels.summary.defaultRouteAllowed > 0
          ? 'Ha pelo menos um canal live pronto para rota padrao.'
          : 'Configure um canal e prove live readiness antes de usar envio real.',
        nextAction: channels.selected?.nextAction || 'Abrir playbook de canal.',
        command: 'npm run zavorth:channel-connection-playbook -- --channel telegram',
        href: '/control/providers?setup=channel',
        proof: `${channels.summary.defaultRouteAllowed} default route(s), ${channels.summary.liveReady} live-ready.`,
      },
      {
        id: 'connect-provider',
        label: 'Testar provider',
        area: 'provider',
        status: statusFromReady(providers.summary.defaultRouteAllowed > 0, providers.summary.readyToProbe > 0),
        summary: providers.summary.defaultRouteAllowed > 0
          ? 'Ha provider com rota padrao e prova live.'
          : 'Configure chave/base URL e rode probe antes de tornar padrao.',
        nextAction: providers.selected?.nextAction || 'Abrir playbook de provider.',
        command: 'npm run zavorth:provider-connection-playbook -- --provider openai',
        href: '/control/providers?setup=provider',
        proof: `${providers.summary.defaultRouteAllowed} default route(s), ${providers.summary.liveReady} live-ready.`,
      },
      {
        id: 'configure-executor',
        label: 'Configurar executor seguro',
        area: 'execution-backend',
        status: statusFromReady(backends.summary.strongSandboxReady > 0, backends.summary.previewReady > 0),
        summary: backends.summary.strongSandboxReady > 0
          ? 'Ha backend forte pronto para smoke e execucao aprovada.'
          : 'Use preview/local-jail enquanto Docker, WSL ou cloud sandbox nao forem provados.',
        nextAction: backends.selected?.nextAction || 'Abrir playbook de backend.',
        command: 'npm run zavorth:execution-backend-playbook -- --backend docker',
        href: '/control/providers?setup=execution',
        proof: `${backends.summary.strongSandboxReady} strong sandbox ready, ${backends.summary.liveReady} live-ready.`,
      },
      {
        id: 'review-memory',
        label: 'Revisar memoria aprendida',
        area: 'memory',
        status: 'next',
        summary: 'Memoria deve aparecer como itens editaveis, com origem, evidencia, confianca, expiracao e esquecer.',
        nextAction: 'Abrir painel de memoria e revisar o que foi aprendido antes de promover regras.',
        command: 'npm run zavorth:memory-learning-loop:check --silent',
        href: '/control/memory?setup=memory',
        proof: 'Memory learning loop, Mnemos UX and forget/edit surfaces stay reviewable.',
      },
      {
        id: 'install-skills-governed',
        label: 'Instalar skills e MCP com preview',
        area: 'skill',
        status: 'next',
        summary: 'Toda skill ou ferramenta MCP precisa passar por intake, scanner, preview, smoke e approval quando houver risco.',
        nextAction: 'Importar uma ferramenta segura em modo preview e verificar smoke nao destrutivo.',
        command: 'npm run zavorth:universal-skill-intake:check --silent',
        href: '/control/skills?setup=intake',
        proof: 'Universal intake blocks hostile scripts and keeps imported support files instruction-only until wrapped.',
      },
      {
        id: 'schedule-with-preview',
        label: 'Agendar rotina com preview',
        area: 'scheduler',
        status: 'next',
        summary: 'Tarefas agendadas devem mostrar prompt final, escopo, skill/procedure carregada, canal e receipt.',
        nextAction: 'Criar uma tarefa de ensaio e confirmar que scope drift e approval expirado ficam bloqueados.',
        command: 'node scripts/zavorth-governed-scheduled-tasks-check.mjs',
        href: '/control/cron?setup=scheduler',
        proof: 'Scheduler guard scans final prompt and blocks compound scheduling, expired approvals and kill-switch bypass.',
      },
      {
        id: 'run-profile-mission',
        label: 'Rodar missao por perfil',
        area: 'mission',
        status: 'next',
        summary: 'Cada perfil precisa provar pedido, decisao, ferramenta ou subagente, approval se houver risco, entrega, receipt e revisao.',
        nextAction: 'Rodar os fluxos Personal, Creator, Developer, Business e Power como missao guiada.',
        command: 'npm run zavorth:daily-product:check --silent',
        href: '/control?setup=missions',
        proof: 'Daily product and experience profile checks keep profile-specific missions visible.',
      },
      {
        id: 'run-quality-evals',
        label: 'Rodar avaliacoes continuas',
        area: 'quality',
        status: 'next',
        summary: 'Evals devem cobrir vazamento, approval fatigue, aprendizado incorreto, regressao de UX e falha de ferramenta.',
        nextAction: 'Executar QA de produto e checks de seguranca antes de promover mudancas de comportamento.',
        command: 'npm run security:secrets --silent && npm run zavorth-control-vite:check --silent',
        href: '/control/docs?setup=quality',
        proof: 'No raw secrets in outputs; dashboard build and design-system checks remain passing.',
      },
    ];
    const summary = {
      total: items.length,
      done: items.filter((entry) => entry.status === 'done').length,
      next: items.filter((entry) => entry.status === 'next').length,
      needsSetup: items.filter((entry) => entry.status === 'needs-setup').length,
      blocked: items.filter((entry) => entry.status === 'blocked').length,
    };
    return {
      generatedAt: this.now().toISOString(),
      version: DASHBOARD_SETUP_CHECKLIST_VERSION,
      status: summary.done === items.length
        ? 'ready'
        : summary.next > 0
          ? 'attention'
          : 'needs-setup',
      headline: 'Configure canais, providers e executor com passos claros e prova honesta.',
      items,
      summary,
      safety: {
        projectionOnly: true,
        rawSecretsSerialized: false,
        liveActionsRemainApprovalBound: true,
      },
    };
  }

  public renderText(snapshot = this.buildSnapshot()): string {
    return [
      'Checklist de setup do ZavorthControl',
      '',
      snapshot.headline,
      '',
      ...snapshot.items.map((item) =>
        `- [${item.status}] ${item.label}: ${item.summary} | ${item.command}`),
    ].join('\n');
  }
}

function statusFromReady(done: boolean, next: boolean): DashboardSetupChecklistItemStatus {
  if (done) return 'done';
  if (next) return 'next';
  return 'needs-setup';
}
