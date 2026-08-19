import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../logger.js';

export interface SessionCheckpointOptions {
  basePath: string;
  maxCheckpointsPerSession?: number;
}

export interface SessionCheckpointData {
  sessionId: string;
  timestamp: string;
  checkpointId: string;
  messages: Array<{ role: string; content: string; timestamp: string }>;
  memory: Array<{ id: string; content: string; keywords: string[] }>;
  config: Record<string, unknown>;
  toolState: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

interface SessionRegistryEntry {
  data: Omit<SessionCheckpointData, 'sessionId' | 'timestamp'>;
  checkpoints: Array<{
    id: string;
    label: string;
    timestamp: string;
    filePath: string;
  }>;
}

export class SessionCheckpoint {
  private basePath: string;
  private maxCheckpointsPerSession: number;
  private sessionRegistry: Map<string, {
    data: Omit<SessionCheckpointData, 'sessionId' | 'timestamp'>;
    checkpoints: Array<{
      id: string;
      label: string;
      timestamp: string;
      filePath: string;
    }>;
  }>;

  constructor(options: SessionCheckpointOptions) {
    this.basePath = path.resolve(options.basePath || process.cwd());
    this.maxCheckpointsPerSession = options.maxCheckpointsPerSession || 100;
    this.sessionRegistry = new Map();
    fs.mkdirSync(this.basePath, { recursive: true });
  }

  registerSession(sessionId: string, data: Omit<SessionCheckpointData, 'sessionId' | 'timestamp'>): void {
    this.sessionRegistry.set(sessionId, {
      data,
      checkpoints: [],
    });
  }

  createCheckpoint(sessionId: string, label: string): { id: string; sessionId: string; number: number; data: SessionCheckpointData } {
    const sessionEntry = this.sessionRegistry.get(sessionId);
    if (!sessionEntry) {
      throw new Error(`Session ${sessionId} not registered`);
    }

    const timestamp = new Date().toISOString();
    const checkpointId = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const checkpointDir = path.join(this.basePath, sessionId);
    fs.mkdirSync(checkpointDir, { recursive: true });

    const checkpointData: SessionCheckpointData = {
      sessionId,
      timestamp,
      ...sessionEntry.data,
      checkpointId,
    };

    const filePath = path.join(this.basePath, sessionId, `${checkpointId}.json`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(checkpointData, null, 2), 'utf8');

    sessionEntry.checkpoints.push({
      id: checkpointId,
      label,
      timestamp,
      filePath,
    });

    this.pruneOldCheckpoints(sessionId);

    const checkpointNumber = sessionEntry.checkpoints.length;
    return { id: checkpointId, sessionId, number: checkpointNumber, data: checkpointData };
  }

  restoreCheckpoint(checkpointId: string): SessionCheckpointData | null {
    const sessions = fs.readdirSync(this.basePath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const sessionId of sessions) {
      const checkpointDir = path.join(this.basePath, sessionId);
      if (!fs.existsSync(checkpointDir)) continue;

      const files = fs.readdirSync(checkpointDir)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(this.basePath, sessionId, f));

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const data = JSON.parse(content);
          if (data.checkpointId === checkpointId || data.id === checkpointId) {
            return data;
          }
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  load(sessionId: string, checkpointId: string): SessionCheckpointData | null {
    const filePath = path.join(this.basePath, sessionId, `${checkpointId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content) as SessionCheckpointData;
    } catch (error) {
      logger.warn('[SessionCheckpoint] Failed to load checkpoint', { error, filePath });
      return null;
    }
  }

  list(sessionId: string): Array<{ id: string; timestamp: string }> {
    const checkpointDir = path.join(this.basePath, sessionId);
    if (!fs.existsSync(checkpointDir)) {
      return [];
    }

    const files = fs.readdirSync(checkpointDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        id: f.replace('.json', ''),
        timestamp: JSON.parse(fs.readFileSync(path.join(this.basePath, sessionId, f), 'utf8')).timestamp,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return files;
  }

  private pruneOldCheckpoints(sessionId: string): void {
    const checkpoints = this.list(sessionId);
    if (checkpoints.length > this.maxCheckpointsPerSession) {
      const toDelete = checkpoints.slice(this.maxCheckpointsPerSession);
      for (const cp of toDelete) {
        const filePath = path.join(this.basePath, sessionId, `${cp.id}.json`);
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          logger.warn('[SessionCheckpoint] Failed to prune checkpoint', { error, filePath });
        }
      }
    }
  }

  delete(sessionId: string, checkpointId: string): boolean {
    const filePath = path.join(this.basePath, sessionId, `${checkpointId}.json`);
    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      logger.warn('[SessionCheckpoint] Failed to delete checkpoint', { error, filePath });
      return false;
    }
  }
}