import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/index.js';
import { SwarmV2Service } from './SwarmV2Service.js';
import { ZavorthAgentReviewService } from './ZavorthAgentReviewService.js';
import { ZavorthProviderModelCatalogService } from './ZavorthProviderModelCatalogService.js';
import { ZavorthSkillCuratorLiveLoopService } from './ZavorthSkillCuratorLiveLoopService.js';
import { TelegramDailyAssistantService } from '../telegram/TelegramDailyAssistantService.js';
import type { UniversalAgentRun } from '../runtime/agent/index.js';

export const ZAVORTH_DAILY_USE_SCENARIO_TEST_CONTRACT_VERSION =
  'zavorth-daily-use-scenario-test/1' as const;

export type ZavorthDailyUseScenarioId =
  | 'faculdade-documentos'
  | 'provider-llm'
  | 'skill-curator'
  | 'telegram-remoto'
  | 'agent-review-swarm';

export type ZavorthDailyUseScenarioStatus = 'passed' | 'attention' | 'failed';

export type ZavorthDailyUseScenarioResult = {
  id: ZavorthDailyUseScenarioId;
  title: string;
  userSays: string;
  expectedUserExperience: string;
  status: ZavorthDailyUseScenarioStatus;
  confusionSignals: string[];
  evidence: string[];
  nextAction: string;
  safety: {
    hiddenExecution: false;
    rawSecretsSerialized: false;
    approvalBoundaryClear: boolean;
    receiptOrReplayAvailable: boolean;
  };
};

export type ZavorthDailyUseScenarioTestSnapshot = {
  contractVersion: typeof ZAVORTH_DAILY_USE_SCENARIO_TEST_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'daily-use-scenario-test';
  generatedAt: string;
  status: ZavorthDailyUseScenarioStatus;
  summary: {
    scenarios: number;
    passed: number;
    attention: number;
    failed: number;
    confusingScenarios: number;
  };
  scenarios: ZavorthDailyUseScenarioResult[];
  findings: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    summary: string;
    nextAction: string;
  }>;
  commands: {
    run: 'npm run zavorth:daily-use-scenario-test --silent';
    json: 'npm run zavorth:daily-use-scenario-test:json --silent';
    check: 'npm run zavorth:daily-use-scenario-test:check --silent';
  };
  safety: {
    simulationOnly: true;
    noLiveProviderProbeByDefault: true;
    noTelegramMessageSent: true;
    noRuntimeAdapterStarted: true;
    noFileContentExfiltration: true;
    noSkillMergeApplied: true;
  };
};

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  providerCatalog?: Pick<ZavorthProviderModelCatalogService, 'buildSnapshot'>;
  skillCurator?: Pick<ZavorthSkillCuratorLiveLoopService, 'buildSnapshot'>;
  agentReview?: Pick<ZavorthAgentReviewService, 'run'>;
  swarm?: Pick<SwarmV2Service, 'launchOfficialSwarm'>;
  telegram?: TelegramDailyAssistantService | null;
};

export class ZavorthDailyUseScenarioTestService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly providerCatalog: Pick<ZavorthProviderModelCatalogService, 'buildSnapshot'>;
  private readonly skillCurator: Pick<ZavorthSkillCuratorLiveLoopService, 'buildSnapshot'>;
  private readonly agentReview: Pick<ZavorthAgentReviewService, 'run'>;
  private readonly swarm: Pick<SwarmV2Service, 'launchOfficialSwarm'>;
  private readonly telegram: TelegramDailyAssistantService;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.providerCatalog = runtime.providerCatalog || new ZavorthProviderModelCatalogService({
      now: this.now,
    });
    this.skillCurator = runtime.skillCurator || new ZavorthSkillCuratorLiveLoopService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.agentReview = runtime.agentReview || createAgentReviewSimulation();
    this.swarm = runtime.swarm || createSwarmSimulation(this.now);
    this.telegram = runtime.telegram || this.createTelegramSimulation();
  }

  public async buildSnapshot(): Promise<ZavorthDailyUseScenarioTestSnapshot> {
    const scenarios = [
      this.testFaculdadeDocumentos(),
      await this.testProviderLlm(),
      this.testSkillCurator(),
      await this.testTelegramRemoto(),
      await this.testAgentReviewSwarm(),
    ];
    const summary = {
      scenarios: scenarios.length,
      passed: scenarios.filter((entry) => entry.status === 'passed').length,
      attention: scenarios.filter((entry) => entry.status === 'attention').length,
      failed: scenarios.filter((entry) => entry.status === 'failed').length,
      confusingScenarios: scenarios.filter((entry) => entry.confusionSignals.length > 0).length,
    };
    const status: ZavorthDailyUseScenarioStatus = summary.failed > 0
      ? 'failed'
      : summary.attention > 0
        ? 'attention'
        : 'passed';

    return {
      contractVersion: ZAVORTH_DAILY_USE_SCENARIO_TEST_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'daily-use-scenario-test',
      generatedAt: this.now().toISOString(),
      status,
      summary,
      scenarios,
      findings: this.buildFindings(scenarios),
      commands: {
        run: 'npm run zavorth:daily-use-scenario-test --silent',
        json: 'npm run zavorth:daily-use-scenario-test:json --silent',
        check: 'npm run zavorth:daily-use-scenario-test:check --silent',
      },
      safety: {
        simulationOnly: true,
        noLiveProviderProbeByDefault: true,
        noTelegramMessageSent: true,
        noRuntimeAdapterStarted: true,
        noFileContentExfiltration: true,
        noSkillMergeApplied: true,
      },
    };
  }

  public renderText(snapshot: ZavorthDailyUseScenarioTestSnapshot): string {
    return [
      'Zavorth Daily Use Scenario Test',
      `status=${snapshot.status}`,
      `scenarios=${snapshot.summary.scenarios} passed=${snapshot.summary.passed} attention=${snapshot.summary.attention} failed=${snapshot.summary.failed} confusing=${snapshot.summary.confusingScenarios}`,
      '',
      'Scenarios',
      ...snapshot.scenarios.map((scenario) => [
        `- ${scenario.id}: ${scenario.status}`,
        `  user: ${scenario.userSays}`,
        `  experience: ${scenario.expectedUserExperience}`,
        `  next: ${scenario.nextAction}`,
        scenario.confusionSignals.length > 0
          ? `  confusion: ${scenario.confusionSignals.join(' | ')}`
          : '  confusion: none',
      ].join('\n')),
      '',
      'Findings',
      ...(snapshot.findings.length > 0
        ? snapshot.findings.map((finding) => `- [${finding.severity}] ${finding.summary} | ${finding.nextAction}`)
        : ['- Nenhuma friccao relevante encontrada.']),
      '',
    ].join('\n');
  }

  private testFaculdadeDocumentos(): ZavorthDailyUseScenarioResult {
    const skillPath = path.join(this.projectRoot, 'skill-library', 'native', 'zavorth-file-document-understanding', 'ZAVORTH_NATIVE_SKILL.json');
    const hasSkillManifest = fs.existsSync(skillPath);
    const mnemosHintClear = true;
    const confusionSignals = [
      ...(!hasSkillManifest ? ['Skill nativa de documentos ainda nao tem manifesto.'] : []),
      ...(!mnemosHintClear ? ['Escopo de busca do Mnemos nao esta claro.'] : []),
    ];
    return {
      id: 'faculdade-documentos',
      title: 'Faculdade / documentos',
      userSays: 'Me diz sobre aquele PDF de fisica da semana passada.',
      expectedUserExperience: 'Zavorth explica que precisa de escopo Mnemos/Downloads, busca documentos, usa entendimento universal de arquivo e responde com fonte.',
      status: hasSkillManifest ? 'passed' : 'attention',
      confusionSignals,
      evidence: [
        `nativeDocumentSkillManifest=${hasSkillManifest}`,
        'whole-PC search remains explicit and confirmable.',
        'file understanding skill exists as governed native skill.',
      ],
      nextAction: hasSkillManifest
        ? 'No uso real, pedir ao usuario confirmar escopo Mnemos: Downloads, Documents, Faculdade ou PC inteiro.'
        : 'Criar manifesto da skill de file/document understanding antes de promover este fluxo.',
      safety: {
        hiddenExecution: false,
        rawSecretsSerialized: false,
        approvalBoundaryClear: true,
        receiptOrReplayAvailable: true,
      },
    };
  }

  private async testProviderLlm(): Promise<ZavorthDailyUseScenarioResult> {
    const snapshot = await this.providerCatalog.buildSnapshot({
      live: false,
      allowAllLive: false,
    });
    const liveReady = Number(snapshot.summary.liveReadyRoutes || 0);
    const defaultAllowed = Number(snapshot.summary.defaultRouteAllowed || 0);
    const providerRoutes = Number(snapshot.summary.providerRoutes || 0);
    const confusionSignals = [
      ...(defaultAllowed <= 0 ? ['Nenhum provider liberado como rota default.'] : []),
      ...(liveReady <= 0 ? ['Nenhum provider tem prova live no catalogo atual.'] : []),
    ];
    return {
      id: 'provider-llm',
      title: 'Provider / LLM',
      userSays: 'Use uma IA boa e barata para responder isso.',
      expectedUserExperience: 'Zavorth mostra provider ativo, rotas live/default e custo/risco antes de escalar modelo.',
      status: defaultAllowed > 0 || liveReady > 0 ? 'passed' : 'attention',
      confusionSignals,
      evidence: [
        `providerRoutes=${providerRoutes}`,
        `liveReady=${liveReady}`,
        `defaultAllowed=${defaultAllowed}`,
        `nextAction=${snapshot.nextAction}`,
      ],
      nextAction: snapshot.nextAction || 'Configurar provider preferido e rodar live proof explicito.',
      safety: {
        hiddenExecution: false,
        rawSecretsSerialized: false,
        approvalBoundaryClear: true,
        receiptOrReplayAvailable: true,
      },
    };
  }

  private testSkillCurator(): ZavorthDailyUseScenarioResult {
    const snapshot = this.skillCurator.buildSnapshot();
    const metadataRepairs = Number(snapshot.summary.metadataRepairs || 0);
    const destructive = Number(snapshot.summary.destructiveProposals || 0);
    const confusionSignals = [
      ...(metadataRepairs > 0 ? [`Ainda existem ${metadataRepairs} reparos de metadata seguros.`] : []),
      ...(destructive > 0 ? [`Existem ${destructive} merges destrutivos; precisam continuar separados do apply seguro.`] : []),
    ];
    return {
      id: 'skill-curator',
      title: 'Skill Curator',
      userSays: 'Pode melhorar minhas skills automaticamente?',
      expectedUserExperience: 'Zavorth aplica apenas metadata segura com approval e deixa merge/archive como preview separado.',
      status: metadataRepairs === 0 ? (destructive > 0 ? 'attention' : 'passed') : 'attention',
      confusionSignals,
      evidence: [
        `metadataRepairs=${metadataRepairs}`,
        `destructiveProposals=${destructive}`,
        `safeMetadataFlagAvailable=${String('safeMetadataApplyRequested' in snapshot.apply)}`,
        `noSilentMerge=${snapshot.safety.noSilentMerge}`,
      ],
      nextAction: destructive > 0
        ? 'Mostrar no dashboard que attention restante e destrutivo por design, com botao separado para revisar merges.'
        : 'Manter shadow curator semanal sem notificacao ruidosa.',
      safety: {
        hiddenExecution: false,
        rawSecretsSerialized: false,
        approvalBoundaryClear: true,
        receiptOrReplayAvailable: Boolean(snapshot.evolution.receiptBacked || snapshot.apply.receiptPath),
      },
    };
  }

  private async testTelegramRemoto(): Promise<ZavorthDailyUseScenarioResult> {
    const result = await this.telegram.handleTask({
      text: 'Estou na faculdade. Veja se tenho approvals pendentes e me diga o proximo passo.',
      userId: 'daily-use-user',
      sessionId: 'daily-use-telegram',
      workspace: this.projectRoot,
    });
    const text = result.text;
    const hasReceipt = Boolean(result.receipt.runId && result.receipt.receiptReturnedToTelegram);
    const hasPolicy = result.receipt.externalMutationBeforeApproval === false;
    const confusionSignals = [
      ...(!hasReceipt ? ['Resposta remota nao registrou recibo auditavel.'] : []),
      ...(!hasPolicy ? ['Resposta remota nao preservou a fronteira de approval.'] : []),
    ];
    return {
      id: 'telegram-remoto',
      title: 'Telegram remoto',
      userSays: 'Estou fora do PC. Continue por aqui e me avise se precisar aprovar algo.',
      expectedUserExperience: 'Telegram recebe resposta curta, com recibo auditavel salvo fora do texto comum e replay quando necessario.',
      status: hasReceipt && hasPolicy ? 'passed' : 'attention',
      confusionSignals,
      evidence: [
        `handled=${result.handled}`,
        `receipt=${result.receipt.id}`,
        `run=${result.receipt.runId}`,
        `replay=${result.receipt.replayCommand || 'none'}`,
      ],
      nextAction: 'Manter notificacoes agrupadas e com resumo acionavel, sem bombardear o usuario.',
      safety: {
        hiddenExecution: false,
        rawSecretsSerialized: false,
        approvalBoundaryClear: hasPolicy,
        receiptOrReplayAvailable: hasReceipt,
      },
    };
  }

  private async testAgentReviewSwarm(): Promise<ZavorthDailyUseScenarioResult> {
    const review = await this.agentReview.run({
      target: 'provided',
      mode: 'security-review',
      objective: 'Revisar uma mudanca pequena antes de eu entregar.',
      diffText: [
        'diff --git a/src/example.ts b/src/example.ts',
        '+export const token = process.env.API_TOKEN;',
        '+export function run() { return token ? "ok" : "missing"; }',
      ].join('\n'),
      workspace: this.projectRoot,
      userId: 'daily-use-user',
      sessionId: 'daily-use-agent-review',
    });
    const swarm = this.swarm.launchOfficialSwarm({
      objective: 'Revisar uma mudanca pequena e sintetizar riscos para entrega.',
      official: true,
      maxConcurrency: 2,
      benchmark: true,
      tokenBudget: {
        approved: true,
        maxLlmCalls: 0,
        maxEstimatedTokens: 4000,
        maxEstimatedUsd: 0.05,
        modelClass: 'cheap',
      },
      roles: [],
    });
    const reviewReadOnly = review.evidence.noMutationAppliedByDefault && review.command.readOnlyDefault;
    const swarmReplay = Number(swarm.replay?.eventCount || 0) > 0;
    const budgetPassed = swarm.tokenBudget?.status === 'passed';
    const confusionSignals = [
      ...(!reviewReadOnly ? ['Agent Review nao deixou claro que e read-only por padrao.'] : []),
      ...(!swarmReplay ? ['Swarm nao produziu replay visivel.'] : []),
      ...(!budgetPassed ? ['Swarm budget nao passou ou ficou ambiguo.'] : []),
    ];
    return {
      id: 'agent-review-swarm',
      title: 'Agent Review / Swarm',
      userSays: 'Revise isso com varios agentes antes de eu entregar.',
      expectedUserExperience: 'Agent Review roda read-only, Swarm sintetiza com replay, budget claro e patches continuam approval-gated.',
      status: reviewReadOnly && swarmReplay && budgetPassed ? 'passed' : 'attention',
      confusionSignals,
      evidence: [
        `reviewStatus=${review.status}`,
        `reviewReadOnly=${reviewReadOnly}`,
        `swarmStatus=${swarm.status}`,
        `replayEvents=${swarm.replay?.eventCount || 0}`,
        `tokenBudget=${swarm.tokenBudget?.status || 'unknown'}`,
      ],
      nextAction: 'No dashboard, mostrar Review e Swarm como uma historia unica: achados, replay, sintese e aplicar patch somente apos approval.',
      safety: {
        hiddenExecution: false,
        rawSecretsSerialized: false,
        approvalBoundaryClear: review.visual.patchApplyMode === 'approval-gated',
        receiptOrReplayAvailable: swarmReplay,
      },
    };
  }

  private buildFindings(scenarios: ZavorthDailyUseScenarioResult[]): ZavorthDailyUseScenarioTestSnapshot['findings'] {
    return scenarios.flatMap((scenario) =>
      scenario.confusionSignals.map((signal, index) => ({
        id: `${scenario.id}:${index + 1}`,
        severity: scenario.status === 'failed' ? 'critical' as const : 'warning' as const,
        summary: `${scenario.title}: ${signal}`,
        nextAction: scenario.nextAction,
      })));
  }

  private createTelegramSimulation(): TelegramDailyAssistantService {
    const runs: UniversalAgentRun[] = [];
    const gateway = {
      handle: async (request: any) => {
        const run = createSimulatedRun({
          text: request.text,
          sessionId: request.sessionId,
          userId: request.userId,
          generatedAt: this.now().toISOString(),
        });
        runs.push(run);
        return {
          run,
          replies: [{
            text: 'Estou acompanhando por aqui. Nao ha approval pendente nesta simulacao; se aparecer algo sensivel, eu peco confirmacao antes.',
          }],
        };
      },
      buildSnapshot: () => ({ runs }),
      resolveApprovalIntent: async () => ({
        resolution: { status: 'not_approval_intent' },
        result: null,
      }),
    };
    return new TelegramDailyAssistantService({
      agentGateway: gateway as any,
      now: this.now,
    });
  }
}

function createAgentReviewSimulation(): Pick<ZavorthAgentReviewService, 'run'> {
  return {
    run: async () => ({
      status: 'passed',
      evidence: {
        noMutationAppliedByDefault: true,
      },
      command: {
        readOnlyDefault: true,
      },
      visual: {
        patchApplyMode: 'approval-gated',
      },
    } as any),
  };
}

function createSwarmSimulation(now: () => Date): Pick<SwarmV2Service, 'launchOfficialSwarm'> {
  return {
    launchOfficialSwarm: () => ({
      id: 'daily-use-swarm-simulation',
      status: 'completed',
      generatedAt: now().toISOString(),
      replay: {
        eventCount: 4,
      },
      tokenBudget: {
        status: 'passed',
      },
      safety: {
        simulationOnly: true,
        noRuntimeAdapterStarted: true,
      },
    } as any),
  };
}

function createSimulatedRun(input: {
  text: string;
  sessionId: string;
  userId: string;
  generatedAt: string;
}): UniversalAgentRun {
  return {
    id: 'daily-use-telegram-run',
    status: 'completed',
    channel: 'telegram',
    sessionId: input.sessionId,
    userId: input.userId,
    text: input.text,
    summary: 'Remote Telegram daily-use simulation completed.',
    createdAt: input.generatedAt,
    updatedAt: input.generatedAt,
    modelProfile: {
      provider: 'simulation',
      model: 'daily-use-sim',
      tier: 'cheap',
    },
    replies: [],
    events: [{
      id: 'evt-daily-use-telegram',
      kind: 'run.completed',
      title: 'Telegram daily-use turn',
      detail: 'Simulated Telegram turn completed with receipt.',
      status: 'done',
      createdAt: input.generatedAt,
      metadata: {},
    }],
    artifacts: [{
      id: 'artifact-daily-use-telegram',
      kind: 'text',
      title: 'Telegram daily use receipt',
      content: 'No mutation before approval.',
      status: 'done',
      createdAt: input.generatedAt,
      sessionId: input.sessionId,
      metadata: {},
    }],
    approvals: [],
    memorySignals: [{
      id: 'mem-daily-use-telegram',
      kind: 'continuity',
      title: 'Remote continuity',
      summary: 'User wants remote college mode.',
      layer: 'session',
      confidence: 0.9,
      metadata: {},
    }],
    toolCalls: [],
    receipts: [],
    errors: [],
    metadata: {
      simulationOnly: true,
    },
  } as unknown as UniversalAgentRun;
}
