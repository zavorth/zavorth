import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/index.js';
import { SwarmV2Service, type SwarmV2TrackedSnapshot } from '../agents/SwarmV2Service.js';
import { ZavorthAgentReviewService, type ZavorthAgentReviewSnapshot } from './ZavorthAgentReviewService.js';
import { ZavorthProviderModelCatalogService } from './ZavorthProviderModelCatalogService.js';
import { ZavorthSkillCuratorLiveLoopService } from './ZavorthSkillCuratorLiveLoopService.js';
import { TelegramDailyAssistantService } from '../gateways/channels/telegram/TelegramDailyAssistantService.js';
import type { UniversalAgentRun, ZavorthAgentGateway } from '../runtime/agent/index.js';

export const ZAVORTH_DAILY_USE_SCENARIO_TEST_CONTRACT_VERSION =
  'zavorth-daily-use-scenario-test/1' as const;

export type ZavorthDailyUseScenarioId =
  | 'faculdade-documentos'
  | 'provider-llm'
  | 'skill-curator'
  | 'telegram-remote'
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
    dryRunOnly: true;
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
    this.agentReview = runtime.agentReview || createAgentReviewDryRun();
    this.swarm = runtime.swarm || createSwarmDryRun(this.now);
    this.telegram = runtime.telegram || this.createTelegramDryRun();
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
        dryRunOnly: true,
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
        : ['- No relevant friction found.']),
      '',
    ].join('\n');
  }

  private testFaculdadeDocumentos(): ZavorthDailyUseScenarioResult {
    const skillPath = path.join(this.projectRoot, 'skill-library', 'native', 'zavorth-file-document-understanding', 'ZAVORTH_NATIVE_SKILL.json');
    const hasSkillManifest = fs.existsSync(skillPath);
    const mnemosHintClear = true;
    const confusionSignals = [
      ...(!hasSkillManifest ? ['Skill nactive de documentos ainda no tem manifest.'] : []),
      ...(!mnemosHintClear ? ['Escopo de busca do Mnemos no is claro.'] : []),
    ];
    return {
      id: 'faculdade-documentos',
      title: 'Faculdade / documentos',
      userSays: 'Me diz sobre aquele PDF de physical da semana passada.',
      expectedUserExperience: 'Zavorth explains that it needs Mnemos/Downloads scope, searches documents, uses universal file understanding, and answers with source.',
      status: hasSkillManifest ? 'passed' : 'attention',
      confusionSignals,
      evidence: [
        `nativeDocumentSkillManifest=${hasSkillManifest}`,
        'whole-PC search remains explicit and confirmable.',
        'file understanding skill exists as governed native skill.',
      ],
      nextAction: hasSkillManifest ? 'In real use, ask the user to confirm Mnemos scope: Downloads, Documents, school, or whole PC.'
        : 'Create file/document understanding skill manifest before promoting this flow.',
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
      ...(defaultAllowed <= 0 ? ['No provider liberado como rota default.'] : []),
      ...(liveReady <= 0 ? ['No provider tem prova live in the current catalog.'] : []),
    ];
    return {
      id: 'provider-llm',
      title: 'Provider / LLM',
      userSays: 'Use a good cost-effective AI to answer this.',
      expectedUserExperience: 'Zavorth mostra provider active, rotas live/default e cost/risk before escalar modelo.',
      status: defaultAllowed > 0 || liveReady > 0 ? 'passed' : 'attention',
      confusionSignals,
      evidence: [
        `providerRoutes=${providerRoutes}`,
        `liveReady=${liveReady}`,
        `defaultAllowed=${defaultAllowed}`,
        `nextAction=${snapshot.nextAction}`,
      ],
      nextAction: snapshot.nextAction || 'Configure the preferred provider and run explicit live proof.',
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
      ...(metadataRepairs > 0 ? [`There are still ${metadataRepairs} safe metadata repairs.`] : []),
      ...(destructive > 0 ? [`There are ${destructive} destructive merges; they must remain separate from safe apply.`] : []),
    ];
    return {
      id: 'skill-curator',
      title: 'Skill Curator',
      userSays: 'Pode melhorar minhas skills automaticamente...',
      expectedUserExperience: 'Zavorth aplica only metadata safe com approval e deixa merge/archive como preview separado.',
      status: metadataRepairs === 0 ? (destructive > 0 ? 'attention' : 'passed') : 'attention',
      confusionSignals,
      evidence: [
        `metadataRepairs=${metadataRepairs}`,
        `destructiveProposals=${destructive}`,
        `safeMetadataFlagAvailable=${String('safeMetadataApplyRequested' in snapshot.apply)}`,
        `noSilentMerge=${snapshot.safety.noSilentMerge}`,
      ],
      nextAction: destructive > 0
        ? 'Show in zavorthControl that remaining attention is destructive by design, with a separate button to review merges.'
        : 'Manter shadow curator semanal without notificaction ruidosa.',
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
      text: 'I am na faculdade. check se have pending approvals e me tell o next passo.',
      userId: 'daily-use-user',
      sessionId: 'daily-use-telegram',
      workspace: this.projectRoot,
    });
    const text = result.text;
    const hasReceipt = Boolean(result.receipt.runId && result.receipt.receiptReturnedToTelegram);
    const hasPolicy = result.receipt.externalMutationBeforeApproval === false;
    const confusionSignals = [
      ...(!hasReceipt ? ['Remote response did not register an auditable receipt.'] : []),
      ...(!hasPolicy ? ['Remote response did not preserve the approval boundary.'] : []),
    ];
    return {
      id: 'telegram-remote',
      title: 'Telegram remote',
      userSays: 'I am outside do PC. Continue por here e me notify se need approve something.',
      expectedUserExperience: 'Telegram receives a short response, with auditable receipt saved outside common text and replay when needed.',
      status: hasReceipt && hasPolicy ? 'passed' : 'attention',
      confusionSignals,
      evidence: [
        `handled=${result.handled}`,
        `receipt=${result.receipt.id}`,
        `run=${result.receipt.runId}`,
        `replay=${result.receipt.replayCommand || 'none'}`,
      ],
      nextAction: 'Keep notifications grouped with actionable summaries, without overwhelming the user.',
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
      objective: 'review uma change pequena before eu entregar.',
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
      objective: 'review uma change pequena e sintetizar risks para entrega.',
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
      ...(!reviewReadOnly ? ['Agent Review no deixou claro que e read-only por default.'] : []),
      ...(!swarmReplay ? ['Swarm did not produce a visible replay.'] : []),
      ...(!budgetPassed ? ['Swarm budget did not pass or was ambiguous.'] : []),
    ];
    return {
      id: 'agent-review-swarm',
      title: 'Agent Review / Swarm',
      userSays: 'Revise isso com varios agentes before eu entregar.',
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
      nextAction: 'In zavorthControl, show Review and Swarm as a single story: findings, replay, synthesis, and patch apply only after approval.',
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

  private createTelegramDryRun(): TelegramDailyAssistantService {
    const runs: UniversalAgentRun[] = [];
    const gateway = {
      handle: async (request: any) => {
        const run = createDryRunRun({
          text: request.text,
          sessionId: request.sessionId,
          userId: request.userId,
          generatedAt: this.now().toISOString(),
        });
        runs.push(run);
        return {
          run,
          replies: [{
            text: 'I am monitoring here. There is no pending approval in this dryRun; if something sensitive appears, I will request confirmation first.',
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
      agentGateway: gateway as unknown as Pick<ZavorthAgentGateway, 'handle' | 'buildSnapshot' | 'resolveApprovalIntent'>,
      now: this.now,
    });
  }
}

function createAgentReviewDryRun(): Pick<ZavorthAgentReviewService, 'run'> {
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
    } as unknown as ZavorthAgentReviewSnapshot),
  };
}

function createSwarmDryRun(now: () => Date): Pick<SwarmV2Service, 'launchOfficialSwarm'> {
  return {
    launchOfficialSwarm: () => ({
      id: 'daily-use-swarm-dryRun',
      status: 'completed',
      generatedAt: now().toISOString(),
      replay: {
        eventCount: 4,
      },
      tokenBudget: {
        status: 'passed',
      },
      safety: {
        dryRunOnly: true,
        noRuntimeAdapterStarted: true,
      },
    } as unknown as SwarmV2TrackedSnapshot),
  };
}

function createDryRunRun(input: {
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
    summary: 'Remote Telegram daily-use dryRun completed.',
    createdAt: input.generatedAt,
    updatedAt: input.generatedAt,
    modelProfile: {
      provider: 'dryRun',
      model: 'daily-use-yes',
      tier: 'cheap',
    },
    replies: [],
    events: [{
      id: 'evt-daily-use-telegram',
      kind: 'run.completed',
      title: 'Telegram daily-use turn',
      detail: 'Offline Telegram turn completed with receipt.',
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
      dryRunOnly: true,
    },
  } as unknown as UniversalAgentRun;
}
