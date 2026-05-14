import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot } from '../config/configHelpers.js';
import type { AiFirstFinalActivationGateSnapshot } from '../contracts/AiFirstFinalActivationGateContract.js';
import type { ZavorthResponseDecision } from '../contracts/ZavorthResponseDecisionContract.js';
import { AiFirstFinalActivationGateService } from './AiFirstFinalActivationGateService.js';
import { AiFirstHistoricalReplayGateService } from './AiFirstHistoricalReplayGateService.js';
import { AiFirstLimitedCanarySwitchboardService } from './AiFirstLimitedCanarySwitchboardService.js';
import { AiFirstPromotionCandidateRegistryService } from './AiFirstPromotionCandidateRegistryService.js';
import { AiFirstRuntimeEntrypointAdapterService } from './AiFirstRuntimeEntrypointAdapterService.js';
import { AiFirstRuntimeReceiptLedgerService } from './AiFirstRuntimeReceiptLedgerService.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from './AiFirstShadowBatchRecorderService.js';

type Runtime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

export type AiFirstActivationPreparationOptions = {
  projectRoot?: string;
  outputDir?: string;
  runtime?: Runtime;
};

export type AiFirstActivationPreparationInput = {
  ownerApprovalId?: string | null;
  outputPath?: string | null;
  write?: boolean | null;
};

export type AiFirstActivationPreparationResult = {
  version: 1;
  generatedAt: string;
  status: 'ready' | 'blocked';
  written: boolean;
  snapshotPath: string;
  ownerApprovalId: string | null;
  snapshot: AiFirstFinalActivationGateSnapshot;
  commands: {
    plan: string;
    activate: string;
    status: string;
    rollback: string;
  };
  message: string;
};

export class AiFirstActivationPreparationService {
  private readonly projectRoot: string;
  private readonly outputDir: string;
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(options: AiFirstActivationPreparationOptions = {}) {
    this.projectRoot = options.projectRoot || findProjectRoot();
    this.outputDir = options.outputDir || path.resolve(this.projectRoot, 'data', 'runtime', 'ai-first-phase10-snapshots');
    this.now = options.runtime?.now || (() => new Date());
    this.idFactory = options.runtime?.idFactory || ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public prepare(input: AiFirstActivationPreparationInput = {}): AiFirstActivationPreparationResult {
    const snapshot = this.buildSnapshot();
    const ownerApprovalId = clean(input.ownerApprovalId);
    const snapshotPath = path.resolve(input.outputPath || path.join(
      this.outputDir,
      `phase10-${snapshot.activationGateId}.json`,
    ));
    const status = snapshot.recommendation.readiness === 'ready-for-owner-controlled-default'
      && snapshot.findings.length === 0
      && snapshot.aggregate.finalFindingCount === 0
      ? 'ready'
      : 'blocked';
    const written = input.write !== false;
    if (written) {
      fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    }
    return {
      version: 1,
      generatedAt: this.now().toISOString(),
      status,
      written,
      snapshotPath,
      ownerApprovalId,
      snapshot,
      commands: this.commands(snapshotPath, ownerApprovalId),
      message: written
        ? `Phase 10 snapshot saved to ${snapshotPath}.`
        : `Phase 10 snapshot prepared for ${snapshotPath}; write disabled.`,
    };
  }

  public renderText(result: AiFirstActivationPreparationResult): string {
    return [
      'Zavorth AI-first activation preparation',
      `Status: ${result.status}`,
      `Written: ${String(result.written)}`,
      `Snapshot: ${result.snapshotPath}`,
      `Readiness: ${result.snapshot.recommendation.readiness}`,
      `Action: ${result.snapshot.recommendation.action}`,
      `Findings: ${result.snapshot.findings.length}`,
      `Owner approval: ${result.ownerApprovalId || 'missing'}`,
      '',
      'Next commands:',
      `- plan: ${result.commands.plan}`,
      `- activate: ${result.commands.activate}`,
      `- status: ${result.commands.status}`,
      `- rollback: ${result.commands.rollback}`,
    ].join('\n');
  }

  private buildSnapshot(): AiFirstFinalActivationGateSnapshot {
    const batchService = new AiFirstShadowBatchRecorderService({ now: this.now, idFactory: this.idFactory });
    const registryService = new AiFirstPromotionCandidateRegistryService({ now: this.now, idFactory: this.idFactory });
    const switchboardService = new AiFirstLimitedCanarySwitchboardService({ now: this.now, idFactory: this.idFactory });
    const adapterService = new AiFirstRuntimeEntrypointAdapterService({ now: this.now, idFactory: this.idFactory });
    const ledgerService = new AiFirstRuntimeReceiptLedgerService({ now: this.now, idFactory: this.idFactory });
    const historicalGateService = new AiFirstHistoricalReplayGateService({ now: this.now, idFactory: this.idFactory });
    const finalGateService = new AiFirstFinalActivationGateService({ now: this.now, idFactory: this.idFactory });
    const batchSnapshot = batchService.recordBatch({
      batchName: 'activation-preparation-clean-conversation-candidate',
      profile: 'promotion-candidate',
      criteria: {
        minSamples: 3,
        minPassRate: 1,
        maxBlockRate: 0,
        maxHighMismatchRate: 0,
        maxHighShadowDivergenceRate: 0,
      },
      samples: [
        conversationSample('conversation-1', 'Oi, me explique essa ideia.'),
        conversationSample('conversation-2', 'Me ajude a pensar num nome melhor.'),
        conversationSample('conversation-3', 'Resuma minha ideia em uma frase simples.'),
      ],
    });
    const registrySnapshot = registryService.buildRegistry({
      registryName: 'activation-preparation-registry',
      batchSnapshot,
      criteria: {
        minFamilySamples: 3,
        minFamilyPassRate: 1,
        eligibleRiskLevels: ['safe'],
      },
    });
    const switchboardSnapshot = switchboardService.buildSwitchboard({
      switchboardName: 'activation-preparation-switchboard',
      registrySnapshot,
      manualActivations: [
        {
          activationId: 'activation-preparation-web-conversation',
          routeKey: 'ai-first:conversation',
          surfaces: ['web'],
          enabled: true,
          approvedBy: 'owner',
        },
      ],
      routeProbes: [
        {
          requestId: 'activation-preparation-web-conversation-request',
          familyId: 'conversation',
          surface: 'web',
          risk: 'safe',
          phase3GuardrailPassed: true,
          registryReceiptPresent: true,
        },
        {
          requestId: 'activation-preparation-cli-conversation-request',
          familyId: 'conversation',
          surface: 'cli',
          risk: 'safe',
          phase3GuardrailPassed: true,
          registryReceiptPresent: true,
        },
      ],
    });
    const adapterSnapshots = [
      adapterService.adapt({
        adapterName: 'activation-preparation-adapter',
        requestId: 'activation-preparation-web-conversation-request',
        surface: 'web',
        userMessage: 'Oi, me explique essa ideia.',
        currentDecision: currentConversationDecision('web'),
        switchboardSnapshot,
      }),
      adapterService.adapt({
        adapterName: 'activation-preparation-adapter',
        requestId: 'activation-preparation-cli-conversation-request',
        surface: 'cli',
        userMessage: 'Oi, me explique essa ideia.',
        currentDecision: currentConversationDecision('cli'),
        switchboardSnapshot,
      }),
    ];
    const baselineLedger = ledgerService.buildLedger({
      ledgerName: 'activation-preparation-baseline-ledger',
      adapterSnapshots,
    });
    const latestLedger = ledgerService.buildLedger({
      ledgerName: 'activation-preparation-latest-ledger',
      adapterSnapshots,
    });
    const historicalGateSnapshot = historicalGateService.buildGate({
      gateName: 'activation-preparation-historical-replay-gate',
      ledgers: [baselineLedger, latestLedger],
    });
    return finalGateService.buildGate({
      activationName: 'activation-preparation-final-gate',
      batchSnapshot,
      registrySnapshot,
      switchboardSnapshot,
      ledgerSnapshot: latestLedger,
      historicalGateSnapshot,
    });
  }

  private commands(snapshotPath: string, ownerApprovalId: string | null): AiFirstActivationPreparationResult['commands'] {
    const approval = ownerApprovalId || '<id>';
    return {
      plan: `zavorth ai-first plan --snapshot "${snapshotPath}" --owner-approval-id ${approval}`,
      activate: `zavorth ai-first activate --snapshot "${snapshotPath}" --owner-approval-id ${approval} --apply --confirm-owner-controlled-default`,
      status: 'zavorth ai-first status',
      rollback: `zavorth ai-first rollback --owner-approval-id ${approval} --apply --confirm-rollback`,
    };
  }
}

function currentConversationDecision(surface = 'web'): ZavorthResponseDecision {
  return {
    schemaVersion: 1,
    mode: 'conversation',
    confidence: 'high',
    reason: 'Respond as normal chat; do not wake the agent runtime.',
    sourceReason: 'conversation-only',
    target: { type: 'none', value: null },
    requestedTools: [],
    responsePath: 'fast-chat',
    shouldCreateArtifact: false,
    shouldShowArtifactInChat: false,
    artifactPolicy: {
      shouldCreateArtifact: false,
      shouldShowArtifactInChat: false,
      reason: 'activation-preparation-fixture',
    },
    diagnostics: {
      surface,
      shouldExecute: false,
      semantic: false,
      universalIntent: null,
      trustSlider: null,
    },
  };
}

function conversationSample(sampleId: string, text: string): AiFirstShadowBatchRecorderSampleInput {
  return {
    sampleId,
    surface: 'web',
    userMessage: text,
    legacyDecision: currentConversationDecision('web'),
    rawAiPlan: {
      intent: {
        primary: 'conversation',
        confidence: 0.92,
      },
      proposedActions: [
        {
          kind: 'answer',
          summary: 'Responder em conversa sem ferramentas.',
        },
      ],
    },
  };
}

function clean(value: unknown): string | null {
  const text = String(value || '').trim();
  return text ? text : null;
}
