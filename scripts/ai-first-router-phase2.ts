import type { ZavorthResponseDecision } from '../src/contracts/ZavorthResponseDecisionContract.js';
import { AiFirstShadowRouterService } from '../src/services/AiFirstShadowRouterService.js';

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function buildLegacyConversationDecision(): ZavorthResponseDecision {
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
      reason: 'phase-2-fixture',
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

function buildAiPlan(userMessage: string): unknown {
  return {
    audience: {
      level: 'plain',
      hideTechnicalJargon: true,
      explainBeforeActing: true,
    },
    intent: {
      primary: 'configuration',
      confidence: 0.88,
      summary: 'Entender que o usuario quer ajuda guiada para configurar uma conta.',
    },
    goal: {
      userFacing: userMessage,
      internalSummary: 'Preparar configuracao assistida com preview e aprovacao.',
    },
    proposedActions: [
      {
        id: 'show-preview',
        kind: 'preview',
        label: 'Mostrar preview',
        summary: 'Mostrar o plano antes de salvar qualquer valor.',
      },
      {
        id: 'save-private-setting',
        kind: 'configure',
        label: 'Salvar configuracao privada',
        summary: 'Salvar configuracao pessoal em armazenamento controlado.',
        requestedToolIds: ['secure-storage.write'],
        payloadPreview: {
          token: 'xoxb-test-token-placeholder-123456',
        },
      },
    ],
  };
}

async function main(): Promise<void> {
  const userMessage =
    getArgValue('--message') ??
    'Configure minha conta usando token: xoxb-test-token-placeholder-123456 e explique em linguagem simples.';
  const service = new AiFirstShadowRouterService();
  const snapshot = service.compare({
    surface: 'web',
    userMessage,
    legacyDecision: buildLegacyConversationDecision(),
    rawAiPlan: buildAiPlan(userMessage),
  });

  if (hasFlag('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${service.renderMarkdown(snapshot)}\n`);
}

main().catch((error) => {
  console.error('[ai-first-router-phase2] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
