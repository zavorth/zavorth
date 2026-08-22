import type { Context } from 'grammy';
import { SwarmOrchestrator, type SwarmRole } from '@zavorth/runtime/sessions/v2/SwarmOrchestrator.js';
import { LlmRuntimeService } from '@zavorth/services/llm/LlmRuntimeService.js';
import path from 'path';
import { logger } from '../../../../logger';
import { asErrorLike } from '../../../../utils/errorLike';

type TelegramSwarmDeps = {
  botApi: {
    sendMessage(chatId: string | number, text: string, options?: Record<string, any>): Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editMessageText(chatId: string | number, messageId: number, text: string, options?: Record<string, any>): Promise<any>;
  };
  getLlmRuntime: () => LlmRuntimeService;
  createSwarm?: (objective: string, roles: SwarmRole[], options: { llmRuntime: LlmRuntimeService; roleTimeoutMs: number }) => SwarmOrchestrator;
};

/**
 * TelegramSwarmController — Exposes the Swarm Orchestrator as a direct
 * Telegram command: `/swarm <objective>`.
 *
 * When a user sends `/swarm Research React 19 and create a summary`,
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
  public async handleSwarm(ctx: Context, args: string): Promise<void> {
    const chatId = ctx.chat?.id || ctx.message?.chat?.id;
    if (!chatId) return;

    const objective = (args || '').trim();
    if (!objective) {
      await this.deps.botApi.sendMessage(chatId, [
        '🐝 **Swarm Orchestrator**',
        '',
        'Usage: `/swarm <objective>`',
        '',
        'Examples:',
        '• `/swarm Research the latest React 19 features`',
        '• `/swarm Create a Python script that converts CSV to JSON`',
        '• `/swarm Analyze system logs and identify errors`',
      ].join('\n'), { parse_mode: 'Markdown' });
      return;
    }

    // Send initial progress message
    const progressMsg = await this.deps.botApi.sendMessage(chatId, [
      '🐝 **Swarm Orchestrator Started**',
      '',
      `📎 Objective: _${objective}_`,
      '',
      '🔄 Preparing parallel agents...',
      '',
      '`[Researcher]` ⏳ Waiting...',
      '`[Actor]`      ⏳ Waiting...',
    ].join('\n'), { parse_mode: 'Markdown' });

    const progressMsgId = progressMsg?.message_id;

    const zavorthCliPath = process.env.ZAVORTH_CLI_PATH || path.resolve(process.cwd(), 'dist', 'zavorth-cli.js');
    const objectiveCommand = `chat ${objective}`.trim();

    const roles: SwarmRole[] = [
      {
        id: 'swarm-researcher',
        label: 'Researcher',
        systemPrompt: 'You are a Research Agent. Focus on searching, extracting, and organizing relevant information about the objective.',
        command: process.execPath,
        args: [zavorthCliPath, '--platform', 'telegram', '--session', 'telegram-swarm-researcher', objectiveCommand],
      },
      {
        id: 'swarm-actor',
        label: 'Actor',
        systemPrompt: 'You are an Action Agent. Focus on writing code, executing commands, and producing concrete results for the objective.',
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
    orchestrator.on('role:started', (data: Record<string, unknown>) => {
      const roleId = typeof data.roleId === 'string' ? data.roleId : String(data.roleId ?? '');
      this.updateProgress(chatId, progressMsgId, objective, roleId, 'running');
    });

    orchestrator.on('role:finished', (data: Record<string, unknown>) => {
      const roleId = typeof data.roleId === 'string' ? data.roleId : String(data.roleId ?? '');
      this.updateProgress(chatId, progressMsgId, objective, roleId, data.status === 'IDLE' ? 'done' : 'error');
    });

    try {
      const snapshot = await orchestrator.execute();

      const synthesized = snapshot.synthesizedOutput || 'Synthesis not available.';
      const statusEmoji = snapshot.status === 'completed' ? '✅' : '⚠️';

      const finalMessage = [
        `🐝 **Swarm Orchestrator ${statusEmoji}**`,
        '',
        `📎 Objective: _${objective}_`,
        '',
        `📊 Status: **${snapshot.status}**`,
        `⏱️ Duration: ${this.calculateDuration(snapshot.startedAt, snapshot.finishedAt)}`,
        `👥 Agents: ${snapshot.roles.length}`,
        '',
        '---',
        '',
        synthesized,
      ].join('\n');

      // Truncate if too long for Telegram
      const maxLen = 4000;
      const truncated = finalMessage.length > maxLen
        ? finalMessage.slice(0, maxLen) + '\n\n... _(truncated)_'
        : finalMessage;

      await this.deps.botApi.sendMessage(chatId, truncated, { parse_mode: 'Markdown' });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errMessage = err instanceof Error ? err.message : String(err);
      await this.deps.botApi.sendMessage(chatId,
        `🐝❌ **Swarm failed**: ${errMessage}`,
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
        '🐝 **Swarm Orchestrator Running...**',
        '',
        `📎 Objective: _${objective}_`,
        '',
        `\`[Researcher]\` ${researcherStatus} ${status === 'running' && roleId.includes('researcher') ? 'Processing...' : ''}`,
        `\`[Actor]\`      ${actorStatus} ${status === 'running' && roleId.includes('actor') ? 'Processing...' : ''}`,
      ].join('\n'), { parse_mode: 'Markdown' });
    } catch (error: unknown) {// edit may fail if message is unchanged or too fast — ignore
      logger.warn('[Telegram Swarm] parsing failed', error);
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
