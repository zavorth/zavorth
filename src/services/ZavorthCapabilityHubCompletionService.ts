import { ZavorthCapabilityNaturalOperatorService } from './ZavorthCapabilityNaturalOperatorService.js';

import fs from 'node:fs';
import path from 'node:path';
import {
  CAPABILITY_HUB_COMPLETION_CONTRACT_VERSION,
  type CapabilityHubCompletionJourney,
  type CapabilityHubCompletionCheckpoint,
  type CapabilityHubCompletionSnapshot,
  type CapabilityHubCompletionStatus,
} from '../contracts/CapabilityHubCompletionContract.js';

import {
  ZavorthCapabilitySetupQueueService,
  type ZavorthCapabilitySetupQueueRuntime,
} from './ZavorthCapabilitySetupQueueService.js';
import { asErrorLike } from '../utils/errorLike.js';

export type ZavorthCapabilityHubCompletionRuntime = ZavorthCapabilitySetupQueueRuntime & {
  rootDir?: string;
  requestLedgerPath?: string;
};

type CapabilityCheckpointDefinition = {
  id: string;
  title: string;
  requiredFiles: string[];
  gate: string;
};

const CHECKPOINTS: CapabilityCheckpointDefinition[] = [
  checkpoint('gate-0', 'Capability Hub', 'capability-hub', 'ZavorthCapabilityHubService', 'CapabilityHubContract'),
  checkpoint('gate-1', 'Governance Recipes', 'governance-recipes', 'ZavorthGovernanceRecipeService', 'GovernanceRecipeContract'),
  checkpoint('gate-2', 'Natural Setup Assistant', 'natural-setup', 'ZavorthNaturalSetupAssistantService', 'NaturalSetupAssistantContract'),
  checkpoint('gate-3', 'Capability Importer', 'capability-import', 'ZavorthCapabilityImportService', 'CapabilityImportContract'),
  checkpoint('gate-4', 'Capability Activation Flow', 'capability-activation-flow', 'ZavorthCapabilityActivationFlowService', 'CapabilityActivationFlowContract'),
  checkpoint('gate-5', 'Capability Pack Catalog', 'capability-packs', 'ZavorthCapabilityPackCatalogService', 'CapabilityPackCatalogContract'),
  checkpoint('gate-6', 'Capability Pack Readiness', 'capability-pack-readiness', 'ZavorthCapabilityPackReadinessDoctorService', 'CapabilityPackReadinessContract'),
  checkpoint('gate-7', 'Capability Setup Conversation', 'capability-setup-guide', 'ZavorthCapabilitySetupConversationService', 'CapabilitySetupConversationContract'),
  checkpoint('gate-8', 'Capability Setup Queue', 'capability-setup-queue', 'ZavorthCapabilitySetupQueueService', 'CapabilitySetupQueueContract'),
  checkpoint('gate-9', 'Capability Setup Executor', 'capability-setup-executor', 'ZavorthCapabilitySetupExecutorService', 'CapabilitySetupExecutorContract'),
  {
    id: 'gate-10',
    title: 'Capability Console',
    gate: 'node scripts/capability-console-check.mjs',
    requiredFiles: [
      'src/contracts/CapabilityConsoleContract.ts',
      'src/services/ZavorthCapabilityConsoleService.ts',
      'src/services/ZavorthCapabilityConsoleApiService.ts',
      'scripts/capability-console.ts',
      'scripts/capability-console-check.mjs',
      'tests/services/ZavorthCapabilityConsoleService.test.ts',
      'docs/capability-plugins.md',
    ],
  },
  {
    id: 'gate-11',
    title: 'Capability Natural Operator',
    gate: 'node scripts/capability-natural-operator-check.mjs',
    requiredFiles: [
      'src/contracts/CapabilityNaturalOperatorContract.ts',
      'src/services/ZavorthCapabilityNaturalOperatorService.ts',
      'src/services/ZavorthCapabilityNaturalOperatorApiService.ts',
      'scripts/capability-natural-operator-check.mjs',
      'tests/services/ZavorthCapabilityNaturalOperatorService.test.ts',
      'docs/capability-plugins.md',
    ],
  },
];

export class ZavorthCapabilityHubCompletionService {
  private readonly now: () => Date;
  private readonly rootDir: string;
  private readonly runtime: ZavorthCapabilityHubCompletionRuntime;

  constructor(runtime: ZavorthCapabilityHubCompletionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
    this.runtime = {
      ...runtime,
      rootDir: this.rootDir,
      now: this.now,
    };
  }

  public buildSnapshot(): CapabilityHubCompletionSnapshot {
    const stages = CHECKPOINTS.map((definition) => this.inspectCheckpoint(definition));
    const journeys = this.runJourneys();
    const liveViolations = journeys.filter((journey) => journey.assertions.liveActivationApplied).length;
    const secretSerializationViolations = journeys.filter((journey) => journey.assertions.rawSecretsSerialized).length;
    const stagesPassed = stages.filter((stageEntry) => stageEntry.status === 'passed').length;
    const journeysPassed = journeys.filter((journey) => journey.status === 'passed').length;
    const status: CapabilityHubCompletionStatus =
      stagesPassed === stages.length
      && journeysPassed === journeys.length
      && liveViolations === 0
      && secretSerializationViolations === 0
        ? 'passed'
        : 'failed';

    return {
      contractVersion: CAPABILITY_HUB_COMPLETION_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status,
      policy: {
        canonicalRoot: 'zavorth-core/Zavorth',
        directWorkspaceGate: true,
        publicScriptBudgetPreserved: true,
        rawSecretsSerialized: false,
        liveActivationApplied: false,
        ownerApprovalBeforeLive: true,
      },
      summary: {
        stages: stages.length,
        stagesPassed,
        journeys: journeys.length,
        journeysPassed,
        liveViolations,
        secretSerializationViolations,
      },
      stages,
      journeys,
      narrative: {
        headline: status === 'passed'
          ? 'Capability Hub complete: gates accepted.'
          : 'Capability Hub still has acceptance failures.',
        operatorSummary: `${stagesPassed}/${stages.length} gate(s), ${journeysPassed}/${journeys.length} journey(s), ${liveViolations} live violation(s) live.`,
        nextAction: status === 'passed'
          ? 'Promote for controlled operational use or start UI/product work.'
          : 'Fix failed gates or journeys before promotion.',
      },
    };
  }

  public renderReport(): string {
    const snapshot = this.buildSnapshot();
    const lines = [
      'Zavorth Capability Hub Completion Gate',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      'Steps:',
    ];
    for (const stageEntry of snapshot.stages) {
      lines.push(`- ${stageEntry.id} ${stageEntry.status}: ${stageEntry.title}`);
      for (const missing of stageEntry.missingFiles.slice(0, 4)) {
        lines.push(`  missing: ${missing}`);
      }
    }
    lines.push('', 'Journeys:');
    for (const journey of snapshot.journeys) {
      lines.push(`- ${journey.id} ${journey.status}: ${journey.expectedAction} <= "${journey.prompt}"`);
    }
    lines.push('', `next: ${snapshot.narrative.nextAction}`);
    return lines.join('\n');
  }

  private inspectCheckpoint(definition: CapabilityCheckpointDefinition): CapabilityHubCompletionCheckpoint {
    const missingFiles = definition.requiredFiles.filter((file) => !fs.existsSync(path.join(this.rootDir, file)));
    return {
      id: definition.id,
      title: definition.title,
      status: missingFiles.length === 0 ? 'passed' : 'failed',
      requiredFiles: definition.requiredFiles,
      missingFiles,
      gate: definition.gate,
    };
  }

  private runJourneys(): CapabilityHubCompletionJourney[] {
    this.seedReadyTicket();
    const operator = new ZavorthCapabilityNaturalOperatorService(this.runtime);
    const journeys = [
      {
        id: 'journey-console-overview',
        prompt: 'mostre o capability hub',
        expectedAction: 'show_console',
        result: operator.execute({
          text: 'mostre o capability hub',
          createTicket: false,
        }),
      },
      {
        id: 'journey-create-slack-ticket',
        prompt: 'quero setup meu Slack',
        expectedAction: 'create_setup_ticket',
        result: operator.execute({
          text: 'quero setup meu Slack com token redacted-slack-token-fixture',
          actorLabel: 'completion-gate',
          ticketId: 'setup-completion-slack',
        }),
      },
      {
        id: 'journey-readiness',
        prompt: 'check release readiness',
        expectedAction: 'run_readiness',
        result: operator.execute({
          text: 'check release readiness',
          packId: 'official-ops-skills',
          targetItemId: 'skill:release-readiness',
        }),
      },
      {
        id: 'journey-approval-guard',
        prompt: 'create controlled request without approval',
        expectedAction: 'prepare_activation_request',
        result: operator.execute({
          text: 'create controlled request for setup-completion-ready',
          ticketId: 'setup-completion-ready',
        }),
      },
      {
        id: 'journey-controlled-request',
        prompt: 'create controlled request with approval',
        expectedAction: 'prepare_activation_request',
        result: operator.execute({
          text: 'create controlled request for setup-completion-ready',
          ticketId: 'setup-completion-ready',
          ownerApprovalId: 'approval-completion',
          confirmOwnerControlledActivation: true,
          execute: true,
        }),
      },
    ];

    return journeys.map((journey) => this.toJourney(journey.id, journey.prompt, journey.expectedAction, journey.result));
  }

  private seedReadyTicket(): void {
    const queue = new ZavorthCapabilitySetupQueueService(this.runtime);
    if (queue.getTicket('setup-completion-ready')) {
      return;
    }
    try {
      queue.createTicket({
        ticketId: 'setup-completion-ready',
        packId: 'official-ops-skills',
        targetItemId: 'skill:release-readiness',
        text: 'completion gate ready release readiness',
        audience: 'owner',
        approvalId: 'approval-completion',
        completedManualSteps: ['review scope and approval budget'],
        completedReadinessChecks: ['release-readiness-readiness', 'artifact-receipt-policy'],
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (!/already exists/i.test(error instanceof Error ? err.message : String(error))) {
        throw error;
      }
    }
  }

  private toJourney(
    id: string,
    prompt: string,
    expectedAction: string,
    naturalResult: CapabilityHubCompletionJourney['naturalResult'],
  ): CapabilityHubCompletionJourney {
    const expectedActionMatched = naturalResult.decision.action === expectedAction;
    const rawSecretsSerialized = this.serialized(naturalResult).includes('redacted-slack-token-fixture');
    const liveActivationApplied = naturalResult.safety.liveActivationApplied;
    const ownerApprovalBeforeLive = naturalResult.safety.ownerApprovalBeforeLive;
    const approvalRequiredWhenExecuting = naturalResult.decision.action !== 'prepare_activation_request'
      || naturalResult.executorResult?.status !== 'activation_request_created'
      || Boolean(naturalResult.executorResult.activationRequest?.ownerApprovalId);
    const status: CapabilityHubCompletionStatus =
      expectedActionMatched
      && rawSecretsSerialized === false
      && liveActivationApplied === false
      && ownerApprovalBeforeLive === true
      && approvalRequiredWhenExecuting ? 'passed'
        : 'failed';

    return {
      id,
      prompt,
      expectedAction,
      status,
      naturalResult,
      assertions: {
        expectedActionMatched,
        rawSecretsSerialized,
        liveActivationApplied,
        ownerApprovalBeforeLive,
        approvalRequiredWhenExecuting,
      },
    };
  }

  private serialized(value: unknown): string {
    return JSON.stringify(value);
  }
}

function checkpoint(id: string, title: string, scriptBase: string, serviceName: string, contractName: string): CapabilityCheckpointDefinition {
  return {
    id,
    title,
    gate: `npm run ${scriptBase}:check`,
    requiredFiles: [
      `src/contracts/${contractName}.ts`,
      `src/services/${serviceName}.ts`,
      `src/services/${serviceName.replace(/Service$/, 'ApiService')}.ts`,
      `scripts/${scriptBase}.ts`,
      `scripts/${scriptBase}-check.mjs`,
      `tests/services/${serviceName}.test.ts`,
    ],
  };
}
