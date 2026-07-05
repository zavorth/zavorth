import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';

export type TurnKind = 'user_message' | 'assistant_response' | 'tool_result' | 'approval' | 'error';

export type CapturedTurn = {
  id: string;
  timestamp: string;
  kind: TurnKind;
  content: string;
  surface: string | null;
  sessionId: string | null;
  userId: string | null;
  metadata: Record<string, unknown>;
};

export type TurnCaptureConfig = {
  enabled: boolean;
  maxTurnsPerSession: number;
  retentionDays: number;
  allowedSurfaces: string[] | null;
  minContentLength: number;
};

export type SurfaceStats = {
  name: string;
  turnCount: number;
  lastSeen: string;
};

export type TurnCaptureRuntime = {
  homeRoot?: string;
  now?: () => Date;
  config?: Partial<TurnCaptureConfig>;
};

const DEFAULT_CONFIG: TurnCaptureConfig = {
  enabled: true,
  maxTurnsPerSession: 500,
  retentionDays: 30,
  allowedSurfaces: null,
  minContentLength: 5,
};

const CAPTURE_FILE = 'data/runtime/user-turn-capture.jsonl';

export const KNOWN_SURFACES = [
  'cli', 'telegram', 'discord', 'whatsapp', 'slack', 'email',
  'signal', 'imessage', 'teams', 'instagram', 'matrix', 'irc',
  'line', 'feishu', 'google-chat', 'qq', 'zalo', 'wecom',
  'weixin', 'yuanbao', 'sms', 'home-assistant', 'voice-call',
  'google-meet', 'twitch', 'nextcloud-talk', 'mattermost',
  'synology-chat', 'nostr', 'simple',
  'zavorthControl', 'desktop', 'api', 'websocket', 'mcp',
  'satellite', 'companion', 'bridge', 'cron',
] as const;

export type KnownSurface = typeof KNOWN_SURFACES[number];

export class UserModelTurnCaptureService {
  private readonly homeRoot: string;
  private readonly now: () => Date;
  private readonly config: TurnCaptureConfig;
  private turnCount = 0;
  private surfaceCounts: Map<string, number> = new Map();
  private surfaceLastSeen: Map<string, string> = new Map();

  constructor(runtime: TurnCaptureRuntime = {}) {
    this.homeRoot = runtime.homeRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.config = { ...DEFAULT_CONFIG, ...runtime.config };
    this.loadSurfaceStats();
  }

  captureTurn(input: {
    kind: TurnKind;
    content: string;
    surface?: string | null;
    sessionId?: string | null;
    userId?: string | null;
    metadata?: Record<string, unknown>;
  }): CapturedTurn | null {
    if (!this.config.enabled) return null;
    if (!input.content || input.content.length < this.config.minContentLength) return null;

    const surface = this.normalizeSurface(input.surface);

    if (this.config.allowedSurfaces && surface && !this.config.allowedSurfaces.includes(surface)) {
      return null;
    }

    const turn: CapturedTurn = {
      id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: this.now().toISOString(),
      kind: input.kind,
      content: input.content.slice(0, 10000),
      surface,
      sessionId: input.sessionId || null,
      userId: input.userId || null,
      metadata: input.metadata || {},
    };

    if (surface) {
      this.surfaceCounts.set(surface, (this.surfaceCounts.get(surface) || 0) + 1);
      this.surfaceLastSeen.set(surface, turn.timestamp);
    }

    this.turnCount++;
    this.appendTurn(turn);
    return turn;
  }

  captureConversation(userMessage: string, assistantResponse: string, context?: {
    surface?: string;
    sessionId?: string;
    userId?: string;
    toolsUsed?: string[];
  }): [CapturedTurn | null, CapturedTurn | null] {
    const userTurn = this.captureTurn({
      kind: 'user_message',
      content: userMessage,
      surface: context?.surface,
      sessionId: context?.sessionId,
      userId: context?.userId,
    });

    const assistantTurn = this.captureTurn({
      kind: 'assistant_response',
      content: assistantResponse,
      surface: context?.surface,
      sessionId: context?.sessionId,
      userId: context?.userId,
      metadata: { toolsUsed: context?.toolsUsed || [] },
    });

    return [userTurn, assistantTurn];
  }

  getRecentTurns(limit = 50): CapturedTurn[] {
    const fp = this.getFilePath();
    if (!fs.existsSync(fp)) return [];

    try {
      const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean);
      return lines.slice(-limit).map((line) => JSON.parse(line) as CapturedTurn);
    } catch (error) { logger.warn('[User Model Turn Capture] JSON parse failed', error); return []; }
  }

  getTurnsBySession(sessionId: string): CapturedTurn[] {
    return this.getRecentTurns(1000).filter((t) => t.sessionId === sessionId);
  }

  getTurnsByUser(userId: string): CapturedTurn[] {
    return this.getRecentTurns(2000).filter((t) => t.userId === userId);
  }

  getTurnsByKind(kind: TurnKind, limit = 100): CapturedTurn[] {
    return this.getRecentTurns(2000).filter((t) => t.kind === kind).slice(-limit);
  }

  getTurnsBySurface(surface: string, limit = 100): CapturedTurn[] {
    return this.getRecentTurns(2000).filter((t) => t.surface === surface).slice(-limit);
  }

  getConversationPairs(limit = 20): Array<{ user: CapturedTurn; assistant: CapturedTurn }> {
    const turns = this.getRecentTurns(limit * 2);
    const pairs: Array<{ user: CapturedTurn; assistant: CapturedTurn }> = [];

    for (let i = 0; i < turns.length - 1; i++) {
      if (turns[i].kind === 'user_message' && turns[i + 1].kind === 'assistant_response') {
        pairs.push({ user: turns[i], assistant: turns[i + 1] });
        i++;
      }
    }

    return pairs.slice(-limit);
  }

  getSurfaceStats(): SurfaceStats[] {
    const stats: SurfaceStats[] = [];
    for (const [name, count] of this.surfaceCounts) {
      stats.push({
        name,
        turnCount: count,
        lastSeen: this.surfaceLastSeen.get(name) || '',
      });
    }
    return stats.sort((a, b) => b.turnCount - a.turnCount);
  }

  getActiveSurfaces(): string[] {
    return [...this.surfaceCounts.keys()].sort(
      (a, b) => (this.surfaceCounts.get(b) || 0) - (this.surfaceCounts.get(a) || 0),
    );
  }

  getStats(): { totalTurns: number; fileExists: boolean; fileSize: number; activeSurfaces: number } {
    const fp = this.getFilePath();
    const exists = fs.existsSync(fp);
    return {
      totalTurns: this.turnCount,
      fileExists: exists,
      fileSize: exists ? fs.statSync(fp).size : 0,
      activeSurfaces: this.surfaceCounts.size,
    };
  }

  pruneOldTurns(): number {
    const fp = this.getFilePath();
    if (!fs.existsSync(fp)) return 0;

    const cutoff = new Date(this.now().getTime() - this.config.retentionDays * 86400000).toISOString();
    const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean);
    const kept = lines.filter((line) => {
      try {
        const turn = JSON.parse(line) as CapturedTurn;
        return turn.timestamp >= cutoff;
      } catch (error) { logger.warn('[User Model Turn Capture] JSON parse failed', error); return false; }
    });

    fs.writeFileSync(fp, kept.join('\n') + (kept.length > 0 ? '\n' : ''), 'utf-8');
    return lines.length - kept.length;
  }

  private normalizeSurface(surface: string | null | undefined): string | null {
    if (!surface) return null;
    const normalized = surface.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return normalized || null;
  }

  private loadSurfaceStats(): void {
    const fp = this.getFilePath();
    if (!fs.existsSync(fp)) return;

    try {
      const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean);
      for (const line of lines) {
        const turn = JSON.parse(line) as CapturedTurn;
        if (turn.surface) {
          this.surfaceCounts.set(turn.surface, (this.surfaceCounts.get(turn.surface) || 0) + 1);
          const last = this.surfaceLastSeen.get(turn.surface) || '';
          if (turn.timestamp > last) {
            this.surfaceLastSeen.set(turn.surface, turn.timestamp);
          }
        }
      }
    } catch (error) { // ignore logger.warn('[User Model Turn Capture] JSON parse failed', error); }
  }

  private appendTurn(turn: CapturedTurn): void {
    const fp = this.getFilePath();
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(fp, JSON.stringify(turn) + '\n', 'utf-8');
  }

  private getFilePath(): string {
    return path.join(this.homeRoot, CAPTURE_FILE);
  }
}
