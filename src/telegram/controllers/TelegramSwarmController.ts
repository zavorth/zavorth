import type { IMessageContext } from '../../contracts/IMessageBroker.js';
import { SwarmOrchestrator, type SwarmRole } from '../../runtime/sessions/v2/SwarmOrchestrator.js';
import { LlmRuntimeService } from '../../services/llm/LlmRuntimeService.js';
import path from 'path';

type TelegramSwarmDeps = {
  botApi: {
    sendMessage(chatId: string | number, text: string, options?: Record<string, any>): Promise<any>;
    editMessageText(chatId: string | number, messageId: number, text: string, options?: Record<string, any>): Promise<any>;
  };
  getLlmRuntime: () => LlmRuntimeService;
  createSwarm?: (objective: string, roles: SwarmRole[], options: { llmRuntime: LlmRuntimeService; roleTimeoutMs: number }) => SwarmOrchestrator;
};

/**
 * TelegramSwarmController — Exposes the Swarm Orchestrator as a direct
 * Telegram command: `/swarm <objective>`.
 *
 * When a user sends `/swarm Pesquise sobre React 19 e crie um resumo`,
 * this controller:
 *  1. Spawns parallel PTY agents (Researcher + Actor roles)
 *  2. Sends a progress message that updates in real-time
 *  3. Returns the LLM-synthesized final answer
 */
export class TelegramSwarmController {
  private activeSwarms = new Map<string, { orchestrator: SwarmOrchestrator; progressMsgId: number | null }>();

  constructor(private readonly deps: TelegramSwarmDeps) {}

  /**
   * Handle the /swarm command.
   */
  public async handleSwarm(ctx: IMessageContext | any, args: string): Promise<void> {
    const chatId = ctx.chat?.id || ctx.message?.chat?.id;
    if (!chatId) return;

    const objective = (args || '').trim();
    if (!objective) {
      await this.deps.botApi.sendMessage(chatId, [
        '🐝 **Swarm Orchestrator**',
        '',
        'Uso: `/swarm <objetivo>`',
        '',
        'Exemplos:',
        '• `/swarm Pesquise sobre as novidades do React 19`',
        '• `/swarm Crie um script Python que converte CSV para JSON`',
        '• `/swarm Analise os logs do sistema e identifique erros`',
      ].join('\n'), { parse_mode: 'Markdown' });
      return;
    }

    // Send initial progress message
    const progressMsg = await this.deps.botApi.sendMessage(chatId, [
      '🐝 **Swarm Orchestrator Iniciado**',
      '',
      `📎 Objetivo: _${objective}_`,
      '',
      '🔄 Preparando agentes paralelos...',
      '',
      '`[Researcher]` ⏳ Aguardando...',
      '`[Actor]`      ⏳ Aguardando...',
    ].join('\n'), { parse_mode: 'Markdown' });

    const progressMsgId = progressMsg?.message_id;

    const zavorthCliPath = process.env.ZAVORTH_CLI_PATH || path.resolve(process.cwd(), 'dist', 'zavorth-cli.js');
    const objectiveCommand = `chat ${objective}`.trim();

    const roles: SwarmRole[] = [
      {
        id: 'swarm-researcher',
        label: 'Researcher',
        systemPrompt: 'Você é um Agente de Pesquisa. Foque em buscar, extrair e organizar informações relevantes sobre o objetivo.',
        command: process.execPath,
        args: [zavorthCliPath, '--platform', 'telegram', '--session', 'telegram-swarm-researcher', objectiveCommand],
      },
      {
        id: 'swarm-actor',
        label: 'Actor',
        systemPrompt: 'Você é um Agente de Ação. Foque em escrever código, executar comandos e produzir resultados concretos para o objetivo.',
        command: process.execPath,
        args: [zavorthCliPath, '--platform', 'telegram', '--session', 'telegram-swarm-actor', objectiveCommand],
      },
    ];

    const llmRuntime = this.deps.getLlmRuntime();
    const orchestrator = this.deps.createSwarm
      ? this.deps.createSwarm(objective, roles, { llmRuntime, roleTimeoutMs: 120000 })
      : new SwarmOrchestrator(objective, roles, { llmRuntime, roleTimeoutMs: 120000 });

    this.activeSwarms.set(chatId.toString(), { orchestrator, progressMsgId });

    // Listen for role events and update progress
    orchestrator.on('role:started', (data: any) => {
      this.updateProgress(chatId, progressMsgId, objective, data.roleId, 'running');
    });

    orchestrator.on('role:finished', (data: any) => {
      this.updateProgress(chatId, progressMsgId, objective, data.roleId, data.status === 'IDLE' ? 'done' : 'error');
    });

    try {
      const snapshot = await orchestrator.execute();

      const synthesized = snapshot.synthesizedOutput || 'Síntese não disponível.';
      const statusEmoji = snapshot.status === 'completed' ? '✅' : '⚠️';

      const finalMessage = [
        `🐝 **Swarm Orchestrator ${statusEmoji}**`,
        '',
        `📎 Objetivo: _${objective}_`,
        '',
        `📊 Status: **${snapshot.status}**`,
        `⏱️ Duração: ${this.calculateDuration(snapshot.startedAt, snapshot.finishedAt)}`,
        `👥 Agentes: ${snapshot.roles.length}`,
        '',
        '---',
        '',
        synthesized,
      ].join('\n');

      // Truncate if too long for Telegram
      const maxLen = 4000;
      const truncated = finalMessage.length > maxLen
        ? finalMessage.slice(0, maxLen) + '\n\n... _(truncado)_'
        : finalMessage;

      await this.deps.botApi.sendMessage(chatId, truncated, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await this.deps.botApi.sendMessage(chatId,
        `🐝❌ **Swarm falhou**: ${err.message || err}`,
        { parse_mode: 'Markdown' },
      );
    } finally {
      this.activeSwarms.delete(chatId.toString());
    }
  }

  /**
   * Get status of active swarm for a chat.
   */
  public getActiveSwarm(chatId: string): SwarmOrchestrator | null {
    return this.activeSwarms.get(chatId)?.orchestrator || null;
  }

  private async updateProgress(
    chatId: string | number,
    messageId: number | null,
    objective: string,
    roleId: string,
    status: 'running' | 'done' | 'error',
  ): Promise<void> {
    if (!messageId) return;

    const emojis: Record<string, string> = {
      running: '🔄',
      done: '✅',
      error: '❌',
    };

    try {
      const researcherStatus = roleId.includes('researcher') ? emojis[status] : '⏳';
      const actorStatus = roleId.includes('actor') ? emojis[status] : '⏳';

      await this.deps.botApi.editMessageText(chatId, messageId, [
        '🐝 **Swarm Orchestrator em Execução...**',
        '',
        `📎 Objetivo: _${objective}_`,
        '',
        `\`[Researcher]\` ${researcherStatus} ${status === 'running' && roleId.includes('researcher') ? 'Processando...' : ''}`,
        `\`[Actor]\`      ${actorStatus} ${status === 'running' && roleId.includes('actor') ? 'Processando...' : ''}`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch {
      // edit may fail if message is unchanged or too fast — ignore
    }
  }

  private calculateDuration(start: string | null, end: string | null): string {
    if (!start || !end) return 'N/A';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
}
