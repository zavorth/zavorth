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
    message: 'Tip: use `/loop --grill` so I ask questions before running, producing more precise results.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_GRILL]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_GRILL,
    emoji: '💡',
    message: 'Tip: in --grill mode, more detailed answers produce better evaluation criteria.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_EXECUTION_ERROR]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_EXECUTION_ERROR,
    emoji: '🔧',
    message: 'Tip: `zavorth doctor --simple` shows exactly what is missing in your environment.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_DOCTOR_SUGGESTION]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_DOCTOR_SUGGESTION,
    emoji: '🩺',
    message: 'Tip: use `zavorth doctor --advanced` for a complete diagnostic including sandbox and providers.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_LOW_LOOP_SCORE]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_LOW_LOOP_SCORE,
    emoji: '📈',
    message: 'Tip: when the score drops below 8, the loop focuses on the weakest point automatically. Use `--grill` to refine the criteria.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_LONG_SESSION]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_LONG_SESSION,
    emoji: '📋',
    message: 'Tip: long sessions can lose context. Use `/reset` to start a clean session while keeping persistent memory.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_TEMPLATE_USE]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_TEMPLATE_USE,
    emoji: '📦',
    message: 'Tip: templates are guided missions. Use `zavorth templates` to see all available options.',
  },
  [CONTEXTUAL_TIP_FLAGS.FIRST_CHANNEL_SETUP]: {
    flag: CONTEXTUAL_TIP_FLAGS.FIRST_CHANNEL_SETUP,
    emoji: '🔗',
    message: 'Tip: after connecting a channel, use `zavorth gateway status` to check connection health.',
  },
  [CONTEXTUAL_TIP_FLAGS.ONBOARDING_COMPLETED]: {
    flag: CONTEXTUAL_TIP_FLAGS.ONBOARDING_COMPLETED,
    emoji: '🎉',
    message: 'Setup complete. Use `zavorth templates` to choose your first guided mission, or simply tell me what you need.',
  },
};

/**
 * ZavorthContextualTipsService manages contextual tips shown once
 * during the user's first interaction with specific features.
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
