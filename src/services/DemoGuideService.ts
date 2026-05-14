import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export type DemoGuideSession = {
  currentIndex: number;
  startedAt: string;
  updatedAt: string;
  completed: boolean;
};

type DemoGuideState = {
  sessions: Record<string, DemoGuideSession>;
};

export class DemoGuideService {
  private state: DemoGuideState;

  constructor(private readonly stateFile: string = config.demoGuideStateFile) {
    this.state = this.load();
  }

  public getSession(userId: string): DemoGuideSession | null {
    const session = this.state.sessions[String(userId || '').trim()];
    return session ? { ...session } : null;
  }

  public start(userId: string): DemoGuideSession {
    const now = new Date().toISOString();
    const key = String(userId || '').trim() || 'unknown';
    const session: DemoGuideSession = {
      currentIndex: 0,
      startedAt: now,
      updatedAt: now,
      completed: false,
    };

    this.state.sessions[key] = session;
    this.persist();
    return { ...session };
  }

  public next(userId: string, totalSteps: number): DemoGuideSession | null {
    const key = String(userId || '').trim() || 'unknown';
    const current = this.state.sessions[key];
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    const safeTotal = Math.max(0, totalSteps);
    if (safeTotal === 0) {
      current.updatedAt = now;
      current.completed = true;
      this.persist();
      return { ...current };
    }

    if (current.completed) {
      current.updatedAt = now;
      this.persist();
      return { ...current };
    }

    const nextIndex = current.currentIndex + 1;
    current.currentIndex = Math.min(nextIndex, safeTotal - 1);
    current.updatedAt = now;
    current.completed = nextIndex >= safeTotal;
    this.persist();
    return { ...current };
  }

  public reset(userId: string): boolean {
    const key = String(userId || '').trim() || 'unknown';
    if (!this.state.sessions[key]) {
      return false;
    }

    delete this.state.sessions[key];
    this.persist();
    return true;
  }

  private load(): DemoGuideState {
    if (!this.stateFile || !fs.existsSync(this.stateFile)) {
      return { sessions: {} };
    }

    try {
      const raw = fs.readFileSync(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DemoGuideState>;
      const sessions = Object.entries(parsed.sessions || {}).reduce<Record<string, DemoGuideSession>>(
        (acc, [userId, session]) => {
          if (!session || typeof session !== 'object') {
            return acc;
          }

          acc[userId] = {
            currentIndex: Number.isFinite((session as DemoGuideSession).currentIndex)
              ? Math.max(0, Math.trunc((session as DemoGuideSession).currentIndex))
              : 0,
            startedAt: (session as DemoGuideSession).startedAt || new Date(0).toISOString(),
            updatedAt: (session as DemoGuideSession).updatedAt || new Date(0).toISOString(),
            completed: Boolean((session as DemoGuideSession).completed),
          };
          return acc;
        },
        {},
      );

      return { sessions };
    } catch {
      return { sessions: {} };
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch {
      // Keep in-memory state even if persistence fails.
    }
  }
}
