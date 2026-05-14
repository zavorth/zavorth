import type { ZavorthResponseDecision } from '../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstLimitedCanarySwitchboardService } from '../src/services/AiFirstLimitedCanarySwitchboardService.js';
import { AiFirstPromotionCandidateRegistryService } from '../src/services/AiFirstPromotionCandidateRegistryService.js';
import { AiFirstRuntimeEntrypointAdapterService } from '../src/services/AiFirstRuntimeEntrypointAdapterService.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from '../src/services/AiFirstShadowBatchRecorderService.js';

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function currentConversationDecision(): ZavorthResponseDecision {
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
      reason: 'phase-7-fixture',
    },
    diagnostics: {
      surface: 'web',
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
    legacyDecision: currentConversationDecision(),
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
  const batchSnapshot = batchService.recordBatch({
    batchName: 'phase-7-clean-conversation-candidate',
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
    registryName: 'phase-7-demo-registry',
    batchSnapshot,
    criteria: {
      minFamilySamples: 3,
      minFamilyPassRate: 1,
      eligibleRiskLevels: ['safe'],
    },
  });
  const switchboard = switchboardService.buildSwitchboard({
    switchboardName: 'phase-7-demo-switchboard',
    registrySnapshot: registry,
    manualActivations: [
      {
        activationId: 'phase-7-web-conversation',
        routeKey: 'ai-first:conversation',
        surfaces: ['web'],
        enabled: true,
        approvedBy: 'owner',
        reason: 'Manual limited canary for safe conversation route.',
      },
    ],
    routeProbes: [
      {
        requestId: 'phase-7-web-conversation-request',
        familyId: 'conversation',
        surface: 'web',
        risk: 'safe',
        phase3GuardrailPassed: true,
        registryReceiptPresent: true,
      },
    ],
  });
  const snapshot = adapterService.adapt({
    adapterName: 'phase-7-demo-adapter',
    requestId: 'phase-7-web-conversation-request',
    surface: 'web',
    userMessage: 'Oi, me explique essa ideia.',
    currentDecision: currentConversationDecision(),
    switchboardSnapshot: switchboard,
  });

  if (hasFlag('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${adapterService.renderMarkdown(snapshot)}\n`);
}

main().catch((error) => {
  console.error('[ai-first-router-phase7] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
