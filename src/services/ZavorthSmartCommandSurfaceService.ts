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
    aliases: ['new', 'nova', 'nova-conversa', 'new-conversation'],
    label: 'Nova conversa',
    summary: 'Inicia uma conversa limpa no canal atual sem tocar arquivos ou providers.',
    risk: 'none',
    executionMode: 'session-local',
    canonicalSlash: '/new',
    cliCommand: 'new',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'reset',
    aliases: ['reset', 'reiniciar', 'limpar-conversa'],
    label: 'Reiniciar conversa',
    summary: 'Reinicia o contexto ativo do canal atual; histórico auditável continua preservado.',
    risk: 'low',
    executionMode: 'session-local',
    canonicalSlash: '/reset',
    cliCommand: 'reset',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'model',
    aliases: ['model', 'modelo', 'models', 'provider', 'providers'],
    label: 'Modelo e provider',
    summary: 'Mostra ou prepara a troca de provider/modelo sem gravar segredo bruto.',
    risk: 'low',
    executionMode: 'state-preview',
    canonicalSlash: '/model [provider:model]',
    cliCommand: 'model [provider:model]',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'personality',
    aliases: ['personality', 'persona', 'tom', 'perfil'],
    label: 'Personalidade',
    summary: 'Mostra ou prepara a troca de persona/SOUL ativa com approval quando houver escrita.',
    risk: 'medium',
    executionMode: 'approval-gated',
    canonicalSlash: '/personality [name]',
    cliCommand: 'personality [name]',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'retry',
    aliases: ['retry', 'tentar-novamente', 'refazer'],
    label: 'Tentar novamente',
    summary: 'Prepara repeticao governada do ultimo run sem burlar approval anterior.',
    risk: 'medium',
    executionMode: 'approval-gated',
    canonicalSlash: '/retry',
    cliCommand: 'retry',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'undo',
    aliases: ['undo', 'desfazer', 'rollback'],
    label: 'Desfazer',
    summary: 'Mostra plano de rollback quando ha receipt reversivel; nao desfaz sem approval.',
    risk: 'high',
    executionMode: 'approval-gated',
    canonicalSlash: '/undo',
    cliCommand: 'undo',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'compress',
    aliases: ['compress', 'compactar', 'context-compress'],
    label: 'Compactar contexto',
    summary: 'Prepara compactacao do contexto da sessao com preservacao de memoria/receipts.',
    risk: 'low',
    executionMode: 'state-preview',
    canonicalSlash: '/compress',
    cliCommand: 'compress',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'usage',
    aliases: ['usage', 'uso', 'custos', 'tokens'],
    label: 'Uso',
    summary: 'Mostra uso operacional, tokens/custo quando disponivel e proximos limites.',
    risk: 'none',
    executionMode: 'read-only',
    canonicalSlash: '/usage',
    cliCommand: 'usage',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'insights',
    aliases: ['insights', 'metricas', 'aprendizados'],
    label: 'Insights',
    summary: 'Resume aprendizado, memoria procedural e sinais dos ultimos dias.',
    risk: 'none',
    executionMode: 'read-only',
    canonicalSlash: '/insights [days]',
    cliCommand: 'insights [days]',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'skills',
    aliases: ['skills', 'skill', 'habilidades'],
    label: 'Skills',
    summary: 'Lista, busca ou preto uso/criaction de skills pelo mesh governado.',
    risk: 'low',
    executionMode: 'state-preview',
    canonicalSlash: '/skills [query]',
    cliCommand: 'skills [query]',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'stop',
    aliases: ['stop', 'parar', 'cancel', 'cancelar'],
    label: 'Parar trabalho atual',
    summary: 'Sinaliza interrupcao/cancelamento governado para a missao atual.',
    risk: 'medium',
    executionMode: 'approval-gated',
    canonicalSlash: '/stop',
    cliCommand: 'stop',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'platforms',
    aliases: ['platforms', 'plataformas', 'channels', 'canais'],
    label: 'Plataformas',
    summary: 'Mostra canais e superficies conectaveis sem fazer probe de rede.',
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
    summary: 'Mostra prontidao operacional e proximo passo claro.',
    risk: 'none',
    executionMode: 'read-only',
    canonicalSlash: '/status',
    cliCommand: 'status',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'sethome',
    aliases: ['sethome', 'home', 'workspace-home', 'definir-home'],
    label: 'Definir home',
    summary: 'Preto troca do workspace/home padrao; escrita exige approval.',
    risk: 'medium',
    executionMode: 'approval-gated',
    canonicalSlash: '/sethome <path>',
    cliCommand: 'sethome <path>',
    supportedSurfaces: ['cli', 'zavorthControl', 'telegram', 'discord', 'whatsapp', 'api'],
  },
  {
    id: 'loop',
    aliases: ['loop', 'interacao', 'eng-loop', 'loop-engineering'],
    label: 'Loop de engenharia',
    summary: 'Executa um loop interativo ou automatico de refinamento e sandbox para tarefas de engenharia.',
    risk: 'high',
    executionMode: 'approval-gated',
    canonicalSlash: '/loop <tarefa>',
    cliCommand: 'loop <tarefa>',
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
          title: 'Comando nao reconhecido',
          body: 'Esse texto deve seguir pelo runtime natural-first como conversa normal.',
          hints: ['Use /status ou /skills para comandos diretos.'],
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
      `Canal: ${snapshot.channel}`,
      snapshot.action.nextCommand ? `Proximo: ${snapshot.action.nextCommand}` : null,
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
      title: command.id === 'new' ? 'Nova conversa pronta' : 'Conversa reiniciada',
      body: 'O canal atual recebeu um novo contexto de conversa. Memoria e receipts historicos continuam auditaveis.',
      hints: [
        'Escreva seu proximo pedido em texto livre.',
        'Use /history para revisar conversas anteriores quando disponivel.',
      ],
    };
  }
  if (command.id === 'model') {
    const current = ctx.providers ? `${ctx.providers.activeProvider}/${ctx.providers.activeModel}` : 'provider atual';
    return {
      title: args ? 'Troca de modelo preparada' : 'Modelo atual',
      body: args
        ? `Vou preparar ${args} como rota de modelo. A troca real precisa passar por provider readiness e SecretRef valido.`
        : `Rota atual: ${current}. Providers catalogados: ${ctx.providers?.summary?.providerRoutes || 0}.`,
      hints: ['zavorth provider-model-catalog', 'zavorth provider-selection'],
    };
  }
  if (command.id === 'personality') {
    return {
      title: args ? 'Persona prepared' : 'Zavorth personas',
      body: args
        ? `Persona "${args}" ficou em preview. Aplicar persona altera comportamento persistente e exige approval.`
        : 'Use /personality <nome> para propor uma persona ou tom de trabalho.',
      hints: ['Nada foi gravado sem approval.', 'Use SOUL.md apenas como fonte governada do perfil.'],
    };
  }
  if (command.id === 'retry') {
    return {
      title: 'Retry governado',
      body: 'Vou repetir somente o ultimo run reversivel/seguro. Se a acao anterior exigiu approval, o retry tambem exige.',
      hints: ['Use /retry <run-id> para ser especifico.', 'Nada sera executado sem approval quando houver risco.'],
    };
  }
  if (command.id === 'undo') {
    return {
      title: 'Rollback preparado',
      body: 'Vou procurar receipt reversivel e gerar preview de rollback. Desfazer escrita ou acao externa exige approval.',
      hints: [
        'Use /undo <receipt-id> quando souber o recibo.',
        'Rollback inexistente vira explicacao, nao tentativa cega.',
      ],
    };
  }
  if (command.id === 'compress') {
    return {
      title: 'Compactaction de contexto preparada',
      body: 'Vou compactar contexto conversacional preservando objetivo, decisoes, approvals, memoria procedural e receipts.',
      hints: ['Preview primeiro; aplicar compactacao persistente exige confirmacao quando alterar memoria.'],
    };
  }
  if (command.id === 'usage') {
    return {
      title: 'Zavorth usage',
      body: `Comandos inteligentes: ${SMART_COMMANDS.length}. Skills conhecidas: ${ctx.skills.length}. Providers catalogados: ${ctx.providers?.summary?.providerRoutes || 0}.`,
      hints: ['Use /insights para leitura dos ultimos dias.', 'Use /model para rota de provider/modelo.'],
    };
  }
  if (command.id === 'insights') {
    return {
      title: 'Insights operacionais',
      body: `Janela solicitada: ${args || '7 dias'}. Vou resumir memoria, runs, falhas e aprendizados sem expor secrets.`,
      hints: ['Use /usage para tokens/custo.', 'Use /skills para capacidades reutilizaveis.'],
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
          : 'Nenhuma skill exata apareceu. O Capability Mesh pode criar draft ou buscar capacidade em agente conectado com approval.',
      hints: ['zavorth capability-mesh --request "<pedido>"', 'zavorth skill-curator'],
    };
  }
  if (command.id === 'stop') {
    return {
      title: 'Parada solicitada',
      body: 'Vou sinalizar cancelamento do trabalho atual no canal, preservando receipt do motivo e sem matar processos fora do escopo.',
      hints: ['Use /status para confirmar estado.', 'Cancelamentos destrutivos exigem approval quando aplicavel.'],
    };
  }
  if (command.id === 'platforms') {
    return {
      title: 'Zavorth platforms',
      body: 'Superficies suportadas: CLI, zavorthControl, Telegram, Discord, WhatsApp/API e canais externos governados.',
      hints: ['zavorth connectors doctor', 'zavorth capability-mesh --request "<pedido>"'],
    };
  }
  if (command.id === 'sethome') {
    return {
      title: args ? 'Home preparado' : 'Home do workspace',
      body: args
        ? `Novo home proposto: ${args}. Gravaction persistente exige approval e path seguro.`
        : 'Informe um caminho: /sethome <path>. O Zavorth vai validar antes de gravar.',
      hints: ['There is no varredura automatica do computador.', 'Use caminhos explicitos.'],
    };
  }
  if (command.id === 'loop') {
    return {
      title: 'Loop de engenharia preparado',
      body: 'Iniciando o LoopEngineeringService para refinar e executar a tarefa de forma segura.',
      hints: ['Use --auto para modo automatico.', 'Use --grill para modo guiado de perguntas.'],
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
    return `${command.label} pode alterar estado, cancelar trabalho ou executar rollback.`;
  }
  if (ctx.apply) {
    return `${command.label} foi chamado com apply e precisa de approval.`;
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
    .replace(/\s+--session(?:-id)?(?:=|\s+)\S+/gi, '')
    .trim();
}

function hasSmartCommandFlag(rawText: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)--${escaped}(?:\\s|$)`, 'i').test(String(rawText || ''));
}

function extractSmartCommandInlineValue(rawText: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
