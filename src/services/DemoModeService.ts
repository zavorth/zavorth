import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export type DemoModeSnapshot = {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  note: string | null;
  autoPresentationEnabled: boolean;
};

export class DemoModeService {
  private snapshot: DemoModeSnapshot;

  constructor(private readonly stateFile: string = config.demoModeStateFile) {
    this.snapshot = this.load();
  }

  public isEnabled(): boolean {
    return this.snapshot.enabled;
  }

  public getStatus(): DemoModeSnapshot {
    return { ...this.snapshot };
  }

  public enable(
    updatedBy: string | null = null,
    note: string | null = null,
    autoPresentationEnabled = false,
  ): DemoModeSnapshot {
    return this.setState(true, updatedBy, note, autoPresentationEnabled);
  }

  public disable(updatedBy: string | null = null, note: string | null = null): DemoModeSnapshot {
    return this.setState(false, updatedBy, note, false);
  }

  private setState(
    enabled: boolean,
    updatedBy: string | null,
    note: string | null,
    autoPresentationEnabled: boolean,
  ): DemoModeSnapshot {
    this.snapshot = {
      enabled,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || null,
      note: note || null,
      autoPresentationEnabled: Boolean(autoPresentationEnabled),
    };
    this.persist();
    return this.getStatus();
  }

  private load(): DemoModeSnapshot {
    if (!this.stateFile || !fs.existsSync(this.stateFile)) {
      return {
        enabled: false,
        updatedAt: null,
        updatedBy: null,
        note: null,
        autoPresentationEnabled: false,
      };
    }

    try {
      const raw = fs.readFileSync(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DemoModeSnapshot>;
      return {
        enabled: Boolean(parsed.enabled),
        updatedAt: parsed.updatedAt || null,
        updatedBy: parsed.updatedBy || null,
        note: parsed.note || null,
        autoPresentationEnabled: Boolean(parsed.autoPresentationEnabled),
      };
    } catch {
      return {
        enabled: false,
        updatedAt: null,
        updatedBy: null,
        note: null,
        autoPresentationEnabled: false,
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
