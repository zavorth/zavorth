export type WebAppPolishCheckStatus = 'pass' | 'warn' | 'fail';
export type WebAppPolishAsset = 'html' | 'script' | 'styles' | 'package';

export type WebAppPolishRequirementSpec = {
  id: string;
  title: string;
  asset: WebAppPolishAsset;
  requiredMarkers: string[];
  reason: string;
};

export type WebAppPolishCheck = {
  id: string;
  title: string;
  status: WebAppPolishCheckStatus;
  reason: string;
  asset: WebAppPolishAsset;
  evidence?: string[];
};

export type WebAppPolishSnapshot = {
  gate: 'web-app-polish';
  surface: 'web-app-polish';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
    requirements: number;
  };
  requirements: WebAppPolishRequirementSpec[];
  checks: WebAppPolishCheck[];
  contracts: string[];
  commands: {
    inspect: string;
    json: string;
    gate: string;
    webQa: string;
  };
  nextRecommendedGate: {
    gate: 'artifact-replay';
    title: string;
    reason: string;
  };
};

export const WEB_APP_POLISH_REQUIREMENTS: WebAppPolishRequirementSpec[] = [
  {
    id: 'canonical-control-entry',
    title: 'canonical /zavorthControl entry',
    asset: 'html',
    requiredMarkers: [
      'id="canonical-surface-banner"',
      'Canonical ZavorthControl',
      '/zavorthControl is the main web entry',
    ],
    reason: 'the web/app must point to the canonical surface and keep /app and /classic out of the public surface.',
  },
  {
    id: 'product-command-rail',
    title: 'official CLI path on the web',
    asset: 'html',
    requiredMarkers: [
      'id="product-command-rail-card"',
      'id="product-command-setup"',
      'id="product-command-go"',
      'id="product-command-chat"',
      'id="product-command-status"',
      'id="product-command-doctor"',
      'zavorth setup',
      'zavorth chat',
      'zavorth doctor',
    ],
    reason: 'ZavorthControl must carry the same canonical journey as the CLI.',
  },
  {
    id: 'operator-cockpit',
    title: 'operator cockpit',
    asset: 'html',
    requiredMarkers: [
      'id="operator-cockpit-card"',
      'id="cockpit-runtime-card"',
      'id="cockpit-approvals-card"',
      'id="cockpit-health-card"',
      'id="operator-action-rail"',
    ],
    reason: 'the operator needs a fast read before opening details.',
  },
  {
    id: 'session-workspace',
    title: 'session operational workspace',
    asset: 'html',
    requiredMarkers: [
      'id="session-workspace-card"',
      'id="session-workspace-approvals-card"',
      'id="session-workspace-diffs-card"',
      'id="session-workspace-resources-card"',
      'id="session-workspace-health-card"',
    ],
    reason: 'approvals, diffs, resources, and health must appear together in the session flow.',
  },
  {
    id: 'artifact-replay-memory',
    title: 'artifacts, replay, and memory',
    asset: 'html',
    requiredMarkers: [
      'id="session-workspace-replay-card"',
      'id="session-workspace-tools-card"',
      'id="learning-memory-card"',
      'id="memory-layered-search-action"',
      'id="replay-learning-control-plane-card"',
    ],
    reason: 'long runs must be recoverable, auditable, and connected to memory.',
  },
  {
    id: 'doctor-next-actions',
    title: 'visual doctor and next actions',
    asset: 'html',
    requiredMarkers: [
      'id="priority-next-steps"',
      'id="session-workspace-health"',
      'id="ops-quality-details"',
      'id="qa-control-plane-card"',
      'Copy doctor',
    ],
    reason: 'the web/app must explain the next step without depending on the terminal.',
  },
  {
    id: 'protected-empty-states',
    title: 'protected empty states',
    asset: 'html',
    requiredMarkers: [
      'Validate the token to',
      'Validate the token to review',
      'Validate the token to load',
      'Validate the token to see',
    ],
    reason: 'authenticated screens must indicate empty state and release path.',
  },
  {
    id: 'rendering-refresh-loop',
    title: 'panel rendering and refresh',
    asset: 'script',
    requiredMarkers: [
      'function renderOperatorCockpit',
      'function renderSessionWorkspace',
      'function renderLearningMemory',
      'function renderList',
      'renderRuntimeStabilityControlPlanePanel',
    ],
    reason: 'the shell must update cockpit, workspace, memory, and stability without manual reload.',
  },
  {
    id: 'interactive-actions',
    title: 'safe interactive actions',
    asset: 'script',
    requiredMarkers: [
      '[data-copy]',
      'requestGatewayControlSocket',
      'runSessionWorkspaceApprovalAction',
      'runLayeredMemorySearch',
      'runPriorityPrimaryAction',
    ],
    reason: 'copying commands, approving, searching memory, and executing the next step must be interactive.',
  },
  {
    id: 'responsive-scannable-layout',
    title: 'responsive and scannable layout',
    asset: 'styles',
    requiredMarkers: [
      'grid-template-columns: repeat(auto-fit',
      '.ops-summary-grid',
      '.action-row',
      '@media (max-width: 640px)',
      'flex-wrap: wrap',
    ],
    reason: 'cards, actions, and grids must remain readable on desktop and mobile.',
  },
];

export const WEB_APP_POLISH_PACKAGE_SCRIPTS = [
  'web-surface:check',
  'test:web:qa',
  'test:web:smoke',
  'qa:web-app-polish',
] as const;

export const WEB_APP_POLISH_CONTRACTS = [
  'The canonical web entry is /zavorthControl; /app and /classic were removed from the public surface.',
  'The web/app must expose the same canonical journey as the CLI: onboard, go, chat, status, and doctor.',
  'Approvals, diffs, artifacts, memory, resources, and health must be in the same operational workspace.',
  'Authenticated empty states must explain the release path without stack trace or raw inventory.',
  'Web app polish gate validates static source and does not start a persistent server.',
];
