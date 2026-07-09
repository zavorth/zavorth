import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';
import type {
IntelligenceFabricSnapshot,
  IntelligenceTaskEval,
  IntelligenceTaskKind,
} from '../contracts/native/IntelligenceFabricContract.js';

export type IntelligenceFabricEvalRecord = {
  schemaVersion: 1;
  recordedAt: string;
  source: 'shadow' | 'canary' | 'default';
  taskEval: IntelligenceTaskEval;
  routing: {
    modelId: string | null;
    providerId: string | null;
    routeId: string | null;
    ready: boolean;
  };
  safety: {
    rawSecretsSerialized: false;
    liveActionApplied: false;
    riskGate: string;
    verifierStatus: string;
    capabilityBuilderStatus: string;
  };
  lessons: string[];
};

export type IntelligenceFabricModelScore = {
  modelId: string;
  taskKind: IntelligenceTaskKind;
  total: number;
  success: number;
  blocked: number;
  averageLatencyMs: number;
  securityIssueRate: number;
};

type IntelligenceFabricLearningRuntime = {
  now?: () => Date;
  ledgerPath?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  appendFileSync?: typeof fs.appendFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class ZavorthIntelligenceFabricLearningService {
  private readonly now: () => Date;
  private readonly ledgerPath: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly appendFileSyncImpl: typeof fs.appendFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: IntelligenceFabricLearningRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.ledgerPath = runtime.ledgerPath || path.join(process.cwd(), 'data', 'intelligence-fabric-task-evals.jsonl');
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.appendFileSyncImpl = runtime.appendFileSync || fs.appendFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public recordSnapshot(input: {
    snapshot: IntelligenceFabricSnapshot;
    source?: 'shadow' | 'canary' | 'default';
  }): IntelligenceFabricEvalRecord {
    const record: IntelligenceFabricEvalRecord = {
      schemaVersion: 1,
      recordedAt: this.now().toISOString(),
      source: input.source || input.snapshot.mode,
      taskEval: input.snapshot.taskEval,
      routing: {
        modelId: input.snapshot.modelRouting.selectedModelId,
        providerId: input.snapshot.modelRouting.selectedProviderId,
        routeId: input.snapshot.modelRouting.selectedRouteId,
        ready: input.snapshot.modelRouting.ready,
      },
      safety: {
        rawSecretsSerialized: false,
        liveActionApplied: false,
        riskGate: input.snapshot.riskGate.overallDecision,
        verifierStatus: input.snapshot.verifier.status,
        capabilityBuilderStatus: input.snapshot.capabilityBuilder.status,
      },
      lessons: [
        ...input.snapshot.taskEval.lessons,
        ...input.snapshot.riskGate.receipts,
        ...input.snapshot.receipts,
      ],
    };
    this.appendRecord(record);
    return record;
  }

  public readRecords(): IntelligenceFabricEvalRecord[] {
    if (!this.existsSyncImpl(this.ledgerPath)) {
      return [];
    }
    return String(this.readFileSyncImpl(this.ledgerPath, 'utf8') || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as IntelligenceFabricEvalRecord;
        } catch (error: any) { logger.warn('[Zavorth Intelligence Fabric Learning] JSON parse failed', error); return null; }
      })
      .filter((record): record is IntelligenceFabricEvalRecord => Boolean(record));
  }

  public buildModelScoreboard(): IntelligenceFabricModelScore[] {
    const groups = new Map<string, IntelligenceFabricEvalRecord[]>();
    for (const record of this.readRecords()) {
      const modelId = record.routing.modelId || 'unselected';
      const key = `${modelId}::${record.taskEval.taskKind}`;
      const current = groups.get(key) || [];
      current.push(record);
      groups.set(key, current);
    }
    return Array.from(groups.entries()).map(([key, records]) => {
      const [modelId, taskKind] = key.split('::') as [string, IntelligenceTaskKind];
      const total = records.length || 1;
      return {
        modelId,
        taskKind,
        total: records.length,
        success: records.filter((record) => record.taskEval.success).length,
        blocked: records.filter((record) => record.safety.verifierStatus === 'blocked').length,
        averageLatencyMs: Math.round(records.reduce((sum, record) => sum + record.taskEval.latencyMs, 0) / total),
        securityIssueRate: Number((records.filter((record) => record.taskEval.securityIssuesFound).length / total).toFixed(3)),
      };
    });
  }

  private appendRecord(record: IntelligenceFabricEvalRecord): void {
    this.mkdirSyncImpl(path.dirname(this.ledgerPath), { recursive: true });
    if (!this.existsSyncImpl(this.ledgerPath)) {
      this.writeFileSyncImpl(this.ledgerPath, '', 'utf8');
    }
    this.appendFileSyncImpl(this.ledgerPath, `${JSON.stringify(record)}\n`, 'utf8');
  }
}
