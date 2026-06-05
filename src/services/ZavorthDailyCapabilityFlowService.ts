import {
  ZAVORTH_DAILY_CAPABILITY_FLOW_VERSION,
  type ZavorthDailyCapabilityFlowMcpItem,
  type ZavorthDailyCapabilityFlowSnapshot,
  type ZavorthDailyCapabilityFlowStage,
  type ZavorthDailyCapabilityFlowStatus,
  type ZavorthDailyCapabilityFlowWizardStep,
  type ZavorthDailyCapabilityFlowDashboardCard,
} from '../contracts/ZavorthDailyCapabilityFlowContract.js';
import type { RuntimeDeploymentTarget } from '../contracts/RuntimeProfilePlaybookContract.js';
import { McpEcosystemIntakeService } from './McpEcosystemIntakeService.js';
import { PromptEvolutionLabService } from './PromptEvolutionLabService.js';
import { RuntimeProfilePlaybookService } from './RuntimeProfilePlaybookService.js';
import { ZavorthOperationalRolloutEvalService } from './ZavorthOperationalRolloutEvalService.js';

type Runtime = {
  now?: () => Date;
  promptLab?: Pick<PromptEvolutionLabService, 'buildSnapshot'>;
  runtimePlaybook?: Pick<RuntimeProfilePlaybookService, 'buildSnapshot'>;
  mcpIntake?: Pick<McpEcosystemIntakeService, 'buildSnapshot'>;
  operationalEval?: Pick<ZavorthOperationalRolloutEvalService, 'buildSnapshot'>;
};

export type ZavorthDailyCapabilityFlowInput = {
  basePrompt?: string | null;
  profileId?: string | null;
  runtimeTarget?: string | null;
  mcpSourcePath?: string | null;
};

export class ZavorthDailyCapabilityFlowService {
  private readonly now: () => Date;
  private readonly promptLab: Pick<PromptEvolutionLabService, 'buildSnapshot'>;
  private readonly runtimePlaybook: Pick<RuntimeProfilePlaybookService, 'buildSnapshot'>;
  private readonly mcpIntake: Pick<McpEcosystemIntakeService, 'buildSnapshot'>;
  private readonly operationalEval: Pick<ZavorthOperationalRolloutEvalService, 'buildSnapshot'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.promptLab = runtime.promptLab || new PromptEvolutionLabService({ now: this.now });
    this.runtimePlaybook = runtime.runtimePlaybook || new RuntimeProfilePlaybookService({ now: this.now });
    this.mcpIntake = runtime.mcpIntake || new McpEcosystemIntakeService({ now: this.now });
    this.operationalEval = runtime.operationalEval || new ZavorthOperationalRolloutEvalService({ now: this.now });
  }

  public async buildSnapshot(input: ZavorthDailyCapabilityFlowInput = {}): Promise<ZavorthDailyCapabilityFlowSnapshot> {
    const prompt = this.promptLab.buildSnapshot({
      promptId: 'daily-capability-flow',
      profileId: input.profileId || 'default',
      basePrompt: input.basePrompt || DEFAULT_PROMPT,
      candidateLimit: 6,
    });
    const runtime = this.runtimePlaybook.buildSnapshot({ target: input.runtimeTarget || 'vps-24-7' });
    const evalSnapshot = this.operationalEval.buildSnapshot({ strict: false });
    const mcpCatalog = input.mcpSourcePath
      ? await this.buildMcpCatalog(input.mcpSourcePath)
      : emptyMcpCatalog();

    const selfImprovementStatus = statusFromPrompt(prompt.status);
    const evalStatus = evalSnapshot.status === 'blocked' ? 'blocked' : evalSnapshot.status === 'attention' ? 'attention' : 'ready';
    const status = resolveStatus([selfImprovementStatus, mcpCatalog.status, evalStatus]);

    return {
      generatedAt: this.now().toISOString(),
      version: ZAVORTH_DAILY_CAPABILITY_FLOW_VERSION,
      status,
      headline: headlineFor(status),
      selfImprovement: {
        title: 'Melhorar comportamento',
        status: selfImprovementStatus,
        promptStatus: prompt.status,
        bestCandidateId: prompt.bestCandidate?.id || null,
        requiresApprovalForPromotion: true,
        noAutoApply: true,
        rollbackAvailable: true,
        stages: buildImprovementStages(prompt.status),
      },
      runtimeSetup: {
        title: 'Rodar leve',
        target: runtime.selectedTarget,
        selectedProfile: runtime.selected.recommendedProfile,
        fallbackProfile: runtime.selected.fallbackProfile,
        alwaysOnReady: runtime.selected.alwaysOnReady,
        wizardSteps: runtime.selected.steps.map((step): ZavorthDailyCapabilityFlowWizardStep => ({
          id: step.id as ZavorthDailyCapabilityFlowWizardStep['id'],
          label: step.label,
          status: step.status,
          command: step.command,
          summary: step.details.join(' '),
        })),
      },
      mcpCatalog,
      continuousEvals: {
        title: 'Rodar avaliacoes',
        status: evalStatus,
        commands: [
          'npm run zavorth:native-evolution-runtime-mcp:check --silent',
          'npm run zavorth:operational-rollout-eval:check --silent',
          'npm run security:secrets --silent',
        ],
        summary: `${evalSnapshot.summary.scenarios} scenarios, ${evalSnapshot.summary.failures} failures, ${evalSnapshot.summary.warnings} warnings.`,
      },
      dashboardProjection: {
        route: '/control',
        renderMode: 'daily-capability-flow',
        cards: dashboardCards({
          selfImprovementStatus,
          runtimeStatus: runtime.status === 'blocked' ? 'blocked' : runtime.status === 'attention' ? 'attention' : 'ready',
          mcpStatus: mcpCatalog.status,
          evalStatus,
          runtimeTarget: runtime.selectedTarget,
          runtimeProfile: runtime.selected.recommendedProfile,
        }),
        safety: {
          projectionOnly: true,
          rawSecretsSerialized: false,
          liveActionsRemainApprovalBound: true,
        },
      },
      nextBestActions: nextBestActions(status, mcpCatalog.blocked),
      safety: {
        projectionOnly: true,
        noLiveActionExecuted: true,
        rawSecretsSerialized: false,
        approvalRequiredForBehaviorChange: true,
        runtimeProfileDoesNotGrantAuthority: true,
        externalToolsHeldForReviewBeforeExposure: true,
        continuousEvalDoesNotPersistByDefault: true,
      },
    };
  }

  public renderText(snapshot: ZavorthDailyCapabilityFlowSnapshot): string {
    return [
      'Zavorth Daily Capability Flow',
      snapshot.headline,
      '',
      `${snapshot.selfImprovement.title}: ${snapshot.selfImprovement.status}; candidato=${snapshot.selfImprovement.bestCandidateId || 'none'}`,
      `${snapshot.runtimeSetup.title}: ${snapshot.runtimeSetup.selectedProfile} para ${snapshot.runtimeSetup.target}`,
      `${snapshot.mcpCatalog.title}: ${snapshot.mcpCatalog.needsReview} para revisar, ${snapshot.mcpCatalog.blocked} bloqueado(s)`,
      `${snapshot.continuousEvals.title}: ${snapshot.continuousEvals.status}; ${snapshot.continuousEvals.summary}`,
      '',
      'Proximos passos:',
      ...snapshot.nextBestActions.map((action) => `- ${action}`),
    ].join('\n');
  }

  private async buildMcpCatalog(sourcePath: string): Promise<ZavorthDailyCapabilityFlowSnapshot['mcpCatalog']> {
    const snapshot = await this.mcpIntake.buildSnapshot({ sourcePath });
    const items = snapshot.items.map((item): ZavorthDailyCapabilityFlowMcpItem => ({
      id: item.id,
      name: redactText(item.name),
      displayStatus: item.status === 'blocked' ? 'blocked' : 'needs-review',
      risk: item.risk,
      tools: item.toolNames.map(redactText),
      executableToolsExposed: 0,
      nextAction: item.status === 'blocked'
        ? 'Review block reason before retrying this source.'
        : 'Review risk, run smoke, then promote with approval if still useful.',
      reviewCommand: item.reviewCommand,
    }));
    const blocked = items.filter((item) => item.displayStatus === 'blocked').length;
    const needsReview = items.filter((item) => item.displayStatus === 'needs-review').length;
    return {
      title: 'Adicionar ferramenta',
      status: blocked > 0 ? 'blocked' : needsReview > 0 ? 'attention' : 'ready',
      scanned: snapshot.summary.scannedCandidates,
      blocked,
      needsReview,
      executableToolsExposed: 0,
      items,
    };
  }
}

const DEFAULT_PROMPT = 'Use evidence, previews, receipts and approval for sensitive actions.';

function buildImprovementStages(promptStatus: 'ready' | 'blocked' | 'needs-review'): ZavorthDailyCapabilityFlowStage[] {
  const blocked = promptStatus === 'blocked';
  return [
    stage('observe', 'Observar uso', 'done', 'Read local receipts and aggregate outcomes without prompt text.', null),
    stage('draft', 'Criar rascunho', blocked ? 'blocked' : 'next', 'Prepare a behavior candidate without changing runtime behavior.', 'npm run zavorth:prompt-evolution-lab -- --profile <profile>'),
    stage('evaluate', 'Testar rascunho', blocked ? 'blocked' : 'pending', 'Run regression, safety and sandbox smoke before promotion.', 'npm run zavorth:native-evolution-runtime-mcp:check --silent'),
    stage('approve', 'Revisar e aprovar', blocked ? 'blocked' : 'pending', 'Promotion needs explicit scoped approval.', 'zavorth prompt-evolution promote <candidate> --approval-id <id>'),
    stage('apply', 'Aplicar mudanca', 'pending', 'Apply only the approved candidate and keep rollback metadata.', null),
    stage('measure', 'Medir resultado', 'pending', 'Measure aggregate outcome, approval fatigue and user correction rate.', 'npm run zavorth:operational-rollout-eval:check --silent'),
    stage('rollback', 'Desfazer se precisar', 'pending', 'Return to previous behavior if evals or user feedback regress.', 'zavorth prompt-evolution rollback <receipt-id>'),
  ];
}

function stage(
  id: ZavorthDailyCapabilityFlowStage['id'],
  label: string,
  status: ZavorthDailyCapabilityFlowStage['status'],
  summary: string,
  command: string | null,
): ZavorthDailyCapabilityFlowStage {
  return { id, label, status, summary, command };
}

function emptyMcpCatalog(): ZavorthDailyCapabilityFlowSnapshot['mcpCatalog'] {
  return {
    title: 'Adicionar ferramenta',
    status: 'ready',
    scanned: 0,
    blocked: 0,
    needsReview: 0,
    executableToolsExposed: 0,
    items: [],
  };
}

function statusFromPrompt(status: 'ready' | 'blocked' | 'needs-review'): ZavorthDailyCapabilityFlowStatus {
  if (status === 'blocked') return 'blocked';
  if (status === 'needs-review') return 'attention';
  return 'ready';
}

function resolveStatus(statuses: ZavorthDailyCapabilityFlowStatus[]): ZavorthDailyCapabilityFlowStatus {
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('attention')) return 'attention';
  return 'ready';
}

function headlineFor(status: ZavorthDailyCapabilityFlowStatus): string {
  if (status === 'blocked') return 'Zavorth encontrou algo para corrigir antes de continuar.';
  if (status === 'attention') return 'Zavorth esta pronto para revisar melhorias antes de aplicar.';
  return 'Zavorth esta pronto para uso diario com setup revisavel.';
}

function nextBestActions(status: ZavorthDailyCapabilityFlowStatus, blockedMcp: number): string[] {
  if (blockedMcp > 0) {
    return [
      'corrigir ou remover a ferramenta bloqueada antes de tentar promover novamente.',
      'rodar intake em uma fonte limpa e revisar o smoke antes de instalar.',
      'manter execucao live desligada ate a fonte passar pelos checks.',
    ];
  }
  if (status === 'attention') {
    return [
      'revisar o rascunho de comportamento antes de promover.',
      'selecionar um perfil runtime leve se o alvo for always-on.',
      'rodar os checks continuos antes de mudar comportamento padrao.',
    ];
  }
  return [
    'abrir o checklist de setup e conectar apenas o que for necessario.',
    'rodar uma missao por perfil e revisar receipts depois.',
    'manter ferramentas externas em revisao antes de expor como tool.',
  ];
}

function redactText(value: string): string {
  return String(value || '')
    .replace(/\b(sk-[a-z0-9]{12,})\b/gi, '[REDACTED_API_KEY]')
    .replace(/\b(api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\bbearer\s+[^\s,;]+/gi, 'bearer [REDACTED]');
}

function dashboardCards(input: {
  selfImprovementStatus: ZavorthDailyCapabilityFlowStatus;
  runtimeStatus: ZavorthDailyCapabilityFlowStatus;
  mcpStatus: ZavorthDailyCapabilityFlowStatus;
  evalStatus: ZavorthDailyCapabilityFlowStatus;
  runtimeTarget: RuntimeDeploymentTarget;
  runtimeProfile: string;
}): ZavorthDailyCapabilityFlowDashboardCard[] {
  return [
    card({
      id: 'improve-behavior',
      title: 'Melhorar comportamento',
      area: 'learning',
      status: input.selfImprovementStatus,
      summary: 'Revisar rascunhos de comportamento com diff, testes, aprovacao, medicao e rollback.',
      href: '/control/skills?flow=improve-behavior',
      command: 'npm run zavorth:prompt-evolution-lab -- --profile <profile>',
      primaryAction: 'Revisar rascunho',
      badges: ['draft', 'approval', 'rollback'],
      requiresApproval: true,
    }),
    card({
      id: 'memory-learning',
      title: 'Memoria e aprendizado',
      area: 'memory',
      status: 'attention',
      summary: 'Ver o que foi aprendido, por que foi aprendido, editar, esquecer e expirar itens.',
      href: '/control/memory?flow=learned',
      command: 'npm run zavorth:memory-learning-loop:check --silent',
      primaryAction: 'Revisar aprendizados',
      badges: ['origem', 'evidencia', 'esquecer'],
      requiresApproval: false,
    }),
    card({
      id: 'mcp-catalog',
      title: 'Catalogo de ferramentas',
      area: 'skills',
      status: input.mcpStatus,
      summary: 'Trazer MCP ou tools por preview, revisar risco, rodar smoke e promover so com aprovacao.',
      href: '/control/skills?flow=mcp-catalog',
      command: 'npm run zavorth:mcp-ecosystem-intake -- --source <path>',
      primaryAction: 'Revisar ferramenta',
      badges: ['preview', 'smoke', 'review'],
      requiresApproval: true,
    }),
    card({
      id: 'skill-lifecycle',
      title: 'Ciclo de skills',
      area: 'skills',
      status: 'attention',
      summary: 'Intake, draft, sandbox, aprovacao, install, uso agregado e curadoria sem conteudo sensivel.',
      href: '/control/skills?flow=lifecycle',
      command: 'npm run zavorth:universal-skill-intake:check --silent',
      primaryAction: 'Abrir ciclo',
      badges: ['draft', 'sandbox', 'curator'],
      requiresApproval: true,
    }),
    card({
      id: 'runtime-wizard',
      title: 'Wizard de runtime',
      area: 'runtime',
      status: input.runtimeStatus,
      summary: `Escolher ${input.runtimeProfile} para ${input.runtimeTarget}, rodar budget doctor e manter sidecars pesados sob demanda.`,
      href: '/control/providers?flow=runtime-profile',
      command: `npm run zavorth:runtime-profile-playbook -- --target ${input.runtimeTarget}`,
      primaryAction: 'Escolher perfil',
      badges: ['vps', 'safe-8gb', 'doctor'],
      requiresApproval: false,
    }),
    card({
      id: 'channel-wizard',
      title: 'Canais conectados',
      area: 'channels',
      status: 'attention',
      summary: 'Conectar Telegram, Slack, WhatsApp, Signal, Email ou Discord com passo a passo e prova honesta.',
      href: '/control/providers?flow=channels',
      command: 'npm run zavorth:channel-connection-playbook -- --channel telegram',
      primaryAction: 'Conectar canal',
      badges: ['setup', 'probe', 'live-ready'],
      requiresApproval: true,
    }),
    card({
      id: 'backend-wizard',
      title: 'Execucao segura',
      area: 'backends',
      status: 'attention',
      summary: 'Configurar local-jail, Docker, WSL ou cloud sandbox com dry-run enquanto smoke forte nao passa.',
      href: '/control/providers?flow=execution-backend',
      command: 'npm run zavorth:execution-backend-playbook -- --backend docker',
      primaryAction: 'Configurar executor',
      badges: ['dry-run', 'smoke', 'approval'],
      requiresApproval: true,
    }),
    card({
      id: 'continuous-evals',
      title: 'Rodar avaliacoes',
      area: 'quality',
      status: input.evalStatus,
      summary: 'Testar qualidade, vazamento, excesso de aprovacao, tool-use, aprendizado indevido e recuperacao.',
      href: '/control/docs?flow=evals',
      command: 'npm run zavorth:daily-capability-flow:check --silent',
      primaryAction: 'Rodar checks',
      badges: ['quality', 'secrets', 'regression'],
      requiresApproval: false,
    }),
  ];
}

function card(input: Omit<ZavorthDailyCapabilityFlowDashboardCard, 'mutatesState' | 'executionAuthority'>): ZavorthDailyCapabilityFlowDashboardCard {
  return {
    ...input,
    mutatesState: false,
    executionAuthority: false,
  };
}
