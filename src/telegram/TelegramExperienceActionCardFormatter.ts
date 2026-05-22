import { InlineKeyboard } from 'grammy';
import type {
  ExperienceActionCard,
  ExperienceSnapshot,
} from '../services/experience/index.js';

export type TelegramExperienceCardMessage = {
  text: string;
  replyOptions?: {
    reply_markup: InlineKeyboard;
  };
};

function asText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function clip(value: unknown, limit = 220): string {
  const text = asText(value);
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function stableId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export class TelegramExperienceActionCardFormatter {
  public formatSnapshot(snapshot: ExperienceSnapshot): TelegramExperienceCardMessage {
    const cards = (snapshot.actionCards || []).filter((card) => card.status === 'pending');
    const pendingApprovals = snapshot.daily?.pendingApprovals ?? snapshot.approvals.filter((approval) => approval.status === 'pending').length;
    const pendingLearning = snapshot.daily?.pendingLearning ?? snapshot.learning.pending;
    const lines = [
      'Zavorth Daily Control',
      '',
      `Estado: ${snapshot.agent.status}`,
      `Tarefa: ${clip(snapshot.daily?.activeTask || snapshot.agent.summary || 'nenhuma ativa', 120)}`,
      `Approvals: ${pendingApprovals} | Learning: ${pendingLearning}`,
      `Health: ${clip(snapshot.daily?.summary || snapshot.health.summary, 140)}`,
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
      replyOptions: this.keyboardForCards(cards, snapshot),
    };
  }

  public formatDiffSummary(snapshot: ExperienceSnapshot): TelegramExperienceCardMessage {
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
    return { text: lines.join('\n'), replyOptions: this.keyboardForUtility() };
  }

  public formatLearningSummary(snapshot: ExperienceSnapshot): TelegramExperienceCardMessage {
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
    return { text: lines.join('\n'), replyOptions: this.keyboardForUtility() };
  }

  public callbackDataFor(card: ExperienceActionCard, actionId: string): string {
    const opaque = stableId(`${card.id}:${actionId}`);
    return `xcard:${opaque}`;
  }

  private keyboardForCards(
    cards: ExperienceActionCard[],
    snapshot: ExperienceSnapshot,
  ): TelegramExperienceCardMessage['replyOptions'] {
    const keyboard = new InlineKeyboard();
    for (const card of cards.slice(0, 2)) {
      const primaryActions = card.actions.slice(0, 2);
      for (const action of primaryActions) {
        keyboard.text(clip(action.label, 24), this.callbackDataFor(card, action.id));
      }
      keyboard.row();
    }
    keyboard.text('Status', '/status').text('Dashboard', '/dashboard');
    if ((snapshot.diffReviews || []).length > 0) {
      keyboard.row().text('Ver diff', 'xcard:diff-summary');
    }
    return { reply_markup: keyboard };
  }

  private keyboardForUtility(): TelegramExperienceCardMessage['replyOptions'] {
    const keyboard = new InlineKeyboard()
      .text('Status', '/status')
      .text('Dashboard', '/dashboard');
    return { reply_markup: keyboard };
  }
}
