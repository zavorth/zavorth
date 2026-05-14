import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export type OperatorModeSnapshot = {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  note: string | null;
};

export class OperatorModeService {
  private snapshot: OperatorModeSnapshot;

  constructor(private readonly stateFile: string = config.operatorModeStateFile) {
    this.snapshot = this.load();
  }

  public isEnabled(): boolean {
    return this.snapshot.enabled;
  }

  public getStatus(): OperatorModeSnapshot {
    return { ...this.snapshot };
  }

  public enable(updatedBy: string | null = null, note: string | null = null): OperatorModeSnapshot {
    return this.setEnabled(true, updatedBy, note);
  }

  public disable(updatedBy: string | null = null, note: string | null = null): OperatorModeSnapshot {
    return this.setEnabled(false, updatedBy, note);
  }

  public setEnabled(enabled: boolean, updatedBy: string | null = null, note: string | null = null): OperatorModeSnapshot {
    this.snapshot = {
      enabled,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || null,
      note: note || null,
    };
    this.persist();
    return this.getStatus();
  }

  private load(): OperatorModeSnapshot {
    if (!this.stateFile || !fs.existsSync(this.stateFile)) {
      return {
        enabled: false,
        updatedAt: null,
        updatedBy: null,
        note: null,
      };
    }

    try {
      const raw = fs.readFileSync(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as Partial<OperatorModeSnapshot>;
      return {
        enabled: Boolean(parsed.enabled),
        updatedAt: parsed.updatedAt || null,
        updatedBy: parsed.updatedBy || null,
        note: parsed.note || null,
      };
    } catch {
      return {
        enabled: false,
        updatedAt: null,
        updatedBy: null,
        note: null,
      };
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify(this.snapshot, null, 2), 'utf8');
    } catch {
      // Keep in-memory state even if persistence fails.
    }
  }
}
