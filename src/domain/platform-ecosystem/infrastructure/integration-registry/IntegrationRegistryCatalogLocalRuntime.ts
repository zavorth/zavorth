import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { capabilityChoices, commonCapabilityQuestion, choice, mode, question, req, step } from './IntegrationRegistryCatalogShared.js';

export const INTEGRATION_LOCAL_RUNTIME_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'AIGateway',
    label: 'AIGateway',
    aliases: ['ai-gateway-local'],
    summary: 'local-first gateway already integrated with Zavorth.',
    description: 'Runs as a local sidecar and talks directly to the Zavorth runtime.',
    supportLevel: 'native',
    category: 'local',
    tags: ['provider', 'sidecar', 'local-first'],
    modes: [
      mode('cli', 'local worktree', 'Uses the sidecar already vendored with Zavorth.', true),
      mode('docker', 'local container', 'Future option for stronger isolation.', false),
    ],
    defaultMode: 'cli',
    capabilities: ['chat', 'code', 'agents', 'automation'],
    binding: {
      kind: 'provider',
      key: 'AIGateway',
      status: 'ready',
      summary: 'Provider and sidecar are already supported.',
    },
    requirements: [
      req('vendor', 'AIGateway vendor present', 'The local sidecar worktree must exist.', {
        type: 'binary',
      }),
      req('upstream_key', 'Upstream credential', 'Depending on your configuration, the gateway may need a backing provider key.', {
        type: 'env',
        secret: true,
        envKey: 'AIGateway_API_KEY',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'How do you want to run AIGateway...', 'single_choice', 'The local worktree is the default Zavorth flow.', {
        required: false,
        choices: [
          choice('cli', 'local worktree', 'Recommended: use the current sidecar.'),
          choice('docker', 'local container', 'Planned for stronger isolation.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Check sidecar', 'Confirm whether the sidecar exists and should stay warm.', 'guided'),
      step('bootstrap', 'Check sidecar status', 'Validate dependencies and sidecar state.', 'verification', 'npm run sidecars:status'),
      step('doctor', 'Run doctor', 'Confirm the gateway is routable.', 'verification', 'npm run integrations:doctor -- --id AIGateway'),
    ],
    safetyNotes: ['local-first execution improves sovereignty and latency.'],
    goodFor: ['Primary gateway', 'Low latency', 'local sovereignty'],
  },
  {
    id: 'zavorth-terminal',
    label: 'ZavorthBridge Remote',
    aliases: ['zavorth-bridge-remote', 'zavorth-terminal', 'agremote', 'omni-zavorth-bridge-remote-chat'],
    summary: 'Official ZavorthBridge remote sidecar, vendored and operated by Zavorth.',
    description: 'Exposes the ZavorthBridge remote UI through a local sidecar with its own doctor, remote mode, and safe playbook.',
    supportLevel: 'native',
    category: 'local',
    tags: ['zavorthBridge', 'remote-ui', 'sidecar', 'mobile'],
    modes: [
      mode('cli', 'local worktree', 'Uses the vendored worktree and official remote sidecar.', true),
      mode('browser', 'Remote UI', 'Uses the protected ZavorthBridge remote interface.', false),
    ],
    defaultMode: 'cli',
    capabilities: ['browser', 'vision', 'automation'],
    binding: {
      kind: 'service',
      key: 'zavorth-terminal',
      status: 'ready',
      summary: 'The ZavorthBridge remote sidecar and doctor are known to the runtime.',
    },
    requirements: [
      req('vendor', 'ZavorthBridge Remote vendor present', 'The local sidecar worktree must exist.', {
        type: 'binary',
      }),
      req('app_password', 'Remote app password', 'Protects web access to the remote sidecar.', {
        type: 'env',
        secret: true,
        envKey: 'ZAVORTH_BRIDGE_REMOTE_APP_PASSWORD',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'How do you want to operate ZavorthBridge Remote...', 'single_choice', 'The local worktree is the recommended default flow.', {
        required: false,
        choices: [
          choice('cli', 'local worktree', 'Recommended: use the vendor controlled by Zavorth.'),
          choice('browser', 'Remote UI', 'Open the protected ZavorthBridge remote interface.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Review remote sidecar', 'Confirm whether the remote vendor exists and whether remote mode should stay active.', 'guided'),
      step('bootstrap', 'Check sidecar status', 'Validate dependencies and remote sidecar state.', 'verification', 'npm run sidecars:status'),
      step('doctor', 'Run remote doctor', 'Confirm ZavorthBridge Remote is ready for safe use.', 'verification', 'npm run integrations:doctor -- --id zavorth-terminal'),
    ],
    safetyNotes: [
      'Keep the remote app password out of chats, logs, and Git.',
      'Expose the remote UI only on networks and surfaces you control.',
      'Diagnose first and repair second; the Zavorth doctor understands this flow.',
    ],
    goodFor: ['Remote ZavorthBridge access', 'Mobile control', 'Recovery playbooks'],
  },
  {
    id: 'external-executor',
    label: 'External Executor',
    aliases: ['external_executor', 'external-runner', 'local-agent-bridge', 'agent-bridge'],
    summary: 'local or WSL executor already supported by Zavorth for code and agents.',
    description: 'The hub treats it as a local connector focused on review, execution, and orchestration.',
    supportLevel: 'native',
    category: 'local',
    tags: ['executor', 'wsl', 'code'],
    modes: [
      mode('cli', 'local or WSL CLI', 'Uses the executor already embedded in Zavorth.', true),
      mode('docker', 'local container', 'Planned for additional isolation.', false),
    ],
    defaultMode: 'cli',
    capabilities: ['code', 'agents', 'automation'],
    binding: {
      kind: 'executor',
      key: 'external_executor',
      status: 'ready',
      summary: 'local executor is already present in the gateway.',
    },
    requirements: [
      req('external_executor_cli', 'External executor CLI available', 'Zavorth must be able to call the CLI.', {
        type: 'binary',
      }),
      req('workspace_binding', 'Authorized workspace', 'The external executor may require an explicit workspace binding.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'How do you want to run the external executor...', 'single_choice', 'Zavorth already works well with the local or WSL CLI.', {
        required: false,
        choices: [
          choice('cli', 'local or WSL CLI', 'Recommended.'),
          choice('docker', 'local container', 'Planned for later.'),
        ],
      }),
      question('capabilities', 'Which capabilities should be prioritized...', 'multi_choice', 'This bridge is most useful for code and automation.', {
        required: false,
        choices: capabilityChoices.filter((entry) => ['code', 'agents', 'automation'].includes(entry.value)),
      }),
    ],
    installSteps: [
      step('review', 'Confirm transport', 'Decide whether the CLI will run in WSL or directly on the host.', 'guided'),
      step('doctor', 'Run doctor', 'Validate CLI access, binding, and workspace state.', 'verification', 'npm run integrations:doctor -- --id external-executor'),
    ],
    safetyNotes: ['As a local executor, it must follow Zavorth permission policies.'],
    goodFor: ['Code review', 'local execution', 'Autonomous flows'],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    aliases: ['local-llm'],
    summary: 'local recipe for running models on the host with a focus on sovereignty.',
    description: 'Zavorth does not have a native Ollama provider yet, but it can guide installation and health checks.',
    supportLevel: 'recipe',
    category: 'local',
    tags: ['local', 'privacy', 'recipe'],
    modes: [
      mode('docker', 'local Docker', 'Recommended for a more isolated start.'),
      mode('cli', 'Native install', 'Best when you want full host control.'),
    ],
    defaultMode: 'docker',
    capabilities: ['chat', 'code'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'The recipe is supported, but automatic binding is still planned.',
    },
    requirements: [
      req('host_resources', 'Host resources', 'local models can consume significant RAM, CPU, and disk.', {
        type: 'manual',
      }),
      req('docker_optional', 'Working Docker install', 'Required only when you choose container mode.', {
        type: 'docker',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'How do you want to install Ollama...', 'single_choice', 'Docker is usually more predictable for the first setup.', {
        required: false,
        choices: [
          choice('docker', 'local Docker', 'Recommended for stronger isolation.'),
          choice('cli', 'Native install', 'Choose this when you want full host control.'),
        ],
      }),
      question('model_family', 'Which local model profile should come first...', 'single_choice', 'This helps estimate host requirements.', {
        required: false,
        choices: [
          choice('small', 'Lightweight', 'Simpler for modest hosts.'),
          choice('coding', 'Coding', 'Better for local review and implementation.'),
          choice('general', 'General use', 'Balanced for chat and reasoning.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Review host capacity', 'Confirm that the host can run a local LLM without hurting the rest of the system.', 'guided'),
      step('install', 'Install Ollama', 'Run the selected native or Docker recipe.', 'manual'),
      step('doctor', 'Run doctor', 'Validate that the installation actually came online.', 'verification', 'npm run integrations:doctor -- --id ollama'),
    ],
    safetyNotes: ['local models can compete with Zavorth for host resources.'],
    goodFor: ['Maximum privacy', 'local sovereignty', 'Offline use'],
  },
];
