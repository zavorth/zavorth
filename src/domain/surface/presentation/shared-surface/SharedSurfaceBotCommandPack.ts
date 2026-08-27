import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import { PersonaRegistryService } from '../../../../runtime/agent/roster/PersonaRegistryService.js';
import { DynamicPersonaCompilerService } from '../../../../runtime/agent/roster/DynamicPersonaCompilerService.js';
import { PeerReviewAdvisoryService } from '../../../../runtime/agent/advisory/PeerReviewAdvisoryService.js';

export interface SharedSurfaceBotCommandPackDeps {
  personaRegistryService: PersonaRegistryService;
  dynamicCompilerService?: DynamicPersonaCompilerService;
  peerReviewService?: PeerReviewAdvisoryService;
}

export class SharedSurfaceBotCommandPack {
  private readonly registry: PersonaRegistryService;
  private readonly compiler: DynamicPersonaCompilerService;
  private readonly peerReviewService: PeerReviewAdvisoryService;

  constructor(deps: SharedSurfaceBotCommandPackDeps) {
    this.registry = deps.personaRegistryService;
    this.compiler = deps.dynamicCompilerService || new DynamicPersonaCompilerService();
    this.peerReviewService = deps.peerReviewService || new PeerReviewAdvisoryService();
  }

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    if (commandType === '/review') {
      await this.handleReview(ctx, String(args || '').trim());
      return true;
    }

    if (commandType !== '/bot') {
      return false;
    }

    const trimmedArgs = String(args || '').trim();
    const parts = trimmedArgs.split(/\s+/);
    const subCommand = (parts[0] || '').toLowerCase();
    const subArgs = parts.slice(1).join(' ').trim();

    switch (subCommand) {
      case 'list':
      case '':
        await this.handleList(ctx);
        return true;
      case 'create':
        await this.handleCreate(ctx, subArgs);
        return true;
      case 'inspect':
        await this.handleInspect(ctx, subArgs);
        return true;
      case 'delete':
        await this.handleDelete(ctx, subArgs);
        return true;
      case 'chat':
        await this.handleChat(ctx, subArgs);
        return true;
      case 'review':
        await this.handleReview(ctx, subArgs);
        return true;
      default:
        await this.handleHelp(ctx);
        return true;
    }
  }

  private async handleList(ctx: IMessageContext): Promise<void> {
    await this.registry.initialize();
    const personas = this.registry.listPersonas();

    if (personas.length === 0) {
      await ctx.reply('No personas currently registered. Create one using `/bot create <description>`.');
      return;
    }

    const lines = [
      '📋 **Zavorth Autonomous Personas Roster**',
      '',
      ...personas.map((p) => {
        const modeBadge = p.isolationMode === 'docker' ? '🐳 docker' : '⚡ direct';
        const passiveBadge = p.passiveInspectionEnabled ? '🛡️ observer' : '🎯 task';
        return `• **@${p.id}** (${p.name}) — _${p.role}_\n  Mode: \`${modeBadge}\` | \`${passiveBadge}\` | Tools: ${p.allowedTools?.length ?? 'all'}`;
      }),
      '',
      'Use `/bot inspect <id>` for details or mention `@<id>` to invoke.',
    ];

    await ctx.reply(lines.join('\n'));
  }

  private async handleCreate(ctx: IMessageContext, intentDescription: string): Promise<void> {
    if (!intentDescription) {
      await ctx.reply('Usage: `/bot create <description>`\nExample: `/bot create SQL database optimizer for slow postgres queries`');
      return;
    }

    await this.registry.initialize();
    try {
      const compiled = await this.compiler.compileFromIntent({
        userIntent: intentDescription,
      });

      const persona = await this.registry.registerPersona(compiled);

      const lines = [
        `✨ **Persona Created: @${persona.id}**`,
        '',
        `- **Name**: ${persona.name}`,
        `- **Role**: ${persona.role}`,
        `- **Isolation Mode**: \`${persona.isolationMode}\``,
        `- **Allowed Tools**: ${persona.allowedTools ? persona.allowedTools.map((t) => `\`${t}\``).join(', ') : 'All Workspace Tools'}`,
        '',
        `_Invoke by typing: \`@${persona.id} <your task>\` or \`/bot chat ${persona.id} <your task>\`_`,
      ];

      await ctx.reply(lines.join('\n'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Failed to create persona: ${message}`);
    }
  }

  private async handleInspect(ctx: IMessageContext, rawId: string): Promise<void> {
    if (!rawId) {
      await ctx.reply('Usage: `/bot inspect <id>`');
      return;
    }

    await this.registry.initialize();
    const persona = this.registry.getPersona(rawId);
    if (!persona) {
      await ctx.reply(`❌ Persona @${rawId} not found in the roster.`);
      return;
    }

    const lines = [
      `🤖 **Persona Details: @${persona.id}**`,
      '',
      `- **Name**: ${persona.name}`,
      `- **Role**: ${persona.role}`,
      `- **Avatar**: ${persona.avatar}`,
      `- **Isolation Mode**: \`${persona.isolationMode}\``,
      `- **Passive Inspection**: \`${persona.passiveInspectionEnabled ? 'Active' : 'Disabled'}\``,
      `- **Allowed Domains**: ${persona.allowedDomains && persona.allowedDomains.length > 0 ? persona.allowedDomains.map((d) => `\`${d}\``).join(', ') : 'None'}`,
      `- **Allowed Tools**: ${persona.allowedTools && persona.allowedTools.length > 0 ? persona.allowedTools.map((t) => `\`${t}\``).join(', ') : 'Default Workspace Tools'}`,
      '',
      '**System Prompt Instructions:**',
      '```markdown',
      persona.systemPrompt,
      '```',
    ];

    await ctx.reply(lines.join('\n'));
  }

  private async handleDelete(ctx: IMessageContext, rawId: string): Promise<void> {
    if (!rawId) {
      await ctx.reply('Usage: `/bot delete <id>`');
      return;
    }

    await this.registry.initialize();
    const deleted = await this.registry.deletePersona(rawId);
    if (deleted) {
      await ctx.reply(`🗑️ Persona @${rawId} successfully deleted.`);
    } else {
      await ctx.reply(`❌ Persona @${rawId} could not be deleted (not found or system protected).`);
    }
  }

  private async handleChat(ctx: IMessageContext, args: string): Promise<void> {
    const parts = args.split(/\s+/);
    const targetId = (parts[0] || '').toLowerCase();
    const prompt = parts.slice(1).join(' ').trim();

    if (!targetId || !prompt) {
      await ctx.reply('Usage: `/bot chat <id> <prompt>`\nExample: `/bot chat executor write tests for auth module`');
      return;
    }

    await this.registry.initialize();
    const persona = this.registry.getPersona(targetId);
    if (!persona) {
      await ctx.reply(`❌ Persona @${targetId} not found.`);
      return;
    }

    await ctx.reply(`🤖 [Persona: **@${persona.id}** (${persona.role})]: Processing your request...\n> "${prompt}"`);
  }

  private async handleReview(ctx: IMessageContext, topic: string): Promise<void> {
    if (!topic) {
      await ctx.reply('Usage: `/review <topic>` or `/bot review <topic>`\nExample: `/review Migrate auth session tokens to HTTP-only cookies`');
      return;
    }

    const debate = await this.peerReviewService.conductDialecticDebate(topic);
    const lines = [
      `🏛️ **Peer Review Dialectic Deliberation: "${debate.topic}"**`,
      '',
      `### 💡 Thesis: ${debate.thesis.name}`,
      `> **Position**: ${debate.thesis.position}`,
      ...debate.thesis.arguments.map((a) => `- ${a}`),
      '',
      `### 🛡️ Antithesis: ${debate.antithesis.name}`,
      `> **Position**: ${debate.antithesis.position}`,
      ...debate.antithesis.counterArguments.map((a) => `- ${a}`),
      '',
      `### ⚖️ Council Synthesis & Recommendation`,
      `**Consensus Points**:`,
      ...debate.synthesis.consensusPoints.map((c) => `✅ ${c}`),
      '',
      `**Actionable Recommendation**:`,
      `> ${debate.synthesis.actionableRecommendation}`,
    ];

    await ctx.reply(lines.join('\n'));
  }

  private async handleHelp(ctx: IMessageContext): Promise<void> {
    const lines = [
      '📖 **Zavorth Bot Command Reference**',
      '',
      '`/bot list` — List all registered personas in the roster',
      '`/bot create <intent>` — Synthesize and register a new persona from natural language',
      '`/bot inspect <id>` — View detailed configuration and system prompt of a persona',
      '`/bot delete <id>` — Remove a persona from the roster',
      '`/bot chat <id> <prompt>` — Dispatch a prompt directly to a specialized persona',
      '`/bot review <topic>` or `/review <topic>` — Trigger a dialectic multi-persona peer review deliberation',
    ];
    await ctx.reply(lines.join('\n'));
  }
}
