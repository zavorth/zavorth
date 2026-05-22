import { InlineKeyboard } from 'grammy';
import type {
  ExperienceActionCard,
  ExperienceSnapshot,
} from '../services/experience/index.js';
import {
  defaultTelegramExperienceActionCardRegistry,
  type TelegramExperienceActionCardRegistry,
  type TelegramExperienceCallbackScope,
} from './TelegramExperienceActionCardRegistry.js';

export type TelegramExperienceCardMessage = {
  text: string;
  replyOptions?: {
    reply_markup: InlineKeyboard;
  };
};

export type TelegramExperienceRenderOptions = {
  scope?: TelegramExperienceCallbackScope;
  ttlMs?: number;
};

function asText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function clip(value: unknown, limit = 220): string {
  const text = asText(value);
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

export class TelegramExperienceActionCardFormatter {
  constructor(
    private readonly registry: TelegramExperienceActionCardRegistry = defaultTelegramExperienceActionCardRegistry,
  ) {}

  public formatSnapshot(snapshot: ExperienceSnapshot, options: TelegramExperienceRenderOptions = {}): TelegramExperienceCardMessage {
    const cards = (snapshot.actionCards || []).filter((card) => card.status === 'pending');
    const pendingApprovals = snapshot.daily?.pendingApprovals ?? snapshot.approvals.filter((approval) => approval.status === 'pending').length;
    const pendingLearning = snapshot.daily?.pendingLearning ?? snapshot.learning.pending;
    const pulse = snapshot.daily?.pulse;
    const profile = snapshot.responseProfile || snapshot.daily?.responseProfile || pulse?.profile;
    const lines = [
      'Zavorth Daily Control',
      '',
      `Estado: ${snapshot.agent.status}`,
      `Pulse: ${clip(pulse?.headline || snapshot.daily?.summary || snapshot.health.summary, 140)}`,
      `Tarefa: ${clip(snapshot.daily?.activeTask || pulse?.activeTask || snapshot.agent.summary || 'nenhuma ativa', 120)}`,
      `Approvals: ${pendingApprovals} | Learning: ${pendingLearning}`,
      `Perfil: ${clip(profile?.label || 'padrao', 40)}`,
      `Proximo: ${clip(pulse?.bestNextAction?.label || 'enviar um pedido natural', 120)}`,
    ];

    if (cards.length > 0) {
      lines.push('', 'Acoes pendentes');
      for (const card of cards.slice(0, 3)) {
        lines.push(`- ${card.title} [${card.risk}]`);
        lines.push(`  ${clip(card.summary, 120)}`);
      }
    } else {
      lines.push('', 'Sem action cards pendentes agora.');
    }

    return {
      text: lines.join('\n'),
      replyOptions: this.keyboardForCards(cards, snapshot, options),
    };
  }

  public formatDiffSummary(
    snapshot: ExperienceSnapshot,
    options: TelegramExperienceRenderOptions = {},
  ): TelegramExperienceCardMessage {
    const reviews = snapshot.diffReviews || [];
    const lines = ['Zavorth Diff Review', ''];
    if (!reviews.length) {
      lines.push('Nenhum diff de sandbox disponivel para revisao.');
    } else {
      for (const review of reviews.slice(0, 3)) {
        lines.push(`- ${review.title} [${review.risk}]`);
        lines.push(`  ${review.summary}`);
        for (const file of review.files.slice(0, 4)) {
          lines.push(`  ${file.path}: +${file.addedLines}/-${file.removedLines}`);
        }
      }
      lines.push('', 'Detalhe completo: use o Dashboard ou `zavorth diff`.');
    }
    return { text: lines.join('\n'), replyOptions: this.keyboardForUtility(options) };
  }

  public formatLearningSummary(
    snapshot: ExperienceSnapshot,
    options: TelegramExperienceRenderOptions = {},
  ): TelegramExperienceCardMessage {
    const candidates = snapshot.learning.candidates || [];
    const lines = ['Zavorth Learning OS', '', clip(snapshot.learning.summary, 180)];
    if (candidates.length > 0) {
      lines.push('', 'Candidatos');
      for (const candidate of candidates.slice(0, 4)) {
        lines.push(`- ${candidate.title} (${Math.round(candidate.confidence * 100)}%, ${candidate.state})`);
        lines.push(`  ${clip(candidate.recommendation, 120)}`);
      }
    } else {
      lines.push('', 'Nenhum candidato pendente.');
    }
    return { text: lines.join('\n'), replyOptions: this.keyboardForUtility(options) };
  }

  public callbackDataFor(
    card: ExperienceActionCard,
    actionId: string,
    options: TelegramExperienceRenderOptions = {},
  ): string {
    const action = card.actions.find((candidate) => candidate.id === actionId);
    return this.registry.register({
      cardId: card.id,
      actionId,
      commandText: action?.command || action?.label || actionId,
      scope: options.scope || null,
      ttlMs: options.ttlMs,
    });
  }

  private keyboardForCards(
    cards: ExperienceActionCard[],
    snapshot: ExperienceSnapshot,
    options: TelegramExperienceRenderOptions,
  ): TelegramExperienceCardMessage['replyOptions'] {
    const keyboard = new InlineKeyboard();
    for (const card of cards.slice(0, 2)) {
      const primaryActions = card.actions.slice(0, 2);
      for (const action of primaryActions) {
        keyboard.text(clip(action.label, 24), this.callbackDataFor(card, action.id, options));
      }
      keyboard.row();
    }
    keyboard.text('Status', '/status').text('Dashboard', '/dashboard');
    if ((snapshot.diffReviews || []).length > 0) {
      const callbackData = this.registry.register({
        cardId: 'utility:diff-summary',
        actionId: 'view-diff-summary',
        commandText: 'ver diff',
        scope: options.scope || null,
        ttlMs: options.ttlMs,
      });
      keyboard.row().text('Ver diff', callbackData);
    }
    return { reply_markup: keyboard };
  }

  private keyboardForUtility(options: TelegramExperienceRenderOptions): TelegramExperienceCardMessage['replyOptions'] {
    const keyboard = new InlineKeyboard()
      .text('Status', '/status')
      .text('Dashboard', '/dashboard');
    const diffCallback = this.registry.register({
      cardId: 'utility:diff-summary',
      actionId: 'view-diff-summary',
      commandText: 'ver diff',
      scope: options.scope || null,
      ttlMs: options.ttlMs,
    });
    keyboard.row().text('Ver diff', diffCallback);
    return { reply_markup: keyboard };
  }
}
