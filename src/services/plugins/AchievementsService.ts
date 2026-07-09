import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'usage' | 'mastery' | 'exploration' | 'social' | 'creation' | 'security' | 'productivity';
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  criteria: {
    type: 'count' | 'streak' | 'unique' | 'threshold' | 'manual';
    target: number;
    metric: string;
  };
  unlocked: boolean;
  unlocked_at: string | null;
  progress: number;
  hidden: boolean;
}

export interface UserAchievementState {
  user_id: string;
  total_points: number;
  level: number;
  unlocked_count: number;
  achievements: Record<string, { unlocked: boolean; progress: number; unlocked_at: string | null }>;
  streaks: Record<string, { current: number; best: number; last_update: string }>;
  stats: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export class AchievementsService {
  private readonly storageDir: string;
  private achievements: Achievement[] = [];
  private userStates: Map<string, UserAchievementState> = new Map();
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly SAVE_DELAY_MS = 1000;

  private readonly TIER_POINTS: Record<string, number> = {
    bronze: 10,
    silver: 25,
    gold: 50,
    platinum: 100,
    diamond: 250,
  };

  private readonly LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000];

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'achievements');
    this.ensureStorageDir();
    this.initDefaultAchievements();
    this.loadUserStates();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private initDefaultAchievements(): void {
    this.achievements = [
      { id: 'first_tool', name: 'First Tool', description: 'Execute your first tool', category: 'usage', icon: '🔧', tier: 'bronze', criteria: { type: 'count', target: 1, metric: 'tool_executions' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'tool_master', name: 'Tool Master', description: 'Execute 100 tools', category: 'usage', icon: '⚙️', tier: 'gold', criteria: { type: 'count', target: 100, metric: 'tool_executions' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'tool_legend', name: 'Tool Legend', description: 'Execute 1000 tools', category: 'usage', icon: '👑', tier: 'diamond', criteria: { type: 'count', target: 1000, metric: 'tool_executions' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'first_skill', name: 'First Skill', description: 'Use your first skill', category: 'exploration', icon: '📚', tier: 'bronze', criteria: { type: 'count', target: 1, metric: 'skill_uses' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'skill_collector', name: 'Skill Collector', description: 'Use 10 different skills', category: 'exploration', icon: '🎒', tier: 'silver', criteria: { type: 'unique', target: 10, metric: 'unique_skills' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'multi_channel', name: 'Multi-Channel', description: 'Send messages in 5 different channels', category: 'social', icon: '📡', tier: 'silver', criteria: { type: 'unique', target: 5, metric: 'unique_channels' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'code_reviewer', name: 'Code Reviewer', description: 'Do 10 code reviews', category: 'mastery', icon: '🔍', tier: 'silver', criteria: { type: 'count', target: 10, metric: 'code_reviews' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'security_guardian', name: 'Security Guardian', description: 'Block 5 dangerous actions', category: 'security', icon: '🛡️', tier: 'gold', criteria: { type: 'count', target: 5, metric: 'blocked_actions' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'voice_user', name: 'Active Voice', description: 'Use voice mode for the first time', category: 'exploration', icon: '🎤', tier: 'bronze', criteria: { type: 'count', target: 1, metric: 'voice_sessions' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'document_extractor', name: 'Document Extractor', description: 'Extract text from 10 documents', category: 'productivity', icon: '📄', tier: 'silver', criteria: { type: 'count', target: 10, metric: 'document_extractions' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'api_explorer', name: 'API Explorer', description: 'Make 20 HTTP requests', category: 'exploration', icon: '🌐', tier: 'silver', criteria: { type: 'count', target: 20, metric: 'api_requests' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'scheduler', name: 'Scheduler', description: 'Create 5 scheduled jobs', category: 'productivity', icon: '⏰', tier: 'bronze', criteria: { type: 'count', target: 5, metric: 'cron_jobs_created' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'delegator', name: 'Delegator', description: 'Delegate 10 tasks to subagents', category: 'mastery', icon: '🤝', tier: 'silver', criteria: { type: 'count', target: 10, metric: 'delegated_tasks' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'receipt_auditor', name: 'Receipt Auditor', description: 'Query 20 receipts', category: 'security', icon: '📋', tier: 'bronze', criteria: { type: 'count', target: 20, metric: 'receipt_searches' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'streak_7', name: 'Full Week', description: 'Use Zavorth 7 days in a row', category: 'usage', icon: '🔥', tier: 'gold', criteria: { type: 'streak', target: 7, metric: 'daily_usage' }, unlocked: false, unlocked_at: null, progress: 0, hidden: false },
      { id: 'hidden_easter_egg', name: 'Hidden', description: '???', category: 'exploration', icon: '🥚', tier: 'platinum', criteria: { type: 'manual', target: 1, metric: 'easter_egg' }, unlocked: false, unlocked_at: null, progress: 0, hidden: true },
    ];
  }

  private loadUserStates(): void {
    const statesPath = path.join(this.storageDir, 'user_states.json');
    if (fs.existsSync(statesPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(statesPath, 'utf-8'));
        this.userStates = new Map(Object.entries(data));
      } catch (error: any) { /* ignore */ logger.warn('[Achievements] JSON parse failed', error); }
    }
  }

  private saveUserStates(): void {
    fs.writeFileSync(
      path.join(this.storageDir, 'user_states.json'),
      JSON.stringify(Object.fromEntries(this.userStates), null, 2),
      'utf-8',
    );
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.dirty) {
        this.dirty = false;
        this.saveUserStates();
      }
    }, AchievementsService.SAVE_DELAY_MS);
    if (this.saveTimer && typeof this.saveTimer === 'object' && 'unref' in this.saveTimer) {
      (this.saveTimer as NodeJS.Timeout).unref();
    }
  }

  public flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) {
      this.dirty = false;
      this.saveUserStates();
    }
  }

  public getUserState(userId: string): UserAchievementState {
    if (!this.userStates.has(userId)) {
      const state: UserAchievementState = {
        user_id: userId,
        total_points: 0,
        level: 1,
        unlocked_count: 0,
        achievements: {},
        streaks: {},
        stats: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      for (const achievement of this.achievements) {
        state.achievements[achievement.id] = { unlocked: false, progress: 0, unlocked_at: null };
      }
      this.userStates.set(userId, state);
      this.saveUserStates();
    }
    return this.userStates.get(userId)!;
  }

  public trackEvent(userId: string, metric: string, value: number = 1): string {
    const state = this.getUserState(userId);

    state.stats[metric] = (state.stats[metric] || 0) + value;
    state.updated_at = new Date().toISOString();

    const unlocked: string[] = [];
    for (const achievement of this.achievements) {
      if (achievement.criteria.metric !== metric) continue;
      const userAch = state.achievements[achievement.id];
      if (userAch.unlocked) continue;

      if (achievement.criteria.type === 'count') {
        userAch.progress = state.stats[metric] || 0;
        if (userAch.progress >= achievement.criteria.target) {
          userAch.unlocked = true;
          userAch.unlocked_at = new Date().toISOString();
          state.total_points += this.TIER_POINTS[achievement.tier];
          state.unlocked_count++;
          unlocked.push(achievement.name);
        }
      }
    }

    this.updateLevel(state);
    this.markDirty();

    if (unlocked.length > 0) {
      return `Event "${metric}" recorded (${value}). Achievement(s) unlocked: ${unlocked.join(', ')}!`;
    }
    return `Event "${metric}" recorded (${value}).`;
  }

  public updateStreak(userId: string, streakName: string): string {
    const state = this.getUserState(userId);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    if (!state.streaks[streakName]) {
      state.streaks[streakName] = { current: 1, best: 1, last_update: today };
    } else {
      const streak = state.streaks[streakName];
      const lastDate = new Date(streak.last_update);
      const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / 86400000);

      if (diffDays === 1) {
        streak.current++;
        streak.best = Math.max(streak.best, streak.current);
      } else if (diffDays > 1) {
        streak.current = 1;
      }
      streak.last_update = today;
    }

    state.updated_at = new Date().toISOString();
    this.markDirty();

    return `Streak "${streakName}": ${state.streaks[streakName].current} days (best: ${state.streaks[streakName].best}).`;
  }

  public unlockManually(userId: string, achievementId: string): string {
    const state = this.getUserState(userId);
    const achievement = this.achievements.find((a) => a.id === achievementId);
    if (!achievement) return `Achievement "${achievementId}" not found.`;

    const userAch = state.achievements[achievementId];
    if (userAch.unlocked) return `Achievement "${achievement.name}" already unlocked.`;

    userAch.unlocked = true;
    userAch.unlocked_at = new Date().toISOString();
    userAch.progress = achievement.criteria.target;
    state.total_points += this.TIER_POINTS[achievement.tier];
    state.unlocked_count++;
    state.updated_at = new Date().toISOString();

    this.updateLevel(state);
    this.markDirty();

    return `Achievement "${achievement.name}" manually unlocked! +${this.TIER_POINTS[achievement.tier]} points.`;
  }

  public getProfile(userId: string): string {
    const state = this.getUserState(userId);

    const lines: string[] = [
      `Achievements Profile: ${userId}`,
      `  Level: ${state.level}`,
      `  Points: ${state.total_points}`,
      `  Unlocked: ${state.unlocked_count}/${this.achievements.length}`,
      '',
      'Achievements:',
    ];

    const byCategory: Record<string, Achievement[]> = {};
    for (const ach of this.achievements) {
      if (!byCategory[ach.category]) byCategory[ach.category] = [];
      byCategory[ach.category].push(ach);
    }

    for (const [category, achievements] of Object.entries(byCategory)) {
      lines.push(`  [${category}]`);
      for (const ach of achievements) {
        if (ach.hidden && !state.achievements[ach.id]?.unlocked) continue;
        const userAch = state.achievements[ach.id];
        const icon = userAch?.unlocked ? '✅' : '⬜';
        const tier = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', diamond: '💠' }[ach.tier];
        const progress = userAch ? `${Math.min(userAch.progress, ach.criteria.target)}/${ach.criteria.target}` : '0/' + ach.criteria.target;
        lines.push(`    ${icon} ${ach.icon} ${tier} ${ach.name}: ${ach.description} [${progress}]`);
      }
    }

    if (Object.keys(state.streaks).length > 0) {
      lines.push('', 'Streaks:');
      for (const [name, streak] of Object.entries(state.streaks)) {
        lines.push(`  ${name}: ${streak.current} days (best: ${streak.best})`);
      }
    }

    return lines.join('\n');
  }

  public getLeaderboard(): string {
    const entries = Array.from(this.userStates.entries())
      .map(([id, state]) => ({ id, points: state.total_points, level: state.level, unlocked: state.unlocked_count }))
      .sort((a, b) => b.points - a.points);

    if (entries.length === 0) return 'No users with achievements.';

    const lines: string[] = ['Leaderboard:'];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      lines.push(`  ${medal} ${e.id}: Level ${e.level} | ${e.points} pts | ${e.unlocked} achievements`);
    }
    return lines.join('\n');
  }

  private updateLevel(state: UserAchievementState): void {
    for (let i = this.LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (state.total_points >= this.LEVEL_THRESHOLDS[i]) {
        state.level = i + 1;
        break;
      }
    }
  }
}
