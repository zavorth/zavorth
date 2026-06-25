import { Database } from '../storage/Database.js';

export const CONTEXTUAL_TIP_FLAGS = {
  FIRST_LOOP_USE: 'loop_first_use',
  FIRST_LOOP_GRILL: 'loop_first_grill',
  FIRST_EXECUTION_ERROR: 'first_execution_error',
  FIRST_DOCTOR_SUGGESTION: 'first_doctor_suggestion',
  FIRST_LOW_LOOP_SCORE: 'loop_score_below_8',
  FIRST_LONG_SESSION: 'session_over_30_messages',
  FIRST_TEMPLATE_USE: 'first_template_use',
  FIRST_CHANNEL_SETUP: 'first_channel_setup',
  ONBOARDING_COMPLETED: 'onboarding_completed',
} as const;

export type ContextualTipFlag = typeof CONTEXTUAL_TIP_FLAGS[keyof typeof CONTEXTUAL_TIP_FLAGS];

export type ContextualTip = {
  flag: ContextualTipFlag;
  message: string;
  emoji: string;
};

const TIP_MESSAGES: Record<ContextualTipFlag, ContextualTip> = {
  [CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_USE]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_USE,
    emoji: '💡',
    message: 'Dica: use `/loop --grill` para que eu faça perguntas antes de executar, gerando resultados mais precisos.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_GRILL]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_GRILL,
    emoji: '💡',
    message: 'Dica: no modo --grill, quanto mais detalhadas suas respostas, melhores os critérios de avaliação.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_EXECUTION_ERROR]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_EXECUTION_ERROR,
    emoji: '🔧',
    message: 'Dica: `zavorth doctor --simple` mostra exatamente o que está faltando no seu ambiente.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_DOCTOR_SUGGESTION]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_DOCTOR_SUGGESTION,
    emoji: '🩺',
    message: 'Dica: use `zavorth doctor --advanced` para um diagnóstico completo incluindo sandbox e providers.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_LOW_LOOP_SCORE]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_LOW_LOOP_SCORE,
    emoji: '📈',
    message: 'Dica: quando a nota fica abaixo de 8, o loop foca no ponto mais fraco automaticamente. Use `--grill` para refinar os critérios.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_LONG_SESSION]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_LONG_SESSION,
    emoji: '📋',
    message: 'Dica: sessões longas podem perder contexto. Use `/reset` para iniciar uma sessão limpa mantendo sua memória persistente.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_TEMPLATE_USE]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_TEMPLATE_USE,
    emoji: '📦',
    message: 'Dica: templates são missões guiadas. Use `zavorth templates` para ver todas as opções disponíveis.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_CHANNEL_SETUP]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_CHANNEL_SETUP,
    emoji: '🔗',
    message: 'Dica: após conectar um canal, use `zavorth gateway status` para verificar a saúde da conexão.',
  },
  [CONTEXTUAL_TIP_FLAGS.ONBOARDING_COMPLETED]: {
    flag: CONTEXTUAL_TIP_FLAGS.ONBOARDING_COMPLETED,
    emoji: '🎉',
    message: 'Setup concluído! Use `zavorth templates` para escolher sua primeira missão guiada, ou simplesmente me diga o que precisa.',
  },
};

/**
 * ZavorthContextualTipsService — gerencia dicas contextuais exibidas uma única vez
 * durante a primeira interação do usuário com funcionalidades específicas.
 */
export class ZavorthContextualTipsService {
  private db!: Database;
  private initialized = false;
  private now: () => Date;

  constructor(opts?: { db?: Database; now?: () => Date }) {
    if (opts?.db) {
      this.db = opts.db;
    }
    this.now = opts?.now ?? (() => new Date());
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    if (!this.db) {
      this.db = await Database.getInstance();
    }
    this.db.run(`
      CREATE TABLE IF NOT EXISTS contextual_tips_seen (
        flag TEXT PRIMARY KEY,
        seen_at TEXT NOT NULL
      )
    `);
    this.initialized = true;
  }

  public async isSeen(flag: ContextualTipFlag): Promise<boolean> {
    await this.init();
    const row = this.db.get<{ flag: string }>(
      'SELECT flag FROM contextual_tips_seen WHERE flag = ?',
      [flag],
    );
    return !!row;
  }

  public async markSeen(flag: ContextualTipFlag): Promise<void> {
    await this.init();
    this.db.run(
      `INSERT OR REPLACE INTO contextual_tips_seen (flag, seen_at) VALUES (?, ?)`,
      [flag, this.now().toISOString()],
    );
  }

  public async getTipIfUnseen(flag: ContextualTipFlag): Promise<ContextualTip | null> {
    await this.init();
    const seen = await this.isSeen(flag);
    if (seen) return null;
    await this.markSeen(flag);
    return TIP_MESSAGES[flag] ?? null;
  }

  public async formatTip(tip: ContextualTip): Promise<string> {
    return `${tip.emoji} ${tip.message}`;
  }

  public async getAllSeenFlags(): Promise<ContextualTipFlag[]> {
    await this.init();
    const rows = this.db.all<{ flag: string }>('SELECT flag FROM contextual_tips_seen');
    return rows.map((r) => r.flag as ContextualTipFlag);
  }

  public async resetAll(): Promise<void> {
    await this.init();
    this.db.run('DELETE FROM contextual_tips_seen');
  }
}
