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
      summary: 'Help the user set up a personal connection without exposing technical details.',
      assumptions: ['The user wants to be guided step by step.'],
    },
    goal: {
      userFacing: userMessage,
      internalSummary: 'Prepare assisted setup with private secret and governed validation.',
    },
    proposedActions: [
      {
        id: 'preview-setup',
        kind: 'preview',
        label: 'Show simple plan',
        summary: 'Explain in plain language what will be configured before saving any value.',
        target: { type: 'conversation' },
        sideEffect: 'none',
      },
      {
        id: 'save-secret',
        kind: 'configure',
        label: 'Save user secret',
        summary: 'Save the secret provided by the user in controlled storage.',
        target: { type: 'account', value: 'personal-settings' },
        requestedToolIds: ['secure-storage.write'],
        payloadPreview: {
          token: 'redacted-slack-token-placeholder',
          destination: 'personal-settings',
        },
      },
      {
        id: 'validate-setup',
        kind: 'test',
        label: 'Validate access',
        summary: 'Test the configuration without sending real messages.',
        target: { type: 'service', value: 'personal-channel' },
        requestedToolIds: ['connection.doctor'],
      },
    ],
    response: {
      userFacingSummary: 'I will guide the setup, show you before saving and ask for your approval.',
    },
  };
}

async function main(): Promise<void> {
  const userMessage =
    getArgValue('--message') ??     'Configure my account using token redacted-slack-token-placeholder and explain everything in simple terms.';
  const service = new AiFirstRoutePlanContractService();
  const result = service.normalize({
    surface: 'gate-1-script',
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
  console.error('[ai-first-router-intent-model] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
