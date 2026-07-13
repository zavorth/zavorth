/**
 * Slash-command handlers for /learn-skill, /model, /export, /consensus.
 * Works on any shared surface (Telegram, WhatsApp, Discord, web, desktop, Control).
 */

import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import { SessionModelRouteService } from '../../../../services/SessionModelRouteService.js';
import { ZavorthSessionTranscriptExportService } from '../../../../services/ZavorthSessionTranscriptExportService.js';
import { ZavorthLearnSkillService } from '../../../../services/ZavorthLearnSkillService.js';
import { invokeConsensusSurface, formatConsensusHelp } from '../../../../services/ConsensusSurface.js';
import { errorMessage } from '../../../../utils/errorLike.js';
import { tService } from '../../../../i18n/services.js';

export class SharedSurfaceSlashEnhancementCommandPack {
  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    const type = String(commandType || '').trim().toLowerCase();
    if (type === '/learn-skill' || type === '/learnskill') {
      await this.handleLearnSkill(ctx, args);
      return true;
    }
    if (type === '/model') {
      await this.handleModel(ctx, args);
      return true;
    }
    if (type === '/export') {
      await this.handleExport(ctx, args);
      return true;
    }
    if (type === '/consensus' || type === '/deliberate' || type === '/moa') {
      await this.handleConsensus(ctx, args);
      return true;
    }
    return false;
  }

  private async handleConsensus(ctx: IMessageContext, args: string): Promise<void> {
    const raw = String(args || '').trim();
    if (raw === 'help' || raw === '-h' || raw === '--help') {
      await ctx.reply(formatConsensusHelp());
      return;
    }

    try {
      const tokens = raw ? tokenizeSlashArgs(raw) : [];
      const sessionId = this.resolveSessionId(ctx);
      const result = await invokeConsensusSurface({
        tokens,
        sessionId,
        projectRoot: process.cwd(),
      });
      await ctx.reply(result.text);
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tService('slash.consensus_failed')));
    }
  }

  private async handleLearnSkill(ctx: IMessageContext, args: string): Promise<void> {
    const parsed = parseLearnSkillArgs(args);
    if (!parsed.source) {
      await ctx.reply([
        tService('slash.learn_skill_usage_title'),
        '',
        `${tService('slash.usage')}:`,
        '  /learn-skill <url|path|notes>                 (natural preview)',
        '  /learn-skill <source> --apply --consent       (apply with consent)',
        '  /learn-skill apply <source> --consent',
        '  /learn-skill <source> --apply --approval-id <id>',
        '  /learn-skill <url> --confirm-live-network',
        '',
        'Preview is the default. Apply requires --consent/--yes or --approval-id.',
      ].join('\n'));
      return;
    }

    try {
      const service = new ZavorthLearnSkillService({ projectRoot: process.cwd() });
      const snap = await service.learn({
        source: parsed.source,
        apply: parsed.apply,
        consent: parsed.consent || Boolean(parsed.approvalId),
        approvalId: parsed.approvalId,
        confirmLiveNetwork: parsed.confirmLiveNetwork,
        allowExecutable: parsed.allowExecutable,
        allowAllCandidates: parsed.allowAll,
        label: parsed.source.slice(0, 80),
      });
      const lines = [
        snap.narrative.headline,
        snap.narrative.operatorSummary,
        '',
        `${tService('slash.status')}: ${snap.status}`,
        `${tService('slash.source_kind')}: ${snap.sourceKind}`,
        `${tService('slash.apply_requested')}: ${snap.applyRequested} | consent: ${snap.consentGranted}`,
        `${tService('slash.candidates')}: ${snap.fabric.summary.candidates}`,
        `${tService('slash.materialized')}: ${snap.fabric.summary.materialized}`,
        `${tService('slash.quarantine')}: ${snap.fabric.quarantineRoot}`,
        '',
        `${tService('slash.next')}: ${snap.narrative.nextStep}`,
      ];
      if (snap.status === 'preview' || snap.status === 'approval-required') {
        lines.push(`${tService('slash.apply')}: /learn-skill ${parsed.source} --apply --consent`);
      }
      await ctx.reply(lines.join('\n'));
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tService('slash.learn_skill_failed')));
    }
  }

  private async handleModel(ctx: IMessageContext, args: string): Promise<void> {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const sessionId = this.resolveSessionId(ctx);
    const service = SessionModelRouteService.getInstance();

    if (tokens.length === 0 || tokens[0] === 'status' || tokens[0] === 'usage') {
      const ledger = service.getLedger(sessionId);
      const lines = [
        tService('slash.session_model_route'),
        '',
        `${tService('slash.session')}: ${sessionId}`,
        `${tService('slash.active')}: ${ledger.route ? `${ledger.route.providerName || 'any'}/${ledger.route.modelName}` : '(default runtime)'}`,
        '',
        `${tService('slash.usage_by_model')}:`,
      ];
      const keys = Object.keys(ledger.totalsByModel);
      if (keys.length === 0) {
        lines.push(`  ${tService('slash.empty')}`);
      } else {
        for (const key of keys.slice(0, 12)) {
          const row = ledger.totalsByModel[key];
          lines.push(`  - ${key}: ${row.calls} call(s), in=${row.inputTokens} out=${row.outputTokens}`);
        }
      }
      lines.push('', `${tService('slash.usage')}: /model <modelName> [provider]`);
      lines.push('CLI: zavorth session model <sessionId> <model> --provider <name>');
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (tokens[0] === 'clear') {
      service.clearSessionModel(sessionId);
      await ctx.reply(tService('slash.session_model_cleared', { sessionId }));
      return;
    }

    const modelName = tokens[0];
    const providerName = tokens[1] || null;
    try {
      const ledger = service.setSessionModel({
        sessionId,
        modelName,
        providerName,
        source: 'slash',
      });
      await ctx.reply([
        tService('slash.session_model_updated'),
        `${tService('slash.session')}: ${sessionId}`,
        `Model: ${ledger.route?.providerName || 'any'}/${ledger.route?.modelName}`,
        tService('slash.subsequent_turns_note'),
      ].join('\n'));
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tService('slash.session_model_failed')));
    }
  }

  private async handleExport(ctx: IMessageContext, args: string): Promise<void> {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const formatToken = tokens.find((t) => /^(markdown|md|html|prompt|prompt-only)$/i.test(t));
    const format = !formatToken
      ? 'markdown'
      : /html/i.test(formatToken)
        ? 'html'
        : /prompt/i.test(formatToken)
          ? 'prompt'
          : 'markdown';
    const sessionId = this.resolveSessionId(ctx);

    try {
      const service = new ZavorthSessionTranscriptExportService({ projectRoot: process.cwd() });
      const snap = service.export({
        sessionId,
        platform: String(ctx.platform || 'web'),
        chatId: String(ctx.chatId || sessionId),
        format,
        redact: true,
      });

      if (snap.status === 'empty') {
        await ctx.reply([
          tService('slash.session_export'),
          '',
          tService('slash.session_export_empty', { sessionId }),
          'CLI with inline messages: zavorth session export --messages-file msgs.json --format markdown',
        ].join('\n'));
        return;
      }

      const preview = snap.bodyPreview.length > 2800
        ? `${snap.bodyPreview.slice(0, 2800)}\n\n… (${tService('slash.preview_truncated')})`
        : snap.bodyPreview;
      await ctx.reply([
        `${tService('slash.session_export')} (${snap.format}) — ${snap.status}`,
        `${tService('slash.messages')}: ${snap.messageCount} | ${tService('slash.redacted')}: ${snap.safety.secretsRedacted}`,
        '',
        preview,
        '',
        `${tService('slash.write_full_file')}: ${snap.commands.apply}`,
      ].join('\n'));
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tService('slash.session_export_failed')));
    }
  }

  private resolveSessionId(ctx: IMessageContext): string {
    const sessionId = String((ctx as { sessionId?: string }).sessionId || '').trim();
    if (sessionId) return sessionId;
    const chatId = String(ctx.chatId || '').trim();
    const userId = String(ctx.userId || '').trim();
    const platform = String(ctx.platform || 'web').trim();
    return chatId || `${platform}:${userId || 'user'}`;
  }
}

function parseLearnSkillArgs(raw: string): {
  source: string;
  apply: boolean;
  consent: boolean;
  approvalId: string | null;
  confirmLiveNetwork: boolean;
  allowExecutable: boolean;
  allowAll: boolean;
} {
  const tokens = String(raw || '').trim().split(/\s+/).filter(Boolean);
  let apply = false;
  let consent = false;
  let confirmLiveNetwork = false;
  let allowExecutable = false;
  let allowAll = false;
  let approvalId: string | null = null;
  const sourceParts: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const lower = t.toLowerCase();
    if (lower === 'apply' || lower === '--apply') {
      apply = true;
      continue;
    }
    if (lower === 'consent' || lower === '--consent' || lower === '--yes' || lower === 'yes') {
      consent = true;
      continue;
    }
    if (lower === '--confirm-live-network' || lower === 'confirm-live-network') {
      confirmLiveNetwork = true;
      continue;
    }
    if (lower === '--allow-executable' || lower === 'allow-executable') {
      allowExecutable = true;
      continue;
    }
    if (lower === '--allow-all' || lower === 'allow-all') {
      allowAll = true;
      continue;
    }
    if (lower === '--approval-id' || lower === 'approval-id') {
      approvalId = tokens[i + 1] || null;
      i += 1;
      continue;
    }
    if (lower.startsWith('--approval-id=')) {
      approvalId = t.slice('--approval-id='.length) || null;
      continue;
    }
    sourceParts.push(t);
  }

  return {
    source: sourceParts.join(' ').trim(),
    apply,
    consent,
    approvalId,
    confirmLiveNetwork,
    allowExecutable,
    allowAll,
  };
}

function tokenizeSlashArgs(raw: string): string[] {
  const text = String(raw || '').trim();
  if (!text) return [];
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return tokens.filter(Boolean);
}
