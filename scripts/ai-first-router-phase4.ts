import type { ZavorthResponseDecision } from '../src/contracts/ZavorthResponseDecisionContract.js';
import {
  AiFirstShadowBatchRecorderService,
  type AiFirstShadowBatchRecorderSampleInput,
} from '../src/services/AiFirstShadowBatchRecorderService.js';

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function legacyDecision(input: Partial<ZavorthResponseDecision>): ZavorthResponseDecision {
  return {
    schemaVersion: 1,
    mode: 'conversation',
    confidence: 'high',
    reason: 'Current route fixture.',
    sourceReason: 'conversation-only',
    target: { type: 'none', value: null },
    requestedTools: [],
    responsePath: 'fast-chat',
    shouldCreateArtifact: false,
    shouldShowArtifactInChat: false,
    artifactPolicy: {
      shouldCreateArtifact: false,
      shouldShowArtifactInChat: false,
      reason: 'phase-4-fixture',
    },
    diagnostics: {
      surface: 'web',
      shouldExecute: false,
      semantic: false,
      universalIntent: null,
      trustSlider: null,
    },
    ...input,
  };
}

function buildSamples(): AiFirstShadowBatchRecorderSampleInput[] {
  const conversationLegacy = legacyDecision({});
  const readLegacy = legacyDecision({
    mode: 'file-inspection',
    responsePath: 'local-inspector',
    requestedTools: ['read_file'],
    diagnostics: {
      surface: 'web',
      shouldExecute: true,
      semantic: false,
      universalIntent: null,
      trustSlider: null,
    },
  });

  return [
    {
      sampleId: 'conversation-1',
      surface: 'web',
      userMessage: 'Oi, me explique essa ideia.',
      legacyDecision: conversationLegacy,
      rawAiPlan: {
        intent: { primary: 'conversation', confidence: 0.92 },
        proposedActions: [{ kind: 'answer', summary: 'Responder em conversa.' }],
      },
    },
    {
      sampleId: 'conversation-2',
      surface: 'web',
      userMessage: 'Me ajude a pensar num nome melhor.',
      legacyDecision: conversationLegacy,
      rawAiPlan: {
        intent: { primary: 'conversation', confidence: 0.88 },
        proposedActions: [{ kind: 'answer', summary: 'Responder em conversa.' }],
      },
    },
    {
      sampleId: 'inspection-1',
      surface: 'web',
      userMessage: 'Leia esse arquivo e resuma.',
      legacyDecision: readLegacy,
      rawAiPlan: {
        intent: { primary: 'workspace-inspection', confidence: 0.9 },
        proposedActions: [{ kind: 'read', summary: 'Ler arquivo local.', requestedToolIds: ['read_file'] }],
      },
    },
    {
      sampleId: 'configuration-1',
      surface: 'web',
      userMessage: 'Configure minha conta usando token: xoxb-test-token-placeholder-123456.',
      legacyDecision: conversationLegacy,
      rawAiPlan: {
        intent: { primary: 'configuration', confidence: 0.89 },
        proposedActions: [
          {
            kind: 'configure',
            summary: 'Salvar configuracao pessoal depois de preview.',
            requestedToolIds: ['secure-storage.write'],
            payloadPreview: { token: 'xoxb-test-token-placeholder-123456' },
          },
        ],
      },
    },
    {
      sampleId: 'mutation-1',
      surface: 'cli',
      userMessage: 'Edite o arquivo de configuracao.',
      legacyDecision: legacyDecision({
        mode: 'operation',
        responsePath: 'agent-runtime',
        requestedTools: ['write_file'],
        diagnostics: {
          surface: 'cli',
          shouldExecute: true,
          semantic: false,
          universalIntent: null,
          trustSlider: null,
        },
      }),
      rawAiPlan: {
        intent: { primary: 'workspace-mutation', confidence: 0.91 },
        proposedActions: [{ kind: 'write', summary: 'Editar arquivo local.', requestedToolIds: ['write_file'] }],
      },
    },
    {
      sampleId: 'invalid-1',
      surface: 'web',
      userMessage: 'oi',
      legacyDecision: conversationLegacy,
      rawAiPlan: 'saida invalida',
    },
  ];
}

async function main(): Promise<void> {
  const service = new AiFirstShadowBatchRecorderService();
  const snapshot = service.recordBatch({
    batchName: 'phase-4-demo',
    profile: 'promotion-candidate',
    criteria: {
      minSamples: 6,
      minPassRate: 0.75,
      maxBlockRate: 0,
      maxHighMismatchRate: 0,
      maxHighShadowDivergenceRate: 0,
    },
    samples: buildSamples(),
  });

  if (hasFlag('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${service.renderMarkdown(snapshot)}\n`);
}

main().catch((error) => {
  console.error('[ai-first-router-phase4] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
