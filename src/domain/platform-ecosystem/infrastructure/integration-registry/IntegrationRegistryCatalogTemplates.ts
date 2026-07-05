import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { commonCapabilityQuestion, mode, question, req, step } from './IntegrationRegistryCatalogShared.js';

export const INTEGRATION_TEMPLATE_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'custom-api',
    label: 'Custom API connector',
    aliases: ['api-template'],
    summary: 'Template for services with an official API that do not have a native connector yet.',
    description: 'The cleanest path for new remote services with their own documentation.',
    supportLevel: 'template',
    category: 'template',
    tags: ['template', 'api', 'custom'],
    modes: [mode('api', 'Remote API', 'Generic template for new HTTP-based connectors.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'browser', 'agents'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Template awaiting a specific implementation.',
    },
    requirements: [
      req('api_docs', 'Official documentation', 'Without reliable docs, the connector should not be automated.', {
        type: 'manual',
      }),
      req('credential', 'Official credential', 'A legitimate key, token, or OAuth credential for the service.', {
        type: 'account',
      }),
    ],
    onboardingQuestions: [
      question('service_name', 'What is the service name?', 'text', 'Example: ZeroCloud, NanoCloud, MyHubAI.', {
        placeholder: 'Service name',
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Capture API details', 'List authentication, base URL, and desired capabilities.', 'guided'),
      step('scaffold', 'Create specific recipe', 'Prepare the connector skeleton from this template.', 'manual'),
    ],
    safetyNotes: ['This template does not create a magical integration; it opens a clean path for a real adapter.'],
    goodFor: ['New services with official APIs', 'Custom connectors'],
  },
  {
    id: 'custom-cli',
    label: 'Custom CLI connector',
    aliases: ['cli-template'],
    summary: 'Template for local CLIs or wrappers Zavorth does not know yet.',
    description: 'Good for local agents, terminal tools, and runtimes that expose a stable CLI.',
    supportLevel: 'template',
    category: 'template',
    tags: ['template', 'cli', 'local'],
    modes: [mode('cli', 'Local CLI', 'Template for binary and terminal integration.')],
    defaultMode: 'cli',
    capabilities: ['chat', 'code', 'agents', 'automation'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Template awaiting a specific executor adapter.',
    },
    requirements: [
      req('binary', 'Installed or installable CLI', 'You need to know how to install or locate the binary.', {
        type: 'binary',
      }),
      req('invocation_contract', 'Known invocation contract', 'Without input/output details for the CLI, the adapter remains incomplete.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('service_name', 'Which CLI do you want to connect?', 'text', 'Example: ZeroCloud CLI, MyLocalAssistant.', {
        placeholder: 'CLI name',
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Map the CLI', 'Capture command, arguments, output, and authentication.', 'guided'),
      step('scaffold', 'Prepare adapter', 'Create the execution and healthcheck skeleton.', 'manual'),
    ],
    safetyNotes: ['Validate the CLI in a sandbox or test workspace before releasing it to production.'],
    goodFor: ['Local agents', 'Terminal tools'],
  },
  {
    id: 'custom-docker-agent',
    label: 'Custom Docker connector',
    aliases: ['docker-template', 'nanocloud', 'zerocloud', 'opencloud'],
    summary: 'Template for agents and services you want to install in Docker before connecting them to Zavorth.',
    description: 'The best entry point for ideas such as NanoCloud, ZeroCloud, and custom sidecars.',
    supportLevel: 'template',
    category: 'template',
    tags: ['template', 'docker', 'agent'],
    modes: [mode('docker', 'Local Docker', 'Template for services installed in containers.')],
    defaultMode: 'docker',
    capabilities: ['chat', 'code', 'browser', 'agents', 'automation'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Template awaiting a service-specific manifest.',
    },
    requirements: [
      req('docker', 'Working Docker', 'The host must run Docker without errors.', { type: 'docker' }),
      req('image_recipe', 'Known image or compose file', 'You need to know the service image, port, and variables.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('service_name', 'What is the agent/service name?', 'text', 'Example: ZeroCloud, NanoCloud, MyDockerAgent.', {
        placeholder: 'Service name',
      }),
      question('expose_port', 'Does this service need to expose a local port?', 'boolean', 'If it exposes a local API, Zavorth can monitor it later.', {
        required: false,
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Confirm Docker model', 'Identify whether it is a single container, compose setup, or complex sidecar.', 'guided'),
      step('scaffold', 'Generate Docker recipe', 'Prepare compose, env, and doctor checks for this agent.', 'manual'),
    ],
    safetyNotes: ['Never expose sensitive containers without authentication and a clear scope.'],
    goodFor: ['Container agents', 'New sidecars', 'Local proofs of concept'],
  },
];
