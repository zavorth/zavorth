import type { DiscordCommandExposure } from './DiscordSurfacePolicyService.js';
import { tService } from '../i18n/services.js';

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
    description: tService('contract.help_description'),
  },
  {
    commandType: '/commands',
    surfaceCommand: '/commands',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'commands',
    discordSlashVisibility: 'public',
    description: tService('contract.commands_description'),
    options: [
      {
        type: 'string',
        name: 'input',
        description: tService('contract.commands_input_description'),
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
    description: tService('contract.status_description'),
  },
  {
    commandType: '/changes',
    surfaceCommand: '/changes',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'changes',
    discordSlashVisibility: 'operator',
    description: tService('contract.changes_description'),
  },
  {
    commandType: '/selfupdate',
    surfaceCommand: '/reload',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'reload',
    discordSlashVisibility: 'operator',
    description: tService('contract.selfupdate_description'),
    options: [
      {
        type: 'boolean',
        name: 'force',
        description: tService('contract.selfupdate_force_description'),
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
    description: tService('contract.autorepair_description'),
    options: [
      {
        type: 'string',
        name: 'mode',
        description: tService('contract.autorepair_mode_description'),
        required: false,
        choices: [
          { name: tService('contract.choice_run'), value: 'run' },
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
    description: tService('contract.task_description'),
    options: [
      {
        type: 'string',
        name: 'input',
        description: tService('contract.task_input_description'),
        required: true,
      },
      {
        type: 'attachment',
        name: 'attachment',
        description: tService('contract.task_attachment_description'),
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
    description: tService('contract.auto_description'),
    options: [
      {
        type: 'string',
        name: 'input',
        description: tService('contract.auto_input_description'),
        required: true,
      },
      {
        type: 'attachment',
        name: 'attachment',
        description: tService('contract.auto_attachment_description'),
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
    description: tService('contract.plan_description'),
    options: [
      {
        type: 'string',
        name: 'input',
        description: tService('contract.plan_input_description'),
        required: true,
      },
      {
        type: 'attachment',
        name: 'attachment',
        description: tService('contract.plan_attachment_description'),
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
    description: tService('contract.workflow_description'),
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
        description: tService('contract.workflow_input_description'),
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
    description: tService('contract.models_description'),
  },
  {
    commandType: '/codexremote',
    surfaceCommand: '/codexremote',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.codexremote_description'),
  },
  {
    commandType: '/agmobile',
    surfaceCommand: '/agmobile',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.agmobile_description'),
  },
  {
    commandType: '/AIGateway',
    surfaceCommand: '/AIGateway',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.aigateway_description'),
  },
  {
    commandType: '/learning',
    surfaceCommand: '/learning',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.learning_description'),
  },
  {
    commandType: '/memory',
    surfaceCommand: '/memory',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.memory_description'),
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
    commandType: '/learn-skill',
    surfaceCommand: '/learn-skill',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'learn-skill',
    discordSlashVisibility: 'operator',
    description: tService('contract.learnskill_description'),
    options: [
      {
        type: 'string',
        name: 'source',
        description: tService('contract.learnskill_source_description'),
        required: true,
      },
    ],
  },
  {
    commandType: '/model',
    surfaceCommand: '/model',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'model',
    discordSlashVisibility: 'operator',
    description: tService('contract.model_description'),
    options: [
      {
        type: 'string',
        name: 'name',
        description: tService('contract.model_name_description'),
        required: true,
      },
      {
        type: 'string',
        name: 'provider',
        description: tService('contract.model_provider_description'),
        required: false,
      },
    ],
  },
  {
    commandType: '/export',
    surfaceCommand: '/export',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'export',
    discordSlashVisibility: 'operator',
    description: tService('contract.export_description'),
    options: [
      {
        type: 'string',
        name: 'format',
        description: 'markdown | html | prompt',
        required: false,
      },
    ],
  },
  {
    commandType: '/consensus',
    surfaceCommand: '/consensus',
    handler: 'shared-service',
    fallbackVisible: true,
    discordSlashName: 'consensus',
    discordSlashVisibility: 'operator',
    description:
      'Multi-model consensus using only your models (preview/status free; run opts into cost). Same as: zavorth consensus',
    options: [
      {
        type: 'string',
        name: 'input',
        description: 'preview | status | run <question> | save-profile --reviewer p:m ...',
        required: false,
      },
    ],
  },
  {
    commandType: '/skills',
    surfaceCommand: '/skills',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashName: 'skills',
    discordSlashVisibility: 'operator',
    description: tService('contract.skills_description'),
    options: [
      {
        type: 'string',
        name: 'input',
        description: tService('contract.skills_input_description'),
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
    description: tService('contract.agents_description'),
    options: [
      {
        type: 'string',
        name: 'input',
        description: tService('contract.agents_input_description'),
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
    description: tService('contract.vision_description'),
    options: [
      {
        type: 'string',
        name: 'input',
        description: tService('contract.vision_input_description'),
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
    description: tService('contract.computer_description'),
    options: [
      {
        type: 'string',
        name: 'input',
        description: tService('contract.computer_input_description'),
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
    description: tService('contract.device_description'),
    options: [
      {
        type: 'string',
        name: 'input',
        description: tService('contract.device_input_description'),
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
    description: tService('contract.invoke_description'),
    options: [
      {
        type: 'string',
        name: 'input',
        description: tService('contract.invoke_input_description'),
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
    description: tService('contract.trust_description'),
  },
  {
    commandType: '/access',
    surfaceCommand: '/access',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.access_description'),
  },
  {
    commandType: '/bootstrap',
    surfaceCommand: '/bootstrap',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.bootstrap_description'),
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
    description: tService('contract.hub_description'),
  },
  {
    commandType: '/evals',
    surfaceCommand: '/evals',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.evals_description'),
  },
  {
    commandType: '/qa',
    surfaceCommand: '/qa',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.qa_description'),
  },
  {
    commandType: '/governance',
    surfaceCommand: '/governance',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.governance_description'),
  },
  {
    commandType: '/replayloop',
    surfaceCommand: '/replayloop',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.replayloop_description'),
  },
  {
    commandType: '/ecosystem',
    surfaceCommand: '/ecosystem',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.ecosystem_description'),
  },
  {
    commandType: '/fleet',
    surfaceCommand: '/fleet',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.fleet_description'),
  },
  {
    commandType: '/stability',
    surfaceCommand: '/stability',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.stability_description'),
  },
  {
    commandType: '/rolloutqa',
    surfaceCommand: '/rolloutqa',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.rolloutqa_description'),
  },
  {
    commandType: '/setupagent',
    surfaceCommand: '/setupagent',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.setupagent_description'),
  },
  {
    commandType: '/automations',
    surfaceCommand: '/automations',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.automations_description'),
  },
  {
    commandType: '/schedule',
    surfaceCommand: '/schedule',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.schedule_description'),
  },
  {
    commandType: '/schedules',
    surfaceCommand: '/schedules',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.schedules_description'),
  },
  {
    commandType: '/unschedule',
    surfaceCommand: '/unschedule',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.unschedule_description'),
  },
  {
    commandType: '/report',
    surfaceCommand: '/report',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.report_description'),
  },
  {
    commandType: '/watchmode',
    surfaceCommand: '/watchmode',
    handler: 'shared-service',
    fallbackVisible: false,
    discordSlashVisibility: 'none',
    description: tService('contract.watchmode_description'),
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
    return `${commands[0]} ${tService('contract.or_connector')} ${commands[1]}`;
  }

  return `${commands.slice(0, -1).join(', ')} ${tService('contract.or_connector')} ${commands[commands.length - 1]}`;
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
  const normalizedPlatform = String(platform || '').trim() || tService('contract.this_surface');
  return tService('contract.command_unavailable', { commands: formatCommandList(commands), platform: normalizedPlatform });
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
