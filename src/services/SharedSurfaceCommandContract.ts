import type { DiscordCommandExposure } from './DiscordSurfacePolicyService.js';

export type SharedSurfaceCommandHandler = 'dispatcher' | 'shared-service';
export type SharedSurfaceSlashVisibility = 'none' | 'public' | 'operator';
export type SharedSurfaceSlashOptionType = 'string' | 'boolean' | 'attachment';

export type SharedSurfaceSlashOption = {
  type: SharedSurfaceSlashOptionType;
  name: string;
  description: string;
  required?: boolean;
  choices?: Array<{
    name: string;
    value: string;
  }>;
};

export type SharedSurfaceCommandContractEntry = {
  commandType: string;
  surfaceCommand: string;
  handler: SharedSurfaceCommandHandler;
  fallbackVisible: boolean;
  discordSlashName?: string;
  discordSlashVisibility: SharedSurfaceSlashVisibility;
  description?: string;
  options?: SharedSurfaceSlashOption[];
};

const SHARED_SURFACE_COMMAND_CONTRACT: SharedSurfaceCommandContractEntry[] = [
  {
    commandType: '/help',
    surfaceCommand: '/help',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'help',
    discordSlashVisibility: 'public',
    description: 'Resume os comandos compartilhados.',
  },
  {
    commandType: '/commands',
    surfaceCommand: '/commands',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'commands',
    discordSlashVisibility: 'public',
    description: 'Mostra o catalogo de comandos compartilhados por canal.',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'Filtro opcional, por exemplo page 2, channel, model ou operator.',
        required: false,
      },
    ],
  },
  {
    commandType: '/status',
    surfaceCommand: '/status',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'status',
    discordSlashVisibility: 'operator',
    description: 'Mostra a saude do runtime.',
  },
  {
    commandType: '/changes',
    surfaceCommand: '/changes',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'changes',
    discordSlashVisibility: 'operator',
    description: 'Resume mudancas locais e estado do runtime.',
  },
  {
    commandType: '/selfupdate',
    surfaceCommand: '/reload',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'reload',
    discordSlashVisibility: 'operator',
    description: 'Pede um recycle supervisionado.',
    options: [
      {
        type: 'boolean',
        name: 'force',
        description: 'Forca o recycle mesmo sem pendencias detectadas.',
        required: false,
      },
    ],
  },
  {
    commandType: '/autorepair',
    surfaceCommand: '/autorepair',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'autorepair',
    discordSlashVisibility: 'operator',
    description: 'Diagnostica, corrige, valida e religa o Zavorth.',
    options: [
      {
        type: 'string',
        name: 'mode',
        description: 'Escolha entre executar ou apenas ver o ultimo relatorio.',
        required: false,
        choices: [
          { name: 'executar', value: 'run' },
          { name: 'status', value: 'status' },
        ],
      },
    ],
  },
  {
    commandType: '/task',
    surfaceCommand: '/task',
    handler: 'dispatcher',
    fallbackVisible: true,
    discordSlashName: 'task',
    discordSlashVisibility: 'public',
    description: 'Envia um pedido normal para o Zavorth.',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'Pedido ou instrucao.',
        required: true,
      },
      {
        type: 'attachment',
        name: 'attachment',
        description: 'Anexo opcional para contextualizar a tarefa.',
        required: false,
      },
    ],
  },
  {
    commandType: '/auto',
    surfaceCommand: '/auto',
    handler: 'dispatcher',
    fallbackVisible: true,
    discordSlashName: 'auto',
    discordSlashVisibility: 'public',
    description: 'Executa uma automacao guiada.',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'Pedido orientado a automacao.',
        required: true,
      },
      {
        type: 'attachment',
        name: 'attachment',
        description: 'Anexo opcional para a automacao.',
        required: false,
      },
    ],
  },
  {
    commandType: '/plan',
    surfaceCommand: '/plan',
    handler: 'dispatcher',
    fallbackVisible: true,
    discordSlashName: 'plan',
    discordSlashVisibility: 'public',
    description: 'Pede um plano antes de executar.',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'Pedido a ser planejado.',
        required: true,
      },
      {
        type: 'attachment',
        name: 'attachment',
        description: 'Anexo opcional para o plano.',
        required: false,
      },
    ],
  },
  {
    commandType: '/workflow',
    surfaceCommand: '/workflow',
    handler: 'dispatcher',
    fallbackVisible: false,
    discordSlashName: 'workflow',
    discordSlashVisibility: 'operator',
    description: 'Executa um workflow composto ou o loop SDD por feature.',
    options: [
      {
        type: 'string',
        name: 'mode',
        description: 'Workflow alvo.',
        required: true,
        choices: [
          { name: 'review', value: 'review' },
          { name: 'ship', value: 'ship' },
          { name: 'research', value: 'research' },
          { name: 'sdd', value: 'sdd' },
          { name: 'resume', value: 'resume' },
        ],
      },
      {
        type: 'string',
        name: 'input',
        description: 'Objetivo do workflow, feature-id no modo sdd ou workflow-run-id no modo resume.',
        required: true,
      },
    ],
  },
  {
    commandType: '/dryrun',
    surfaceCommand: '/dryrun',
    handler: 'dispatcher',
    fallbackVisible: true,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/models',
    surfaceCommand: '/models',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashName: 'models',
    discordSlashVisibility: 'operator',
    description: 'Resume modelos e providers ativos.',
  },
  {
    commandType: '/codexremote',
    surfaceCommand: '/codexremote',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Opera o control plane remoto do Codex CLI.',
  },
  {
    commandType: '/agmobile',
    surfaceCommand: '/agmobile',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Prepara o ZavorthBridge para uso pelo celular.',
  },
  {
    commandType: '/AIGateway',
    surfaceCommand: '/AIGateway',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Opera a rota propria e o upstream do AIGateway.',
  },
  {
    commandType: '/learning',
    surfaceCommand: '/learning',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra e revisa candidatos aprendidos pelo learning plane.',
  },
  {
    commandType: '/memory',
    surfaceCommand: '/memory',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Consulta a layered memory em camadas.',
  },
  {
    commandType: '/teams',
    surfaceCommand: '/teams',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/tenants',
    surfaceCommand: '/tenants',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/gateway',
    surfaceCommand: '/gateway',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/tools',
    surfaceCommand: '/tools',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/skills',
    surfaceCommand: '/skills',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashName: 'skills',
    discordSlashVisibility: 'operator',
    description: 'Mostra o catalogo de skills e ativa dry-run/live pelo bridge governado.',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'search <consulta>, use <skill>, absorb <path> ou batches.',
        required: false,
      },
    ],
  },
  {
    commandType: '/agents',
    surfaceCommand: '/agents',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashName: 'agents',
    discordSlashVisibility: 'operator',
    description: 'Opera subagentes vivos governados com aliases /subagent e sessions_spawn.',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'spawn <tarefa>, status/history, read latest, summarize latest ou cancel latest.',
        required: false,
      },
    ],
  },
  {
    commandType: '/vision',
    surfaceCommand: '/vision',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashName: 'vision',
    discordSlashVisibility: 'operator',
    description: 'Observa evidencias visuais em modo read-only com redaction e receipts.',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'status, inspect, explain, ocr ou texto visual a analisar.',
        required: false,
      },
    ],
  },
  {
    commandType: '/computer',
    surfaceCommand: '/computer',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashName: 'computer',
    discordSlashVisibility: 'operator',
    description: 'Opera browser e desktop computer control plane governado com preview, hard blocks e approval-first.',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'status, observe, plan, approve, cancel, browser status, browser plan ou browser inspect.',
        required: false,
      },
    ],
  },
  {
    commandType: '/device',
    surfaceCommand: '/device',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashName: 'device',
    discordSlashVisibility: 'operator',
    description: 'Opera Android ADB/device bridge governado com doctor, screenshot, inspect, plan e approval-first.',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'status, android doctor, screenshot, inspect, plan, approve <plan> ou cancel.',
        required: false,
      },
    ],
  },
  {
    commandType: '/invoke',
    surfaceCommand: '/invoke',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashName: 'invoke',
    discordSlashVisibility: 'operator',
    description: 'Roteia linguagem natural para subagentes, skills ou absorcao governada.',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'Pedido natural, por exemplo use subagentes para revisar X.',
        required: true,
      },
    ],
  },
  {
    commandType: '/hooks',
    surfaceCommand: '/hooks',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/runtime',
    surfaceCommand: '/runtime',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/trust',
    surfaceCommand: '/trust',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra e ajusta o Trust Plane oficial do Zavorth.',
  },
  {
    commandType: '/access',
    surfaceCommand: '/access',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra o manifesto oficial de acesso local e remoto.',
  },
  {
    commandType: '/bootstrap',
    surfaceCommand: '/bootstrap',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Resume o checklist oficial de bootstrap e instalacao.',
  },
  {
    commandType: '/transports',
    surfaceCommand: '/transports',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/channels',
    surfaceCommand: '/channels',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/plugins',
    surfaceCommand: '/plugins',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/platform',
    surfaceCommand: '/platform',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/hub',
    surfaceCommand: '/hub',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra o Hub + MCP product plane consolidado.',
  },
  {
    commandType: '/evals',
    surfaceCommand: '/evals',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra a Eval observability com scorecards, traces e historico operacional.',
  },
  {
    commandType: '/qa',
    surfaceCommand: '/qa',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra budgets, smokes, regressions e gates da QA release.',
  },
  {
    commandType: '/governance',
    surfaceCommand: '/governance',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra tenants, trust decisions, allowlists e policy da Governance.',
  },
  {
    commandType: '/replayloop',
    surfaceCommand: '/replayloop',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra replay, artifacts reutilizaveis e learning loop da Replay learning.',
  },
  {
    commandType: '/ecosystem',
    surfaceCommand: '/ecosystem',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra SDKs, guides, publish e receitas publicas da Ecosystem.',
  },
  {
    commandType: '/fleet',
    surfaceCommand: '/fleet',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra channels, fleet, transports e superficies da Distributed runtime.',
  },
  {
    commandType: '/stability',
    surfaceCommand: '/stability',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra keepalive, doctor e recover da fleet supervisionada.',
  },
  {
    commandType: '/rolloutqa',
    surfaceCommand: '/rolloutqa',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra QA persistente, runtime distribuido e readiness de rollout.',
  },
  {
    commandType: '/setupagent',
    surfaceCommand: '/setupagent',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra a leitura oficial da Natural setup para setup natural de canais.',
  },
  {
    commandType: '/automations',
    surfaceCommand: '/automations',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra e opera a Scheduled runs de automacoes e scheduled runs.',
  },
  {
    commandType: '/schedule',
    surfaceCommand: '/schedule',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Cria um preview governado de agendamento recorrente.',
  },
  {
    commandType: '/schedules',
    surfaceCommand: '/schedules',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Lista agendamentos recorrentes com status e guardrails.',
  },
  {
    commandType: '/unschedule',
    surfaceCommand: '/unschedule',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Remove um agendamento governado por ID.',
  },
  {
    commandType: '/report',
    surfaceCommand: '/report',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Cria um preview governado de relatorio recorrente.',
  },
  {
    commandType: '/watchmode',
    surfaceCommand: '/watchmode',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: 'Mostra e ajusta a policy oficial do Watch Mode supervisionado.',
  },
  {
    commandType: '/memoryplane',
    surfaceCommand: '/memoryplane',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/sessions',
    surfaceCommand: '/sessions',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/sessionhistory',
    surfaceCommand: '/sessionhistory',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/sessionsend',
    surfaceCommand: '/sessionsend',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/sessionspawn',
    surfaceCommand: '/sessionspawn',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/nodes',
    surfaceCommand: '/nodes',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/nodepair',
    surfaceCommand: '/nodepair',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/nodeinvoke',
    surfaceCommand: '/nodeinvoke',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/capabilities',
    surfaceCommand: '/capabilities',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/enable',
    surfaceCommand: '/enable',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/disable',
    surfaceCommand: '/disable',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/mode',
    surfaceCommand: '/mode',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/workspace',
    surfaceCommand: '/workspace',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/integrations',
    surfaceCommand: '/integrations',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
  {
    commandType: '/connect',
    surfaceCommand: '/connect',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
  },
];

function normalizeCommandType(commandType: string): string {
  return String(commandType || '').trim().toLowerCase();
}

function formatCommandList(commands: string[]): string {
  if (commands.length <= 1) {
    return commands[0] || '';
  }

  if (commands.length === 2) {
    return `${commands[0]} ou ${commands[1]}`;
  }

  return `${commands.slice(0, -1).join(', ')} ou ${commands[commands.length - 1]}`;
}

export function getSharedSurfaceCommandContract(): SharedSurfaceCommandContractEntry[] {
  return SHARED_SURFACE_COMMAND_CONTRACT.map((entry) => ({
    ...entry,
    options: entry.options ? entry.options.map((option) => ({ ...option })) : undefined,
  }));
}

export function isSharedSurfaceServiceCommandType(commandType: string): boolean {
  const normalized = normalizeCommandType(commandType);
  return SHARED_SURFACE_COMMAND_CONTRACT.some(
    (entry) => entry.handler === 'shared-service' && entry.commandType === normalized,
  );
}

export function isSharedSurfaceDispatcherCommandType(commandType: string): boolean {
  const normalized = normalizeCommandType(commandType);
  return SHARED_SURFACE_COMMAND_CONTRACT.some(
    (entry) => entry.handler === 'dispatcher' && entry.commandType === normalized,
  );
}

export function isSharedSurfaceCommandType(commandType: string, hasSharedService: boolean): boolean {
  if (isSharedSurfaceDispatcherCommandType(commandType)) {
    return true;
  }

  return hasSharedService && isSharedSurfaceServiceCommandType(commandType);
}

export function formatSharedSurfaceUnavailableReply(platform: string): string {
  const commands = SHARED_SURFACE_COMMAND_CONTRACT
    .filter((entry) => entry.fallbackVisible)
    .map((entry) => entry.surfaceCommand);
  const normalizedPlatform = String(platform || '').trim() || 'esta superficie';
  return `Esse comando ainda nao esta disponivel fora do gateway principal. Use ${formatCommandList(commands)} em ${normalizedPlatform}.`;
}

export function getDiscordSlashCommandManifest(options: {
  commandExposure: DiscordCommandExposure;
  publicServerMode: boolean;
}): SharedSurfaceCommandContractEntry[] {
  if (options.commandExposure === 'none') {
    return [];
  }

  return getSharedSurfaceCommandContract().filter((entry) => {
    if (!entry.discordSlashName || entry.discordSlashVisibility === 'none') {
      return false;
    }

    if (options.publicServerMode || options.commandExposure === 'minimal') {
      return entry.discordSlashVisibility === 'public';
    }

    return entry.discordSlashVisibility === 'public' || entry.discordSlashVisibility === 'operator';
  });
}
