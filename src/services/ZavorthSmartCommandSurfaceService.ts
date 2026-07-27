import { SkillCatalogService } from '../skills/SkillCatalogService.js';
import {
  ZAVORTH_SMART_COMMAND_SURFACE_CONTRACT_VERSION,
  type ZavorthSmartCommandId,
  type ZavorthSmartCommandResolution,
  type ZavorthSmartCommandSnapshot,
  type ZavorthSmartCommandStatus,
} from '../contracts/ZavorthSmartCommandSurfaceContract.js';

import type { SkillCatalogEntry } from '../skills/SkillCatalogContract.js';
import { ZavorthProviderModelCatalogService } from './ZavorthProviderModelCatalogService.js';
import type { ZavorthProviderModelCatalogSnapshot } from '../contracts/ZavorthProviderModelCatalogContract.js';
import { logger } from '../logger.js';

export type ZavorthSmartCommandSurfaceInput = {
  rawText?: string | null;
  channel?: string | null;
  sessionId?: string | null;
  apply?: boolean;
  approvalId?: string | null;
};

export type ZavorthSmartCommandSurfaceRuntime = {
  now?: () => Date;
  skillCatalogService?: Pick<SkillCatalogService, 'listEntries'>;
  providerModelCatalogService?: Pick<ZavorthProviderModelCatalogService, 'buildSnapshot'>;
};

type ParsedCommand = {
  id: ZavorthSmartCommandId | null;
  args: string;
};

type CommandContext = {
  raw: string;
  args: string;
  channel: string;
  sessionId: string | null;
  apply: boolean;
  approvalId: string | null;
  skills: SkillCatalogEntry[];
  providers: ZavorthProviderModelCatalogSnapshot | null;
};

const SMART_COMMANDS: ZavorthSmartCommandResolution[] = [
  {
    id: 'new',
    aliases: ['new', 'new-conversation'],
    label: 'New conversation',
    summary: 'Starts a clean conversation in the current channel without touching files or providers.',
    risk: 'none',
    executionMode: 'session-local',
    canonicalSlash: '/new',
    cliCommand: 'new',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'reset',
    aliases: ['reset'],
    label: 'Restart conversation',
    summary: 'Restarts the active context of the current channel; auditable history remains preserved.',
    risk: 'low',
    executionMode: 'session-local',
    canonicalSlash: '/reset',
    cliCommand: 'reset',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'model',
    aliases: ['model', 'models', 'provider', 'providers'],
    label: 'Model and provider',
    summary: 'Shows or prepares provider/model switching without storing raw secrets.',
    risk: 'low',
    executionMode: 'state-preview',
    canonicalSlash: '/model [provider:model]',
    cliCommand: 'model [provider:model]',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'personality',
    aliases: ['personality', 'persona', 'profile'],
    label: 'Personality',
    summary: 'Shows or prepares active persona/SOUL switching with approval when writes are involved.',
    risk: 'medium',
    executionMode: 'approval-gated',
    canonicalSlash: '/personality [name]',
    cliCommand: 'personality [name]',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'retry',
    aliases: ['retry', 'try-again'],
    label: 'try again',
    summary: 'Prepares a governed repeat of the latest run without bypassing previous approval.',
    risk: 'medium',
    executionMode: 'approval-gated',
    canonicalSlash: '/retry',
    cliCommand: 'retry',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'undo',
    aliases: ['undo', 'rollback'],
    label: 'Undo',
    summary: 'Shows rollback plan when there is reversible receipt; does not undo without approval.',
    risk: 'high',
    executionMode: 'approval-gated',
    canonicalSlash: '/undo',
    cliCommand: 'undo',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'compress',
    aliases: ['compress', 'context-compress'],
    label: 'Compact context',
    summary: 'Prepares session context compaction with memory/receipt preservation.',
    risk: 'low',
    executionMode: 'state-preview',
    canonicalSlash: '/compress',
    cliCommand: 'compress',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'usage',
    aliases: ['usage', 'tokens'],
    label: 'usage',
    summary: 'Shows operational usage, tokens/cost when available, and next limits.',
    risk: 'none',
    executionMode: 'read-only',
    canonicalSlash: '/usage',
    cliCommand: 'usage',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'insights',
    aliases: ['insights', 'metrics', 'learnings'],
    label: 'Insights',
    summary: 'Summarizes learning, procedural memory, and signals from recent days.',
    risk: 'none',
    executionMode: 'read-only',
    canonicalSlash: '/insights [days]',
    cliCommand: 'insights [days]',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'skills',
    aliases: ['skills', 'skill'],
    label: 'Skills',
    summary: 'Lists, searches, or prepares governed skill usage/creation through the mesh.',
    risk: 'low',
    executionMode: 'state-preview',
    canonicalSlash: '/skills [query]',
    cliCommand: 'skills [query]',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'stop',
    aliases: ['stop', 'cancel'],
    label: 'Stop current work',
    summary: 'Signals governed interruption/cancellation for the current mission.',
    risk: 'medium',
    executionMode: 'approval-gated',
    canonicalSlash: '/stop',
    cliCommand: 'stop',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'platforms',
    aliases: ['platforms', 'channels'],
    label: 'Platforms',
    summary: 'Shows connectable channels and surfaces without making network probes.',
    risk: 'none',
    executionMode: 'read-only',
    canonicalSlash: '/platforms',
    cliCommand: 'platforms',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'status',
    aliases: ['status', 'ready'],
    label: 'Status',
    summary: 'Shows operational readiness and a clear next step.',
    risk: 'none',
    executionMode: 'read-only',
    canonicalSlash: '/status',
    cliCommand: 'status',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'sethome',
    aliases: ['sethome', 'home', 'workspace-home'],
    label: 'Set home',
    summary: 'Proposes changing the default workspace/home; writing requires approval.',
    risk: 'medium',
    executionMode: 'approval-gated',
    canonicalSlash: '/sethome <path>',
    cliCommand: 'sethome <path>',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'loop',
    aliases: ['loop', 'interaction', 'eng-loop', 'loop-engineering'],
    label: 'Engineering loop',
    summary: 'Runs an interactive or automatic refinement and sandbox loop for engineering tasks.',
    risk: 'high',
    executionMode: 'approval-gated',
    canonicalSlash: '/loop <task>',
    cliCommand: 'loop <task>',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
];

const COMMAND_BY_ALIAS = new Map<string, ZavorthSmartCommandResolution>();
for (const command of SMART_COMMANDS) {
  COMMAND_BY_ALIAS.set(command.id, command);
  for (const alias of command.aliases) {
    COMMAND_BY_ALIAS.set(alias, command);
  }
}

export class ZavorthSmartCommandSurfaceService {
  private readonly now: () => Date;
  private readonly skillCatalog: Pick<SkillCatalogService, 'listEntries'>;
  private readonly providerCatalog: Pick<ZavorthProviderModelCatalogService, 'buildSnapshot'>;

  public constructor(runtime: ZavorthSmartCommandSurfaceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillCatalog = runtime.skillCatalogService || new SkillCatalogService();
    this.providerCatalog = runtime.providerModelCatalogService || new ZavorthProviderModelCatalogService();
  }

  public listCommands(): ZavorthSmartCommandResolution[] {
    return SMART_COMMANDS.map((entry) => ({
      ...entry,
      aliases: [...entry.aliases],
      supportedSurfaces: [...entry.supportedSurfaces],
    }));
  }

  public canHandle(rawText: string): boolean {
    return this.parse(rawText).id !== null;
  }

  public async buildSnapshot(input: ZavorthSmartCommandSurfaceInput = {}): Promise<ZavorthSmartCommandSnapshot> {
    const raw = cleanRaw(input.rawText || '/status');
    const parsed = this.parse(raw);
    const command = parsed.id ? COMMAND_BY_ALIAS.get(parsed.id) || null : null;
    const channel = clean(input.channel) || 'cli';
    const sessionId = clean(input.sessionId);
    const skills = safeRead(() => this.skillCatalog.listEntries(), [] as SkillCatalogEntry[]);
    const providers = await safeReadAsync(
      () => this.providerCatalog.buildSnapshot(),
      null as ZavorthProviderModelCatalogSnapshot | null,
    );
    const ctx: CommandContext = {
      raw,
      args: parsed.args,
      channel,
      sessionId,
      apply: input.apply === true || hasSmartCommandFlag(raw, 'apply'),
      approvalId: clean(input.approvalId) || extractSmartCommandInlineValue(raw, 'approval-id'),
      skills,
      providers,
    };
    const status = command ? statusFor(command, ctx) : 'not-handled';
    const reply = command
      ? replyFor(command, ctx)
      : {
          title: 'Command not recognized',
          body: 'This text should flow through the natural-first runtime as a normal conversation.',
          hints: ['Use /status or /skills for direct commands.'],
        };

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SMART_COMMAND_SURFACE_CONTRACT_VERSION,
      surface: 'smart-command-surface',
      status,
      command: {
        raw,
        id: command?.id || null,
        args: parsed.args,
        canonicalSlash: command?.canonicalSlash || null,
        cliEquivalent: command?.cliCommand || null,
      },
      channel,
      sessionId,
      reply,
      action: {
        performed: command
          ? command.executionMode === 'session-local' && (command.id === 'new' || command.id === 'reset')
          : false,
        requiresApproval: command
          ? command.executionMode === 'approval-gated' || (command.executionMode === 'state-preview' && ctx.apply)
          : false,
        approvalReason: command ? approvalReasonFor(command, ctx) : null,
        nextCommand: command ? nextCommandFor(command, ctx) : null,
      },
      inventory: {
        commands: SMART_COMMANDS.length,
        providersKnown: providers?.summary?.providerRoutes || 0,
        skillsKnown: skills.length,
        platformsKnown: 6,
      },
      policy: {
        slashAndTextUseSameGateway: true,
        readOnlyCommandsDoNotStartRuntime: true,
        stateChangingCommandsPreviewFirst: true,
        riskyCommandsRequireApproval: true,
        crossSurfaceAliasesStable: true,
      },
      safety: {
        noShellExecution: true,
        noNetworkProbe: true,
        noSecretSerialization: true,
        noFilesystemMutationWithoutApproval: true,
        noRuntimeAdapterInvocation: true,
      },
      catalog: this.listCommands(),
    };
  }

  public renderText(snapshot: ZavorthSmartCommandSnapshot): string {
    const lines = [
      snapshot.reply.title,
      snapshot.reply.body,
      '',
      `Comando: ${snapshot.command.canonicalSlash || snapshot.command.raw}`,
      `Status: ${snapshot.status}`,
      `Channel: ${snapshot.channel}`,
      snapshot.action.nextCommand ? `next: ${snapshot.action.nextCommand}` : null,
    ].filter(Boolean) as string[];
    if (snapshot.reply.hints.length > 0) {
      lines.push('', 'Dicas');
      for (const hint of snapshot.reply.hints) {
        lines.push(`- ${hint}`);
      }
    }
    return `${lines.join('\n')}\n`;
  }

  private parse(rawText: string): ParsedCommand {
    const normalized = cleanRaw(rawText).replace(/^\/+/, '').trim();
    if (!normalized) {
      return { id: null, args: '' };
    }
    const first = normalizeKey(normalized.split(/\s+/)[0] || '');
    const args = stripSmartCommandRuntimeFlags(normalized.slice((normalized.split(/\s+/)[0] || '').length).trim());
    const command = COMMAND_BY_ALIAS.get(first) || null;
    return {
      id: command?.id || null,
      args,
    };
  }
}

function statusFor(command: ZavorthSmartCommandResolution, ctx: CommandContext): ZavorthSmartCommandStatus {
  if ((command.executionMode === 'approval-gated' || ctx.apply) && !ctx.approvalId) {
    return 'approval-required';
  }
  if (command.executionMode === 'state-preview' && !ctx.apply) {
    return 'preview';
  }
  return 'handled';
}

function replyFor(command: ZavorthSmartCommandResolution, ctx: CommandContext): ZavorthSmartCommandSnapshot['reply'] {
  const args = ctx.args.trim();
  if (command.id === 'new' || command.id === 'reset') {
    return {
      title: command.id === 'new' ? 'New conversation ready' : 'Conversation restarted',
      body: 'The current channel received a new conversation context. Memory and receipt histories remain auditable.',
      hints: [
        'Write your next request in free-form text.',
        'Use /history para review conversas anteriores when available.',
      ],
    };
  }
  if (command.id === 'model') {
    const current = ctx.providers ? `${ctx.providers.activeProvider}/${ctx.providers.activeModel}` : 'provider current';
    return {
      title: args ? 'Model switch prepared' : 'Current model',
      body: args ? `I will prepare ${args} as a model route. The real switch must pass provider readiness and valid SecretRef.`
        : `Current route: ${current}. Cataloged providers: ${ctx.providers?.summary?.providerRoutes || 0}.`,
      hints: ['zavorth provider-model-catalog', 'zavorth provider-selection'],
    };
  }
  if (command.id === 'personality') {
    return {
      title: args ? 'Persona prepared' : 'Zavorth personas',
      body: args ? `Persona "${args}" stayed in preview. Applying persona changes persistent behavior and requires approval.`
        : 'Use /personality <nome> para propor uma persona ou tom de trabalho.',
      hints: ['Nothing was saved without approval.', 'Use SOUL.md only as a governed profile source.'],
    };
  }
  if (command.id === 'retry') {
    return {
      title: 'Governed retry',
      body: 'I will repeat only the latest reversible/safe run. If the previous action required approval, retry also requires it.',
      hints: ['Use /retry <run-id> to be specific.', 'Nothing will execute without approval when risk is present.'],
    };
  }
  if (command.id === 'undo') {
    return {
      title: 'Rollback ready',
      body: 'I will look for a reversible receipt and generate a rollback preview. Undoing a write or external action requires approval.',
      hints: [
        'Use /undo <receipt-id> when you know the receipt.',
        'Non-existent rollback becomes explanation, not blind attempt.',
      ],
    };
  }
  if (command.id === 'compress') {
    return {
      title: 'Context compaction ready',
      body: 'I will compact conversational context preserving objective, decisions, approvals, procedural memory and receipts.',
      hints: ['Preview first; applying persistent compaction requires confirmation when changing memory.'],
    };
  }
  if (command.id === 'usage') {
    return {
      title: 'Zavorth usage',
      body: `Smart commands: ${SMART_COMMANDS.length}. Known skills: ${ctx.skills.length}. Cataloged providers: ${ctx.providers?.summary?.providerRoutes || 0}.`,
      hints: ['Use /insights for reading recent days.', 'Use /model for provider/model route.'],
    };
  }
  if (command.id === 'insights') {
    return {
      title: 'Operational insights',
      body: `Requested window: ${args || '7 days'}. I will summarize memory, runs, failures and learnings without exposing secrets.`,
      hints: ['Use /usage for tokens/cost.', 'Use /skills for reusable capabilities.'],
    };
  }
  if (command.id === 'skills') {
    const matches = args
      ? ctx.skills
          .filter((skill) =>
            `${skill.name} ${skill.description} ${skill.searchText}`.toLowerCase().includes(args.toLowerCase()),
          )
          .slice(0, 5)
      : ctx.skills.slice(0, 5);
    return {
      title: args ? 'Skills found' : 'Zavorth skills',
      body:
        matches.length > 0
          ? matches.map((skill) => `${skill.name}: ${skill.description}`).join('\n')
          : 'No exact skill found. The Capability Mesh can create a draft or fetch capability from a connected agent with approval.',
      hints: ['zavorth capability-mesh --request "<request>"', 'zavorth skill-curator'],
    };
  }
  if (command.id === 'stop') {
    return {
      title: 'Stop requested',
      body: 'I will signal cancellation of the current channel work, preserving the reason receipt without killing processes outside scope.',
      hints: ['Use /status to confirm state.', 'Destructive cancellations require approval when applicable.'],
    };
  }
  if (command.id === 'platforms') {
    return {
      title: 'Zavorth platforms',
      body: 'Supported surfaces: CLI, zavorthControl, Telegram, Discord, WhatsApp/API, and governed external channels.',
      hints: ['zavorth connectors doctor', 'zavorth capability-mesh --request "<request>"'],
    };
  }
  if (command.id === 'sethome') {
    return {
      title: args ? 'Home prepared' : 'Workspace home',
      body: args ? `Proposed new home: ${args}. Persistent writes require approval and a safe path.`
        : 'Informe um path: /sethome <path>. O Zavorth vai validate before gravar.',
      hints: ['There is no automatic computer scan.', 'Use explicit paths.'],
    };
  }
  if (command.id === 'loop') {
    return {
      title: 'Engineering loop prepared',
      body: 'Starting LoopEngineeringService to refine and run the task safely.',
      hints: ['Use --auto for automatic mode.', 'Use --grill for guided question mode.'],
    };
  }
  return {
    title: 'Zavorth status',
    body: 'Use Zavorth Ready To Go for full readiness or /usage for a light summary.',
    hints: ['zavorth ready-to-go', 'zavorth doctor'],
  };
}

function approvalReasonFor(command: ZavorthSmartCommandResolution, ctx: CommandContext): string | null {
  if (command.executionMode === 'approval-gated') {
    return `${command.label} pode alterar estado, cancelar trabalho ou run rollback.`;
  }
  if (ctx.apply) {
    return `${command.label} foi chamado com apply e needs approval.`;
  }
  return null;
}

function nextCommandFor(command: ZavorthSmartCommandResolution, ctx: CommandContext): string | null {
  const args = ctx.args ? ` ${ctx.args}` : '';
  if (command.id === 'model')
    return ctx.args ? `zavorth provider-selection ${ctx.args}` : 'zavorth provider-model-catalog';
  if (command.id === 'skills') return `zavorth capability-mesh --request "${escapeQuote(ctx.args || 'listar skills')}"`;
  if (command.id === 'platforms') return 'zavorth connectors doctor';
  if (command.id === 'status') return 'zavorth ready-to-go';
  if (command.id === 'sethome') return `zavorth smart-command /sethome${args} --apply --approval-id <approval-id>`;
  if (command.executionMode === 'approval-gated')
    return `zavorth smart-command ${command.canonicalSlash.split(' ')[0]}${args} --approval-id <approval-id>`;
  return null;
}

function cleanRaw(value: unknown): string {
  return String(value || '')
    .trim()
    .slice(0, 2000);
}

function clean(value: unknown): string | null {
  const text = String(value || '').trim();
  return text ? text.slice(0, 1000) : null;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, '-');
}

function escapeQuote(value: string): string {
  return String(value).replace(/"/g, '\\"');
}

function stripSmartCommandRuntimeFlags(value: string): string {
  return String(value || '')
    .replace(/\s+--apply\b/gi, '')
    .replace(/\s+--approval-id(?:=|\s+)\S+/gi, '')
    .replace(/\s+--channel(?:=|\s+)\S+/gi, '')
    .replace(/\s+--session(?:-id)...(?:=|\s+)\S+/gi, '')
    .trim();
}

function hasSmartCommandFlag(rawText: string, name: string): boolean {
  const escaped = name.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)--${escaped}(?:\\s|$)`, 'i').test(String(rawText || ''));
}

function extractSmartCommandInlineValue(rawText: string, name: string): string | null {
  const escaped = name.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
  const match = String(rawText || '').match(new RegExp(`(?:^|\\s)--${escaped}(?:=|\\s+)(\\S+)`, 'i'));
  return match?.[1]?.trim() || null;
}

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch (error: unknown) {
    logger.warn('[Zavorth Smart Command Surface] string operation failed', error);
    return fallback;
  }
}

async function safeReadAsync<T>(reader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await reader();
  } catch (error: unknown) {
    logger.warn('[Zavorth Smart Command Surface] string operation failed', error);
    return fallback;
  }
}