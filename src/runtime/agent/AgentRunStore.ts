import * as fs from 'fs';
import * as path from 'path';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';export type AgentRunStore = {
  loadRuns: () => UniversalAgentRun[];
  saveRuns: (runs: UniversalAgentRun[]) => void;
};

export class MemoryAgentRunStore implements AgentRunStore {
  private runs: UniversalAgentRun[] = [];

  public loadRuns(): UniversalAgentRun[] {
    return [...this.runs];
  }

  public saveRuns(runs: UniversalAgentRun[]): void {
    this.runs = [...runs];
  }
}

export type JsonAgentRunStoreOptions = {
  filePath?: string;
  maxRuns?: number;
};

export class JsonAgentRunStore implements AgentRunStore {
  private readonly filePath: string;
  private readonly maxRuns: number;

  constructor(options: JsonAgentRunStoreOptions = {}) {
    this.filePath = options.filePath || path.resolve(process.cwd(), 'data', 'runtime', 'universal-agent-runs.json');
    this.maxRuns = Math.max(1, options.maxRuns || 200);
  }

  public loadRuns(): UniversalAgentRun[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const runs = Array.isArray(parsed?.runs) ? parsed.runs : Array.isArray(parsed) ? parsed : [];
      return runs
        .filter((run: unknown): run is UniversalAgentRun => (
          Boolean(run)
          && typeof run === 'object'
          && typeof (run as { id?: unknown }).id === 'string'
        ))
        .slice(0, this.maxRuns);
    } catch (error: unknown) {return [];
    }
  }

  public saveRuns(runs: UniversalAgentRun[]): void {
    const sortedRuns = [...runs]
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, this.maxRuns);
    const payload = {
      version: 'zavorth-universal-agent-runs/1',
      savedAt: new Date().toISOString(),
      runs: sortedRuns,
    };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }
}

export function createDefaultAgentRunStore(): JsonAgentRunStore {
  return new JsonAgentRunStore();
}
