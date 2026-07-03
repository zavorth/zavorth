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
  phase: '40';
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
  nextRecommendedPhase: {
    phase: '43';
    title: string;
    reason: string;
  };
};

export const WEB_APP_POLISH_REQUIREMENTS: WebAppPolishRequirementSpec[] = [
  {
    id: 'canonical-control-entry',
    title: 'entrada canonica /zavorthControl',
    asset: 'html',
    requiredMarkers: [
      'id="canonical-surface-banner"',
      'ZavorthControl canonica',
      '/zavorthControl e a entrada web principal',
    ],
    reason: 'a web/app precisa apontar para a superficie canonica e deixar /app e /classic fora da superficie publica.',
  },
  {
    id: 'product-command-rail',
    title: 'trilha oficial da CLI na web',
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
    reason: 'a ZavorthControl deve carregar a mesma jornada canonica da CLI.',
  },
  {
    id: 'operator-cockpit',
    title: 'cockpit do operador',
    asset: 'html',
    requiredMarkers: [
      'id="operator-cockpit-card"',
      'id="cockpit-runtime-card"',
      'id="cockpit-approvals-card"',
      'id="cockpit-health-card"',
      'id="operator-action-rail"',
    ],
    reason: 'o operador precisa de uma leitura rapida antes de abrir detalhes.',
  },
  {
    id: 'session-workspace',
    title: 'workspace operacional da sessao',
    asset: 'html',
    requiredMarkers: [
      'id="session-workspace-card"',
      'id="session-workspace-approvals-card"',
      'id="session-workspace-diffs-card"',
      'id="session-workspace-resources-card"',
      'id="session-workspace-health-card"',
    ],
    reason: 'approvals, diffs, recursos e health precisam aparecer juntos no fluxo de sessao.',
  },
  {
    id: 'artifact-replay-memory',
    title: 'artifacts, replay e memoria',
    asset: 'html',
    requiredMarkers: [
      'id="session-workspace-replay-card"',
      'id="session-workspace-tools-card"',
      'id="learning-memory-card"',
      'id="memory-layered-search-action"',
      'id="replay-learning-control-plane-card"',
    ],
    reason: 'runs longos precisam ser recuperaveis, auditaveis e conectados a memoria.',
  },
  {
    id: 'doctor-next-actions',
    title: 'doctor visual e proximas acoes',
    asset: 'html',
    requiredMarkers: [
      'id="priority-next-steps"',
      'id="session-workspace-health"',
      'id="ops-quality-details"',
      'id="qa-control-plane-card"',
      'Copiar doctor',
    ],
    reason: 'a web/app deve explicar o proximo passo sem depender do terminal.',
  },
  {
    id: 'protected-empty-states',
    title: 'estados vazios protegidos',
    asset: 'html',
    requiredMarkers: [
      'Valide o token para',
      'Valide o token para revisar',
      'Valide o token para carregar',
      'Valide o token para ver',
    ],
    reason: 'telas autenticadas precisam indicar estado vazio e caminho de liberacao.',
  },
  {
    id: 'rendering-refresh-loop',
    title: 'renderizacao e refresh dos paineis',
    asset: 'script',
    requiredMarkers: [
      'function renderOperatorCockpit',
      'function renderSessionWorkspace',
      'function renderLearningMemory',
      'function renderList',
      'renderRuntimeStabilityControlPlanePanel',
    ],
    reason: 'o shell precisa atualizar cockpit, workspace, memoria e estabilidade sem reload manual.',
  },
  {
    id: 'interactive-actions',
    title: 'acoes interativas seguras',
    asset: 'script',
    requiredMarkers: [
      '[data-copy]',
      'requestGatewayControlSocket',
      'runSessionWorkspaceApprovalAction',
      'runLayeredMemorySearch',
      'runPriorityPrimaryAction',
    ],
    reason: 'copiar comandos, aprovar, buscar memoria e executar o proximo passo devem ser interativos.',
  },
  {
    id: 'responsive-scannable-layout',
    title: 'layout responsivo e escaneavel',
    asset: 'styles',
    requiredMarkers: [
      'grid-template-columns: repeat(auto-fit',
      '.ops-summary-grid',
      '.action-row',
      '@media (max-width: 640px)',
      'flex-wrap: wrap',
    ],
    reason: 'cards, acoes e grids precisam se manter legiveis em desktop e mobile.',
  },
];

export const WEB_APP_POLISH_PACKAGE_SCRIPTS = [
  'web-surface:check',
  'test:web:qa',
  'test:web:smoke',
  'qa:web-app-polish',
  'qa:phase:40',
] as const;

export const WEB_APP_POLISH_CONTRACTS = [
  'A entrada web canonica e /zavorthControl; /app e /classic foram removidas da superficie publica.',
  'A web/app precisa expor a mesma jornada canonica da CLI: onboard, go, chat, status e doctor.',
  'Approvals, diffs, artifacts, memoria, recursos e health precisam estar no mesmo workspace operacional.',
  'Estados vazios autenticados devem explicar o caminho de liberacao sem stack trace ou inventario bruto.',
  'O gate da Etapa 40 valida fonte estatica e nao inicia servidor persistente.',
];
