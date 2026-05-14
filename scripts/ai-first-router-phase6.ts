import type { ZavorthResponseDecision } from '../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstLimitedCanarySwitchboardService } from '../src/services/AiFirstLimitedCanarySwitchboardService.js';
import { AiFirstPromotionCandidateRegistryService } from '../src/services/AiFirstPromotionCandidateRegistryService.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from '../src/services/AiFirstShadowBatchRecorderService.js';

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function legacyConversationDecision(): ZavorthResponseDecision {
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
      reason: 'phase-6-fixture',
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
    legacyDecision: legacyConversationDecision(),
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
  const batchSnapshot = batchService.recordBatch({
    batchName: 'phase-6-clean-conversation-candidate',
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
    registryName: 'phase-6-demo-registry',
    batchSnapshot,
    criteria: {
      minFamilySamples: 3,
      minFamilyPassRate: 1,
      eligibleRiskLevels: ['safe'],
    },
  });
  const switchboard = switchboardService.buildSwitchboard({
    switchboardName: 'phase-6-demo-switchboard',
    registrySnapshot: registry,
    manualActivations: [
      {
        activationId: 'phase-6-web-conversation',
        routeKey: 'ai-first:conversation',
        surfaces: ['web'],
        enabled: true,
        approvedBy: 'owner',
        reason: 'Manual limited canary for safe conversation route.',
      },
    ],
    routeProbes: [
      {
        requestId: 'probe-web-conversation',
        familyId: 'conversation',
        surface: 'web',
        risk: 'safe',
        phase3GuardrailPassed: true,
        registryReceiptPresent: true,
      },
      {
        requestId: 'probe-cli-conversation',
        familyId: 'conversation',
        surface: 'cli',
        risk: 'safe',
        phase3GuardrailPassed: true,
        registryReceiptPresent: true,
      },
    ],
  });

  if (hasFlag('--json')) {
    process.stdout.write(`${JSON.stringify(switchboard, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${switchboardService.renderMarkdown(switchboard)}\n`);
}

main().catch((error) => {
  console.error('[ai-first-router-phase6] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
