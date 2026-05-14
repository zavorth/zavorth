export type ProductQualityCheckStatus = 'pass' | 'warn' | 'fail';

export type ProductQualityCommandFamily =
  | 'first-run'
  | 'work'
  | 'operations'
  | 'capabilities'
  | 'memory'
  | 'release'
  | 'advanced';

export type ProductQualityCommandSpec = {
  command: string;
  family: ProductQualityCommandFamily;
  summary: string;
  localAlias?: string;
  jsonExample?: string;
};

export type ProductQualityDocSpec = {
  path: string;
  label: string;
  requiredPhrases: string[];
  advancedPhrase?: string;
};

export type ProductQualityRule = {
  id: string;
  title: string;
  description: string;
  severity: 'blocking' | 'warning';
};

export type ProductQualityCheck = {
  id: string;
  title: string;
  status: ProductQualityCheckStatus;
  reason: string;
  path?: string;
  evidence?: string[];
};

export type ProductQualityContractSnapshot = {
  phase: '39';
  surface: 'product-quality-contract';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  officialJourney: string[];
  commandSpecs: ProductQualityCommandSpec[];
  rules: ProductQualityRule[];
  checks: ProductQualityCheck[];
  nextRecommendedPhase: {
    phase: '41';
    title: string;
    reason: string;
  };
};

export const PRODUCT_QUALITY_OFFICIAL_JOURNEY = [
  'zavorth setup',
  'zavorth go',
  'zavorth chat',
  'zavorth status',
  'zavorth doctor',
] as const;

export const PRODUCT_QUALITY_COMMANDS: ProductQualityCommandSpec[] = [
  {
    command: 'zavorth setup',
    family: 'first-run',
    summary: 'prepara perfil, provider, host e acesso inicial',
    localAlias: 'onboard',
  },
  {
    command: 'zavorth go',
    family: 'first-run',
    summary: 'sobe o runtime supervisionado e abre a melhor superficie',
    localAlias: 'go',
  },
  {
    command: 'zavorth chat',
    family: 'work',
    summary: 'abre o terminal conversacional oficial',
    localAlias: 'chat',
  },
  {
    command: 'zavorth run "<pedido>"',
    family: 'work',
    summary: 'envia um pedido unico em linguagem natural',
  },
  {
    command: 'zavorth continue',
    family: 'work',
    summary: 'retoma o trabalho atual sem slash command',
  },
  {
    command: 'zavorth status',
    family: 'operations',
    summary: 'mostra a leitura curta do momento',
    localAlias: 'status',
    jsonExample: 'zavorth status --json',
  },
  {
    command: 'zavorth doctor',
    family: 'operations',
    summary: 'mostra bloqueios e proximo passo claro',
    localAlias: 'doctor',
    jsonExample: 'zavorth doctor --json',
  },
  {
    command: 'zavorth cockpit',
    family: 'operations',
    summary: 'consolida status, doctor, brief, tarefas e artefatos',
    localAlias: 'cockpit',
    jsonExample: 'zavorth cockpit --json',
  },
  {
    command: 'zavorth capabilities list',
    family: 'capabilities',
    summary: 'mostra capabilities, risco, permissao, MCP allowlist e fallback',
    localAlias: 'capabilities',
    jsonExample: 'zavorth capabilities list --json',
  },
  {
    command: 'zavorth tasks',
    family: 'capabilities',
    summary: 'mostra o Task OS com estados formais',
    localAlias: 'tasks',
    jsonExample: 'zavorth tasks --json',
  },
  {
    command: 'zavorth artifacts task latest',
    family: 'capabilities',
    summary: 'lista artefatos persistidos por task',
    localAlias: 'artifacts',
    jsonExample: 'zavorth artifacts task latest --json',
  },
  {
    command: 'zavorth supervisor plan "<pedido>"',
    family: 'capabilities',
    summary: 'monta uma DAG supervisionada quando a tarefa justificar',
    localAlias: 'supervisor',
    jsonExample: 'zavorth supervisor plan "corrija um bug" --json',
  },
  {
    command: 'zavorth memory review',
    family: 'memory',
    summary: 'mostra memorias aprendidas, retencao e acoes de correcao',
    localAlias: 'memory:review',
    jsonExample: 'zavorth memory review --json',
  },
  {
    command: 'zavorth heal --preview',
    family: 'operations',
    summary: 'mostra plano de recuperacao sem executar',
    localAlias: 'heal',
    jsonExample: 'zavorth heal --preview --json',
  },
  {
    command: 'zavorth release status',
    family: 'release',
    summary: 'mostra canal, versao, risco, rollback e presenca remota',
    localAlias: 'release:status',
    jsonExample: 'zavorth release status --json',
  },
  {
    command: 'zavorth nodes',
    family: 'advanced',
    summary: 'mostra companions e devices sem inventario bruto',
  },
  {
    command: 'zavorth plugins list',
    family: 'advanced',
    summary: 'mostra plugins, skills, MCPs, colecoes e recipes em formato compacto',
  },
];

export const PRODUCT_QUALITY_DOCS: ProductQualityDocSpec[] = [
  {
    path: 'README.md',
    label: 'README principal',
    requiredPhrases: [
      'Primeiro Uso Em 60 Segundos',
      'zavorth setup',
      'zavorth go',
      'zavorth chat',
      'zavorth doctor',
      '--json',
    ],
    advancedPhrase: 'Trilha Avancada E De Manutencao',
  },
  {
    path: 'docs/02-quickstart.md',
    label: 'Quickstart',
    requiredPhrases: [
      'zavorth setup',
      'zavorth go',
      'zavorth chat',
      'zavorth doctor',
      '--json',
    ],
  },
  {
    path: 'docs/34-zavorth-cli.md',
    label: 'CLI canonica',
    requiredPhrases: [
      'Caminho Feliz',
      'Saida Humana Vs JSON',
      'Checklist De Qualidade Da CLI',
      'zavorth setup',
      'zavorth go',
      'zavorth chat',
      'zavorth doctor',
    ],
  },
  {
    path: 'docs/69-cli-ux-diagnosis.md',
    label: 'Diagnostico de UX da CLI',
    requiredPhrases: [
      'uma trilha oficial curta',
      'zavorth setup',
      'zavorth go',
      'zavorth chat',
      'Checklist de aceitacao da fase CLI',
    ],
  },
];

export const PRODUCT_QUALITY_RULES: ProductQualityRule[] = [
  {
    id: 'journey-first',
    title: 'Jornada oficial primeiro',
    description: 'README e quickstart devem apresentar setup -> go -> chat antes de scripts internos.',
    severity: 'blocking',
  },
  {
    id: 'human-output',
    title: 'Saida humana curta',
    description: 'A primeira camada humana deve mostrar estado, bloqueio e proxima acao sem inventario bruto.',
    severity: 'blocking',
  },
  {
    id: 'json-clean',
    title: 'JSON limpo',
    description: 'Com --json, comandos oficiais devem imprimir somente JSON parseavel.',
    severity: 'blocking',
  },
  {
    id: 'advanced-lane',
    title: 'Trilha avancada rotulada',
    description: 'npm run ops:*, cli:fast e scripts internos devem aparecer como manutencao/desenvolvimento.',
    severity: 'warning',
  },
  {
    id: 'first-layer-noise',
    title: 'Sem ruido tecnico na primeira camada',
    description: 'Termos como sessionId, chatId, control plane, stack trace e npm run ops nao podem dominar a UX humana.',
    severity: 'blocking',
  },
];
