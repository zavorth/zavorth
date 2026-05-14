import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import type { EngineeringRunSnapshot } from '../contracts/EngineeringCoreContract.js';

type EngineeringRunLedgerServiceOptions = {
  ledgerDir?: string;
};

export class EngineeringRunLedgerService {
  private readonly ledgerDir: string;

  constructor(options: EngineeringRunLedgerServiceOptions = {}) {
    this.ledgerDir =
      options.ledgerDir
      || path.resolve(config.dataDir, 'runtime', 'engineering-runs');
  }

  public nextRunId(): string {
    return `eng-${randomUUID()}`;
  }

  public listRuns(limit: number = 20): EngineeringRunSnapshot[] {
    if (!fs.existsSync(this.ledgerDir)) {
      return [];
    }

    return fs.readdirSync(this.ledgerDir)
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => this.readRun(path.join(this.ledgerDir, entry)))
      .filter((entry): entry is EngineeringRunSnapshot => Boolean(entry))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);
  }

  public getRun(runId: string): EngineeringRunSnapshot | null {
    const normalizedRunId = String(runId || '').trim();
    if (!normalizedRunId) {
      return null;
    }
    return this.readRun(this.resolveRunPath(normalizedRunId));
  }

  public saveRun(run: EngineeringRunSnapshot): EngineeringRunSnapshot {
    fs.mkdirSync(this.ledgerDir, { recursive: true });
    const snapshot: EngineeringRunSnapshot = {
      ...run,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(this.resolveRunPath(snapshot.runId), JSON.stringify(snapshot, null, 2), 'utf8');
    return snapshot;
  }

  private readRun(filePath: string): EngineeringRunSnapshot | null {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as EngineeringRunSnapshot;
    } catch {
      return null;
    }
  }

  private resolveRunPath(runId: string): string {
    return path.join(this.ledgerDir, `${runId}.json`);
  }
}
