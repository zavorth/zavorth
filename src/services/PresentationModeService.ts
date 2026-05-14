import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export type PresentationModeSnapshot = {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  note: string | null;
};

export class PresentationModeService {
  private snapshot: PresentationModeSnapshot;

  constructor(private readonly stateFile: string = config.presentationModeStateFile) {
    this.snapshot = this.load();
  }

  public isEnabled(): boolean {
    return this.snapshot.enabled;
  }

  public getStatus(): PresentationModeSnapshot {
    return { ...this.snapshot };
  }

  public enable(updatedBy: string | null = null, note: string | null = null): PresentationModeSnapshot {
    return this.setEnabled(true, updatedBy, note);
  }

  public disable(updatedBy: string | null = null, note: string | null = null): PresentationModeSnapshot {
    return this.setEnabled(false, updatedBy, note);
  }

  public setEnabled(enabled: boolean, updatedBy: string | null = null, note: string | null = null): PresentationModeSnapshot {
    this.snapshot = {
      enabled,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || null,
      note: note || null,
    };
    this.persist();
    return this.getStatus();
  }

  private load(): PresentationModeSnapshot {
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
      const parsed = JSON.parse(raw) as Partial<PresentationModeSnapshot>;
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
