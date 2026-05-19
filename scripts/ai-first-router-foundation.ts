import { AiFirstRoutePlanContractService } from '../src/services/AiFirstRoutePlanContractService.js';

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function buildSampleRawPlan(userMessage: string): unknown {
  return {
    audience: {
      level: 'plain',
      hideTechnicalJargon: true,
      explainBeforeActing: true,
    },
    intent: {
      primary: 'configuration',
      confidence: 0.86,
      summary: 'Ajudar o usuario a configurar uma conexao pessoal sem expor detalhes tecnicos.',
      assumptions: ['O usuario quer ser guiado passo a passo.'],
    },
    goal: {
      userFacing: userMessage,
      internalSummary: 'Preparar configuracao assistida com segredo privado e validacao governada.',
    },
    proposedActions: [
      {
        id: 'preview-setup',
        kind: 'preview',
        label: 'Mostrar plano simples',
        summary: 'Explicar em linguagem simples o que sera configurado antes de salvar qualquer valor.',
        target: { type: 'conversation' },
        sideEffect: 'none',
      },
      {
        id: 'save-secret',
        kind: 'configure',
        label: 'Salvar segredo do usuario',
        summary: 'Salvar o segredo fornecido pelo usuario em armazenamento controlado.',
        target: { type: 'account', value: 'personal-settings' },
        requestedToolIds: ['secure-storage.write'],
        payloadPreview: {
          token: 'xoxb-test-token-placeholder-123456',
          destination: 'personal-settings',
        },
      },
      {
        id: 'validate-setup',
        kind: 'test',
        label: 'Validar acesso',
        summary: 'Testar a configuracao sem enviar mensagens reais.',
        target: { type: 'service', value: 'personal-channel' },
        requestedToolIds: ['connection.doctor'],
      },
    ],
    response: {
      userFacingSummary: 'Vou guiar a configuracao, mostrar antes de salvar e pedir sua aprovacao.',
    },
  };
}

async function main(): Promise<void> {
  const userMessage =
    getArgValue('--message') ??
    'Configure minha conta usando token xoxb-test-token-placeholder-123456 e me explique tudo de forma simples.';
  const service = new AiFirstRoutePlanContractService();
  const result = service.normalize({
    surface: 'checkpoint-1-script',
    userMessage,
    rawPlan: buildSampleRawPlan(userMessage),
  });

  if (hasFlag('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${service.renderMarkdown(result)}\n`);
}

main().catch((error) => {
  console.error('[ai-first-router-intent-model] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
