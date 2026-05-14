import type { ZavorthResponseDecision } from '../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstLimitedCanarySwitchboardService } from '../src/services/AiFirstLimitedCanarySwitchboardService.js';
import { AiFirstPromotionCandidateRegistryService } from '../src/services/AiFirstPromotionCandidateRegistryService.js';
import { AiFirstRuntimeEntrypointAdapterService } from '../src/services/AiFirstRuntimeEntrypointAdapterService.js';
import { AiFirstRuntimeReceiptLedgerService } from '../src/services/AiFirstRuntimeReceiptLedgerService.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from '../src/services/AiFirstShadowBatchRecorderService.js';

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
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
      reason: 'phase-8-fixture',
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

async function main(): Promise<void> {
  const batchService = new AiFirstShadowBatchRecorderService();
  const registryService = new AiFirstPromotionCandidateRegistryService();
  const switchboardService = new AiFirstLimitedCanarySwitchboardService();
  const adapterService = new AiFirstRuntimeEntrypointAdapterService();
  const ledgerService = new AiFirstRuntimeReceiptLedgerService();
  const batchSnapshot = batchService.recordBatch({
    batchName: 'phase-8-clean-conversation-candidate',
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
  const registry = registryService.buildRegistry({
    registryName: 'phase-8-demo-registry',
    batchSnapshot,
    criteria: {
      minFamilySamples: 3,
      minFamilyPassRate: 1,
      eligibleRiskLevels: ['safe'],
    },
  });
  const switchboard = switchboardService.buildSwitchboard({
    switchboardName: 'phase-8-demo-switchboard',
    registrySnapshot: registry,
    manualActivations: [
      {
        activationId: 'phase-8-web-conversation',
        routeKey: 'ai-first:conversation',
        surfaces: ['web'],
        enabled: true,
        approvedBy: 'owner',
        reason: 'Manual limited canary for safe conversation route.',
      },
    ],
    routeProbes: [
      {
        requestId: 'phase-8-web-conversation-request',
        familyId: 'conversation',
        surface: 'web',
        risk: 'safe',
        phase3GuardrailPassed: true,
        registryReceiptPresent: true,
      },
      {
        requestId: 'phase-8-cli-conversation-request',
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
      adapterName: 'phase-8-demo-adapter',
      requestId: 'phase-8-web-conversation-request',
      surface: 'web',
      userMessage: 'Oi, me explique essa ideia.',
      currentDecision: currentConversationDecision('web'),
      switchboardSnapshot: switchboard,
    }),
    adapterService.adapt({
      adapterName: 'phase-8-demo-adapter',
      requestId: 'phase-8-cli-conversation-request',
      surface: 'cli',
      userMessage: 'Oi, me explique essa ideia.',
      currentDecision: currentConversationDecision('cli'),
      switchboardSnapshot: switchboard,
    }),
  ];
  const persistPath = getArgValue('--persist');
  const ledger = ledgerService.buildLedger({
    ledgerName: 'phase-8-demo-ledger',
    adapterSnapshots,
    persistence: persistPath
      ? {
          enabled: true,
          filePath: persistPath,
        }
      : null,
  });

  if (hasFlag('--json')) {
    process.stdout.write(`${JSON.stringify(ledger, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${ledgerService.renderMarkdown(ledger)}\n`);
}

main().catch((error) => {
  console.error('[ai-first-router-phase8] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
