/**
 * Session Checkpoint Recovery Service.
 * Persists atomic step snapshots at tool boundaries to enable instant crash recovery and uninterrupted turn resumption.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionStepCheckpoint {
  sessionId: string;
  stepIndex: number;
  totalSteps: number;
  lastCompletedTool: string;
  modifiedFiles: string[];
  pendingTask: string;
  timestamp: string;
}

export class SessionCheckpointRecoveryService {
  private static getCheckpointDir(): string {
    const localDir = path.join(process.cwd(), '.zavorth', 'checkpoints');
    if (!fs.existsSync(localDir)) {
      try {
        fs.mkdirSync(localDir, { recursive: true });
      } catch {
        const homeDir = path.join(os.homedir(), '.zavorth', 'checkpoints');
        if (!fs.existsSync(homeDir)) fs.mkdirSync(homeDir, { recursive: true });
        return homeDir;
      }
    }
    return localDir;
  }

  /**
   * Saves an atomic step checkpoint for a session.
   */
  static saveCheckpoint(checkpoint: SessionStepCheckpoint): void {
    const file = path.join(this.getCheckpointDir(), `${checkpoint.sessionId}.json`);
    try {
      fs.writeFileSync(file, JSON.stringify(checkpoint, null, 2), 'utf-8');
    } catch {
      // Safe non-blocking write
    }
  }

  /**
   * Retrieves pending checkpoint for a session.
   */
  static getCheckpoint(sessionId: string): SessionStepCheckpoint | null {
    const file = path.join(this.getCheckpointDir(), `${sessionId}.json`);
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Clears checkpoint upon clean session completion.
   */
  static clearCheckpoint(sessionId: string): void {
    const file = path.join(this.getCheckpointDir(), `${sessionId}.json`);
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Lists all pending recoverable checkpoints across sessions.
   */
  static listPendingCheckpoints(): SessionStepCheckpoint[] {
    const dir = this.getCheckpointDir();
    const checkpoints: SessionStepCheckpoint[] = [];

    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
              const parsed: SessionStepCheckpoint = JSON.parse(raw);
              if (parsed.sessionId && parsed.stepIndex !== undefined) {
                checkpoints.push(parsed);
              }
            } catch {
              // Ignore corrupt
            }
          }
        }
      }
    } catch {
      // Non-blocking
    }

    return checkpoints;
  }
}
