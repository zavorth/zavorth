import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { choice, commonCapabilityQuestion, mode, question, req, step } from './IntegrationRegistryCatalogShared.js';

export const INTEGRATION_REMOTE_PROVIDER_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'gemini',
    label: 'Google Gemini / AI Studio',
    aliases: ['google', 'aistudio', 'google-ai-studio'],
    summary: 'Native connector for Gemini chat, vision, and search models.',
    description: 'This provider already exists in Zavorth and is one of the simplest paths to get started.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['provider', 'google', 'multimodal'],
    modes: [mode('api', 'Remote API', 'Uses a Google AI Studio key.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'search', 'agents'],
    binding: {
      kind: 'provider',
      key: 'gemini',
      status: 'ready',
      summary: 'Native provider already present in the runtime.',
    },
    requirements: [
      req('gemini_api_key', 'Gemini key', 'Required to authenticate the provider.', {
        type: 'env',
        secret: true,
        envKey: 'GEMINI_API_KEY',
      }),
      req('google_account', 'Google account', 'Required to create and manage the key.', {
        type: 'account',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'How do you want to use Gemini...', 'single_choice', 'Remote API is the default path.', {
        required: false,
        choices: [choice('api', 'Remote API', 'Recommended: nothing is installed locally.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Review scope', 'Decide whether you need chat, code, vision, search, or agents.', 'guided'),
      step('configure-key', 'Add the key', 'Configure GEMINI_API_KEY in a secure location.', 'manual', 'GEMINI_API_KEY=...'),
      step('doctor', 'Run doctor', 'Validate that the integration is ready.', 'verification', 'npm run integrations:doctor -- --id gemini'),
    ],
    safetyNotes: [
      'This integration sends prompts and files to a remote service.',
      'Enable vision only when you actually need image understanding.',
    ],
    goodFor: ['Research', 'Multimodal analysis', 'General use'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    aliases: ['chatgpt'],
    summary: 'Native connector for GPT models focused on chat, code, and vision.',
    description: 'Uses the OpenAI provider already embedded in Zavorth.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['provider', 'openai', 'vision'],
    modes: [mode('api', 'Remote API', 'Uses OPENAI_API_KEY.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'agents'],
    binding: {
      kind: 'provider',
      key: 'openai',
      status: 'ready',
      summary: 'Native provider already present in the runtime.',
    },
    requirements: [
      req('openai_api_key', 'OpenAI key', 'Required to authenticate the provider.', {
        type: 'env',
        secret: true,
        envKey: 'OPENAI_API_KEY',
      }),
      req('billing', 'Active billing', 'The integration usually fails without active billing.', {
        type: 'account',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'How do you want to use OpenAI...', 'single_choice', 'Remote API is the default path.', {
        required: false,
        choices: [choice('api', 'Remote API', 'Recommended and already supported.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Confirm goal', 'Decide whether the focus is chat, code, vision, or agents.', 'guided'),
      step('configure-key', 'Add OPENAI_API_KEY', 'The provider cannot start without the key.', 'manual', 'OPENAI_API_KEY=...'),
      step('doctor', 'Run doctor', 'Validate that the provider is ready.', 'verification', 'npm run integrations:doctor -- --id openai'),
    ],
    safetyNotes: ['Costs vary by model.', 'Avoid sending secrets in free-form prompts unless necessary.'],
    goodFor: ['Chat', 'Code', 'Vision'],
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    aliases: ['minimax-direct', 'minimax-api'],
    summary: 'Native direct connector for the MiniMax OpenAI-compatible API.',
    description: 'Allows MiniMax usage without routing through an intermediate gateway while preserving the main provider profile.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['provider', 'minimax', 'coding', 'agents'],
    modes: [mode('api', 'Remote API', 'Uses MINIMAX_API_KEY with an OpenAI-compatible endpoint.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'agents'],
    binding: {
      kind: 'provider',
      key: 'minimax',
      status: 'ready',
      summary: 'Optional native provider for direct MiniMax access.',
    },
    requirements: [
      req('minimax_api_key', 'MiniMax key', 'Required to authenticate the direct provider.', {
        type: 'env',
        secret: true,
        envKey: 'MINIMAX_API_KEY',
      }),
      req('minimax_model', 'MiniMax model', 'The recommended default is MiniMax-M2.7.', {
        type: 'manual',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'How do you want to use MiniMax...', 'single_choice', 'Direct remote API is the supported path today.', {
        required: false,
        choices: [choice('api', 'Remote API', 'Recommended for direct MiniMax usage.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Define the MiniMax role', 'Choose whether it is a complementary provider or the primary provider for specific tasks.', 'guided'),
      step('configure-key', 'Add MINIMAX_API_KEY', 'The direct provider cannot activate without the key.', 'manual', 'MINIMAX_API_KEY=...'),
      step('doctor', 'Run doctor', 'Confirm that the key and binding are ready.', 'verification', 'npm run integrations:doctor -- --id minimax'),
    ],
    safetyNotes: ['Use direct MiniMax access when you want fewer intermediate routing dependencies.'],
    goodFor: ['Coding', 'Agentic tasks', 'Direct API use'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    aliases: ['router'],
    summary: 'Native gateway for many remote models through a single entry point.',
    description: 'Already available in Zavorth and useful for testing many models with less setup friction.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['provider', 'gateway', 'routing'],
    modes: [mode('api', 'Remote API', 'Uses OPENROUTER_API_KEY.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'agents', 'search'],
    binding: {
      kind: 'provider',
      key: 'openrouter',
      status: 'ready',
      summary: 'Native provider already embedded in the runtime.',
    },
    requirements: [
      req('openrouter_api_key', 'OpenRouter key', 'Required for authentication.', {
        type: 'env',
        secret: true,
        envKey: 'OPENROUTER_API_KEY',
      }),
      req('model_strategy', 'Model strategy', 'You will likely want to choose a default profile.', {
        type: 'manual',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'How do you want to use OpenRouter...', 'single_choice', 'Remote API is the default path.', {
        required: false,
        choices: [choice('api', 'Remote API', 'Recommended and already supported.')],
      }),
      commonCapabilityQuestion,
      question('routing_goal', 'What is the main use case...', 'single_choice', 'This helps Zavorth suggest a profile.', {
        required: false,
        choices: [
          choice('balanced', 'General use', 'Balances chat, code, and research.'),
          choice('research', 'Research', 'Prioritizes depth and evidence.'),
          choice('code', 'Code', 'Focused on review and implementation.'),
        ],
      }),
    ],
    installSteps: [
      step('review', 'Choose gateway role', 'Decide whether it will be primary or complementary.', 'guided'),
      step('configure-key', 'Add OPENROUTER_API_KEY', 'The provider cannot activate without the key.', 'manual', 'OPENROUTER_API_KEY=...'),
      step('doctor', 'Run doctor', 'Confirm that the key and binding are ready.', 'verification', 'npm run integrations:doctor -- --id openrouter'),
    ],
    safetyNotes: ['Start with a small set of enabled models to keep behavior predictable.'],
    goodFor: ['Model comparison', 'Flexible routing', 'Research'],
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    aliases: ['open-code'],
    summary: 'Native connector for the OpenCode provider already supported by Zavorth.',
    description: 'Useful for expanding code-focused provider options without adding another sidecar.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['provider', 'code', 'api'],
    modes: [mode('api', 'Remote API', 'Uses OPENCODE_API_KEY.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'agents'],
    binding: {
      kind: 'provider',
      key: 'opencode',
      status: 'ready',
      summary: 'Native provider already available.',
    },
    requirements: [
      req('opencode_api_key', 'OpenCode key', 'Required to authenticate the provider.', {
        type: 'env',
        secret: true,
        envKey: 'OPENCODE_API_KEY',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'How do you want to use OpenCode...', 'single_choice', 'Remote API is the default path.', {
        required: false,
        choices: [choice('api', 'Remote API', 'Recommended and already supported.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('configure-key', 'Add OPENCODE_API_KEY', 'The provider cannot activate without the key.', 'manual', 'OPENCODE_API_KEY=...'),
      step('doctor', 'Run doctor', 'Confirm that the provider is ready.', 'verification', 'npm run integrations:doctor -- --id opencode'),
    ],
    safetyNotes: ['As with any remote API, review the type of data you send.'],
    goodFor: ['Code', 'Provider fallback'],
  },
  {
    id: 'copilot',
    label: 'Microsoft Copilot',
    aliases: ['microsoft-copilot', 'github-copilot'],
    summary: 'Experimental recipe for connecting to Copilot ecosystems.',
    description: 'Zavorth does not have a production-native binding yet, but the hub can guide onboarding.',
    supportLevel: 'experimental',
    category: 'remote',
    tags: ['copilot', 'experimental', 'browser'],
    modes: [
      mode('browser', 'Assisted browser', 'Experimental flow guided through browser navigation.'),
      mode('mcp', 'MCP connector', 'For use when a trusted MCP adapter is available.'),
      mode('api', 'Official API', 'Only when a stable supported endpoint exists.'),
    ],
    defaultMode: 'browser',
    capabilities: ['chat', 'code', 'agents'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'There is no production-native binding yet.',
    },
    requirements: [
      req('official_access', 'Official access', 'Zavorth only uses permitted and legitimate flows.', {
        type: 'account',
      }),
      req('supported_recipe', 'Supported recipe', 'Without an official recipe, the integration stays exploratory.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Which path should be tried first...', 'single_choice', 'Assisted browser mode is usually the least invasive path.', {
        required: false,
        choices: [
          choice('browser', 'Assisted browser', 'Useful when access exists but no integrated API is available yet.'),
          choice('mcp', 'MCP connector', 'Best when a trusted adapter becomes available.'),
          choice('api', 'Official API', 'Choose this only when you know the endpoint exists.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Confirm access path', 'Identify whether the integration will use browser, MCP, or API access.', 'guided'),
      step('recipe', 'Apply supported recipe', 'Follow only truly supported flows.', 'manual'),
      step('doctor', 'Run doctor', 'Evaluate whether the integration is at least partially operational.', 'verification', 'npm run integrations:doctor -- --id copilot'),
    ],
    safetyNotes: [
      'Zavorth does not bypass CAPTCHA, 2FA, or proprietary access controls.',
      'Experimental integration: do not assume full compatibility.',
    ],
    goodFor: ['Benchmarking', 'Future connector planning'],
  },
];
