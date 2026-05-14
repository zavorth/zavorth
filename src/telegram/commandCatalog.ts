import { getDefaultCapabilityRegistry } from '../capabilities/CapabilityRegistry.js';
import {
  EXTERNAL_EXECUTOR_COMMAND,
  EXTERNAL_REVIEW_COMMAND,
  EXTERNAL_REVIEW_DASH_COMMAND,
  LEGACY_EXTERNAL_COMMAND,
  LEGACY_EXTERNAL_REVIEW_COMMAND,
  LEGACY_EXTERNAL_REVIEW_DASH_COMMAND,
  LEGACY_EXTERNAL_SHORT_COMMAND,
} from './ExternalExecutorIdentity.js';

export type CommandSection =
  | 'entry'
  | 'execution'
  | 'monitoring'
  | 'permissions'
  | 'zavorthBridge'
  | 'skills'
  | 'search'
  | 'memory'
  | 'fun'
  | 'group_admin';

export type CommandCatalogEntry = {
  command: string;
  description: string;
  section: CommandSection;
  usage?: string;
  hidden?: boolean;
  privateMenu?: boolean;
  groupMenu?: boolean;
};

const capabilityRegistry = getDefaultCapabilityRegistry();

const STATIC_COMMAND_ALIASES: Record<string, string> = {
  '/menu': '/zavorth',
  '/remoto': '/remote',
  '/selfmodify': '/selfmod',
  '/reload': '/selfupdate',
  '/repair': '/autorepair',
  '/agent': '/agents',
  '/subagent': '/agents',
  '/subagents': '/agents',
  '/sessions_spawn': '/agents',
  '/invocar': '/invoke',
  '/aigateway': '/AIGateway',
  [LEGACY_EXTERNAL_COMMAND]: EXTERNAL_EXECUTOR_COMMAND,
  [LEGACY_EXTERNAL_SHORT_COMMAND]: EXTERNAL_EXECUTOR_COMMAND,
  [EXTERNAL_REVIEW_DASH_COMMAND]: EXTERNAL_REVIEW_COMMAND,
  [LEGACY_EXTERNAL_REVIEW_COMMAND]: EXTERNAL_REVIEW_COMMAND,
  [LEGACY_EXTERNAL_REVIEW_DASH_COMMAND]: EXTERNAL_REVIEW_COMMAND,
};

const STATIC_COMMAND_EXECUTORS: Record<string, string | null> = {
  '/plan': 'planner',
  '/run': 'local_executor',
  '/dryrun': 'local_executor',
  '/approve': 'approval_manager',
  '/reject': 'approval_manager',
};

const CAPABILITY_COMMAND_CATALOG: CommandCatalogEntry[] = capabilityRegistry
  .getCommandCatalogEntries()
  .map((entry) => ({
    command: entry.command,
    description: entry.description,
    section: (entry.section || 'execution') as CommandSection,
    usage: entry.usage,
    hidden: entry.hidden,
    privateMenu: entry.privateMenu,
    groupMenu: entry.groupMenu,
  }));

const STATIC_COMMAND_CATALOG: CommandCatalogEntry[] = [
  { command: 'start', description: 'Inicia o Zavorth e abre o hub.', section: 'entry', usage: '[tour|recipes|security|settings]', privateMenu: false, groupMenu: false },
  { command: 'zavorth', description: 'Hub interativo com painel, acoes e ajustes.', section: 'entry', privateMenu: true, groupMenu: true },
  { command: 'help', description: 'Guia completo de comandos.', section: 'entry', privateMenu: true, groupMenu: true },
  { command: 'commands', description: 'Catalogo paginado de comandos por canal.', section: 'entry', usage: '[filtro|page N]', privateMenu: true, groupMenu: true },
  { command: 'plan', description: 'Planeja antes de executar qualquer acao.', section: 'execution', usage: '<tarefa>', privateMenu: true, groupMenu: true },
  { command: 'task', description: 'Conversa orquestrada sobre uma tarefa.', section: 'execution', usage: '<pedido>', hidden: true },
  { command: 'auto', description: 'Conversa orientada a automacao.', section: 'execution', usage: '<pedido>', hidden: true },
  { command: 'selfmod', description: 'Auto-modificacao guardada do Zavorth.', section: 'execution', usage: '[preview <arquivo> -- <instrucao>|goal -- <objetivo>|apply <preview_id>|rollback <change_id>]', hidden: true, privateMenu: false },
  { command: 'run', description: 'Executa comando shell local direto.', section: 'execution', usage: '<comando>', privateMenu: false },
  { command: 'dryrun', description: 'Simula um comando sem executar.', section: 'execution', usage: '<comando>', privateMenu: false },
  { command: 'status', description: 'Saude, uptime e estado geral.', section: 'monitoring', privateMenu: true, groupMenu: true },
  { command: 'doctor', description: 'Diagnostico do desktop local, WSL, Docker e companions.', section: 'monitoring', usage: '[desktop]', privateMenu: true, groupMenu: false },
  { command: 'companion', description: 'Control plane supervisionado para WSL, Docker, ZavorthBridge e Codex.', section: 'monitoring', usage: '[list|inspect <id>|hibernate <id>|resume <id>|stop-idle <id>|trim <id>|restart-safe <id>|optimize <preset> [apply <planId>]]', privateMenu: true, groupMenu: false },
  { command: 'workspace', description: 'Doctor e preset leve para workspaces Zavorth em IDEs companheiras.', section: 'monitoring', usage: '[doctor|optimize <zavorthBridge|vscode|vscode-derivative> [apply <planId>]]', privateMenu: true, groupMenu: false },
  { command: 'profile', description: 'Mostra ou troca o perfil de runtime leve.', section: 'monitoring', usage: '[core|ops|full]', privateMenu: true, groupMenu: false },
  { command: 'enable', description: 'Habilita uma capability sob demanda.', section: 'monitoring', usage: '<capability> [once|session|host]', privateMenu: true, groupMenu: false },
  { command: 'disable', description: 'Desabilita uma capability sob demanda.', section: 'monitoring', usage: '<capability>', privateMenu: true, groupMenu: false },
  { command: 'models', description: 'Resume modelos e providers ativos.', section: 'monitoring', privateMenu: false },
  { command: 'codexremote', description: 'Control plane remoto do Codex CLI com perfis e sessoes.', section: 'monitoring', usage: '[status|profiles|profile <id>|start [titulo] -- <prompt>|sessions|inspect <id>|tail <id>|resume <id> [-- <prompt>]|stop <id>|web <id>]', privateMenu: true, groupMenu: false },
  { command: 'teams', description: 'Mostra workflows compostos e a disponibilidade por superficie.', section: 'monitoring', usage: '[id]', privateMenu: true, groupMenu: false },
  { command: 'tenants', description: 'Resume governanca, onboarding e allowlists por tenant.', section: 'monitoring', usage: '[tenant|surface]|run <tenantId> <actionId>', privateMenu: true, groupMenu: false },
  { command: 'gateway', description: 'Snapshot canonico do Gateway unificado.', section: 'monitoring', privateMenu: true, groupMenu: false },
  { command: 'tools', description: 'Surface oficial de tools, skills e plugins.', section: 'monitoring', privateMenu: true, groupMenu: false },
  { command: 'hooks', description: 'Plano oficial de hooks, eventos e registros por workspace.', section: 'monitoring', usage: '[filtro]', privateMenu: true, groupMenu: false },
  { command: 'runtime', description: 'Postura oficial do Runtime & Security Mesh.', section: 'monitoring', privateMenu: true, groupMenu: false },
  { command: 'access', description: 'Manifesto oficial de acesso local e remoto.', section: 'monitoring', usage: '[local|remote]', privateMenu: true, groupMenu: false },
  { command: 'bootstrap', description: 'Checklist oficial de bootstrap e instalacao.', section: 'monitoring', privateMenu: true, groupMenu: false },
  { command: 'transports', description: 'Bridges, sidecars e node hosts do plano remoto.', section: 'monitoring', usage: '[id]', privateMenu: true, groupMenu: false },
  { command: 'model', description: 'Troca o provider conversacional ou um modelo Gemini/Gemma.', section: 'monitoring', usage: '<provider|modelo>', privateMenu: false },
  { command: 'remote', description: 'Liga/desliga modo remoto.', section: 'monitoring', usage: '[on|off|status]', privateMenu: false },
  { command: 'audit', description: 'Eventos recentes do audit log.', section: 'monitoring', usage: '[quantidade]', privateMenu: false },
  { command: 'mode', description: 'Mostra/altera o product mode ou resolve elevacoes do Zavorth.', section: 'monitoring', usage: '[chat|assistant|builder|operator|approve <requestId> [once|session|host]|reject <requestId>]', privateMenu: true, groupMenu: false },
  { command: 'operator', description: 'Liga/desliga o modo operador.', section: 'monitoring', usage: '[on|off|status]', privateMenu: false },
  { command: 'presentation', description: 'Liga/desliga o modo apresentacao.', section: 'monitoring', usage: '[on|off|status]', privateMenu: false },
  { command: 'demo', description: 'Controla e mostra o roteiro de demo do Zavorth.', section: 'monitoring', usage: '[on|off|status|start|next|reset|short|pitch|checklist|research|files|workflow|stitch|full]', privateMenu: false },
  { command: 'dailyreport', description: 'Liga/desliga ou envia o relatorio diario.', section: 'monitoring', usage: '[status|on|off|now]', privateMenu: false },
  { command: 'channels', description: 'Resumo oficial do Channel Mesh e dos canais first-class.', section: 'monitoring', usage: '[id]', privateMenu: true, groupMenu: false },
  { command: 'memoryplane', description: 'Retomada, entregas e memorias em um unico plano oficial.', section: 'monitoring', privateMenu: true, groupMenu: false },
  { command: 'sessions', description: 'Plano oficial das sessoes e pontos de retomada.', section: 'monitoring', usage: '[sessionId|chatId]', privateMenu: true, groupMenu: false },
  { command: 'sessionhistory', description: 'Replay e handoff da sessao alvo.', section: 'monitoring', usage: '[sessionId|chatId]', privateMenu: true, groupMenu: false },
  { command: 'sessionsend', description: 'Despacha uma mensagem para outra sessao.', section: 'monitoring', usage: '<sessionId|chatId> -- <mensagem>', privateMenu: true, groupMenu: false },
  { command: 'sessionspawn', description: 'Abre uma sessao derivada rastreavel.', section: 'monitoring', usage: '[web]', privateMenu: true, groupMenu: false },
  { command: 'nodes', description: 'Resumo oficial do Node Mesh e do transporte remoto.', section: 'monitoring', usage: '[nodeId]', privateMenu: true, groupMenu: false },
  { command: 'nodepair', description: 'Cria um pairing draft para um node host.', section: 'monitoring', usage: '[label]', privateMenu: true, groupMenu: false },
  { command: 'nodeinvoke', description: 'Enfileira uma invocacao remota para um node pareado.', section: 'monitoring', usage: '<nodeId> <capabilityId> [action] [payload-json]', privateMenu: true, groupMenu: false },
  { command: 'plugins', description: 'Plano oficial de plugins, skills e extensoes do Zavorth.', section: 'monitoring', usage: '[id|filtro]', privateMenu: true, groupMenu: false },
  { command: 'platform', description: 'Plano unificado de plugins, skills e MCPs do Zavorth.', section: 'monitoring', usage: '[id|filtro]', privateMenu: true, groupMenu: false },
  { command: 'hub', description: 'Plano consolidado de integrations, plugins, skills, platform e MCP.', section: 'monitoring', usage: '[id|filtro|sync|doctor|run <actionId>|recommend <objetivo>]', privateMenu: true, groupMenu: false },
  { command: 'evals', description: 'Wave D: scorecards, traces e historico operacional.', section: 'monitoring', usage: '[workspace X|surface Y|executor Z|workflow W]', privateMenu: true, groupMenu: false },
  { command: 'qa', description: 'Budgets, smokes, regressions e release gates da Wave 6.', section: 'monitoring', usage: '[alpha|beta]', privateMenu: true, groupMenu: false },
  { command: 'governance', description: 'Tenants, trust decisions, allowlists e policy da Wave 7.', section: 'monitoring', usage: '[limit N]', privateMenu: true, groupMenu: false },
  { command: 'replayloop', description: 'Replay, artifacts reutilizaveis e learning loop da Wave 8.', section: 'monitoring', usage: '[limit N]', privateMenu: true, groupMenu: false },
  { command: 'ecosystem', description: 'SDKs, guides, publish e receitas publicas da Wave 9.', section: 'monitoring', usage: '[id|filtro]', privateMenu: true, groupMenu: false },
  { command: 'fleet', description: 'Channels, fleet, transports e superficies da Wave 10.', section: 'monitoring', usage: '[id|filtro]', privateMenu: true, groupMenu: false },
  { command: 'stability', description: 'Keepalive, doctor e recover da fleet supervisionada.', section: 'monitoring', privateMenu: true, groupMenu: false },
  { command: 'rolloutqa', description: 'QA persistente, runtime distribuido e readiness de rollout.', section: 'monitoring', usage: '[alpha|beta]', privateMenu: true, groupMenu: false },
  { command: 'setupagent', description: 'Wave A: setup natural-first de canais por linguagem humana.', section: 'monitoring', usage: '[pedido natural]', privateMenu: true, groupMenu: false },
  { command: 'watchmode', description: 'Wave C: policy, approvals e replay do Watch Mode supervisionado.', section: 'monitoring', usage: '[status|strict on|strict off|allow-app <janela>|allow-site <host>]', privateMenu: true, groupMenu: false },
  { command: 'swarm', description: 'Executa uma equipe multiagente curta e supervisionada.', section: 'execution', usage: '<objetivo>', privateMenu: true, groupMenu: false },
  { command: 'echo', description: 'Liga/desliga o Modo Echo (resposta por voz).', section: 'execution', usage: '[on|off]', privateMenu: true, groupMenu: false },
  { command: 'learning', description: 'Learning plane com candidatos aprendidos e gates explicitos.', section: 'monitoring', usage: '[status|candidates|approve <id>|reject <id>|promote <id>]', privateMenu: true, groupMenu: false },
  { command: 'integrations', description: 'Catalogo de conectores e receitas do Zavorth.', section: 'monitoring', usage: '[id]', privateMenu: true, groupMenu: true },
  { command: 'skills', description: 'Catalogo curado de skills, recipes, planos e sidecar MCP.', section: 'skills', usage: '[library|plan <id>|plan recipe <id>|id|filtro|recipe <id>|recommend <objetivo>|mcp]', privateMenu: true, groupMenu: true },
  { command: 'agents', description: 'Subagentes vivos governados: spawn, status, history, read, summarize e cancel.', section: 'execution', usage: '[spawn|status|history|wait|cancel|read|summarize] [latest|sessionId] [--live] <tarefa>', privateMenu: true, groupMenu: true },
  { command: 'invoke', description: 'Roteia linguagem natural para skills, subagentes ou absorcao governada.', section: 'execution', usage: '<pedido natural>', privateMenu: true, groupMenu: true },
  { command: 'teams', description: 'Workflows compostos e disponibilidade por superficie.', section: 'monitoring', usage: '[id]', privateMenu: true, groupMenu: false },
  { command: 'tenants', description: 'Governanca, onboarding e allowlists por tenant.', section: 'monitoring', usage: '[tenant|surface]|run <tenantId> <actionId>', privateMenu: true, groupMenu: false },
  { command: 'trust', description: 'Trust Plane com MCP, skills, plugins e runtime supervisionado.', section: 'monitoring', usage: '[status|mcp safe|mcp trusted|skills deny]', privateMenu: true, groupMenu: false },
  { command: 'connect', description: 'Inicia onboarding seguro para uma integracao.', section: 'monitoring', usage: '<integracao> [modo]', privateMenu: true, groupMenu: false },
  { command: 'changes', description: 'Resume alteracoes locais e estado do runtime.', section: 'monitoring', privateMenu: false },
  { command: 'reload', description: 'Reinicia o Zavorth supervisionado.', section: 'monitoring', privateMenu: false },
  { command: 'selfupdate', description: 'Pede reload supervisionado do Zavorth.', section: 'monitoring', usage: '[status|summary|force]', hidden: true, privateMenu: false },
  { command: 'autorepair', description: 'Corrige, valida, atualiza e religa o Zavorth sozinho.', section: 'monitoring', usage: '[status]', privateMenu: false },
  { command: 'wsl', description: 'Liga/desliga WSL e runtimes externos.', section: 'monitoring', usage: '[on|off|status]', privateMenu: false },
  { command: 'schedule', description: 'Agenda comando recorrente.', section: 'monitoring', usage: '<every Xh|Xm> <comando>', privateMenu: false },
  { command: 'schedules', description: 'Lista agendamentos ativos.', section: 'monitoring', privateMenu: false },
  { command: 'unschedule', description: 'Cancela agendamento.', section: 'monitoring', usage: '<id>', privateMenu: false },
  { command: 'automations', description: 'Wave F: automacoes naturais, maintenance e scheduled runs.', section: 'monitoring', usage: '[status|maintenance on|maintenance off|maintenance run|pause <id>|resume <id>|remove <id>|<pedido natural>]', privateMenu: true, groupMenu: false },
  { command: 'settings', description: 'Ajustes rapidos de modo e modelos.', section: 'monitoring', privateMenu: false },
  { command: 'cleanup', description: 'Fecha apps nao essenciais.', section: 'monitoring', privateMenu: false },
  { command: 'clear', description: 'Apaga mensagens do bot neste chat.', section: 'monitoring', privateMenu: false },
  { command: 'report', description: 'Agenda briefing automatico.', section: 'search', usage: 'every <Xm|Xh> <tema>', privateMenu: false },
  { command: 'perm', description: 'Gerencia permissoes e politicas.', section: 'permissions', usage: 'list|show|approve|reject|edit ...', privateMenu: true, groupMenu: true },
  { command: 'echoapprovals', description: 'Lista approvals pendentes do Echo com botoes inline.', section: 'permissions', usage: '[approve <id>|reject <id>]', privateMenu: true, groupMenu: true },
  { command: 'lock', description: 'Tranca o Zavorth.', section: 'permissions', usage: '<senha>', privateMenu: true, groupMenu: true },
  { command: 'unlock', description: 'Destranca o Zavorth.', section: 'permissions', usage: '<senha>', privateMenu: true, groupMenu: true },
  { command: 'hostauth', description: 'Status/reautorizacao do host atual.', section: 'permissions', usage: '[status|trust]', privateMenu: false },
  { command: 'permallow', description: 'Cria politica persistente.', section: 'permissions', usage: 'executor=<nome> kind=<folder|command|ui> ...', privateMenu: false },
  { command: 'permrevoke', description: 'Revoga uma permissao por id.', section: 'permissions', usage: '<id>', privateMenu: false },
  { command: 'approve', description: 'Aprova tarefa pendente por id.', section: 'permissions', usage: '<task_id>', privateMenu: false },
  { command: 'reject', description: 'Rejeita tarefa pendente por id.', section: 'permissions', usage: '<task_id>', privateMenu: false },
  { command: 'undo', description: 'Tenta desfazer tarefa por id.', section: 'permissions', usage: '<task_id>', privateMenu: false },
  { command: 'agfocus', description: 'Foca a janela do ZavorthBridge.', section: 'zavorthBridge', privateMenu: false },
  { command: 'agaccept', description: 'Aprova etapa no ZavorthBridge.', section: 'zavorthBridge', privateMenu: false },
  { command: 'agnudge', description: 'Empurrao para conversa ZavorthBridge.', section: 'zavorthBridge', usage: '<texto>', privateMenu: false },
  { command: 'agbridge', description: 'Estado do bridge ZavorthBridge.', section: 'zavorthBridge', privateMenu: false },
  { command: 'agclean', description: 'Limpa sessao do ZavorthBridge.', section: 'zavorthBridge', privateMenu: false },
  { command: 'agreset', description: 'Reinicia conversa ZavorthBridge.', section: 'zavorthBridge', privateMenu: false },
  { command: 'agmodel', description: 'Troca modelo ZavorthBridge.', section: 'zavorthBridge', usage: '<modelo>', privateMenu: false },
  { command: 'agmobile', description: 'Prepara o ZavorthBridge para uso pelo celular.', section: 'zavorthBridge', usage: '[start|status|guide|stop]', privateMenu: false },
  { command: 'AIGateway', description: 'Opera a rota propria e o upstream do AIGateway.', section: 'monitoring', usage: '[status|route|start|doctor|sync|promote|rollback]', privateMenu: false },
  { command: 'save', description: 'Salva snippet de texto.', section: 'memory', usage: '<nome> <conteudo>', privateMenu: false },
  { command: 'snippet', description: 'Recupera snippet salvo.', section: 'memory', usage: '<nome>', privateMenu: false },
  { command: 'snippets', description: 'Lista todos os snippets.', section: 'memory', privateMenu: false },
  { command: 'remember', description: 'Salva fato na memoria.', section: 'memory', usage: '<chave> <valor>', privateMenu: false },
  { command: 'recall', description: 'Recupera fato da memoria.', section: 'memory', usage: '<chave>', privateMenu: false },
  { command: 'memory', description: 'Layered memory com busca episodica, semantica e procedural.', section: 'memory', usage: '[status|search <consulta>|procedures]', privateMenu: true, groupMenu: false },
  { command: 'forget', description: 'Remove fato da memoria.', section: 'memory', usage: '<chave>', privateMenu: false },
  { command: 'roll', description: 'Rola um dado .', section: 'fun', usage: '[lados]', privateMenu: false, groupMenu: true },
  { command: 'coinflip', description: 'Cara ou coroa.', section: 'fun', privateMenu: false, groupMenu: true },
  { command: '8ball', description: 'Bola magica sarcastica.', section: 'fun', usage: '<pergunta>', privateMenu: false, groupMenu: true },
  { command: 'joke', description: 'Conta uma piada.', section: 'fun', privateMenu: false, groupMenu: true },
  { command: 'roulette', description: 'Roleta dramatica do chat.', section: 'fun', privateMenu: false, groupMenu: true },
  { command: 'ban', description: 'Bane um membro.', section: 'group_admin', usage: '<user_id|reply>', privateMenu: false, groupMenu: true },
  { command: 'kick', description: 'Expulsa um membro.', section: 'group_admin', usage: '<user_id|reply>', privateMenu: false, groupMenu: true },
  { command: 'mute', description: 'Silencia um membro.', section: 'group_admin', usage: '<user_id|reply> [tempo]', privateMenu: false, groupMenu: true },
  { command: 'unmute', description: 'Remove silencio.', section: 'group_admin', usage: '<user_id|reply>', privateMenu: false, groupMenu: true },
  { command: 'warn', description: 'Aplica advertencia.', section: 'group_admin', usage: '<user_id|reply> [motivo]', privateMenu: false, groupMenu: true },
  { command: 'warns', description: 'Lista advertencias.', section: 'group_admin', usage: '<user_id|reply>', privateMenu: false, groupMenu: true },
  { command: 'clearwarns', description: 'Limpa advertencias.', section: 'group_admin', usage: '<user_id|reply>', privateMenu: false, groupMenu: true },
  { command: 'regras', description: 'Define/mostra regras do grupo.', section: 'group_admin', usage: '[texto]', privateMenu: false, groupMenu: true },
  { command: 'stats', description: 'Estatisticas do grupo.', section: 'group_admin', privateMenu: false, groupMenu: true },
  { command: 'setwelcome', description: 'Define boas-vindas.', section: 'group_admin', usage: '<mensagem>', privateMenu: false, groupMenu: true },
  { command: 'setbye', description: 'Define despedida.', section: 'group_admin', usage: '<mensagem>', privateMenu: false, groupMenu: true },
  { command: 'antispam', description: 'Configura anti-spam.', section: 'group_admin', usage: '[subcomando]', privateMenu: false, groupMenu: true },
  { command: 'filter', description: 'Filtro de tipo de mensagem.', section: 'group_admin', usage: '<tipo> [on|off]', privateMenu: false, groupMenu: true },
];

export const COMMAND_ALIASES: Record<string, string> = {
  ...STATIC_COMMAND_ALIASES,
  ...capabilityRegistry.getAliasMap(),
};

export const COMMAND_EXECUTORS: Record<string, string | null> = {
  ...STATIC_COMMAND_EXECUTORS,
  ...capabilityRegistry.getExplicitExecutorMap(),
};

export const TELEGRAM_COMMAND_CATALOG: CommandCatalogEntry[] = [
  ...STATIC_COMMAND_CATALOG,
  ...CAPABILITY_COMMAND_CATALOG.filter((entry) => !STATIC_COMMAND_CATALOG.some((staticEntry) => staticEntry.command === entry.command)),
];

export const KNOWN_COMMANDS = new Set(TELEGRAM_COMMAND_CATALOG.map((entry) => `/${entry.command}`));

export function resolveCommandAlias(commandType: string): string {
  return COMMAND_ALIASES[commandType] || commandType;
}

export function getExplicitExecutorForCommand(commandType: string): string | null {
  return commandType in COMMAND_EXECUTORS ? COMMAND_EXECUTORS[commandType] : null;
}

export function isKnownCommand(commandType: string): boolean {
  return KNOWN_COMMANDS.has(commandType);
}
