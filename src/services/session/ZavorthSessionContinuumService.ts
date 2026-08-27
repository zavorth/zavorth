import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { KanbanBoardState } from '../kanban/ZavorthKanbanBoardService.js';
import type { TrajectoryTurn } from '../compression/ZavorthTrajectoryCompressorService.js';
import { logger } from '../../logger.js';

export interface SessionContinuumSnapshot {
  readonly sessionId: string;
  readonly sessionTitle?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly kanbanState?: KanbanBoardState;
  readonly trajectoryTurns?: readonly TrajectoryTurn[];
  readonly trackedFiles?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export class ZavorthSessionContinuumService {
  private readonly storageDir: string;
  private readonly maxSnapshots: number;

  constructor(options?: { storageDir?: string; maxSnapshots?: number }) {
    this.storageDir = options?.storageDir || path.join(os.homedir(), '.zavorth', 'sessions');
    this.maxSnapshots = options?.maxSnapshots || 10;
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (err: unknown) {
      logger.warn('[ZavorthSessionContinuumService] Failed to create storage dir:', { error: err });
    }
  }

  public saveSnapshot(snapshot: SessionContinuumSnapshot): boolean {
    try {
      this.ensureStorageDir();
      const sanitizedId = snapshot.sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = path.join(this.storageDir, `${sanitizedId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');

      this.rotateSnapshots();
      return true;
    } catch (err: unknown) {
      logger.warn('[ZavorthSessionContinuumService] Failed to save snapshot:', { error: err });
      return false;
    }
  }

  public restoreSnapshot(sessionId: string): SessionContinuumSnapshot | null {
    try {
      const sanitizedId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = path.join(this.storageDir, `${sanitizedId}.json`);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content) as SessionContinuumSnapshot;
    } catch (err: unknown) {
      logger.warn('[ZavorthSessionContinuumService] Failed to restore snapshot:', { error: err });
      return null;
    }
  }

  public listSnapshots(): readonly SessionContinuumSnapshot[] {
    try {
      this.ensureStorageDir();
      const files = fs.readdirSync(this.storageDir).filter((f) => f.endsWith('.json'));
      const snapshots: SessionContinuumSnapshot[] = [];

      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(this.storageDir, file), 'utf8');
          snapshots.push(JSON.parse(content) as SessionContinuumSnapshot);
        } catch (error: unknown) { const err = error instanceof Error ? error : new Error(String(error)); logger.debug('[SessionContinuum] Failed to parse snapshot file', { file, error: err.message }); }
      }

      return snapshots.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  public deleteSnapshot(sessionId: string): boolean {
    try {
      const sanitizedId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = path.join(this.storageDir, `${sanitizedId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private rotateSnapshots(): void {
    try {
      const list = this.listSnapshots();
      if (list.length > this.maxSnapshots) {
        const toDelete = list.slice(this.maxSnapshots);
        for (const item of toDelete) {
          this.deleteSnapshot(item.sessionId);
        }
      }
    } catch (error: unknown) { const err = error instanceof Error ? error : new Error(String(error)); logger.debug('[SessionContinuum] Failed to rotate snapshots', { error: err.message }); }
  }
}
