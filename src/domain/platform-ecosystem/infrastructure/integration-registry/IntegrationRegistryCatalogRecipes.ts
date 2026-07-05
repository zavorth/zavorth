import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { choice, commonCapabilityQuestion, mode, question, req, step } from './IntegrationRegistryCatalogShared.js';

export const INTEGRATION_RECIPE_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'oracle-cloudflare-gemma',
    label: 'Oracle + Cloudflare + Gemma',
    aliases: ['oracle-cloudflare', 'cloudflare-gemma', 'oracle-gemma'],
    summary: 'Lean remote architecture: Zavorth on Oracle, Cloudflare at the edge, and Gemma through the Gemini API.',
    description:
      'Operational recipe for hosting the Zavorth runtime on Oracle Always Free, publishing through Cloudflare Tunnel, and routing Gemini or Gemma through Cloudflare AI Gateway.',
    supportLevel: 'recipe',
    category: 'remote',
    tags: ['oracle', 'cloudflare', 'gemma', 'gemini', 'deployment'],
    modes: [mode('api', 'Remote stack', 'Oracle for runtime, Cloudflare for the edge, and Gemini or Gemma for inference.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'agents', 'automation'],
    binding: {
      kind: 'service',
      key: 'oracle-cloudflare-gemma',
      status: 'partial',
      summary: 'Operational recipe supported by Zavorth with templates and its own doctor.',
    },
    requirements: [
      req('oracle_vm', 'Oracle Always Free VM', 'Required to keep Zavorth online 24/7.', {
        type: 'account',
      }),
      req('cloudflare_tunnel', 'Cloudflare Tunnel', 'Publishes /app without exposing the Oracle IP directly.', {
        type: 'account',
      }),
      req('cloudflare_tunnel_hostname', 'Tunnel hostname', 'Used to derive the public Zavorth URL.', {
        type: 'env',
        envKey: 'CLOUDFLARE_TUNNEL_PUBLIC_HOSTNAME',
      }),
      req('cloudflare_ai_gateway_account', 'Cloudflare AI Gateway account id', 'Required for the Gemini or Gemma edge route.', {
        type: 'env',
        envKey: 'CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID',
      }),
      req('cloudflare_ai_gateway_id', 'Cloudflare AI Gateway id', 'Identifies the inference gateway.', {
        type: 'env',
        envKey: 'CLOUDFLARE_AI_GATEWAY_ID',
      }),
      req('gemini_api_key', 'Gemini key', 'Required for Gemma hosted through the Gemini API.', {
        type: 'env',
        secret: true,
        envKey: 'GEMINI_API_KEY',
      }),
    ],
    onboardingQuestions: [
      question('stack_goal', 'What is the main goal for this stack?', 'single_choice', 'This helps guide the initial rollout.', {
        required: false,
        choices: [
          choice('public-bot', 'Public bot', 'Focus on Discord, Telegram, or web access for several people.'),
          choice('private-ops', 'Private operations', 'Focus on keeping Zavorth online 24/7 for personal use.'),
        ],
      }),
      question('public_hostname', 'Which public hostname do you want to use?', 'text', 'Example: zavorth.your-domain.com', {
        required: false,
        placeholder: 'zavorth.your-domain.com',
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('oracle', 'Prepare Oracle VM', 'Create the VM and install Node/npm for the Zavorth runtime.', 'manual'),
      step('systemd', 'Apply Zavorth service', 'Use the config/deploy/zavorth-oracle.service.example template.', 'manual'),
      step('tunnel', 'Configure cloudflared', 'Use the config/deploy/cloudflared.oracle.example.yml template.', 'manual'),
      step('gateway', 'Configure AI Gateway', 'Create the gateway and fill the variables in .env.', 'manual'),
      step('doctor', 'Run rollout doctor', 'Validate that the Oracle + Cloudflare + Gemma stack is coherent.', 'verification', 'npm run ops:oracle-cloudflare'),
    ],
    safetyNotes: [
      'Keep GEMINI_API_KEY and any Cloudflare token out of chats and Git.',
      'Use Cloudflare Tunnel instead of opening the Oracle web port directly to the internet.',
      'Do not treat Oracle Always Free as a self-hosted Gemma 4 machine; inference should stay remote.',
    ],
    goodFor: ['Low-cost 24/7 Zavorth', 'Protected edge', 'Gemma hosting without a powerful notebook'],
  },
];
